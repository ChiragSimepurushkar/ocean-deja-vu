"""
tests/test_model_shapes.py
--------------------------
Shape-correctness tests for all ML components.

These tests use synthetic data (no real ocean data required) so they can
run in CI before any training data has been downloaded.

Run with: pytest tests/test_model_shapes.py -v
"""

from __future__ import annotations

import numpy as np
import pytest
import torch

from src.models.encoder import SurfaceEncoder
from src.models.mae import OceanMAE
from src.models.decoder import EOFDecoder, TorchEOFBridge
from src.models.retrieval import AnalogRetriever
from src.models.uncertainty import calibrate_conformal, apply_bands, ConformalCalibrator
from src.training.losses import (
    eof_mse_loss, depth_weighted_mse,
    vertical_smoothness_loss, steric_consistency_loss, total_loss,
)


# ──────────────────────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def device():
    return torch.device("cpu")


@pytest.fixture
def encoder(device):
    return SurfaceEncoder(in_channels=15, embed_dim=128).to(device)


@pytest.fixture
def decoder(device):
    return EOFDecoder(embed_dim=128, n_modes=40, target_h=100, target_w=240).to(device)


@pytest.fixture
def surface_batch(device):
    """Synthetic batch: B=2 daily snapshots, 15 channels, 100×240 grid."""
    return torch.randn(2, 15, 100, 240, device=device)


@pytest.fixture
def mask_batch(device):
    """Ocean mask: 80% ocean pixels."""
    m = (torch.rand(2, 100, 240) > 0.2).float()
    return m.to(device)


@pytest.fixture
def eof_bridge():
    """Synthetic TorchEOFBridge with random components."""
    components = np.random.randn(40, 15).astype(np.float32)
    mean_vec   = np.random.randn(15).astype(np.float32)
    return TorchEOFBridge(components, mean_vec)


# ──────────────────────────────────────────────────────────────────────────────
# Encoder tests
# ──────────────────────────────────────────────────────────────────────────────

class TestEncoder:
    def test_output_shape(self, encoder, surface_batch, device):
        out = encoder(surface_batch)
        B, D, h, w = out.shape
        assert B == 2
        assert D == 128
        assert h == 100 // 32      # 3 (100 / 32 = 3.125 → 3)
        assert w == 240 // 32      # 7 (240 / 32 = 7.5 → 7)

    def test_freeze_unfreeze(self, encoder):
        encoder.freeze()
        for p in encoder.parameters():
            assert not p.requires_grad

        encoder.unfreeze()
        for p in encoder.parameters():
            assert p.requires_grad

    def test_gradient_flows(self, encoder, surface_batch):
        encoder.unfreeze()
        out = encoder(surface_batch)
        out.mean().backward()
        # At least some gradients should be non-zero
        grads = [p.grad for p in encoder.parameters() if p.grad is not None]
        assert len(grads) > 0

    def test_different_in_channels(self, device):
        """Encoder should accept any number of input channels."""
        for c in [1, 3, 7, 15, 20]:
            enc = SurfaceEncoder(in_channels=c, embed_dim=64).to(device)
            x = torch.randn(1, c, 100, 240, device=device)
            out = enc(x)
            assert out.shape[1] == 64, f"Failed for in_channels={c}"


# ──────────────────────────────────────────────────────────────────────────────
# MAE tests
# ──────────────────────────────────────────────────────────────────────────────

class TestMAE:
    def test_output_shape(self, encoder, surface_batch, device):
        mae = OceanMAE(encoder, mask_ratio=0.5, channel_drop_prob=0.2,
                       target_h=100, target_w=240).to(device)
        loss, x_hat, pmask = mae(surface_batch)
        assert loss.ndim == 0              # scalar
        assert x_hat.shape == surface_batch.shape
        assert pmask.shape == (2, 100, 240)

    def test_loss_positive(self, encoder, surface_batch, device):
        mae = OceanMAE(encoder, target_h=100, target_w=240).to(device)
        loss, _, _ = mae(surface_batch)
        assert loss.item() >= 0

    def test_masking_zeroes_pixels(self, encoder, device):
        """Masked positions should be zeroed in the corrupted input."""
        mae = OceanMAE(encoder, mask_ratio=0.99, channel_drop_prob=0.0,
                       target_h=100, target_w=240).to(device)
        x = torch.ones(1, 15, 100, 240, device=device)
        x_masked, pmask, _ = mae.apply_masking(x)
        # Nearly all pixels should be 0 (99% mask ratio)
        zero_fraction = (x_masked == 0).float().mean().item()
        assert zero_fraction > 0.90, f"Expected >90% zeros, got {zero_fraction:.3f}"

    def test_coord_channels_not_dropped(self, encoder, device):
        """Last 4 channels (coord) must never be dropped by channel drop."""
        mae = OceanMAE(encoder, mask_ratio=0.0, channel_drop_prob=1.0,
                       n_coord_channels=4, target_h=100, target_w=240).to(device)
        x = torch.ones(4, 15, 100, 240, device=device)
        x_masked, _, cmask = mae.apply_masking(x)
        # Last 4 channels should remain 1.0
        assert (x_masked[:, -4:] == 1.0).all()


# ──────────────────────────────────────────────────────────────────────────────
# Decoder tests
# ──────────────────────────────────────────────────────────────────────────────

class TestDecoder:
    def test_output_shape(self, encoder, decoder, surface_batch, device):
        z = encoder(surface_batch)
        out = decoder(z)
        assert out.shape == (2, 40, 100, 240)

    def test_output_is_float(self, encoder, decoder, surface_batch):
        z = encoder(surface_batch)
        out = decoder(z)
        assert out.dtype == torch.float32

    def test_gradient_flows_through_decoder(self, encoder, decoder, surface_batch):
        z = encoder(surface_batch)
        out = decoder(z)
        out.mean().backward()
        grads = [p.grad for p in decoder.parameters() if p.grad is not None]
        assert len(grads) > 0


# ──────────────────────────────────────────────────────────────────────────────
# TorchEOFBridge tests
# ──────────────────────────────────────────────────────────────────────────────

class TestTorchEOFBridge:
    def test_encode_decode_roundtrip(self, eof_bridge):
        profiles = torch.randn(100, 15)
        coeffs   = eof_bridge.encode(profiles)
        recon    = eof_bridge.decode(coeffs)
        # Reconstruction won't be perfect with random components, but shapes must match
        assert recon.shape == profiles.shape

    def test_spatial_decode_shape(self, eof_bridge):
        coeffs = torch.randn(2, 40, 100, 240)
        prof   = eof_bridge.decode(coeffs)
        assert prof.shape == (2, 15, 100, 240)

    def test_from_sklearn(self):
        from sklearn.decomposition import PCA
        import numpy as np
        data = np.random.randn(500, 15)
        pca  = PCA(n_components=15).fit(data)
        bridge = TorchEOFBridge.from_sklearn(pca)
        assert bridge.components.shape == (15, 15)
        assert bridge.mean_vec.shape == (15,)


# ──────────────────────────────────────────────────────────────────────────────
# Loss function tests
# ──────────────────────────────────────────────────────────────────────────────

class TestLosses:
    def test_eof_mse_zero_for_perfect_prediction(self, device):
        pred = torch.randn(2, 40, 100, 240, device=device)
        mask = torch.ones(2, 100, 240, device=device)
        loss = eof_mse_loss(pred, pred, mask)
        assert loss.item() < 1e-6

    def test_depth_weighted_mse_positive(self, device):
        pred = torch.randn(2, 15, 100, 240, device=device)
        true = torch.randn(2, 15, 100, 240, device=device)
        mask = torch.ones(2, 100, 240, device=device)
        loss = depth_weighted_mse(pred, true, mask)
        assert loss.item() >= 0

    def test_smoothness_zero_for_constant_profile(self, device):
        # Constant temperature at all depths → zero smoothness loss
        prof = torch.ones(2, 15, 100, 240, device=device) * 28.0
        loss = vertical_smoothness_loss(prof)
        assert loss.item() < 1e-6

    def test_total_loss_returns_components(self, device):
        B, M, H, W = 2, 40, 100, 240
        pred_eof  = torch.randn(B, M, H, W, device=device)
        true_eof  = torch.randn(B, M, H, W, device=device)
        pred_prof = torch.randn(B, 15, H, W, device=device)
        true_prof = torch.randn(B, 15, H, W, device=device)
        sla       = torch.randn(B, H, W, device=device)
        mask      = torch.ones(B, H, W, device=device)

        loss, components = total_loss(
            pred_eof, true_eof, pred_prof, true_prof, sla, mask
        )
        assert loss.item() >= 0
        assert set(components.keys()) == {
            "loss_eof", "loss_phys", "loss_smooth", "loss_steric", "loss_total"
        }
        assert abs(components["loss_total"] - loss.item()) < 1e-5

    def test_land_mask_excludes_land_pixels(self, device):
        """Setting mask=0 for half the domain should not affect loss (those pixels ignored)."""
        pred = torch.randn(1, 40, 10, 10, device=device)
        true = torch.zeros(1, 40, 10, 10, device=device)
        mask_full = torch.ones(1, 10, 10, device=device)
        mask_half = mask_full.clone()
        mask_half[:, :, 5:] = 0   # right half = land

        loss_full = eof_mse_loss(pred, true, mask_full)
        loss_half = eof_mse_loss(pred, true, mask_half)
        # Half the ocean should give different (not necessarily smaller) loss
        assert loss_full.item() != loss_half.item()


# ──────────────────────────────────────────────────────────────────────────────
# Uncertainty tests
# ──────────────────────────────────────────────────────────────────────────────

class TestUncertainty:
    def test_conformal_calibration_coverage(self):
        """Calibrated intervals should achieve >= (1-alpha) coverage on the cal set."""
        np.random.seed(42)
        N, D = 500, 15
        pred = np.random.randn(N, D)
        true = pred + np.random.randn(N, D) * 0.5   # calibration set residuals

        alpha = 0.10
        q = calibrate_conformal(pred, true, alpha=alpha)

        # Check coverage on the same set (must be >= 1-alpha by construction)
        lo, hi = apply_bands(pred, np.zeros((N, D)), q)
        coverage = ((true >= lo) & (true <= hi)).mean(axis=0)
        assert (coverage >= (1 - alpha)).all(), \
            f"Coverage too low: min={coverage.min():.3f} < {1-alpha}"

    def test_conformal_quantile_shape(self):
        pred = np.random.randn(200, 15)
        true = np.random.randn(200, 15)
        q = calibrate_conformal(pred, true, alpha=0.10)
        assert q.shape == (15,)
        assert (q >= 0).all()

    def test_calibrator_save_load(self, tmp_path):
        pred = np.random.randn(100, 15).astype(np.float32)
        true = np.random.randn(100, 15).astype(np.float32)
        cal = ConformalCalibrator.fit(pred, true, alpha=0.10)

        path = str(tmp_path / "conformal.json")
        cal.save(path)
        cal2 = ConformalCalibrator.load(path)
        np.testing.assert_allclose(cal.q, cal2.q, rtol=1e-5)


# ──────────────────────────────────────────────────────────────────────────────
# End-to-end forward pass test
# ──────────────────────────────────────────────────────────────────────────────

class TestEndToEnd:
    def test_full_forward_pass(self, encoder, decoder, eof_bridge, surface_batch, mask_batch, device):
        """Encoder → Decoder → EOF Bridge → Loss — all shapes correct."""
        eof_bridge = eof_bridge.to(device)

        z = encoder(surface_batch)
        pred_eof = decoder(z)

        # Decode to profiles
        B, M, H, W = pred_eof.shape
        flat = pred_eof.permute(0, 2, 3, 1).reshape(-1, M)
        pred_prof = eof_bridge.decode(flat).reshape(B, H, W, 15).permute(0, 3, 1, 2)

        true_eof  = torch.randn_like(pred_eof)
        true_prof = torch.randn_like(pred_prof)
        sla       = torch.randn(B, H, W, device=device)

        loss, components = total_loss(pred_eof, true_eof, pred_prof, true_prof,
                                      sla, mask_batch)

        assert loss.ndim == 0
        assert loss.item() >= 0
        assert loss.item() < 1e4   # sanity: shouldn't be astronomically large
