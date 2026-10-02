"""
src/models/uncertainty.py
--------------------------
Conformal prediction calibration for the Ocean Deja Vu uncertainty module.

Method: Split conformal prediction (Angelopoulos & Bates 2022).
  1. Run the fused predictor on the *validation* set.
  2. Compute per-depth absolute residuals |pred - obs|.
  3. Take the (1 - alpha) empirical quantile per depth level.
  4. At test time, expand ± q(depth) around every prediction.

Calibration is conditioned on depth only (not space/season) for the prototype.
The conformal quantile is combined with the analog spread in quadrature to
produce a single uncertainty band:

    total_sigma(d) = sqrt(q_conformal(d)^2 + analog_spread(d)^2)

Calibration check (coverage):
  - For each depth, count what fraction of held-out ARGO observations fall
    within [pred - total_sigma, pred + total_sigma].
  - Target: >= (1 - alpha) = 90%.

References:
  - Angelopoulos & Bates (2022): "A Gentle Introduction to Conformal Prediction
    and Distribution-Free Uncertainty Quantification."
  - Romano et al. (2019): "Conformalized Quantile Regression."
"""

from __future__ import annotations

import json
import os

import numpy as np


# ──────────────────────────────────────────────────────────────────────────────
# Calibration
# ──────────────────────────────────────────────────────────────────────────────

def calibrate_conformal(
    pred_profiles: np.ndarray,   # (N, n_depths)
    true_profiles: np.ndarray,   # (N, n_depths)
    alpha: float = 0.10,
    finite_sample_correction: bool = True,
) -> np.ndarray:
    """
    Fit split-conformal quantiles from a held-out calibration set.

    Parameters
    ----------
    pred_profiles : (N, n_depths) model predictions on the calibration set
    true_profiles : (N, n_depths) corresponding ground-truth values
    alpha : miscoverage level (0.10 → target 90% coverage)
    finite_sample_correction : whether to apply the +1/(N+1) correction
        (recommended; guarantees marginal coverage at finite N)

    Returns
    -------
    q : (n_depths,) conformal quantile per depth level (always >= 0)
    """
    residuals = np.abs(pred_profiles - true_profiles)   # (N, n_depths)
    N = len(residuals)

    if finite_sample_correction:
        # Per Venn–Abers / standard conformal: ceil((N+1)(1-alpha)) / N
        level = min(1.0, np.ceil((N + 1) * (1 - alpha)) / N)
    else:
        level = 1.0 - alpha

    q = np.quantile(residuals, level, axis=0)           # (n_depths,)
    return q.astype(np.float32)


# ──────────────────────────────────────────────────────────────────────────────
# Applying the bands
# ──────────────────────────────────────────────────────────────────────────────

def apply_bands(
    pred: np.ndarray,            # (n_depths,)  or (N, n_depths)
    analog_spread: np.ndarray,   # same shape
    conformal_q: np.ndarray,     # (n_depths,)
) -> tuple[np.ndarray, np.ndarray]:
    """
    Combine the conformal quantile with the analog spread in quadrature.

    Returns
    -------
    lower : pred - total_sigma
    upper : pred + total_sigma
    """
    total_sigma = np.sqrt(conformal_q ** 2 + analog_spread ** 2)
    return pred - total_sigma, pred + total_sigma


# ──────────────────────────────────────────────────────────────────────────────
# Coverage diagnostics
# ──────────────────────────────────────────────────────────────────────────────

def coverage_report(
    pred: np.ndarray,          # (N, n_depths)
    lo:   np.ndarray,          # (N, n_depths) lower band
    hi:   np.ndarray,          # (N, n_depths) upper band
    true: np.ndarray,          # (N, n_depths)
    depths: list[int] | None = None,
) -> dict:
    """
    Compute per-depth empirical coverage and mean interval width.

    Returns a dict with keys 'depth', 'coverage', 'width' (each a list).
    """
    n_depths = pred.shape[1]
    depth_labels = depths or list(range(n_depths))

    covered = (true >= lo) & (true <= hi)   # (N, n_depths)
    coverage = covered.mean(axis=0)         # (n_depths,)
    width    = (hi - lo).mean(axis=0)       # (n_depths,)

    return {
        "depth":    depth_labels,
        "coverage": coverage.tolist(),
        "width":    width.tolist(),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Serialisation
# ──────────────────────────────────────────────────────────────────────────────

class ConformalCalibrator:
    """
    Stores conformal quantiles and exposes a clean predict-with-bands API.

    Usage:
        cal = ConformalCalibrator.fit(val_preds, val_true, alpha=0.10)
        cal.save("data/cache/conformal.json")

        # Later:
        cal = ConformalCalibrator.load("data/cache/conformal.json")
        lo, hi = cal.predict_bands(pred, analog_spread)
    """

    def __init__(self, q: np.ndarray, alpha: float, n_cal: int) -> None:
        self.q = q           # (n_depths,)
        self.alpha = alpha
        self.n_cal = n_cal

    @classmethod
    def fit(
        cls,
        pred_profiles: np.ndarray,
        true_profiles: np.ndarray,
        alpha: float = 0.10,
    ) -> "ConformalCalibrator":
        q = calibrate_conformal(pred_profiles, true_profiles, alpha)
        return cls(q=q, alpha=alpha, n_cal=len(pred_profiles))

    def predict_bands(
        self,
        pred: np.ndarray,
        analog_spread: np.ndarray,
    ) -> tuple[np.ndarray, np.ndarray]:
        return apply_bands(pred, analog_spread, self.q)

    def save(self, path: str) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump({
                "q": self.q.tolist(),
                "alpha": self.alpha,
                "n_cal": self.n_cal,
            }, f, indent=2)
        print(f"[ConformalCalibrator] Saved to {path}")

    @classmethod
    def load(cls, path: str) -> "ConformalCalibrator":
        with open(path) as f:
            d = json.load(f)
        return cls(
            q=np.array(d["q"], dtype=np.float32),
            alpha=d["alpha"],
            n_cal=d["n_cal"],
        )

    def __repr__(self) -> str:
        return (
            f"ConformalCalibrator(alpha={self.alpha}, n_cal={self.n_cal}, "
            f"q_mean={self.q.mean():.3f}°C)"
        )
