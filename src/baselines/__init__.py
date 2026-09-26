"""Ocean Deja Vu - Baseline Models for Subsurface Temperature Reconstruction.

Provides 4 reference baselines:
1. ClimatologyBaseline: Daily-mean GLORYS historical profile per pixel
2. PersistenceBaseline: Yesterday's GLORYS profile
3. LinearBaseline: Ridge regression from surface channels to vertical profiles
4. PlainUNetBaseline: Direct 2D U-Net predicting all 15 depth levels without pretraining
"""

from .climatology import ClimatologyBaseline
from .persistence import PersistenceBaseline
from .linear import LinearBaseline
from .unet import PlainUNetBaseline, train_unet_baseline
from .evaluate import evaluate_all_baselines

__all__ = [
    "ClimatologyBaseline",
    "PersistenceBaseline",
    "LinearBaseline",
    "PlainUNetBaseline",
    "train_unet_baseline",
    "evaluate_all_baselines",
]
