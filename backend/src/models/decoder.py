"""
src/models/decoder.py
---------------------
EOF-coefficient decoder for the Ocean Deja Vu reconstruction system.

Maps encoder spatial feature maps (plus optional metadata) → EOF coefficients
→ 15-level temperature profiles.

Design:
  1. Upsample the low-res feature map (H/32, W/32) back to full domain (H, W)
     using bilinear interpolation.
  2. Apply a shared pixel-wise MLP (same weights at every grid cell) to map
     the embed_dim feature vector to `n_modes` EOF coefficients.
  3. The ProfileEOF object (owned by Dev 1's data pipeline) expands the
     coefficients into physical temperature profiles in °C.

The pixel-wise MLP approach lets the decoder learn a single function applied
identically across space, keeping parameter count small and avoiding border
artefacts.
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _build_mlp(
    in_dim: int, hidden: list[int], out_dim: int, dropout: float
) -> nn.Sequential:
    layers: list[nn.Module] = []
    prev = in_dim
    for h in hidden:
        layers += [nn.Linear(prev, h), nn.GELU(), nn.Dropout(dropout)]
        prev = h
    layers.append(nn.Linear(prev, out_dim))
    return nn.Sequential(*layers)


# ──────────────────────────────────────────────────────────────────────────────
# EOF Decoder
# ──────────────────────────────────────────────────────────────────────────────

class EOFDecoder(nn.Module):
    """
    Pixel-wise MLP that maps encoder embeddings → EOF coefficients.

    Parameters
    ----------
    embed_dim : int
        Encoder output channels.
    n_modes : int
        Number of EOF modes to predict (e.g. 40 captures ~99% variance).
    hidden : list[int]
        MLP hidden layer widths.
    dropout : float
        Dropout probability in the MLP.
    target_h, target_w : int
        Full-resolution domain size (101, 241).

    Forward
    -------
    Input : z — (B, embed_dim, h, w)  low-res feature map from encoder
    Output: (B, n_modes, H, W)  per-pixel EOF coefficients
    """

    def __init__(
        self,
        embed_dim: int = 128,
        n_modes: int = 40,
        hidden: list[int] | None = None,
        dropout: float = 0.10,
        target_h: int = 101,
        target_w: int = 241,
    ) -> None:
        super().__init__()
        self.n_modes = n_modes
        self.target_h = target_h
        self.target_w = target_w

        if hidden is None:
            hidden = [512, 256]

        self.mlp = _build_mlp(embed_dim, hidden, n_modes, dropout)
        self._init_weights()

    def _init_weights(self) -> None:
        for m in self.mlp.modules():
            if isinstance(m, nn.Linear):
                nn.init.trunc_normal_(m.weight, std=0.02)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def forward(self, z: torch.Tensor) -> torch.Tensor:
        """
        Parameters
        ----------
        z : (B, embed_dim, h, w)  encoder output at 1/32 resolution

        Returns
        -------
        coeffs : (B, n_modes, H, W)
        """
        # Upsample to full resolution
        z_up = F.interpolate(
            z, size=(self.target_h, self.target_w),
            mode="bilinear", align_corners=False
        )  # (B, embed_dim, H, W)

        B, D, H, W = z_up.shape

        # Pixel-wise MLP: reshape to (B*H*W, D), apply, reshape back
        z_flat = z_up.permute(0, 2, 3, 1).reshape(-1, D)  # (B*H*W, D)
        coeffs = self.mlp(z_flat)                           # (B*H*W, n_modes)
        coeffs = coeffs.reshape(B, H, W, -1).permute(0, 3, 1, 2)  # (B, n_modes, H, W)

        return coeffs


# ──────────────────────────────────────────────────────────────────────────────
# EOF ↔ Profile bridge (torch-native, for use inside the training loop)
# ──────────────────────────────────────────────────────────────────────────────

class TorchEOFBridge(nn.Module):
    """
    Wraps the sklearn-fitted EOF (PCA) components into a torch module
    so that EOF ↔ profile conversion happens on-device inside the
    training loop (enables end-to-end gradients through the decoding step).

    Parameters
    ----------
    components : np.ndarray  shape (n_modes, n_depths)
        PCA eigenvectors (pca.components_).
    mean : np.ndarray  shape (n_depths,)
        PCA mean (pca.mean_).
    """

    def __init__(self, components: np.ndarray, mean: np.ndarray) -> None:
        super().__init__()
        self.register_buffer("components", torch.from_numpy(components).float())
        self.register_buffer("mean_vec",   torch.from_numpy(mean).float())

    def decode(self, coeffs: torch.Tensor) -> torch.Tensor:
        """
        coeffs : (B, n_modes, H, W) or (N, n_modes)
        Returns profiles in the same spatial layout but last dim = n_depths.
        """
        if coeffs.ndim == 4:
            B, M, H, W = coeffs.shape
            flat = coeffs.permute(0, 2, 3, 1).reshape(-1, M)  # (B*H*W, M)
            prof = flat @ self.components + self.mean_vec       # (B*H*W, D)
            return prof.reshape(B, H, W, -1).permute(0, 3, 1, 2)  # (B, D, H, W)
        else:
            # (N, M)
            return coeffs @ self.components + self.mean_vec    # (N, D)

    def encode(self, profiles: torch.Tensor) -> torch.Tensor:
        """profiles: (..., n_depths) → (..., n_modes)"""
        centered = profiles - self.mean_vec
        return centered @ self.components.T

    @classmethod
    def from_sklearn(cls, pca) -> "TorchEOFBridge":
        """Construct from a fitted sklearn.decomposition.PCA object or ProfileEOF wrapper."""
        if hasattr(pca, "pca"):
            pca = pca.pca  # Extract from ProfileEOF wrapper
        return cls(
            components=pca.components_.astype(np.float32),
            mean=pca.mean_.astype(np.float32),
        )
