#!/usr/bin/env bash
# scripts/evaluate.sh
# Run ARGO-based validation and ablation study.
set -euo pipefail

ARGO="data/processed/argo_collocated.parquet"
STORE="data/processed/ocean_odv.zarr"
EOF_PATH="data/cache/eof.pkl"

echo "=== Running Ablation Evaluation ==="
python -m src.evaluation.ablation \
    --variants full_model no_pretrain no_eof no_steric no_analog \
    --store_path   "$STORE" \
    --eof_path     "$EOF_PATH" \
    --encoder_ckpt checkpoints/pretrain/encoder_pretrained.pt \
    --stage2_ckpt  checkpoints/stage2/stage2_final.pt \
    --argo_parquet "$ARGO" \
    --out          data/cache/ablation_results.parquet

echo "=== Ablation complete. Results: data/cache/ablation_results.parquet ==="
