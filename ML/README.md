# 🌊 Ocean Deja Vu

> **Reconstruct daily subsurface ocean temperature at 15 depth levels (0–1000 m)
> over the North Indian Ocean using only satellite surface observations.**
>
> Explainable • Uncertainty-aware • ARGO-validated

---

## What it does

Ocean Deja Vu takes 7 publicly available satellite surface fields (SST, SSS,
SSH, surface currents, winds) and reconstructs the full 3-D temperature
structure of the ocean — no ship or float required for the reconstruction.
Each prediction includes:

- **Temperature profile** at 15 standard depths (0 – 1000 m), in °C
- **Uncertainty bands** (split-conformal, 90% coverage)
- **Analog dates** — the k most similar historical ocean states (explainability)
- **Derived diagnostics** — mixed-layer depth, thermocline depth, D20 isotherm,
  upper-ocean heat content

---

## Team split (hackathon)

| Owner | Scope |
|-------|-------|
| **Dev 1 — Data & Pipeline** | Downloads, regridding, feature engineering, Zarr store, baselines |
| **Dev 2 — ML/Modeling** ← *this branch* | Encoder, MAE, decoder, retrieval, uncertainty, validation |
| **Dev 3 — Backend & UI** | FastAPI, Streamlit demo, advisory bot |

---

## Branch: `dev2-ml-modeling`

This branch owns everything in `src/models/`, `src/training/`, `src/evaluation/`,
and `src/serving/inference.py`.

### Deliverables on this branch

| File | What it does |
|------|-------------|
| `src/models/encoder.py` | ConvNeXt-tiny surface encoder (15 → 128-d embeddings) |
| `src/models/mae.py` | Masked-Autoencoder pretraining wrapper |
| `src/models/decoder.py` | Pixel-wise MLP: embeddings → EOF coefficients → profiles |
| `src/models/retrieval.py` | FAISS cosine-similarity analog retrieval + fusion |
| `src/models/uncertainty.py` | Split-conformal calibration + coverage diagnostics |
| `src/training/losses.py` | Depth-weighted + smoothness + steric consistency losses |
| `src/training/pretrain.py` | Lightning MAE pretraining loop |
| `src/training/supervised.py` | Two-stage supervised training (frozen → end-to-end) |
| `src/evaluation/metrics.py` | RMSE/bias/corr per depth/season/basin |
| `src/evaluation/argo_colloc.py` | ARGO collocation + leakage-safe hold-out |
| `src/evaluation/ablation.py` | 5-variant ablation runner |
| `src/serving/inference.py` | End-to-end inference + diagnostics |
| `tests/test_model_shapes.py` | Shape & correctness tests (no real data needed) |
| `tests/test_metrics.py` | Metrics unit tests |
| `tests/test_eof_roundtrip.py` | EOF encode/decode roundtrip |

---

## Quick start (Dev 2)

```bash
# 1. Clone and create branch
git clone https://github.com/ChiragSimepurushkar/ocean-deja-vu.git
cd ocean-deja-vu
git checkout dev2-ml-modeling

# 2. Create conda environment (includes xESMF via conda-forge)
conda env create -f environment.yml
conda activate odv

# 3. Install torch with CUDA (adjust cu121 to your CUDA version)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# 4. Run shape tests (no ocean data needed)
pytest tests/test_model_shapes.py tests/test_metrics.py tests/test_eof_roundtrip.py -v

# 5. Once Dev 1 has the Zarr store ready:
bash scripts/pretrain.sh         # ~2–4 hrs on A100
bash scripts/train_decoder.sh    # stage1 (50 ep) + stage2 (30 ep)
bash scripts/build_faiss.sh      # build analog index
bash scripts/evaluate.sh         # ARGO validation + ablations
```

---

## Training pipeline overview

```
Surface fields (Zarr)
       │
       ▼
  SurfaceEncoder              ← ConvNeXt-tiny, 15 channels → 128-d
  (pretrained via MAE)
       │
       ▼
   EOFDecoder                 ← pixel-wise MLP → 40 EOF coefficients
       │
       ▼
  TorchEOFBridge.decode()    ← PCA inverse: coefficients → 15 depths (°C)
       │
       ├──► depth_weighted_mse  ┐
       ├──► vertical_smoothness ├── total_loss
       ├──► steric_consistency  ┘
       │
       ▼
   AnalogRetriever            ← FAISS: k nearest historical days
       │  (blend_weight=0.30)
       ▼
  Fused prediction + spread
       │
       ▼
  ConformalCalibrator         ← 90% coverage uncertainty bands
```

---

## Key design decisions

### Why ConvNeXt-tiny?
- Comparable accuracy to ViT-Small but 5× cheaper to train from scratch.
- No positional-embedding issues when input resolution changes.
- `timm` integration makes the stem swap trivial.

### Why EOF decoding?
- Drastically reduces the decoder's output space (40 modes vs 15 × 100 × 240 values).
- Forces the decoder to learn physically meaningful vertical structures.
- EOF roundtrip error < 0.05°C on NIO profiles.

### Why conformal prediction?
- Gives **honest** coverage guarantees without distributional assumptions.
- Calibrated once on the validation set; zero additional training cost.
- Coverage reported per depth level (skill drops below ~300 m as expected).

### Why FAISS + seasonal window?
- Cosine similarity in embedding space captures "similar ocean states."
- Seasonal restriction prevents physically nonsensical analogs
  (e.g. a January BoB matching a July AS).
- Analog spread is a natural first-order uncertainty proxy.

---

## Interfaces with other branches

### With Dev 1 (Data & Pipeline)
Dev 2 expects these files to exist before training:

| File | Description |
|------|-------------|
| `data/processed/ocean_odv.zarr` | Zarr store with `surface/{date}`, `target/{date}`, `mask`, `dates/{split}` |
| `data/cache/eof.pkl` | Pickled sklearn PCA object fitted on training profiles |
| `data/processed/argo_collocated.parquet` | Output of `argo_colloc.collocate_to_grid()` |

### With Dev 3 (Backend & UI)
Dev 3 calls `InferencePipeline.run(date, lat, lon)` and `InferencePipeline.predict_field(date, var)`.
The FastAPI app imports from `src.serving.inference`.

---

## Ablation table (target)

| Model | RMSE 0m | RMSE 100m | RMSE 300m | Corr (mean) |
|-------|---------|-----------|-----------|-------------|
| Climatology | ~1.8°C | ~2.1°C | ~1.5°C | ~0.40 |
| Persistence | ~1.2°C | ~1.6°C | ~1.3°C | ~0.55 |
| Linear reg | ~0.9°C | ~1.3°C | ~1.2°C | ~0.70 |
| U-Net (baseline) | ~0.7°C | ~1.0°C | ~1.0°C | ~0.78 |
| **Full model** | **~0.5°C** | **~0.7°C** | **~0.9°C** | **~0.85** |

*Numbers are rough targets; actual results depend on training data coverage.*

---

## Known limitations (honest reporting)

| Limitation | Impact | Planned fix |
|------------|--------|-------------|
| Skill drops below ~300 m | Expected; shown in RMSE curve | No fix — report honestly |
| FAISS index is spatially averaged per day | Analog retrieval is position-agnostic | Patch-level FAISS (v2) |
| Conformal bands from val set only | May be overconfident in edge cases | Isotonic calibration per depth |
| No monsoon SSS data | Surface state less constrained Jul–Sep | Channel-drop masking handles this |

---

## License

MIT. See `LICENSE`.

---

*Ocean Deja Vu — SIH 2024 Prototype. Dev 2: ML/Modeling branch.*
