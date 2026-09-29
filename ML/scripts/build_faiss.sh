#!/usr/bin/env bash
# scripts/build_faiss.sh
# Build the FAISS analog retrieval index from training embeddings.
# Requires the trained encoder checkpoint and Zarr store.
set -euo pipefail

echo "=== Building FAISS Analog Index ==="
python - <<'EOF'
import torch, pickle, os, sys
sys.path.insert(0, ".")

from src.models.encoder import SurfaceEncoder
from src.models.retrieval import AnalogRetriever

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
encoder = SurfaceEncoder(in_channels=15, embed_dim=128)

ckpt = "checkpoints/stage2/best.ckpt"
if not os.path.exists(ckpt):
    ckpt = "checkpoints/pretrain/encoder_pretrained.ckpt"
    print(f"[warn] stage2 ckpt not found, using pretrain: {ckpt}")

state = torch.load(ckpt, map_location="cpu")
sd = state.get("state_dict", state)
sd_enc = {k.replace("encoder.", "").replace("mae.encoder.", ""): v
          for k, v in sd.items() if "encoder" in k}
encoder.load_state_dict(sd_enc, strict=False)

# Load Zarr dataloader (train split only)
try:
    from src.data.zarr_store import make_dataloaders
    train_dl, _ = make_dataloaders(
        "data/processed/ocean_odv.zarr",
        batch_size=16, num_workers=4,
        return_dates=True
    )
except Exception as e:
    print(f"[error] Could not load dataloader: {e}")
    sys.exit(1)

retriever = AnalogRetriever(embed_dim=128, k=8, seasonal_window_days=45)

# Load GLORYS profiles for the index
import zarr
store = zarr.open("data/processed/ocean_odv.zarr", "r")
glorys_profiles = {}
for d in store["dates/train"][:]:
    try:
        prof = store[f"target/{d}"][:]  # (15, H, W)
        glorys_profiles[d] = prof.reshape(15, -1).T  # (H*W, 15)
    except Exception:
        pass

retriever.build(encoder, train_dl, glorys_profiles, device, cache_dir="data/cache")
print("[done] FAISS index saved to data/cache/")
EOF
