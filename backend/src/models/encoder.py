"""
src/models/encoder.py
---------------------
ConvNeXt-tiny surface encoder for the Ocean Deja Vu system.

Accepts an arbitrary number of input channels (geophysical surface fields)
and outputs a compact spatial embedding map at 1/32 resolution.

Architecture choices:
  - ConvNeXt-tiny via `timm` (fast, small, ResNet-class params).
  - First conv layer (stem) re-initialised to accept `in_channels` instead of 3.
  - Global average pooling removed; spatial feature map preserved for the decoder.
  - 1×1 conv projection to `embed_dim`.
"""

from __future__ import annotations

import math
import torch
import torch.nn as nn

try:
    import timm
    HAS_TIMM = True
except ImportError:
    timm = None
    HAS_TIMM = False


# ──────────────────────────────────────────────────────────────────────────────
# Helper
# ──────────────────────────────────────────────────────────────────────────────

def _reinit_stem(backbone: nn.Module, in_channels: int) -> None:
    """Replace the first ConvNeXt stem conv to accept `in_channels`."""
    # timm ConvNeXt stem: backbone.stem[0] is the 4×4 strided conv
    old_conv = backbone.stem[0]
    new_conv = nn.Conv2d(
        in_channels,
        old_conv.out_channels,
        kernel_size=old_conv.kernel_size,
        stride=old_conv.stride,
        padding=old_conv.padding,
        bias=old_conv.bias is not None,
    )
    # Fan-in initialisation: average RGB weights over new channel count
    with torch.no_grad():
        if in_channels <= 3:
            new_conv.weight.copy_(old_conv.weight[:, :in_channels, ...])
        else:
            # Tile and re-normalise
            repeats = math.ceil(in_channels / 3)
            tiled = old_conv.weight.repeat(1, repeats, 1, 1)[:, :in_channels, ...]
            new_conv.weight.copy_(tiled / repeats)
        if old_conv.bias is not None:
            new_conv.bias.copy_(old_conv.bias)
    backbone.stem[0] = new_conv


# ──────────────────────────────────────────────────────────────────────────────
# Encoder
# ──────────────────────────────────────────────────────────────────────────────

class SurfaceEncoder(nn.Module):
    """
    ConvNeXt-tiny backbone modified for multi-channel geophysical input.

    Parameters
    ----------
    in_channels : int
        Number of surface input channels (default 15: 7 obs + 4 derived + 4 coord).
    embed_dim : int
        Output embedding dimension per spatial location.
    pretrained_imagenet : bool
        Whether to initialise backbone from ImageNet weights.
        Set False when training from scratch on ocean data.

    Forward
    -------
    Input : (B, in_channels, H, W)
    Output: (B, embed_dim, H//32, W//32)
    """

    def __init__(
        self,
        in_channels: int = 15,
        embed_dim: int = 128,
        pretrained_imagenet: bool = False,
    ) -> None:
        super().__init__()
        self.in_channels = in_channels
        self.embed_dim = embed_dim

        # Load backbone (no classifier head, preserve spatial feature map)
        if HAS_TIMM:
            self.backbone = timm.create_model(
                "convnext_tiny",
                pretrained=pretrained_imagenet,
                in_chans=3,        # we'll swap the stem below
                num_classes=0,     # remove FC classifier
                global_pool="",    # keep spatial output
            )
            # Replace stem to accept the correct number of channels
            _reinit_stem(self.backbone, in_channels)
            feat_dim = self.backbone.num_features
        else:
            # Native PyTorch CNN backbone: 4x downsampling stem + 3 stages with stride 2 = 1/32
            self.backbone = nn.Sequential(
                nn.Conv2d(in_channels, 96, kernel_size=4, stride=4),
                nn.GELU(),
                nn.Conv2d(96, 192, kernel_size=3, stride=2, padding=1),
                nn.GELU(),
                nn.Conv2d(192, 384, kernel_size=3, stride=2, padding=1),
                nn.GELU(),
                nn.Conv2d(384, 768, kernel_size=3, stride=2, padding=1),
                nn.GELU(),
            )
            feat_dim = 768

        # 1×1 projection to embed_dim
        self.proj = nn.Sequential(
            nn.GroupNorm(1, feat_dim),  # layer-norm equivalent for conv feature maps
            nn.Conv2d(feat_dim, embed_dim, kernel_size=1),
        )

        self._init_proj()

    def _init_proj(self) -> None:
        nn.init.trunc_normal_(self.proj[1].weight, std=0.02)
        nn.init.zeros_(self.proj[1].bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Parameters
        ----------
        x : (B, C_surf, H, W)  — normalised surface fields

        Returns
        -------
        (B, embed_dim, H//32, W//32)
        """
        if HAS_TIMM:
            feats = self.backbone.forward_features(x)   # (B, 768, H/32, W/32)
        else:
            feats = self.backbone(x)                    # (B, 768, h, w)
        target_h = max(1, x.shape[-2] // 32)
        target_w = max(1, x.shape[-1] // 32)
        if feats.shape[-2:] != (target_h, target_w):
            feats = nn.functional.interpolate(feats, size=(target_h, target_w), mode="bilinear", align_corners=False)
        return self.proj(feats)                         # (B, embed_dim, H//32, W//32)

    # ------------------------------------------------------------------
    # Convenience
    # ------------------------------------------------------------------

    def freeze(self) -> None:
        """Freeze all parameters (Stage-1 decoder training)."""
        for p in self.parameters():
            p.requires_grad_(False)

    def unfreeze(self) -> None:
        """Unfreeze all parameters (Stage-2 end-to-end fine-tune)."""
        for p in self.parameters():
            p.requires_grad_(True)

    @property
    def output_stride(self) -> int:
        return 32
