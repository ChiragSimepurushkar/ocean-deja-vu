"""Plain U-Net Baseline architecture for subsurface temperature reconstruction.

Predicts all 15 depth levels directly from 15 surface channels without encoder
pretraining or EOF decomposition. Serves as the primary deep learning baseline
and the 'beat this' benchmark for Dev 2's masked autoencoder & analog retrieval pipeline.
"""

from __future__ import annotations
import logging
from typing import Optional, Tuple, Dict
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader

logger = logging.getLogger(__name__)


class DoubleConv(nn.Module):
    """Two 3x3 convs each with BatchNorm and GELU activation."""

    def __init__(self, in_ch: int, out_ch: int):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.GELU(),
            nn.Conv2d(out_ch, out_ch, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.GELU(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.conv(x)


class PlainUNetBaseline(nn.Module):
    """2D U-Net mapping (B, 15, H, W) surface channels to (B, 15, H, W) vertical profiles."""

    def __init__(self, in_channels: int = 15, out_channels: int = 15, init_features: int = 32):
        super().__init__()
        f = init_features

        # Encoder
        self.inc = DoubleConv(in_channels, f)
        self.down1 = nn.Sequential(nn.MaxPool2d(2), DoubleConv(f, f * 2))
        self.down2 = nn.Sequential(nn.MaxPool2d(2), DoubleConv(f * 2, f * 4))
        self.down3 = nn.Sequential(nn.MaxPool2d(2), DoubleConv(f * 4, f * 8))

        # Bottleneck
        self.bot = DoubleConv(f * 8, f * 8)

        # Decoder with upsampling and skip connections
        self.up1 = nn.ConvTranspose2d(f * 8, f * 4, kernel_size=2, stride=2)
        self.conv_up1 = DoubleConv(f * 8, f * 4)

        self.up2 = nn.ConvTranspose2d(f * 4, f * 2, kernel_size=2, stride=2)
        self.conv_up2 = DoubleConv(f * 4, f * 2)

        self.up3 = nn.ConvTranspose2d(f * 2, f, kernel_size=2, stride=2)
        self.conv_up3 = DoubleConv(f * 2, f)

        # Output projection
        self.outc = nn.Conv2d(f, out_channels, kernel_size=1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        orig_h, orig_w = x.shape[-2], x.shape[-1]

        # Encoder pass
        x1 = self.inc(x)
        x2 = self.down1(x1)
        x3 = self.down2(x2)
        x4 = self.down3(x3)

        # Bottleneck
        xb = self.bot(x4)

        # Decoder pass with shape alignment for odd dimensions
        u1 = self._upsample_concat(xb, x3, self.up1)
        c1 = self.conv_up1(u1)

        u2 = self._upsample_concat(c1, x2, self.up2)
        c2 = self.conv_up2(u2)

        u3 = self._upsample_concat(c2, x1, self.up3)
        c3 = self.conv_up3(u3)

        out = self.outc(c3)

        # Ensure output matches exact input spatial dimensions
        if out.shape[-2:] != (orig_h, orig_w):
            out = F.interpolate(out, size=(orig_h, orig_w), mode="bilinear", align_corners=False)

        return out

    @staticmethod
    def _upsample_concat(x: torch.Tensor, skip: torch.Tensor, up_layer: nn.Module) -> torch.Tensor:
        x_up = up_layer(x)
        # Pad x_up if dimensions differ slightly due to pooling odd numbers
        diff_y = skip.size(-2) - x_up.size(-2)
        diff_x = skip.size(-1) - x_up.size(-1)
        x_up = F.pad(x_up, [diff_x // 2, diff_x - diff_x // 2, diff_y // 2, diff_y - diff_y // 2])
        return torch.cat([skip, x_up], dim=1)


def train_unet_baseline(
    model: PlainUNetBaseline,
    train_loader: DataLoader,
    val_loader: DataLoader,
    epochs: int = 5,
    lr: float = 1e-3,
    device: str = "cpu",
) -> Dict[str, float]:
    """Train the plain U-Net baseline on target profiles."""
    model.to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    criterion = nn.MSELoss()

    best_val_loss = float("inf")
    logger.info("Training Plain U-Net Baseline for %d epochs on device=%s...", epochs, device)

    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        n_train_batches = 0

        for batch in train_loader:
            surface, _, mask, target_profiles, _ = batch
            surface = torch.nan_to_num(surface.to(device), nan=0.0)
            target_clean = torch.nan_to_num(target_profiles.to(device), nan=0.0)
            mask = mask.to(device).unsqueeze(1)  # (B, 1, H, W)

            optimizer.zero_grad()
            pred = model(surface)

            # Masked MSE loss (only compute on ocean pixels)
            loss = criterion(pred * mask, target_clean * mask)
            loss.backward()
            optimizer.step()

            train_loss += loss.item()
            n_train_batches += 1

        avg_train_loss = train_loss / max(1, n_train_batches)

        # Validation loop
        model.eval()
        val_loss = 0.0
        n_val_batches = 0
        with torch.no_grad():
            for batch in val_loader:
                surface, _, mask, target_profiles, _ = batch
                surface = torch.nan_to_num(surface.to(device), nan=0.0)
                target_clean = torch.nan_to_num(target_profiles.to(device), nan=0.0)
                mask = mask.to(device).unsqueeze(1)

                pred = model(surface)
                loss = criterion(pred * mask, target_clean * mask)
                val_loss += loss.item()
                n_val_batches += 1

        avg_val_loss = val_loss / max(1, n_val_batches)
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss

        logger.info("Epoch %02d/%02d - Train Loss: %.4f | Val Loss: %.4f", epoch, epochs, avg_train_loss, avg_val_loss)

    return {"best_val_loss": best_val_loss}
