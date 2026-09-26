#!/usr/bin/env bash
# scripts/pretrain.sh
# Self-supervised MAE pretraining.
# Run from the repo root: bash scripts/pretrain.sh
set -euo pipefail

STORE="data/processed/ocean_odv.zarr"
CKPT_DIR="checkpoints/pretrain"
EPOCHS=${EPOCHS:-20}
BATCH=${BATCH:-8}
SEED=${SEED:-42}

echo "=== Ocean Deja Vu — MAE Pretraining ==="
echo "Store: $STORE | Epochs: $EPOCHS | Batch: $BATCH"

python -m src.training.pretrain \
    --store_path   "$STORE" \
    --in_channels  15 \
    --embed_dim    128 \
    --mask_ratio   0.50 \
    --channel_drop_prob 0.20 \
    --decoder_dim  256 \
    --target_h     100 \
    --target_w     240 \
    --epochs       "$EPOCHS" \
    --batch_size   "$BATCH" \
    --lr           1e-4 \
    --weight_decay 0.05 \
    --grad_clip    1.0 \
    --num_workers  4 \
    --checkpoint_dir "$CKPT_DIR" \
    --seed         "$SEED" \
    --run_tag      pretrain_v1

echo "=== Pretraining complete. Encoder: $CKPT_DIR/ ==="
