"""
src/evaluation/ablation.py
---------------------------
Automated ablation runner for Ocean Deja Vu.

Five ablation variants (from plan_v1.md §9):

| Experiment  | Description                                         |
|-------------|-----------------------------------------------------|
| no_pretrain | Random encoder weights, supervised training only    |
| no_eof      | Decoder predicts 15 depths directly (no EOF trick)  |
| no_steric   | Remove steric consistency loss (w_str = 0)          |
| no_analog   | Pure decoder output, no retrieval fusion            |
| full_model  | All components enabled                              |

Each variant is trained, then evaluated with compute_skill() and the results
are logged to a single W&B project for side-by-side comparison.

Usage:
    python -m src.evaluation.ablation \
        --variants full_model no_pretrain no_eof no_steric no_analog \
        --store_path data/processed/ocean_odv.zarr \
        --eof_path data/cache/eof.pkl \
        --argo_path data/processed/argo_collocated.parquet

This module also serves as the canonical table generator for the SIH report:
    df = run_ablation_table(...)
    df.to_latex("report/ablation_table.tex")
"""

from __future__ import annotations

import argparse
import copy
import pickle
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import torch

from src.models.encoder import SurfaceEncoder
from src.models.decoder import EOFDecoder, TorchEOFBridge
from src.models.retrieval import AnalogRetriever
from src.models.uncertainty import ConformalCalibrator
from src.evaluation.metrics import compute_skill, rmse_profile, compare_models
from src.evaluation.argo_colloc import to_profile_arrays
from src.training.supervised import ReconstructionLightning
from src.training.losses import DEPTHS


# ──────────────────────────────────────────────────────────────────────────────
# Variant configs
# ──────────────────────────────────────────────────────────────────────────────

VARIANT_DEFAULTS = {
    "full_model":  {"use_pretrain": True,  "use_eof": True,  "w_str": 0.05, "use_analog": True},
    "no_pretrain": {"use_pretrain": False, "use_eof": True,  "w_str": 0.05, "use_analog": True},
    "no_eof":      {"use_pretrain": True,  "use_eof": False, "w_str": 0.05, "use_analog": True},
    "no_steric":   {"use_pretrain": True,  "use_eof": True,  "w_str": 0.00, "use_analog": True},
    "no_analog":   {"use_pretrain": True,  "use_eof": True,  "w_str": 0.05, "use_analog": False},
}


# ──────────────────────────────────────────────────────────────────────────────
# Direct decoder (no EOF) — used by no_eof variant
# ──────────────────────────────────────────────────────────────────────────────

class DirectDecoder(torch.nn.Module):
    """Predicts 15 depth levels directly (no EOF compression)."""
    def __init__(self, embed_dim: int = 128, n_depths: int = 15,
                 hidden=(512, 256), dropout: float = 0.10,
                 target_h: int = 100, target_w: int = 240):
        super().__init__()
        import torch.nn as nn
        import torch.nn.functional as F
        self.target_h = target_h
        self.target_w = target_w
        layers = []
        prev = embed_dim
        for h in hidden:
            layers += [nn.Linear(prev, h), nn.GELU(), nn.Dropout(dropout)]
            prev = h
        layers.append(nn.Linear(prev, n_depths))
        self.mlp = nn.Sequential(*layers)

    def forward(self, z: torch.Tensor) -> torch.Tensor:
        import torch.nn.functional as F
        z_up = F.interpolate(z, size=(self.target_h, self.target_w),
                             mode="bilinear", align_corners=False)
        B, D, H, W = z_up.shape
        flat = z_up.permute(0, 2, 3, 1).reshape(-1, D)
        out  = self.mlp(flat)                           # (B*H*W, 15)
        return out.reshape(B, H, W, -1).permute(0, 3, 1, 2)  # (B, 15, H, W)


# ──────────────────────────────────────────────────────────────────────────────
# Inference helper: run model on a test dataloader
# ──────────────────────────────────────────────────────────────────────────────

@torch.no_grad()
def predict_on_dataloader(
    encoder: SurfaceEncoder,
    decoder: torch.nn.Module,
    eof_bridge: Optional[TorchEOFBridge],
    dataloader,
    retriever: Optional[AnalogRetriever],
    calibrator: Optional[ConformalCalibrator],
    blend_weight: float,
    device: torch.device,
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """
    Run full inference pipeline on a dataloader.

    Returns
    -------
    preds  : (N, n_depths) model predictions in °C
    trues  : (N, n_depths) ARGO observations in °C
    dates  : (N,) date strings
    """
    encoder.eval()
    decoder.eval()

    all_preds, all_trues, all_dates = [], [], []

    for batch in dataloader:
        if len(batch) >= 4:
            surface, true_eof, mask, sla = batch[:4]
            date_strs = batch[4] if len(batch) > 4 else []
        else:
            surface, true_eof, mask = batch[:3]
            sla = torch.zeros(surface.shape[0], surface.shape[2], surface.shape[3])
            date_strs = []

        surface = surface.to(device)
        z = encoder(surface)                               # (B, D, h, w)
        pred_raw = decoder(z)                              # (B, M or 15, H, W)

        if eof_bridge is not None:
            # EOF decoder path
            pred_prof = eof_bridge.decode(
                pred_raw.permute(0, 2, 3, 1).reshape(-1, pred_raw.shape[1])
            )  # (B*H*W, 15)
        else:
            # Direct decoder path
            pred_prof = pred_raw.permute(0, 2, 3, 1).reshape(-1, pred_raw.shape[1])

        # For metrics we just use the spatial mean as a single profile per day
        # In practice, ARGO collocation matches specific grid cells
        B = surface.shape[0]
        pred_mean = pred_prof.reshape(B, -1, pred_prof.shape[-1]).mean(dim=1)  # (B, 15)

        if eof_bridge is not None:
            true_prof = eof_bridge.decode(
                true_eof.permute(0, 2, 3, 1).reshape(-1, true_eof.shape[1]).to(device)
            ).reshape(B, -1, 15).mean(dim=1)  # (B, 15)
        else:
            true_prof = true_eof.permute(0, 2, 3, 1).reshape(B, -1, 15).mean(dim=1).to(device)

        # Analog fusion
        if retriever is not None and date_strs:
            fused = []
            z_mean = z.mean(dim=[-2, -1])                  # (B, D)
            z_norm = (z_mean / (z_mean.norm(dim=-1, keepdim=True) + 1e-8)).cpu().numpy()
            from datetime import date as _date
            for b in range(B):
                ds = date_strs[b] if b < len(date_strs) else "2023-01-01"
                doy = _date.fromisoformat(ds).timetuple().tm_yday
                ar = retriever.query(z_norm[b], doy)
                fp = retriever.fuse(pred_mean[b].cpu().numpy(), ar, blend_weight)
                fused.append(fp)
            pred_mean = torch.tensor(np.stack(fused), device=device)

        all_preds.append(pred_mean.cpu().numpy())
        all_trues.append(true_prof.cpu().numpy())
        all_dates.extend(list(date_strs) if date_strs else [""] * B)

    return np.concatenate(all_preds), np.concatenate(all_trues), all_dates


# ──────────────────────────────────────────────────────────────────────────────
# Main ablation runner
# ──────────────────────────────────────────────────────────────────────────────

def run_ablation_table(
    variants: list[str],
    store_path: str,
    eof_path: str,
    pretrained_encoder_ckpt: str,
    stage2_ckpt: str,
    argo_parquet: str,
    retriever_cache: str = "data/cache",
    blend_weight: float = 0.30,
    conformal_alpha: float = 0.10,
    device_str: str = "cuda" if torch.cuda.is_available() else "cpu",
    batch_size: int = 8,
    num_workers: int = 4,
) -> pd.DataFrame:
    """
    Train / evaluate all requested ablation variants and return a combined
    skill DataFrame with a 'model' column.

    NOTE: For the hackathon, this function loads *pre-trained* checkpoints
    rather than re-training from scratch for every ablation.
    Full training ablations are left for the week-4 schedule.
    """
    device = torch.device(device_str)

    # Load shared resources
    with open(eof_path, "rb") as f:
        pca = pickle.load(f)
    eof_bridge = TorchEOFBridge.from_sklearn(pca)

    argo_df = pd.read_parquet(argo_parquet)
    _, lons_argo, months_argo, obs_temps = to_profile_arrays(argo_df)
    lats_argo = argo_df["lat"].values

    try:
        from src.data.zarr_store import make_dataloaders
        _, val_dl, test_dl = make_dataloaders(
            store_path, batch_size=batch_size, num_workers=num_workers,
            return_sla=True, return_dates=True, split="test"
        )
    except ImportError:
        raise RuntimeError("Zarr store not found — run Dev 1 pipeline first.")

    all_preds: dict[str, np.ndarray] = {}

    for variant in variants:
        print(f"\n[ablation] Evaluating variant: {variant}")
        cfg = VARIANT_DEFAULTS.get(variant, VARIANT_DEFAULTS["full_model"])

        # Build encoder
        encoder = SurfaceEncoder(in_channels=15, embed_dim=128)
        if cfg["use_pretrain"]:
            state = torch.load(pretrained_encoder_ckpt, map_location="cpu")
            sd = {k.replace("mae.encoder.", ""): v
                  for k, v in state.get("state_dict", state).items()
                  if "encoder" in k}
            encoder.load_state_dict(sd, strict=False)
        # else: random init

        # Build decoder
        if cfg["use_eof"]:
            decoder = EOFDecoder(embed_dim=128, n_modes=40)
            bridge  = eof_bridge
        else:
            decoder = DirectDecoder(embed_dim=128, n_depths=15)
            bridge  = None

        # Load stage-2 checkpoint if available (for full_model)
        if variant == "full_model" and Path(stage2_ckpt).exists():
            ckpt = torch.load(stage2_ckpt, map_location="cpu")
            sd   = ckpt.get("state_dict", ckpt)
            encoder.load_state_dict(
                {k.replace("encoder.", ""): v for k, v in sd.items() if "encoder" in k},
                strict=False,
            )
            decoder.load_state_dict(
                {k.replace("decoder.", ""): v for k, v in sd.items() if "decoder" in k},
                strict=False,
            )

        encoder.to(device)
        decoder.to(device)
        eof_bridge.to(device)

        # Retriever
        retriever = None
        if cfg["use_analog"] and Path(retriever_cache, "faiss.index").exists():
            retriever = AnalogRetriever.load(retriever_cache)

        preds, trues, dates = predict_on_dataloader(
            encoder, decoder, bridge, test_dl,
            retriever, None, blend_weight, device,
        )
        all_preds[variant] = preds

    # Use last 'trues' as ground truth (same for all variants)
    return compare_models(all_preds, trues, months_argo[:len(trues)],
                          lats_argo[:len(trues)], lons_argo[:len(trues)])


# ──────────────────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────────────────

def main(args: argparse.Namespace) -> None:
    df = run_ablation_table(
        variants=args.variants,
        store_path=args.store_path,
        eof_path=args.eof_path,
        pretrained_encoder_ckpt=args.encoder_ckpt,
        stage2_ckpt=args.stage2_ckpt,
        argo_parquet=args.argo_parquet,
    )

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(str(out))
    print(f"[ablation] Results saved to {out}")
    print(df.groupby("model")[["rmse", "bias", "corr"]].mean().round(4))


def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser("Ocean Deja Vu — Ablation Runner")
    p.add_argument("--variants", nargs="+",
                   default=["full_model", "no_pretrain", "no_eof", "no_steric", "no_analog"])
    p.add_argument("--store_path",   default="data/processed/ocean_odv.zarr")
    p.add_argument("--eof_path",     default="data/cache/eof.pkl")
    p.add_argument("--encoder_ckpt", default="checkpoints/pretrain/encoder_pretrained.ckpt")
    p.add_argument("--stage2_ckpt",  default="checkpoints/stage2/best.ckpt")
    p.add_argument("--argo_parquet", default="data/processed/argo_collocated.parquet")
    p.add_argument("--out",          default="data/cache/ablation_results.parquet")
    return p


if __name__ == "__main__":
    main(_parser().parse_args())
