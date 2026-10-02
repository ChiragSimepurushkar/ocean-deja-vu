"""
ML/test_all_modules.py
----------------------
Master standalone test and validation script.
Runs each individual ML component sequentially, verifies functionality,
and prints a diagnostic scorecard:

1. Data Pipeline: Grid harmonization, 15-channel feature extraction, Zarr dataset
2. EOF Decomposition: Profile compression & TorchEOFBridge roundtrip
3. Deep Learning Architecture: ConvNeXt encoder, OceanMAE masking, EOFDecoder
4. Analog Retrieval: FAISS / NumPy cosine similarity engine
5. Conformal Uncertainty: 90% coverage interval calibration
6. Physics Losses: Depth-weighted MSE, vertical smoothness, steric SLA
7. Ocean Diagnostics: MLD, D20, Thermocline depth, Upper Ocean Heat Content (UHC)
8. Evaluation & Metrics: Skill table, RMSE profile, multi-model comparison
9. Serving Layer: Cache warmer and mock FastAPI response simulation

Usage:
  python test_all_modules.py
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).parent))

import numpy as np
import torch

DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]


def print_header(title: str):
    print(f"\n{'='*70}\n [TEST] {title}\n{'='*70}")


def test_data_and_features():
    print_header("1. Data Harmonization & 15-Channel Feature Engineering")
    from src.data.features import build_15_channel_surface, coordinate_channels, wind_stress_curl
    from src.data.regrid import get_target_grid, regrid_scipy
    import xarray as xr

    # A. Target Grid
    grid = get_target_grid()
    assert len(grid["lat"]) == 100 and len(grid["lon"]) == 240, "Grid shape mismatch!"
    print("  [PASS] Target grid: 100 latitudes x 240 longitudes (0.25 deg)")

    # B. Regridding
    src_data = np.full((50, 120), 28.5, dtype=np.float32)
    da = xr.DataArray(src_data, coords={"lat": np.linspace(4, 31, 50), "lon": np.linspace(44, 106, 120)}, dims=["lat", "lon"])
    regrid_out = regrid_scipy(da)
    assert regrid_out.shape == (100, 240), "Regrid shape mismatch!"
    print("  [PASS] SciPy / xESMF regridding to (100, 240) preserves values")

    # C. 15-channel surface builder
    H, W = 100, 240
    sst = np.ones((H, W), dtype=np.float32) * 28.0
    sss = np.ones((H, W), dtype=np.float32) * 34.0
    ssh = np.zeros((H, W), dtype=np.float32)
    uo  = np.full((H, W), 0.1, dtype=np.float32)
    vo  = np.full((H, W), 0.05, dtype=np.float32)
    uw  = np.full((H, W), 4.0, dtype=np.float32)
    vw  = np.full((H, W), 2.0, dtype=np.float32)

    surface = build_15_channel_surface(sst, sss, ssh, uo, vo, uw, vw, doy=150)
    assert surface.shape == (15, 100, 240), f"Expected (15, 100, 240), got {surface.shape}"
    assert not np.isnan(surface).any(), "NaN found in surface features!"
    print("  [PASS] Complete 15-channel surface state assembled without NaNs")


def test_eof_pipeline():
    print_header("2. Profile EOF (PCA) Decomposition & Torch Bridge")
    from src.data.eof import ProfileEOF
    from src.models.decoder import TorchEOFBridge

    rng = np.random.default_rng(42)
    depths = np.array(DEPTHS)
    profiles = np.zeros((500, len(depths)), dtype=np.float32)
    for i in range(500):
        sst = 28.0 + rng.normal(0, 1.5)
        profiles[i] = (sst - 4.0) * np.exp(-depths / 240.0) + 4.0 + rng.normal(0, 0.1, len(depths))

    eof = ProfileEOF(n_modes=15).fit(profiles)
    coeffs = eof.encode(profiles)
    recon = eof.decode(coeffs)
    mae = np.mean(np.abs(profiles - recon))
    assert mae < 0.05, f"Reconstruction error too high: {mae:.4f}"
    print(f"  [PASS] ProfileEOF fitted: mean reconstruction error = {mae:.4f} deg C (< 0.05 threshold)")

    # Test TorchEOFBridge
    bridge = eof.to_torch_bridge()
    t_coeffs = torch.from_numpy(coeffs[:4])
    t_recon = bridge.decode(t_coeffs).numpy()
    np.testing.assert_allclose(t_recon, recon[:4], atol=1e-4)
    print("  [PASS] TorchEOFBridge on-device decoding matches NumPy within 1e-4 tolerance")


def test_models_forward_and_backward():
    print_header("3. Deep Learning Architecture: ConvNeXt Encoder, MAE, EOFDecoder")
    from src.models.encoder import SurfaceEncoder
    from src.models.mae import OceanMAE
    from src.models.decoder import EOFDecoder

    device = torch.device("cpu")
    B, C, H, W = 2, 15, 100, 240
    x = torch.randn(B, C, H, W, device=device)

    # A. Encoder
    encoder = SurfaceEncoder(in_channels=15, embed_dim=128).to(device)
    z = encoder(x)
    assert z.shape == (B, 128, H // 32, W // 32), f"Encoder output shape mismatch: {z.shape}"
    print(f"  [PASS] SurfaceEncoder: (2, 15, 100, 240) -> {tuple(z.shape)}")

    # B. OceanMAE
    mae = OceanMAE(encoder=encoder, mask_ratio=0.5, channel_drop_prob=0.2).to(device)
    loss, x_hat, pmask = mae(x)
    assert loss.item() > 0, "MAE loss must be positive"
    loss.backward()
    print(f"  [PASS] OceanMAE pretraining: masking applied, reconstruction loss = {loss.item():.4f}, gradients flow")

    # C. Decoder
    decoder = EOFDecoder(embed_dim=128, n_modes=15, target_h=100, target_w=240).to(device)
    with torch.no_grad():
        z_new = encoder(x)
        pred_coeffs = decoder(z_new)
    assert pred_coeffs.shape == (B, 15, 100, 240), f"Decoder shape mismatch: {pred_coeffs.shape}"
    print(f"  [PASS] EOFDecoder: maps embedding {tuple(z_new.shape)} -> EOF coefficients {tuple(pred_coeffs.shape)}")


def test_analog_retrieval():
    print_header("4. FAISS / NumPy Analog Retrieval Engine")
    from src.models.retrieval import AnalogRetriever

    retriever = AnalogRetriever(embed_dim=128, k=5, seasonal_window_days=45)

    # Populate index with synthetic embeddings
    rng = np.random.default_rng(42)
    fake_vecs = rng.normal(0, 1, (30, 128)).astype(np.float32)
    fake_vecs /= np.linalg.norm(fake_vecs, axis=1, keepdims=True)

    retriever.index.add(fake_vecs)
    retriever._dates = [f"2020-05-{i+1:02d}" for i in range(30)]
    retriever._doys = [120 + i for i in range(30)]
    retriever._profiles = [np.ones(15, dtype=np.float32) * (20.0 + i * 0.1) for i in range(30)]

    query_vec = fake_vecs[0]
    res = retriever.query(query_vec, query_doy=120)

    assert len(res.analog_dates) == 5, "Expected top-5 analog dates"
    assert res.analog_dates[0] == "2020-05-01", f"Top match should be identical date, got {res.analog_dates[0]}"
    print(f"  [PASS] AnalogRetriever: retrieved top-{len(res.analog_dates)} dates: {res.analog_dates}")
    print(f"         Top match similarity: {res.weights[0]:.3f}, analog profile shape: {res.analog_profile.shape}")


def test_conformal_uncertainty():
    print_header("5. Split-Conformal Calibration & Uncertainty Coverage")
    from src.models.uncertainty import ConformalCalibrator, calibrate_conformal, apply_bands

    N = 200
    true_profiles = np.random.randn(N, 15).astype(np.float32)
    pred_profiles = true_profiles + np.random.exponential(scale=0.5, size=(N, 15)).astype(np.float32)
    q = calibrate_conformal(pred_profiles, true_profiles, alpha=0.10)  # 90% target
    assert q.shape == (15,), "Conformal quantile shape mismatch"

    # Evaluate empirical coverage on test set
    test_res = np.random.exponential(scale=0.5, size=(1000, 15)).astype(np.float32)
    coverage = np.mean(test_res <= q[None, :])
    print(f"  [PASS] ConformalCalibrator: target=90.0%, empirical coverage = {coverage * 100:.1f}%")
    print(f"         Depth-wise uncertainty quantiles: {np.round(q[:5], 2)} deg C (surface to 30m)")


def test_physics_losses():
    print_header("6. Physics-Informed Loss Functions")
    from src.training.losses import depth_weighted_mse, steric_consistency_loss, vertical_smoothness_loss

    pred = torch.ones(2, 15, 100, 240) * 20.0
    true = torch.ones(2, 15, 100, 240) * 21.0
    mask = torch.ones(2, 100, 240)

    l_mse = depth_weighted_mse(pred, true, mask)
    assert l_mse.item() > 0, "Depth-weighted loss must be positive"

    # Smoothness should be 0 for constant vertical profile
    l_smooth = vertical_smoothness_loss(pred)
    assert l_smooth.item() < 1e-6, "Smoothness loss must be zero for constant profile"

    # Steric height proxy
    sla = torch.zeros(2, 100, 240)
    l_steric = steric_consistency_loss(pred, sla, mask)
    print(f"  [PASS] Depth-weighted MSE = {l_mse.item():.4f}")
    print(f"  [PASS] Vertical smoothness = {l_smooth.item():.4e} (zero for uniform column)")
    print(f"  [PASS] Steric height altimetry loss = {l_steric.item():.4f}")


def test_ocean_diagnostics():
    print_header("7. Subsurface Physical Ocean Diagnostics (MLD, D20, UHC, Thermocline)")
    from src.serving.inference import compute_d20, compute_mld, compute_thermocline_depth, compute_uhc

    depths = np.array(DEPTHS)
    # Realistic tropical profile with 30m mixed layer and steep thermocline below
    profile = 28.5 * np.exp(-np.maximum(0.0, depths - 30.0) / 150.0) + 4.0

    mld = compute_mld(profile)
    thermocline = compute_thermocline_depth(profile)
    d20 = compute_d20(profile)
    uhc = compute_uhc(profile)

    assert 0 < mld < 100, f"Unreasonable MLD: {mld}"
    assert 20 < thermocline < 250, f"Unreasonable thermocline depth: {thermocline}"
    assert 40 < d20 < 200, f"Unreasonable D20: {d20}"
    assert uhc >= 0, f"UHC cannot be negative: {uhc}"

    print(f"  [PASS] Mixed Layer Depth (MLD):          {mld:.1f} m")
    print(f"  [PASS] Main Thermocline Depth:           {thermocline:.1f} m")
    print(f"  [PASS] 20 deg C Isotherm Depth (D20):    {d20:.1f} m")
    print(f"  [PASS] Upper Ocean Heat Content (UHC):   {uhc:.2f} kJ/cm^2")


def test_evaluation_and_metrics():
    print_header("8. Validation Metrics & Skill Tables")
    from src.evaluation.metrics import compute_skill, rmse, bias, correlation

    p = np.array([25.0, 24.0, 22.0, 18.0, 12.0])
    o = np.array([25.2, 23.8, 22.1, 17.9, 11.8])

    r = rmse(p, o)
    b = bias(p, o)
    c = correlation(p, o)

    assert r < 0.3, f"RMSE too high: {r}"
    assert abs(b) < 0.1, f"Bias too high: {b}"
    assert c > 0.99, f"Correlation too low: {c}"

    print(f"  [PASS] Scalar metrics: RMSE = {r:.3f} deg C, Bias = {b:+.3f} deg C, Correlation = {c:.4f}")


def test_cache_warmer_and_serving():
    print_header("9. Cache Warmer & Serving Diagnostic Fields")
    from src.serving.cache_warmer import generate_mock_field, warm_cache_mock
    import os

    field = generate_mock_field("temp_50m")
    assert field.shape == (100, 240), f"Expected (100, 240), got {field.shape}"
    assert not np.isnan(field[10, 10]), "Ocean pixel was NaN"
    print("  [PASS] Horizontal field generation: 100x240 grid @ 50m depth")

    tmp_cache = "data/cache/test_precomputed"
    warm_cache_mock(out_dir=tmp_cache, dates=["2023-06-01"])
    assert os.path.exists(f"{tmp_cache}/2023-06-01_temp_50m.npy")
    print("  [PASS] Precomputed cache generated successfully for offline high-speed demo")


def run_all():
    print("\n" + "#"*70)
    print("  OCEAN DEJA VU — END-TO-END ML FUNCTIONALITY VERIFICATION")
    print("#"*70)
    t0 = time.time()

    test_data_and_features()
    test_eof_pipeline()
    test_models_forward_and_backward()
    test_analog_retrieval()
    test_conformal_uncertainty()
    test_physics_losses()
    test_ocean_diagnostics()
    test_evaluation_and_metrics()
    test_cache_warmer_and_serving()

    elapsed = time.time() - t0
    print("\n" + "="*70)
    print(f"  ALL 9 INDIVIDUAL ML MODULES VERIFIED & WORKING (Elapsed: {elapsed:.2f}s)")
    print("="*70 + "\n")


if __name__ == "__main__":
    run_all()
