"""
src/training/supervised.py
--------------------------
Two-stage supervised training for the Ocean Deja Vu decoder.

Stage 1 — Frozen encoder, train decoder only
  - 50 epochs, lr=5e-4
  - Encoder weights are frozen; only decoder parameters receive gradients.
  - Convergence is fast (~10 epochs) and gives a good decoder initialisation.

Stage 2 — End-to-end fine-tune
  - 30 epochs, lr=1e-5
  - All parameters unfrozen; very low LR to avoid catastrophic forgetting of
    the pretrained encoder representations.

The Lightning module wraps both stages; stage is set on construction and
controls encoder freeze/unfreeze behaviour.

Usage:
    # Stage 1 (frozen encoder):
    python -m src.training.supervised --stage 1 \
        --encoder_ckpt checkpoints/pretrain/encoder_pretrained.ckpt

    # Stage 2 (end-to-end):
    python -m src.training.supervised --stage 2 \
        --model_ckpt checkpoints/stage1/best.ckpt
"""

from __future__ import annotations

import argparse
from pathlib import Path

import torch
import torch.nn as nn
import lightning as L
from lightning.pytorch.callbacks import (
    ModelCheckpoint,
    LearningRateMonitor,
    EarlyStopping,
)
from lightning.pytorch.loggers import WandbLogger

from src.models.encoder import SurfaceEncoder
from src.models.decoder import EOFDecoder, TorchEOFBridge
from src.training.losses import total_loss, DEPTHS


# ──────────────────────────────────────────────────────────────────────────────
# Lightning Module
# ──────────────────────────────────────────────────────────────────────────────

class ReconstructionLightning(L.LightningModule):
    """
    Encoder + Decoder supervised training.

    Parameters
    ----------
    encoder : SurfaceEncoder
    decoder : EOFDecoder
    eof_bridge : TorchEOFBridge
        On-device EOF decoder (torch) for converting coefficients → profiles.
    stage : int
        1 = freeze encoder (decoder-only), 2 = end-to-end fine-tune.
    lr : float
        Peak learning rate.
    weight_decay : float
    t_max : int
        Cosine LR period (epochs).
    loss_weights : dict
        Weights for eof, phys, smooth, steric loss terms.
    """

    def __init__(
        self,
        encoder: SurfaceEncoder,
        decoder: EOFDecoder,
        eof_bridge: TorchEOFBridge,
        stage: int = 1,
        lr: float = 5e-4,
        weight_decay: float = 0.01,
        t_max: int = 50,
        loss_weights: dict | None = None,
    ) -> None:
        super().__init__()
        self.save_hyperparameters(ignore=["encoder", "decoder", "eof_bridge"])
        self.encoder = encoder
        self.decoder = decoder
        self.eof_bridge = eof_bridge
        self.stage = stage
        self.lr = lr
        self.weight_decay = weight_decay
        self.t_max = t_max
        self.lw = loss_weights or {"eof": 1.0, "phys": 1.0, "sm": 0.10, "str": 0.05}

    # ------------------------------------------------------------------
    # Stage management
    # ------------------------------------------------------------------

    def on_train_start(self) -> None:
        if self.stage == 1:
            self.encoder.freeze()
            print("[supervised] Stage 1: encoder frozen, training decoder only.")
        else:
            self.encoder.unfreeze()
            print("[supervised] Stage 2: end-to-end fine-tune, all params unfrozen.")

    # ------------------------------------------------------------------
    # Training step
    # ------------------------------------------------------------------

    def training_step(
        self, batch: tuple[torch.Tensor, ...], batch_idx: int
    ) -> torch.Tensor:
        surface, true_eof, mask, sla = self._unpack_batch(batch)

        z = self.encoder(surface)                    # (B, D, h, w)
        pred_eof = self.decoder(z)                   # (B, n_modes, H, W)

        # Convert EOF coefficients → physical profiles for physics losses
        pred_prof = self._eof_to_profiles(pred_eof)  # (B, n_depths, H, W)
        true_prof = self._eof_to_profiles(true_eof)  # (B, n_depths, H, W)

        loss, components = total_loss(
            pred_eof, true_eof, pred_prof, true_prof, sla, mask,
            w_eof=self.lw["eof"],  w_phys=self.lw["phys"],
            w_sm=self.lw["sm"],    w_str=self.lw["str"],
        )

        self.log_dict(
            {f"train/{k}": v for k, v in components.items()},
            prog_bar=True, on_step=True, on_epoch=True,
        )
        return loss

    # ------------------------------------------------------------------
    # Validation step
    # ------------------------------------------------------------------

    def validation_step(
        self, batch: tuple[torch.Tensor, ...], batch_idx: int
    ) -> None:
        surface, true_eof, mask, sla = self._unpack_batch(batch)

        z = self.encoder(surface)
        pred_eof = self.decoder(z)
        pred_prof = self._eof_to_profiles(pred_eof)
        true_prof = self._eof_to_profiles(true_eof)

        loss, components = total_loss(
            pred_eof, true_eof, pred_prof, true_prof, sla, mask,
            w_eof=self.lw["eof"],  w_phys=self.lw["phys"],
            w_sm=self.lw["sm"],    w_str=self.lw["str"],
        )

        # Per-depth RMSE for key levels
        rmse = self._per_depth_rmse(pred_prof, true_prof, mask)
        val_log = {f"val/{k}": v for k, v in components.items()}
        for d_idx, d in enumerate(DEPTHS[:8]):   # 0–125 m logged per epoch
            val_log[f"val/rmse_{d}m"] = rmse[d_idx].item()
        val_log["val/rmse_mean"] = rmse.mean().item()

        self.log_dict(val_log, prog_bar=True, on_epoch=True)

    # ------------------------------------------------------------------
    # Optimiser
    # ------------------------------------------------------------------

    def configure_optimizers(self):
        # Only optimise non-frozen parameters
        params = [p for p in self.parameters() if p.requires_grad]
        opt = torch.optim.AdamW(params, lr=self.lr, weight_decay=self.weight_decay)
        sched = torch.optim.lr_scheduler.CosineAnnealingLR(
            opt, T_max=self.t_max, eta_min=1e-7
        )
        return {"optimizer": opt, "lr_scheduler": {"scheduler": sched, "interval": "epoch"}}

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _unpack_batch(
        batch: tuple[torch.Tensor, ...],
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Expected batch format from OceanDataset:
            (surface, eof_target, mask, sla)
        sla is optional; if not provided, zeros are used.
        """
        if len(batch) == 4:
            return batch[0], batch[1], batch[2], batch[3]
        elif len(batch) == 3:
            surface, eof, mask = batch
            sla = torch.zeros(surface.shape[0], surface.shape[2], surface.shape[3],
                              device=surface.device)
            return surface, eof, mask, sla
        else:
            raise ValueError(f"Unexpected batch length {len(batch)}")

    def _eof_to_profiles(self, eof_map: torch.Tensor) -> torch.Tensor:
        """
        Convert (B, n_modes, H, W) EOF coefficients → (B, n_depths, H, W) profiles.
        Uses the torch EOF bridge (differentiable).
        """
        B, M, H, W = eof_map.shape
        flat = eof_map.permute(0, 2, 3, 1).reshape(-1, M)     # (B*H*W, M)
        prof = self.eof_bridge.decode(flat)                     # (B*H*W, n_depths)
        n_d = prof.shape[1]
        return prof.reshape(B, H, W, n_d).permute(0, 3, 1, 2)  # (B, n_depths, H, W)

    @staticmethod
    def _per_depth_rmse(
        pred: torch.Tensor, true: torch.Tensor, mask: torch.Tensor
    ) -> torch.Tensor:
        """(B, n_depths, H, W) → (n_depths,) RMSE over ocean pixels."""
        ocean = mask.unsqueeze(1).float()                        # (B, 1, H, W)
        sq_err = (pred - true) ** 2 * ocean                     # (B, n_depths, H, W)
        rmse = torch.sqrt(sq_err.sum(dim=[0, 2, 3]) / (ocean.sum() + 1e-8))
        return rmse  # (n_depths,)

    # ------------------------------------------------------------------
    # Save / load helpers used by scripts
    # ------------------------------------------------------------------

    def save_encoder(self, path: str) -> None:
        torch.save(self.encoder.state_dict(), path)
        print(f"[supervised] Encoder saved to {path}")

    @classmethod
    def load_from_pretrained_encoder(
        cls,
        encoder_ckpt: str,
        in_channels: int = 15,
        embed_dim: int = 128,
        n_modes: int = 40,
        eof_bridge: TorchEOFBridge | None = None,
        stage: int = 1,
        **kwargs,
    ) -> "ReconstructionLightning":
        encoder = SurfaceEncoder(in_channels=in_channels, embed_dim=embed_dim)
        state = torch.load(encoder_ckpt, map_location="cpu")
        # Handle Lightning checkpoint wrapping
        if "state_dict" in state:
            state = {
                k.replace("mae.encoder.", ""): v
                for k, v in state["state_dict"].items()
                if k.startswith("mae.encoder.")
            }
        encoder.load_state_dict(state, strict=False)
        decoder = EOFDecoder(embed_dim=embed_dim, n_modes=n_modes)
        if eof_bridge is None:
            raise ValueError("eof_bridge must be provided (load from data pipeline).")
        return cls(encoder=encoder, decoder=decoder, eof_bridge=eof_bridge,
                   stage=stage, **kwargs)


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

def main(args: argparse.Namespace) -> None:
    L.seed_everything(args.seed, workers=True)

    # Load EOF bridge from data pipeline
    import pickle, numpy as np
    from sklearn.decomposition import PCA
    with open(args.eof_path, "rb") as f:
        pca: PCA = pickle.load(f)
    eof_bridge = TorchEOFBridge.from_sklearn(pca)

    if args.stage == 1:
        module = ReconstructionLightning.load_from_pretrained_encoder(
            encoder_ckpt=args.encoder_ckpt,
            eof_bridge=eof_bridge,
            stage=1,
            lr=5e-4,
            t_max=args.epochs,
        )
    else:
        module = ReconstructionLightning.load_from_checkpoint(
            args.model_ckpt,
            strict=False,
        )
        module.stage = 2
        module.lr = 1e-5
        module.t_max = args.epochs

    # DataLoaders from Dev 1
    try:
        from src.data.zarr_store import make_dataloaders
        train_dl, val_dl = make_dataloaders(
            store_path=args.store_path,
            batch_size=args.batch_size,
            num_workers=args.num_workers,
            return_sla=True,
        )
    except ImportError:
        raise RuntimeError("src.data.zarr_store not found — run Dev 1 pipeline first.")

    logger = None
    if not args.no_wandb:
        tag = f"stage{args.stage}_{args.run_tag}"
        logger = WandbLogger(project="ocean-deja-vu", name=tag)

    ckpt_dir = Path(args.checkpoint_dir)
    ckpt_dir.mkdir(parents=True, exist_ok=True)
    callbacks = [
        ModelCheckpoint(
            dirpath=str(ckpt_dir),
            filename=f"stage{args.stage}-{{epoch:02d}}-{{val/loss_total:.4f}}",
            monitor="val/loss_total",
            mode="min",
            save_top_k=3,
        ),
        LearningRateMonitor("epoch"),
        EarlyStopping(monitor="val/loss_total", patience=8, mode="min"),
    ]

    trainer = L.Trainer(
        max_epochs=args.epochs,
        accelerator="auto",
        devices="auto",
        precision="16-mixed",
        gradient_clip_val=1.0,
        callbacks=callbacks,
        logger=logger,
        log_every_n_steps=10,
    )
    trainer.fit(module, train_dl, val_dl)
    print(f"[supervised] Stage {args.stage} done. Best: {callbacks[0].best_model_path}")


def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser("Ocean Deja Vu — Supervised Training")
    p.add_argument("--stage",         type=int, default=1,  choices=[1, 2])
    p.add_argument("--encoder_ckpt",  type=str, default="checkpoints/pretrain/encoder_pretrained.ckpt")
    p.add_argument("--model_ckpt",    type=str, default="checkpoints/stage1/best.ckpt")
    p.add_argument("--eof_path",      type=str, default="data/cache/eof.pkl")
    p.add_argument("--store_path",    type=str, default="data/processed/ocean_odv.zarr")
    p.add_argument("--epochs",        type=int, default=50)
    p.add_argument("--batch_size",    type=int, default=8)
    p.add_argument("--num_workers",   type=int, default=4)
    p.add_argument("--checkpoint_dir",type=str, default="checkpoints/stage1")
    p.add_argument("--seed",          type=int, default=42)
    p.add_argument("--run_tag",       type=str, default="v1")
    p.add_argument("--no_wandb",      action="store_true")
    return p


if __name__ == "__main__":
    main(_parser().parse_args())
