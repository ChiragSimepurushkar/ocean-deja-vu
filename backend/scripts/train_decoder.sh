#!/usr/bin/env bash
# scripts/train_decoder.sh
# Two-stage supervised decoder training.
# Run from repo root after pretrain.sh completes.
set -euo pipefail

STORE="${STORE:-../Dataset}"
EOF_PATH="data/cache/eof.pkl"
ENC_CKPT="checkpoints/pretrain/encoder_pretrained.ckpt"

echo "=== Stage 1: Frozen encoder, train decoder only ==="
python -m src.training.supervised \
    --stage          1 \
    --encoder_ckpt   "$ENC_CKPT" \
    --eof_path       "$EOF_PATH" \
    --store_path     "$STORE" \
    --epochs         50 \
    --batch_size     8 \
    --lr             5e-4 \
    --checkpoint_dir checkpoints/stage1 \
    --run_tag        stage1_v1

echo "=== Stage 2: End-to-end fine-tune ==="
python -m src.training.supervised \
    --stage          2 \
    --model_ckpt     checkpoints/stage1/best.ckpt \
    --eof_path       "$EOF_PATH" \
    --store_path     "$STORE" \
    --epochs         30 \
    --batch_size     4 \
    --checkpoint_dir checkpoints/stage2 \
    --run_tag        stage2_v1

echo "=== Training complete. Best model: checkpoints/stage2/ ==="
