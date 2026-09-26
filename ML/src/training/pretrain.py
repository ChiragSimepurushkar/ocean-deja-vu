"""
src/training/pretrain.py
------------------------
Self-supervised MAE pretraining loop using PyTorch Lightning.

Training protocol:
  - 20 epochs, AdamW, cosine LR schedule.
  - Random pixel masking (50%) + channel drop (20%) applied inside OceanMAE.
  - Logs reconstruction loss and sample reconstructions to W&B every N steps.
  - Saves best encoder checkpoint as `checkpoints/pretrain/encoder_pretrained.ckpt`.

Expected runtime: ~2–4 hours on a single A100 (40 GB) for 5 years of NIO data.

Usage:
    python -m src.training.pretrain --config-path ../../configs \
        --config-name model train.pretrain.epochs=20
"""

from __future__ import annotations

import os
import argparse
from pathlib import Path

import torch
import lightning as L
from lightning.pytorch.callbacks import (
    ModelCheckpoint,
    LearningRateMonitor,
    EarlyStopping,
)
from lightning.pytorch.loggers import WandbLogger

from src.models.encoder import SurfaceEncoder
from src.models.mae import OceanMAE


# ──────────────────────────────────────────────────────────────────────────────
# Lightning Module
# ──────────────────────────────────────────────────────────────────────────────

class MAELightning(L.LightningModule):
    """
    Lightning wrapper around OceanMAE for pretraining.

    Parameters
    ----------
    mae : OceanMAE
    lr : float
        Peak learning rate.
    weight_decay : float
    t_max : int
        Cosine annealing period (epochs).
    """

    def __init__(
        self,
        mae: OceanMAE,
        lr: float = 1e-4,
        weight_decay: float = 0.05,
        t_max: int = 20,
    ) -> None:
        super().__init__()
        self.save_hyperparameters(ignore=["mae"])
        self.mae = mae
        self.lr = lr
        self.weight_decay = weight_decay
        self.t_max = t_max

    # ------------------------------------------------------------------
    # Steps
    # ------------------------------------------------------------------

    def training_step(
        self, batch: tuple[torch.Tensor, ...], batch_idx: int
    ) -> torch.Tensor:
        surface = batch[0]                          # (B, C, H, W)
        loss, x_hat, pmask = self.mae(surface)
        self.log("pretrain/loss", loss, prog_bar=True, on_step=True, on_epoch=True)

        # Visualise first batch of every 500 steps
        if batch_idx % 500 == 0 and self.logger is not None:
            self._log_reconstruction(surface, x_hat, pmask)

        return loss

    def validation_step(
        self, batch: tuple[torch.Tensor, ...], batch_idx: int
    ) -> None:
        surface = batch[0]
        loss, _, _ = self.mae(surface)
        self.log("pretrain/val_loss", loss, prog_bar=True, on_epoch=True)

    # ------------------------------------------------------------------
    # Optimiser
    # ------------------------------------------------------------------

    def configure_optimizers(self):
        opt = torch.optim.AdamW(
            self.parameters(), lr=self.lr, weight_decay=self.weight_decay
        )
        sched = torch.optim.lr_scheduler.CosineAnnealingLR(
            opt, T_max=self.t_max, eta_min=1e-6
        )
        return {"optimizer": opt, "lr_scheduler": {"scheduler": sched, "interval": "epoch"}}

    # ------------------------------------------------------------------
    # Logging helpers
    # ------------------------------------------------------------------

    def _log_reconstruction(
        self,
        surface: torch.Tensor,
        x_hat: torch.Tensor,
        pmask: torch.Tensor,
    ) -> None:
        """Log SST channel (idx 0) original vs reconstruction to W&B."""
        try:
            import wandb
            orig = surface[0, 0].cpu().float().numpy()
            recon = x_hat[0, 0].detach().cpu().float().numpy()
            mask  = pmask[0].cpu().numpy()
            self.logger.experiment.log({
                "pretrain/sst_original":      wandb.Image(orig, caption="Original SST"),
                "pretrain/sst_reconstruction":wandb.Image(recon, caption="Reconstructed SST"),
                "pretrain/pixel_mask":        wandb.Image(mask.astype(float), caption="Pixel Mask"),
            })
        except Exception:
            pass  # graceful degradation if W&B not configured


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

def main(args: argparse.Namespace) -> None:
    L.seed_everything(args.seed, workers=True)

    # ── Build model ────────────────────────────────────────────────────
    encoder = SurfaceEncoder(
        in_channels=args.in_channels,
        embed_dim=args.embed_dim,
        pretrained_imagenet=False,
    )
    mae = OceanMAE(
        encoder=encoder,
        mask_ratio=args.mask_ratio,
        channel_drop_prob=args.channel_drop_prob,
        decoder_dim=args.decoder_dim,
        n_coord_channels=4,
        target_h=args.target_h,
        target_w=args.target_w,
    )
    module = MAELightning(
        mae=mae,
        lr=args.lr,
        weight_decay=args.weight_decay,
        t_max=args.epochs,
    )

    # ── Data ───────────────────────────────────────────────────────────
    # DataLoaders are expected to be provided by Dev 1's zarr_store.py.
    # We import here lazily to avoid breaking if zarr store isn't ready.
    try:
        from src.data.zarr_store import make_dataloaders
        train_dl, val_dl = make_dataloaders(
            store_path=args.store_path,
            batch_size=args.batch_size,
            num_workers=args.num_workers,
        )
    except ImportError:
        raise RuntimeError(
            "src.data.zarr_store not found. "
            "Make sure Dev 1 has created the Zarr store before pretraining."
        )

    # ── Logger ─────────────────────────────────────────────────────────
    logger = None
    if not args.no_wandb:
        logger = WandbLogger(project="ocean-deja-vu", name=f"pretrain_{args.run_tag}")

    # ── Callbacks ──────────────────────────────────────────────────────
    ckpt_dir = Path(args.checkpoint_dir)
    ckpt_dir.mkdir(parents=True, exist_ok=True)

    callbacks = [
        ModelCheckpoint(
            dirpath=str(ckpt_dir),
            filename="encoder_pretrained-{epoch:02d}-{pretrain/val_loss:.4f}",
            monitor="pretrain/val_loss",
            mode="min",
            save_top_k=2,
        ),
        LearningRateMonitor(logging_interval="epoch"),
        EarlyStopping(
            monitor="pretrain/val_loss",
            patience=5,
            mode="min",
        ),
    ]

    # ── Trainer ────────────────────────────────────────────────────────
    trainer = L.Trainer(
        max_epochs=args.epochs,
        accelerator="auto",
        devices="auto",
        precision="16-mixed",
        gradient_clip_val=args.grad_clip,
        callbacks=callbacks,
        logger=logger,
        log_every_n_steps=10,
    )

    trainer.fit(module, train_dl, val_dl)
    print(f"[pretrain] Done. Best checkpoint: {callbacks[0].best_model_path}")


# ──────────────────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────────────────

def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Ocean Deja Vu — MAE Pretraining")
    p.add_argument("--store_path", type=str, default="data/processed/ocean_odv.zarr")
    p.add_argument("--in_channels", type=int, default=15)
    p.add_argument("--embed_dim", type=int, default=128)
    p.add_argument("--mask_ratio", type=float, default=0.50)
    p.add_argument("--channel_drop_prob", type=float, default=0.20)
    p.add_argument("--decoder_dim", type=int, default=256)
    p.add_argument("--target_h", type=int, default=100)
    p.add_argument("--target_w", type=int, default=240)
    p.add_argument("--epochs", type=int, default=20)
    p.add_argument("--batch_size", type=int, default=8)
    p.add_argument("--lr", type=float, default=1e-4)
    p.add_argument("--weight_decay", type=float, default=0.05)
    p.add_argument("--grad_clip", type=float, default=1.0)
    p.add_argument("--num_workers", type=int, default=4)
    p.add_argument("--checkpoint_dir", type=str, default="checkpoints/pretrain")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--run_tag", type=str, default="v1")
    p.add_argument("--no_wandb", action="store_true")
    return p


if __name__ == "__main__":
    main(_parser().parse_args())
