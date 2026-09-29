"""
src/models/mae.py
-----------------
Masked Autoencoder (MAE) wrapper for self-supervised pretraining of the
Ocean Deja Vu surface encoder.

Two complementary masking strategies:
  1. Pixel masking   – random 50 % of (H, W) spatial positions are zeroed.
  2. Channel drop    – one randomly chosen *obs* channel is zeroed entirely
                       (simulates missing SSS / wind sensors).

The lightweight pixel decoder is discarded after pretraining; only the frozen
encoder weights are forwarded to the supervised training stage.

Design notes:
  - The 4 coordinate channels (lat_sin, lon_cos, doy_sin, doy_cos) are never
    dropped — they are always available and the encoder must always see them.
  - Reconstruction loss is computed only on *masked* positions to avoid the
    trivial "copy the unmasked pixels" shortcut.
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

from src.models.encoder import SurfaceEncoder


# ──────────────────────────────────────────────────────────────────────────────
# Pixel decoder (lightweight; used only during pretraining)
# ──────────────────────────────────────────────────────────────────────────────

class _PixelDecoder(nn.Module):
    """
    Upsample encoder feature map back to input resolution and reconstruct
    all input channels.

    Input : (B, embed_dim, H/32, W/32)
    Output: (B, in_channels, H, W)
    """

    def __init__(
        self,
        embed_dim: int = 128,
        decoder_dim: int = 256,
        in_channels: int = 15,
        target_h: int = 100,
        target_w: int = 240,
    ) -> None:
        super().__init__()
        self.target_h = target_h
        self.target_w = target_w
        self.net = nn.Sequential(
            nn.Conv2d(embed_dim, decoder_dim, kernel_size=1),
            nn.GELU(),
            nn.Upsample(size=(target_h, target_w), mode="bilinear", align_corners=False),
            nn.Conv2d(decoder_dim, decoder_dim, kernel_size=3, padding=1),
            nn.GELU(),
            nn.Conv2d(decoder_dim, in_channels, kernel_size=1),
        )

    def forward(self, z: torch.Tensor) -> torch.Tensor:
        return self.net(z)


# ──────────────────────────────────────────────────────────────────────────────
# Masking helpers
# ──────────────────────────────────────────────────────────────────────────────

def _pixel_mask(
    B: int, H: int, W: int, ratio: float, device: torch.device
) -> torch.BoolTensor:
    """Return a (B, H, W) boolean mask where True = masked (zeroed)."""
    noise = torch.rand(B, H, W, device=device)
    return noise < ratio  # type: ignore[return-value]


def _channel_drop_mask(
    B: int, C: int, n_coord: int, prob: float, device: torch.device
) -> torch.BoolTensor:
    """
    Return a (B, C) boolean mask where True = channel dropped.
    Coord channels (last `n_coord`) are protected from dropping.
    At most one obs channel is dropped per sample.
    """
    obs_C = C - n_coord
    mask = torch.zeros(B, C, dtype=torch.bool, device=device)
    drop = torch.rand(B, device=device) < prob
    # Choose a random obs channel index per sample
    channel_idx = torch.randint(0, obs_C, (B,), device=device)
    for b in range(B):
        if drop[b]:
            mask[b, channel_idx[b]] = True
    return mask


# ──────────────────────────────────────────────────────────────────────────────
# OceanMAE
# ──────────────────────────────────────────────────────────────────────────────

class OceanMAE(nn.Module):
    """
    Masked Autoencoder for ocean surface fields.

    Parameters
    ----------
    encoder : SurfaceEncoder
    mask_ratio : float
        Fraction of spatial pixels to mask (default 0.5).
    channel_drop_prob : float
        Probability of dropping one obs channel per sample (default 0.2).
    decoder_dim : int
        Hidden width of the pixel decoder.
    n_coord_channels : int
        Number of coordinate channels (always protected from masking).
    target_h, target_w : int
        Spatial dimensions of the input field (100, 240 for the NIO domain).
    """

    def __init__(
        self,
        encoder: SurfaceEncoder,
        mask_ratio: float = 0.50,
        channel_drop_prob: float = 0.20,
        decoder_dim: int = 256,
        n_coord_channels: int = 4,
        target_h: int = 100,
        target_w: int = 240,
    ) -> None:
        super().__init__()
        self.encoder = encoder
        self.mask_ratio = mask_ratio
        self.channel_drop_prob = channel_drop_prob
        self.n_coord_channels = n_coord_channels

        self.pixel_decoder = _PixelDecoder(
            embed_dim=encoder.embed_dim,
            decoder_dim=decoder_dim,
            in_channels=encoder.in_channels,
            target_h=target_h,
            target_w=target_w,
        )

    # ------------------------------------------------------------------
    # Masking
    # ------------------------------------------------------------------

    def apply_masking(
        self, x: torch.Tensor
    ) -> tuple[torch.Tensor, torch.BoolTensor, torch.BoolTensor]:
        """
        Apply pixel masking + channel drop to `x`.

        Returns
        -------
        x_masked : same shape as x, with masked positions zeroed
        pixel_mask : (B, H, W) bool — True where pixels were zeroed
        chan_mask  : (B, C) bool    — True where channels were dropped
        """
        B, C, H, W = x.shape
        x = x.clone()

        # 1. Pixel masking
        pmask = _pixel_mask(B, H, W, self.mask_ratio, x.device)  # (B,H,W)
        x[pmask.unsqueeze(1).expand_as(x)] = 0.0

        # 2. Channel drop (obs channels only)
        cmask = _channel_drop_mask(
            B, C, self.n_coord_channels, self.channel_drop_prob, x.device
        )  # (B, C)
        x[cmask.unsqueeze(-1).unsqueeze(-1).expand_as(x)] = 0.0

        return x, pmask, cmask

    # ------------------------------------------------------------------
    # Forward
    # ------------------------------------------------------------------

    def forward(
        self, x: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Parameters
        ----------
        x : (B, C, H, W) normalised surface fields

        Returns
        -------
        loss   : scalar reconstruction loss on masked positions
        x_hat  : (B, C, H, W) full reconstruction
        pmask  : (B, H, W) pixel mask (for logging / visualisation)
        """
        x_masked, pmask, cmask = self.apply_masking(x)

        z = self.encoder(x_masked)            # (B, D, h, w)
        x_hat = self.pixel_decoder(z)         # (B, C, H, W)

        # Loss only on masked pixels (and for dropped channels on all pixels)
        # pixel_mask broadcast: (B, 1, H, W)
        combined_mask = pmask.unsqueeze(1).float()  # (B, 1, H, W)
        # Also include all dropped-channel positions
        chan_weight = (~cmask).float().unsqueeze(-1).unsqueeze(-1)  # (B,C,1,1)
        # We want to penalise reconstruction everywhere for dropped channels
        # and only at masked pixels for unmasked channels
        weight = torch.maximum(combined_mask.expand_as(x), 1 - chan_weight)

        loss = (weight * (x_hat - x) ** 2).sum() / (weight.sum() + 1e-8)
        return loss, x_hat, pmask
