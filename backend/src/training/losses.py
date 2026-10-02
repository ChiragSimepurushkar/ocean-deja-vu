"""
src/training/losses.py
-----------------------
All loss functions used during supervised decoder training.

Depth weights
-------------
Surface levels matter most (SST-constrained), so they receive higher weight.
Weights are proportional to the expected predictive skill drop with depth
(empirically calibrated to North Indian Ocean dynamics).

DEPTH_WEIGHTS[i] corresponds to DEPTHS[i] = [0,5,10,20,30,50,75,100,125,150,200,300,500,700,1000].

Loss components
---------------
1. l_eof   — MSE on EOF coefficients (main training signal, fast convergence).
2. l_phys  — Depth-weighted MSE on physical temperature profiles (°C).
3. l_sm    — Vertical smoothness: penalise squared differences between
             adjacent depth levels (discourages un-physical discontinuities).
4. l_str   — Steric consistency: depth-integrated thermal expansion proxy
             should be consistent with observed SLA (optional, λ=0.05).

total_loss = l_eof + l_phys + 0.10*l_sm + 0.05*l_str
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


# ──────────────────────────────────────────────────────────────────────────────
# Depth metadata
# ──────────────────────────────────────────────────────────────────────────────

DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]

# Layer thicknesses (m) for depth integration (midpoint differences)
_DZ = torch.tensor(
    [5, 5, 5, 10, 10, 20, 25, 25, 25, 50, 100, 200, 200, 300],
    dtype=torch.float32,
)  # shape (14,) — one fewer than n_depths

# Per-level weights: higher at shallow depths where surface signals are informative
DEPTH_WEIGHTS = torch.tensor(
    [3.0, 3.0, 2.0, 2.0, 2.0, 1.5, 1.5, 1.0, 1.0, 1.0, 0.8, 0.6, 0.4, 0.3, 0.2],
    dtype=torch.float32,
)  # shape (15,)


# ──────────────────────────────────────────────────────────────────────────────
# Individual loss terms
# ──────────────────────────────────────────────────────────────────────────────

def eof_mse_loss(
    pred_eof: torch.Tensor,    # (B, n_modes, H, W)
    true_eof: torch.Tensor,    # (B, n_modes, H, W)
    mask: torch.Tensor,        # (B, H, W) — 1=ocean, 0=land
) -> torch.Tensor:
    """Mean-squared error on EOF coefficients, averaged over ocean pixels."""
    err = (pred_eof - true_eof) ** 2                    # (B, n_modes, H, W)
    ocean = mask.unsqueeze(1).float()                   # (B, 1, H, W)
    return (err * ocean).sum() / (ocean.sum() * pred_eof.shape[1] + 1e-8)


def depth_weighted_mse(
    pred_prof: torch.Tensor,   # (B, n_depths, H, W) in °C
    true_prof: torch.Tensor,   # (B, n_depths, H, W) in °C
    mask: torch.Tensor,        # (B, H, W)
) -> torch.Tensor:
    """Depth-weighted MSE on physical temperature profiles."""
    device = pred_prof.device
    w = DEPTH_WEIGHTS.to(device)[None, :, None, None]   # (1, 15, 1, 1)
    err = (pred_prof - true_prof) ** 2 * w              # (B, 15, H, W)
    ocean = mask.unsqueeze(1).float()                   # (B, 1, H, W)
    return (err * ocean).sum() / (ocean.sum() * w.mean() + 1e-8)


def vertical_smoothness_loss(prof: torch.Tensor) -> torch.Tensor:
    """
    Penalise large vertical gradients between consecutive depth levels.
    This discourages sharp thermal inversions not supported by surface signals.

    prof : (B, n_depths, H, W)
    """
    dz = prof[:, 1:] - prof[:, :-1]    # (B, 14, H, W)
    return (dz ** 2).mean()


def steric_consistency_loss(
    pred_prof: torch.Tensor,   # (B, n_depths, H, W) in °C
    sla: torch.Tensor,         # (B, H, W) in m — observed sea-level anomaly
    mask: torch.Tensor,        # (B, H, W)
    alpha_thermal: float = 2e-4,   # simplified thermal expansion coeff (/°C)
) -> torch.Tensor:
    """
    Encourage depth-integrated thermal expansion to be consistent with SLA.

    steric_pred ≈ alpha_thermal * ∑ T(z) * dz
    We want steric_pred ~ sla (after de-meaning).

    This is a soft physics constraint; its weight is small (0.05) to avoid
    dominating when T predictions are still poor early in training.

    pred_prof : (B, n_depths, H, W)
    sla        : (B, H, W)
    """
    device = pred_prof.device
    dz = _DZ.to(device)[None, :, None, None]    # (1, 14, 1, 1)
    # Integrate over the 14 layer thicknesses (from depth 0 to 700 m)
    steric_pred = (pred_prof[:, :-1] * alpha_thermal * dz).sum(dim=1)  # (B, H, W)

    # Normalise both to zero-mean (we only care about spatial patterns)
    ocean = mask.float()
    steric_pred_c = steric_pred - (steric_pred * ocean).sum() / (ocean.sum() + 1e-8)
    sla_c         = sla         - (sla         * ocean).sum() / (ocean.sum() + 1e-8)

    return F.mse_loss(steric_pred_c * ocean, sla_c * ocean)


# ──────────────────────────────────────────────────────────────────────────────
# Combined loss
# ──────────────────────────────────────────────────────────────────────────────

def total_loss(
    pred_eof:   torch.Tensor,   # (B, n_modes, H, W)
    true_eof:   torch.Tensor,   # (B, n_modes, H, W)
    pred_prof:  torch.Tensor,   # (B, n_depths, H, W) in °C
    true_prof:  torch.Tensor,   # (B, n_depths, H, W) in °C
    sla:        torch.Tensor,   # (B, H, W) sea-level anomaly in m
    mask:       torch.Tensor,   # (B, H, W) ocean mask
    w_eof:   float = 1.00,
    w_phys:  float = 1.00,
    w_sm:    float = 0.10,
    w_str:   float = 0.05,
) -> tuple[torch.Tensor, dict[str, float]]:
    """
    Compute weighted sum of all loss components.

    Returns
    -------
    loss : scalar total loss
    components : dict with individual loss values (for logging)
    """
    l_eof  = eof_mse_loss(pred_eof, true_eof, mask)
    l_phys = depth_weighted_mse(pred_prof, true_prof, mask)
    l_sm   = vertical_smoothness_loss(pred_prof)
    l_str  = steric_consistency_loss(pred_prof, sla, mask)

    loss = w_eof * l_eof + w_phys * l_phys + w_sm * l_sm + w_str * l_str

    components = {
        "loss_eof":    l_eof.item(),
        "loss_phys":   l_phys.item(),
        "loss_smooth": l_sm.item(),
        "loss_steric": l_str.item(),
        "loss_total":  loss.item(),
    }
    return loss, components
