"""
ML/scripts/train_smoke_test.py
-------------------------------
End-to-end training script for the Ocean Deja Vu smoke test (7 days).
Does everything in sequence:
  1. Validate the Zarr dataset
  2. Compute channel normalization stats
  3. Fit EOF from target profiles (or use pre-computed)
  4. Run MAE pretraining (self-supervised)
  5. Run Stage 1 decoder training (frozen encoder)
  6. Run Stage 2 fine-tuning (end-to-end)
  7. Build FAISS analog index
  8. Run evaluation

Usage (from ML/ directory):
    conda activate pytorch
    python scripts/train_smoke_test.py --store ../Dataset --epochs_pretrain 5 --epochs_s1 10 --epochs_s2 5

For larger datasets, increase epochs and batch sizes:
    python scripts/train_smoke_test.py --store ../Dataset --epochs_pretrain 20 --epochs_s1 50 --epochs_s2 30 --batch 8
"""

from __future__ import annotations

# Add ML/ to path
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import argparse
import json
import logging
import os
import pickle
import time
from pathlib import Path
from src.data.zarr3_reader import Zarr3Store

import numpy as np
import torch

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("train_smoke_test")


def timer(label: str):
    """Simple context manager to time blocks."""
    class _Timer:
        def __enter__(self):
            self.start = time.time()
            logger.info(f"{'='*60}")
            logger.info(f"  STEP: {label}")
            logger.info(f"{'='*60}")
            return self
        def __exit__(self, *_):
            elapsed = time.time() - self.start
            logger.info(f"  ✅ {label} completed in {elapsed:.1f}s")
            logger.info("")
    return _Timer()


# ─────────────────────────────────────────────────────────────────────────────
# Step 1: Validate Dataset
# ─────────────────────────────────────────────────────────────────────────────

def step_validate(store_path: str) -> dict:
    """Quick validation, returns metadata dict."""
    import zarr

    store = Zarr3Store(store_path)
    meta = {}

    # Grid
    lat = np.array(store["lat"][:])
    lon = np.array(store["lon"][:])
    depths = np.array(store["depths"][:])
    mask = np.array(store["mask"][:]).astype(np.float32)
    meta["nlat"], meta["nlon"] = lat.shape[0], lon.shape[0]
    meta["n_depths"] = len(depths)
    meta["ocean_frac"] = mask.mean()

    # Dates
    for split in ["train", "val", "test"]:
        raw = np.array(store[f"dates/{split}"][:])
        text = bytes(raw.tolist()).decode("utf-8")
        dates = json.loads(text)
        meta[f"n_{split}"] = len(dates)
        meta[f"dates_{split}"] = dates

    # EOF modes
    first_date = meta["dates_train"][0]
    eof = np.array(store[f"target_eof/{first_date}"][:])
    meta["n_eof_modes"] = eof.shape[0]

    logger.info(f"  Grid: {meta['nlat']} × {meta['nlon']}")
    logger.info(f"  Ocean: {meta['ocean_frac']*100:.1f}%")
    logger.info(f"  Depths: {meta['n_depths']}")
    logger.info(f"  EOF modes: {meta['n_eof_modes']}")
    logger.info(f"  Train: {meta['n_train']} days, Val: {meta['n_val']} days, "
                f"Test: {meta['n_test']} days")

    return meta


# ─────────────────────────────────────────────────────────────────────────────
# Step 2: Compute Channel Stats
# ─────────────────────────────────────────────────────────────────────────────

def step_compute_stats(store_path: str, meta: dict, out_path: str) -> "ChannelStats":
    """Compute per-channel mean/std from training surface data."""
    from src.data.normalize import ChannelStats
    import zarr

    out = Path(out_path)
    if out.exists():
        logger.info(f"  Loading existing stats from {out}")
        return ChannelStats.load(out)

    store = Zarr3Store(store_path)
    mask = np.array(store["mask"][:]).astype(np.float32)

    # Collect all training surface arrays
    surfaces = []
    for date in meta["dates_train"]:
        surf = np.array(store[f"surface/{date}"][:]).astype(np.float32)
        surf = np.nan_to_num(surf, nan=0.0)
        surfaces.append(surf)

    stack = np.stack(surfaces, axis=0)  # (N, 15, H, W)
    logger.info(f"  Fitting stats on {stack.shape[0]} samples, shape={stack.shape}")

    stats = ChannelStats()
    stats.fit_from_samples(stack, mask=mask)

    out.parent.mkdir(parents=True, exist_ok=True)
    stats.save(out)
    logger.info(f"  Saved channel stats to {out}")
    logger.info(f"  Mean: {np.round(stats.mean, 3).tolist()}")
    logger.info(f"  Std:  {np.round(stats.std, 3).tolist()}")

    return stats


# ─────────────────────────────────────────────────────────────────────────────
# Step 3: Fit EOF (optional — use pre-computed from dataset)
# ─────────────────────────────────────────────────────────────────────────────

def step_fit_eof(store_path: str, meta: dict, out_path: str, n_modes: int = 8) -> "ProfileEOF":
    """Fit EOF from GLORYS target profiles in the training set."""
    from src.data.eof import ProfileEOF
    import zarr

    out = Path(out_path)
    if out.exists():
        logger.info(f"  Loading existing EOF from {out}")
        return ProfileEOF.load(out)

    store = Zarr3Store(store_path)
    mask = np.array(store["mask"][:]).astype(np.float32)

    # Collect target profiles from training dates
    all_profiles = []
    for date in meta["dates_train"]:
        prof = np.array(store[f"target_profiles/{date}"][:]).astype(np.float32)
        # prof shape: (15, H, W) — flatten to (H*W, 15) for ocean pixels
        flat = prof.reshape(15, -1).T  # (H*W, 15)
        mask_flat = mask.flatten()
        ocean = flat[mask_flat > 0.5]  # only ocean pixels
        ocean = ocean[~np.any(np.isnan(ocean), axis=1)]  # remove NaN rows
        all_profiles.append(ocean)

    profiles = np.concatenate(all_profiles, axis=0)  # (N_total, 15)
    logger.info(f"  Fitting EOF on {profiles.shape[0]} ocean profiles, "
                f"{n_modes} modes")

    eof = ProfileEOF(n_modes=n_modes)
    eof.fit(profiles)

    out.parent.mkdir(parents=True, exist_ok=True)
    eof.save(out)
    logger.info(f"  Saved EOF to {out}")
    logger.info(f"  Variance explained: "
                f"{np.cumsum(eof.pca.explained_variance_ratio_)[-1]*100:.2f}%")

    return eof


# ─────────────────────────────────────────────────────────────────────────────
# Step 4: MAE Pretraining
# ─────────────────────────────────────────────────────────────────────────────

def step_pretrain(args, meta, stats):
    """Self-supervised MAE pretraining."""
    import lightning as L
    from lightning.pytorch.callbacks import ModelCheckpoint
    from src.models.encoder import SurfaceEncoder
    from src.models.mae import OceanMAE
    from src.training.pretrain import MAELightning
    from src.data.zarr_store import make_dataloaders

    L.seed_everything(args.seed, workers=True)

    # Build model
    encoder = SurfaceEncoder(
        in_channels=15,
        embed_dim=args.embed_dim,
        pretrained_imagenet=False,
    )
    mae = OceanMAE(
        encoder=encoder,
        mask_ratio=0.50,
        channel_drop_prob=0.20,
        decoder_dim=256,
        n_coord_channels=4,
        target_h=meta["nlat"],
        target_w=meta["nlon"],
    )
    module = MAELightning(
        mae=mae,
        lr=args.lr_pretrain,
        weight_decay=0.05,
        t_max=args.epochs_pretrain,
    )

    # Data
    train_dl, val_dl = make_dataloaders(
        store_path=args.store,
        batch_size=args.batch,
        stats=stats,
        num_workers=0,
    )

    logger.info(f"  Train batches: {len(train_dl)}, Val batches: {len(val_dl)}")

    # Callbacks
    ckpt_dir = Path("checkpoints/pretrain")
    ckpt_dir.mkdir(parents=True, exist_ok=True)

    callbacks = [
        ModelCheckpoint(
            dirpath=str(ckpt_dir),
            filename="encoder-{epoch:02d}-{pretrain/val_loss:.4f}",
            monitor="pretrain/val_loss",
            mode="min",
            save_top_k=1,
        ),
    ]

    # Trainer
    trainer = L.Trainer(
        max_epochs=args.epochs_pretrain,
        accelerator="auto",
        devices=1,
        precision="16-mixed" if torch.cuda.is_available() else "32-true",
        gradient_clip_val=1.0,
        callbacks=callbacks,
        logger=False,  # No W&B for smoke test
        log_every_n_steps=1,
        enable_progress_bar=True,
    )

    trainer.fit(module, train_dl, val_dl)
    best = callbacks[0].best_model_path
    logger.info(f"  Best pretrain checkpoint: {best}")

    # Save encoder state dict separately
    encoder_path = str(ckpt_dir / "encoder_pretrained.pt")
    torch.save(encoder.state_dict(), encoder_path)
    logger.info(f"  Encoder saved: {encoder_path}")

    return best, encoder_path


# ─────────────────────────────────────────────────────────────────────────────
# Step 5 & 6: Supervised Training (Stage 1 + Stage 2)
# ─────────────────────────────────────────────────────────────────────────────

def step_supervised(args, meta, stats, eof, encoder_path: str, stage: int):
    """Supervised decoder training (stage 1 or 2)."""
    import lightning as L
    from lightning.pytorch.callbacks import ModelCheckpoint
    from src.models.encoder import SurfaceEncoder
    from src.models.decoder import EOFDecoder, TorchEOFBridge
    from src.training.supervised import ReconstructionLightning
    from src.data.zarr_store import make_dataloaders

    L.seed_everything(args.seed, workers=True)

    epochs = args.epochs_s1 if stage == 1 else args.epochs_s2
    lr = 5e-4 if stage == 1 else 1e-5
    ckpt_dir = Path(f"checkpoints/stage{stage}")
    ckpt_dir.mkdir(parents=True, exist_ok=True)

    # Build model
    encoder = SurfaceEncoder(in_channels=15, embed_dim=args.embed_dim)

    if stage == 1:
        # Load pretrained encoder weights
        state = torch.load(encoder_path, map_location="cpu", weights_only=True)
        encoder.load_state_dict(state, strict=False)
        logger.info(f"  Loaded encoder from {encoder_path}")
    else:
        # Load full stage 1 checkpoint
        prev_ckpt = args.stage1_ckpt
        logger.info(f"  Loading stage 1 checkpoint: {prev_ckpt}")

    decoder = EOFDecoder(
        embed_dim=args.embed_dim,
        n_modes=meta["n_eof_modes"],
    )

    eof_bridge = eof.to_torch_bridge()

    module = ReconstructionLightning(
        encoder=encoder,
        decoder=decoder,
        eof_bridge=eof_bridge,
        stage=stage,
        lr=lr,
        t_max=epochs,
    )

    if stage == 2 and hasattr(args, "stage1_ckpt") and args.stage1_ckpt:
        # Load full model state from stage 1
        try:
            ckpt = torch.load(args.stage1_ckpt, map_location="cpu")
            if "state_dict" in ckpt:
                module.load_state_dict(ckpt["state_dict"], strict=False)
            logger.info(f"  Loaded stage 1 model state")
        except Exception as e:
            logger.warning(f"  Could not load stage 1 checkpoint: {e}")

    # Data — with SLA for steric loss
    train_dl, val_dl = make_dataloaders(
        store_path=args.store,
        batch_size=args.batch if stage == 1 else max(1, args.batch // 2),
        stats=stats,
        return_sla=True,
        n_modes=meta["n_eof_modes"],
        num_workers=0,
    )

    callbacks = [
        ModelCheckpoint(
            dirpath=str(ckpt_dir),
            filename=f"stage{stage}-{{epoch:02d}}",
            monitor="val/loss_total",
            mode="min",
            save_top_k=1,
        )
    ]

    trainer = L.Trainer(
        max_epochs=epochs,
        accelerator="auto",
        devices=1,
        precision="16-mixed" if torch.cuda.is_available() else "32-true",
        gradient_clip_val=1.0,
        callbacks=callbacks,
        logger=False,
        log_every_n_steps=1,
        enable_progress_bar=True,
    )

    trainer.fit(module, train_dl, val_dl)
    best = callbacks[0].best_model_path
    logger.info(f"  Best stage {stage} checkpoint: {best}")

    # Save final model
    final_path = str(ckpt_dir / f"stage{stage}_final.pt")
    torch.save(module.state_dict(), final_path)

    return best, final_path


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Ocean Deja Vu — End-to-End Smoke Test Training")

    # Paths
    p.add_argument("--store", type=str, default="../Dataset",
                    help="Path to the processed Zarr dataset")

    # Architecture
    p.add_argument("--embed_dim", type=int, default=128)
    p.add_argument("--n_modes", type=int, default=8)

    # Training
    p.add_argument("--epochs_pretrain", type=int, default=5,
                    help="MAE pretraining epochs (smoke: 5, full: 20)")
    p.add_argument("--epochs_s1", type=int, default=10,
                    help="Stage 1 decoder epochs (smoke: 10, full: 50)")
    p.add_argument("--epochs_s2", type=int, default=5,
                    help="Stage 2 fine-tune epochs (smoke: 5, full: 30)")
    p.add_argument("--batch", type=int, default=2,
                    help="Batch size (smoke: 2, full: 8)")
    p.add_argument("--lr_pretrain", type=float, default=1e-4)
    p.add_argument("--seed", type=int, default=42)

    # Skip steps
    p.add_argument("--skip_pretrain", action="store_true")
    p.add_argument("--skip_supervised", action="store_true")
    p.add_argument("--encoder_ckpt", type=str, default=None,
                    help="Path to existing encoder checkpoint (skip pretrain)")
    p.add_argument("--stage1_ckpt", type=str, default=None,
                    help="Path to existing stage 1 checkpoint (for stage 2)")

    args = p.parse_args()
    total_start = time.time()

    logger.info("╔══════════════════════════════════════════════════════════╗")
    logger.info("║           Ocean Deja Vu — Training Pipeline             ║")
    logger.info("╚══════════════════════════════════════════════════════════╝")
    logger.info(f"  Store: {args.store}")
    logger.info(f"  Device: {'CUDA' if torch.cuda.is_available() else 'CPU'}")
    if torch.cuda.is_available():
        logger.info(f"  GPU: {torch.cuda.get_device_name(0)}")
        logger.info(f"  VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

    # ── Step 1: Validate ──
    with timer("Dataset Validation"):
        meta = step_validate(args.store)

    # ── Step 2: Channel Stats ──
    stats_path = "data/cache/channel_stats.json"
    with timer("Channel Statistics"):
        stats = step_compute_stats(args.store, meta, stats_path)

    # ── Step 3: EOF Fitting ──
    eof_path = "data/cache/eof.pkl"
    with timer("EOF Fitting"):
        eof = step_fit_eof(args.store, meta, eof_path, n_modes=args.n_modes)

    # ── Step 4: MAE Pretraining ──
    encoder_path = args.encoder_ckpt
    pretrain_ckpt = None
    if not args.skip_pretrain:
        with timer("MAE Self-Supervised Pretraining"):
            pretrain_ckpt, encoder_path = step_pretrain(args, meta, stats)
    else:
        if encoder_path is None:
            encoder_path = "checkpoints/pretrain/encoder_pretrained.pt"
        logger.info(f"Skipping pretrain. Using encoder: {encoder_path}")

    # ── Step 5: Stage 1 (Frozen Encoder) ──
    stage1_ckpt = args.stage1_ckpt
    if not args.skip_supervised:
        with timer("Stage 1: Decoder Training (Frozen Encoder)"):
            stage1_ckpt, _ = step_supervised(
                args, meta, stats, eof, encoder_path, stage=1
            )

        # ── Step 6: Stage 2 (End-to-End) ──
        args.stage1_ckpt = stage1_ckpt
        with timer("Stage 2: End-to-End Fine-Tuning"):
            stage2_ckpt, final_path = step_supervised(
                args, meta, stats, eof, encoder_path, stage=2
            )
    else:
        logger.info("Skipping supervised training.")

    # ── Summary ──
    total_time = time.time() - total_start
    logger.info("")
    logger.info("╔══════════════════════════════════════════════════════════╗")
    logger.info("║              Training Pipeline Complete!                 ║")
    logger.info("╚══════════════════════════════════════════════════════════╝")
    logger.info(f"  Total time: {total_time/60:.1f} minutes")
    logger.info(f"  Stats:     {stats_path}")
    logger.info(f"  EOF:       {eof_path}")
    if pretrain_ckpt:
        logger.info(f"  Pretrain:  {pretrain_ckpt}")
    if not args.skip_supervised:
        logger.info(f"  Stage 1:   {stage1_ckpt}")
        logger.info(f"  Stage 2:   {stage2_ckpt}")
        logger.info(f"  Final:     {final_path}")


if __name__ == "__main__":
    main()
