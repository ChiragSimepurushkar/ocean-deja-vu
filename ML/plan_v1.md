# Ocean Deja Vu — Prototype Implementation Plan

### SIH Submission-Ready Build

---

## 0. Framing: What "Prototype" Means Here

The prototype must do four things simultaneously:

1. **Run end-to-end** — real data in, reconstructed temperature profiles out, with uncertainty bands.
2. **Be demonstrable live** — a browser-accessible UI a judge can click on during evaluation.
3. **Be individually defensible** — every component (encoder, decoder, retrieval, validation) is independently testable and produces logged metrics.
4. **Require only addons to become the full system** — no throwaway code; the prototype is the skeleton of production.

Anything that cannot satisfy all four is deferred. Anything that satisfies all four is in scope, even if simplified.

---

## 1. Repository Layout

```
ocean-deja-vu/
│
├── configs/
│   ├── data.yaml          # paths, domain bounds, depth levels
│   ├── model.yaml         # architecture hyperparams
│   └── train.yaml         # optimizer, schedule, seed
│
├── data/
│   ├── raw/               # netCDF downloads (gitignored)
│   ├── processed/         # zarr stores (gitignored)
│   └── cache/             # embeddings.npy, faiss.index (gitignored)
│
├── src/
│   ├── data/
│   │   ├── download.py        # copernicusmarine + PO.DAAC CLI wrappers
│   │   ├── regrid.py          # xESMF pipelines
│   │   ├── features.py        # derived channels (curl, div, grad, lat/lon/doy)
│   │   ├── normalize.py       # per-channel stats, anomaly computation
│   │   ├── eof.py             # EOF decomposition of target profiles
│   │   └── zarr_store.py      # patch extraction → zarr dataset
│   │
│   ├── models/
│   │   ├── encoder.py         # ConvNeXt-tiny surface encoder
│   │   ├── mae.py             # Masked-Autoencoder wrapper for pretraining
│   │   ├── decoder.py         # EOF-coefficient MLP decoder
│   │   ├── retrieval.py       # FAISS index + weighted fusion
│   │   └── uncertainty.py     # conformal calibration
│   │
│   ├── training/
│   │   ├── pretrain.py        # MAE training loop
│   │   ├── supervised.py      # decoder (then end-to-end) training loop
│   │   └── losses.py          # depth-weighted, steric, smoothness terms
│   │
│   ├── evaluation/
│   │   ├── metrics.py         # RMSE, bias, corr per depth/season/region
│   │   ├── argo_colloc.py     # ARGO collocation and hold-out protocol
│   │   └── ablation.py        # automated ablation runner
│   │
│   └── serving/
│       ├── api.py             # FastAPI app
│       ├── inference.py       # single-day inference pipeline
│       └── cache_warmer.py    # pre-render fields for demo
│
├── demo/
│   ├── app.py             # Streamlit front end
│   └── pages/
│       ├── 01_map.py          # spatial heatmap with time slider
│       ├── 02_profile.py      # click-to-profile, analog dates
│       └── 03_validation.py   # validation dashboard
│
├── notebooks/
│   ├── 01_eda.ipynb
│   ├── 02_eof_analysis.ipynb
│   └── 03_error_analysis.ipynb
│
├── scripts/
│   ├── build_dataset.sh       # runs all preprocessing steps in order
│   ├── pretrain.sh
│   ├── train_decoder.sh
│   ├── build_faiss.sh
│   └── evaluate.sh
│
├── tests/
│   ├── test_regrid.py
│   ├── test_model_shapes.py
│   └── test_metrics.py
│
├── requirements.txt
├── environment.yml
└── README.md
```

---

## 2. Tech Stack (pinned)

| Layer | Library | Notes |
| --- | --- | --- |
| Data I/O | `xarray`, `copernicusmarine`, `zarr`, `pooch` | zarr v2 for Dask-compatible chunk access |
| Regridding | `xesmf 0.8`, `scipy.interpolate` | conservative for SST/GLORYS, bilinear for SSS |
| EOF | `eofs` or `sklearn.decomposition.PCA` | PCA on flattened profiles; keep N modes > 99 % variance |
| Similarity search | `faiss-cpu` (or `faiss-gpu` if GPU available) | `IndexFlatIP` with L2-normalized embeddings = cosine |
| DL | `torch 2.x`, `timm` | `timm` provides ConvNeXt-tiny backbone |
| Training utils | `lightning 2.x`, `wandb` | Lightning module wraps encoder + decoder |
| Serving | `fastapi`, `uvicorn`, `httpx` |  |
| Demo | `streamlit 1.35`, `plotly`, `folium` |  |
| Config | `hydra-core` | compose configs, override from CLI |
| Uncertainty | `MAPIE` or manual conformal code |  |
| CI | `pytest`, `ruff`, `pre-commit` |  |

```bash
# environment bootstrap
conda create -n odv python=3.11
conda activate odv
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install timm lightning wandb xarray xesmf zarr copernicusmarine \
            eofs faiss-cpu fastapi uvicorn streamlit plotly folium \
            hydra-core MAPIE pooch scipy numpy pandas rich
```

---

## 3. Configuration (configs/)

```yaml
# configs/data.yaml
domain:
  lat: [5.0, 30.0]
  lon: [45.0, 105.0]
  res: 0.25
  nlat: 100
  nlon: 240

depths: [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]

channels:
  sst: {source: ostia, anomaly: true}
  sss: {source: smap_smos, anomaly: false}
  ssh: {source: duacs, anomaly: true}
  uo:  {source: oscar}
  vo:  {source: oscar}
  uw:  {source: ccmp}
  vw:  {source: ccmp}
  # derived — computed in features.py, not downloaded
  curl_tau: {}
  div_uv: {}
  sst_grad_x: {}
  sst_grad_y: {}
  # coordinate channels
  lat_sin: {}
  lon_cos: {}
  doy_sin: {}
  doy_cos: {}

n_surface_channels: 15  # 7 obs + 4 derived + 4 coord
n_depths: 15

splits:
  train: [2019, 2020, 2021]
  val: [2022]
  test: [2023]
  argo_holdout_boxes: [[10,20,75,90]]  # [lat0,lat1,lon0,lon1]

paths:
  raw:  data/raw
  proc: data/processed
  cache: data/cache
```

```yaml
# configs/model.yaml
encoder:
  backbone: convnext_tiny   # timm name
  pretrained_imagenet: false # train from scratch on ocean data
  embed_dim: 128
  patch_size: 1             # pixel-level (no spatial pooling before decoder)

mae:
  mask_ratio: 0.50
  channel_drop_prob: 0.20   # prob of dropping an entire channel
  decoder_dim: 256

decoder:
  eof_modes: 40             # target: EOF coefficients
  hidden: [512, 256]
  dropout: 0.10

retrieval:
  k: 8
  seasonal_window_days: 45
  blend_weight: 0.30        # decoder vs analog blend (tuned on val)

uncertainty:
  conformal_alpha: 0.10     # 90 % coverage target
```

---

## 4. Phase 1 — Data Acquisition & Preprocessing

### 4.1 Download Scripts (`src/data/download.py`)

Use `copernicusmarine` Python SDK, not the CLI, so downloads are scriptable and resumable.

```python
import copernicusmarine as cm

PRODUCTS = {
    "sst": dict(
        dataset_id="METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2",  # OSTIA
        variables=["analysed_sst"],
        start_datetime="2019-01-01",
        end_datetime="2023-12-31",
        minimum_latitude=4.5, maximum_latitude=30.5,
        minimum_longitude=44.5, maximum_longitude=105.5,
    ),
    "ssh": dict(
        dataset_id="SEALEVEL_GLO_PHY_L4_MY_008_047",        # DUACS
        variables=["sla", "adt"],
        # same bbox and dates
    ),
    "sss": dict(
        dataset_id="MULTIOBS_GLO_PHY_S_SURFACE_MYNRT_015_013",
        variables=["sos"],
    ),
    "glorys": dict(
        dataset_id="GLOBAL_MULTIYEAR_PHY_001_030",
        variables=["thetao"],
        # subset to 15 depth levels
    ),
}

def download_all(out_dir: str, skip_existing: bool = True):
    for name, kwargs in PRODUCTS.items():
        dst = Path(out_dir) / name
        if skip_existing and dst.exists():
            continue
        cm.subset(**kwargs, output_directory=str(dst), output_filename=f"{name}.nc")
```

OSCAR and CCMP go through PO.DAAC Earthdata; use `earthaccess` library:

```python
import earthaccess
earthaccess.login(strategy="environment")  # EARTHDATA_USERNAME / PASSWORD in .env

def download_oscar(out_dir):
    results = earthaccess.search_data(
        short_name="OSCAR_L4_OC_FINAL_V2.0",
        temporal=("2019-01-01","2023-12-31"),
        bounding_box=(44.5, 4.5, 105.5, 30.5)
    )
    earthaccess.download(results, out_dir)
```

### 4.2 Regridding (`src/data/regrid.py`)

```python
import xesmf as xe
import xarray as xr

TARGET_GRID = xr.Dataset({
    "lat": (["lat"], np.arange(5.125, 30.0, 0.25)),
    "lon": (["lon"], np.arange(45.125, 105.0, 0.25)),
})

def regrid(ds: xr.Dataset, var: str, method: str = "bilinear") -> xr.Dataset:
    regridder = xe.Regridder(ds, TARGET_GRID, method, periodic=False)
    return regridder(ds[var])

# SST: conservative (downsampling from 0.05°)
sst_regrid = regrid(sst_ds, "analysed_sst", "conservative")

# SSS: bilinear (upsampling from 0.125°)
sss_regrid = regrid(sss_ds, "sos", "bilinear")

# GLORYS: conservative (downsampling from 1/12°), subset 15 levels
glorys_regrid = regrid(glorys_ds.sel(depth=DEPTHS, method="nearest"), "thetao", "conservative")
```

Land-sea mask comes from GLORYS fill values. Store it once and apply consistently.

### 4.3 Feature Engineering (`src/data/features.py`)

```python
def wind_stress_curl(uw: xr.DataArray, vw: xr.DataArray, rho_air=1.225, Cd=1.3e-3):
    """∂(τ_y)/∂x − ∂(τ_x)/∂y on the 0.25° grid."""
    tau_x = rho_air * Cd * np.abs(np.hypot(uw, vw)) * uw
    tau_y = rho_air * Cd * np.abs(np.hypot(uw, vw)) * vw
    dx = 0.25 * 111_000 * np.cos(np.deg2rad(uw.lat))
    dy = 0.25 * 111_000
    curl = (np.gradient(tau_y.values, axis=-1) / dx.values[..., None] -
            np.gradient(tau_x.values, axis=-2) / dy)
    return xr.DataArray(curl, coords=tau_x.coords)

def surface_divergence(uo, vo):
    dx = 0.25 * 111_000 * np.cos(np.deg2rad(uo.lat))
    dy = 0.25 * 111_000
    return (np.gradient(uo.values, axis=-1) / dx.values[..., None] +
            np.gradient(vo.values, axis=-2) / dy)

def sst_gradients(sst):
    dx = 0.25 * 111_000 * np.cos(np.deg2rad(sst.lat))
    return (np.gradient(sst.values, axis=-1) / dx.values[..., None],
            np.gradient(sst.values, axis=-2) / (0.25 * 111_000))

def coordinate_channels(nlat=100, nlon=240, lats=None, lons=None, doy=None):
    """Broadcast lat, lon, doy into (C, H, W) arrays."""
    lat_sin = np.sin(np.deg2rad(lats))[:, None] * np.ones((1, nlon))
    lon_cos = np.cos(np.deg2rad(lons))[None, :] * np.ones((nlat, 1))
    doy_sin = np.sin(2 * np.pi * doy / 365.25) * np.ones((nlat, nlon))
    doy_cos = np.cos(2 * np.pi * doy / 365.25) * np.ones((nlat, nlon))
    return lat_sin, lon_cos, doy_sin, doy_cos
```

### 4.4 Normalization (`src/data/normalize.py`)

```python
class ChannelStats:
    """Fit on training set, apply everywhere. Saved to disk as JSON."""
    def fit(self, zarr_store, train_years):
        # stream through train split, accumulate mean and std per channel
        ...
    def transform(self, x: np.ndarray) -> np.ndarray:
        return (x - self.mean) / (self.std + 1e-6)
    def inverse_transform(self, x: np.ndarray) -> np.ndarray:
        return x * self.std + self.mean
    def save(self, path): ...
    def load(self, path): ...
```

SST and SLA anomalies: subtract the per-pixel daily climatology (computed over training years), then standardize.

### 4.5 EOF Compression (`src/data/eof.py`)

```python
from sklearn.decomposition import PCA

class ProfileEOF:
    """Fit on training profiles. Target → EOF coefficients → target."""
    def __init__(self, n_modes=40):
        self.pca = PCA(n_components=n_modes)
    
    def fit(self, profiles: np.ndarray):
        # profiles: (N_samples, 15) — flattened over space
        self.pca.fit(profiles)
        explained = self.pca.explained_variance_ratio_.cumsum()
        print(f"Modes {self.pca.n_components}: {explained[-1]*100:.2f}% variance")
    
    def encode(self, profiles): return self.pca.transform(profiles)
    def decode(self, coeffs):   return self.pca.inverse_transform(coeffs)
```

Typical result: 20–40 modes capture > 99 % variance in the North Indian Ocean.

### 4.6 Zarr Dataset (`src/data/zarr_store.py`)

```python
import zarr, torch
from torch.utils.data import Dataset

class OceanDataset(Dataset):
    """
    Each item: (surface: [C_surf, H, W], target_eof: [N_modes], mask: [H, W])
    Items indexed by (year, doy) from the split.
    """
    def __init__(self, store_path: str, split: str, stats: ChannelStats, eof: ProfileEOF):
        self.store = zarr.open(store_path, "r")
        self.dates = self.store[f"dates/{split}"][:]
        ...
    
    def __getitem__(self, idx):
        d = self.dates[idx]
        surface = self.store[f"surface/{d}"][:]      # (C, H, W)
        target  = self.store[f"target/{d}"][:]       # (15, H, W) depth profiles
        mask    = self.store["mask"][:]               # (H, W) land=0
        # flatten spatial, encode EOF
        prof_flat = target.reshape(15, -1).T          # (H*W, 15)
        eof_coeffs = self.eof.encode(prof_flat)       # (H*W, N_modes)
        eof_coeffs = eof_coeffs.T.reshape(-1, H, W)  # (N_modes, H, W)
        return torch.tensor(surface), torch.tensor(eof_coeffs), torch.tensor(mask)
```

Build script output: `data/processed/ocean_odv.zarr` (\~8–12 GB for 5 years).

---

## 5. Phase 2 — Baseline Models

Implement all baselines before the main model. They double as sanity checks.

```python
# src/evaluation/baselines.py

class ClimatologyBaseline:
    """Daily-mean GLORYS profile per pixel."""
    def fit(self, train_store): ...
    def predict(self, date, location): ...

class PersistenceBaseline:
    """Yesterday's GLORYS profile."""
    def predict(self, date, location): ...

class LinearBaseline:
    """Ridge regression: surface channels → EOF coefficients, per pixel."""
    def fit(self, train_store): ...
    def predict(self, surface_channels): ...

class PlainUNetBaseline(nn.Module):
    """Predicts all 15 depth levels directly, no encoder pretraining."""
    def __init__(self, in_channels=15, out_channels=15): ...
```

Run `scripts/evaluate.sh baselines` and log to W&B before touching the main model.

---

## 6. Phase 3 — Self-Supervised Encoder Pretraining

### Architecture (`src/models/encoder.py`)

```python
import timm, torch, torch.nn as nn

class SurfaceEncoder(nn.Module):
    """
    ConvNeXt-tiny modified for multi-channel geophysical input.
    Outputs spatial feature maps at 1/32 resolution, then pooled to embed_dim.
    """
    def __init__(self, in_channels: int = 15, embed_dim: int = 128):
        super().__init__()
        self.backbone = timm.create_model(
            "convnext_tiny",
            pretrained=False,
            in_chans=in_channels,
            num_classes=0,         # remove classifier head
            global_pool="",        # keep spatial output
        )
        feat_dim = self.backbone.num_features  # 768 for convnext_tiny
        self.proj = nn.Conv2d(feat_dim, embed_dim, kernel_size=1)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, C_surf, H, W)
        feats = self.backbone.forward_features(x)  # (B, 768, H/32, W/32)
        return self.proj(feats)                     # (B, embed_dim, H/32, W/32)
```

### MAE Wrapper (`src/models/mae.py`)

```python
class OceanMAE(nn.Module):
    """
    Two masking modes applied randomly per batch:
      - pixel masking: random 50% of (H,W) positions
      - channel drop: zero out one randomly chosen obs channel
    Decoder reconstructs masked values.
    """
    def __init__(self, encoder: SurfaceEncoder, mask_ratio=0.5, chan_drop_p=0.2):
        super().__init__()
        self.encoder = encoder
        self.mask_ratio = mask_ratio
        self.chan_drop_p = chan_drop_p
        # lightweight pixel decoder: just a few conv layers
        self.pixel_decoder = nn.Sequential(
            nn.Conv2d(encoder.embed_dim, 256, 1),
            nn.GELU(),
            nn.Upsample(scale_factor=32, mode="bilinear"),
            nn.Conv2d(256, encoder.in_channels, 1),
        )
    
    def forward(self, x, mask=None):
        x_masked, pixel_mask, chan_mask = self.apply_masking(x)
        z = self.encoder(x_masked)          # (B, D, h, w)
        x_hat = self.pixel_decoder(z)       # (B, C, H, W)
        loss = F.mse_loss(x_hat[pixel_mask], x[pixel_mask])
        return loss, x_hat
    
    def apply_masking(self, x):
        B, C, H, W = x.shape
        x = x.clone()
        # pixel masking
        noise = torch.rand(B, H, W, device=x.device)
        pixel_mask = noise < self.mask_ratio   # (B, H, W) bool
        x[pixel_mask.unsqueeze(1).expand_as(x)] = 0.0
        # channel drop
        chan_mask = torch.rand(B, C, device=x.device) < self.chan_drop_p
        # don't drop coord channels (last 4)
        chan_mask[:, -4:] = False
        x[chan_mask.unsqueeze(-1).unsqueeze(-1).expand_as(x)] = 0.0
        return x, pixel_mask, chan_mask
```

### Pretraining Loop (`src/training/pretrain.py`)

```python
import lightning as L

class MAELightning(L.LightningModule):
    def __init__(self, mae: OceanMAE, lr=1e-4):
        super().__init__()
        self.mae = mae
        self.lr = lr
    
    def training_step(self, batch, _):
        surface, _, mask = batch
        loss, _ = self.mae(surface)
        self.log("pretrain/loss", loss)
        return loss
    
    def configure_optimizers(self):
        opt = torch.optim.AdamW(self.parameters(), lr=self.lr, weight_decay=0.05)
        sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=100)
        return [opt], [sched]
```

Run: `python scripts/pretrain.sh` — \~20 epochs, \~2–4 hrs on a single A100.\
Output: `checkpoints/encoder_pretrained.ckpt`

---

## 7. Phase 4 — Supervised Decoder Training

### Decoder (`src/models/decoder.py`)

```python
class EOFDecoder(nn.Module):
    """
    Maps encoder output (spatial features) + metadata → EOF coefficients → profiles.
    Operates pixel-wise on the upsampled feature map.
    """
    def __init__(self, embed_dim=128, n_modes=40, hidden=[512, 256], dropout=0.1):
        super().__init__()
        layers = []
        in_dim = embed_dim
        for h in hidden:
            layers += [nn.Linear(in_dim, h), nn.GELU(), nn.Dropout(dropout)]
            in_dim = h
        layers.append(nn.Linear(in_dim, n_modes))
        self.mlp = nn.Sequential(*layers)
        self.upsample = nn.Upsample(size=(100, 240), mode="bilinear", align_corners=False)
    
    def forward(self, z: torch.Tensor) -> torch.Tensor:
        # z: (B, D, h, w) → upsample → (B, D, H, W)
        z = self.upsample(z)                           # (B, 128, 100, 240)
        B, D, H, W = z.shape
        z_flat = z.permute(0,2,3,1).reshape(-1, D)    # (B*H*W, D)
        coeffs = self.mlp(z_flat)                      # (B*H*W, N_modes)
        return coeffs.reshape(B, H, W, -1).permute(0,3,1,2)  # (B, N_modes, H, W)
```

### Loss Function (`src/training/losses.py`)

```python
# Depth weights: surface levels penalized more
DEPTH_WEIGHTS = torch.tensor([3,3,2,2,2,1.5,1.5,1,1,1,0.8,0.6,0.4,0.3,0.2])

def depth_weighted_mse(pred_profiles, true_profiles, mask):
    """pred/true: (B, 15, H, W); mask: (B, H, W)"""
    w = DEPTH_WEIGHTS.to(pred_profiles.device)[None,:,None,None]
    err = (pred_profiles - true_profiles)**2 * w
    return (err * mask.unsqueeze(1)).sum() / (mask.sum() * 15)

def vertical_smoothness(profiles):
    """Penalize large vertical gradients."""
    dz = profiles[:, 1:] - profiles[:, :-1]
    return (dz**2).mean()

def steric_consistency_loss(pred_profiles, sla, alpha_steric=1.0):
    """
    Thermal expansion: ∫ α(T) * T dz ≈ linear proxy for steric SLA.
    Encourages depth-integrated warming to be consistent with observed SLA.
    alpha ≈ 2e-4 /°C (simplified)
    """
    dz = torch.tensor([5,5,5,10,10,20,25,25,25,50,100,200,200,300],  # layer thicknesses m
                       dtype=pred_profiles.dtype, device=pred_profiles.device)
    steric_pred = (pred_profiles[:, :-1] * 2e-4 * dz[None,:,None,None]).sum(dim=1)
    return F.mse_loss(steric_pred, sla)

def total_loss(pred_eof, true_eof, pred_profiles, true_profiles, sla, mask, eof_obj):
    l_eof  = F.mse_loss(pred_eof[mask.bool()], true_eof[mask.bool()])
    l_phys = depth_weighted_mse(pred_profiles, true_profiles, mask)
    l_sm   = vertical_smoothness(pred_profiles)
    l_str  = steric_consistency_loss(pred_profiles, sla)
    return l_eof + l_phys + 0.1*l_sm + 0.05*l_str
```

### Training Protocol (`src/training/supervised.py`)

**Stage 1**: Freeze encoder → train decoder only. 50 epochs, lr=5e-4.\
**Stage 2**: Unfreeze encoder → end-to-end fine-tune. 30 epochs, lr=1e-5, grad clip 1.0.

```python
class ReconstructionLightning(L.LightningModule):
    def __init__(self, encoder, decoder, eof_obj, stage=1):
        ...
    def on_train_epoch_start(self):
        if self.current_epoch == 0 and self.stage == 1:
            for p in self.encoder.parameters():
                p.requires_grad = False
    def training_step(self, batch, _):
        surface, true_eof, mask = batch
        z = self.encoder(surface)
        pred_eof = self.decoder(z)
        # decode EOF → profiles for physical losses
        pred_profiles = self.eof_obj.decode_batch(pred_eof)
        true_profiles = self.eof_obj.decode_batch(true_eof)
        loss = total_loss(pred_eof, true_eof, pred_profiles, true_profiles,
                          batch["sla"], mask, self.eof_obj)
        self.log_dict({"train/loss": loss})
        return loss
```

---

## 8. Phase 5 — Analog Retrieval & Uncertainty

### Build the Index (`src/models/retrieval.py`)

```python
import faiss, numpy as np

class AnalogRetriever:
    def __init__(self, embed_dim=128, k=8, seasonal_window=45):
        self.index = faiss.IndexFlatIP(embed_dim)  # cosine via L2-norm
        self.k = k
        self.sw = seasonal_window
        self.embeddings = []      # list of (date, embedding_mean, glorys_profile)
    
    def build(self, encoder, train_loader, glorys_store, device):
        encoder.eval()
        with torch.no_grad():
            for batch in train_loader:
                surface, _, mask = batch
                z = encoder(surface.to(device))            # (B, D, h, w)
                z_mean = z.mean(dim=[-2,-1]).cpu().numpy() # (B, D) global mean embedding
                z_norm = z_mean / (np.linalg.norm(z_mean, axis=1, keepdims=True) + 1e-8)
                self.index.add(z_norm.astype(np.float32))
                # store corresponding GLORYS profiles + dates
                ...
        faiss.write_index(self.index, "data/cache/faiss.index")
    
    def query(self, z_query: np.ndarray, query_doy: int):
        """Returns k analog profiles and their similarity weights."""
        # seasonal filter: restrict FAISS search to a seasonal window subset
        seasonal_ids = self._seasonal_subset(query_doy)
        if len(seasonal_ids) < self.k:
            seasonal_ids = None  # fallback: no restriction
        
        D, I = self.index.search(z_query[None], self.k)
        weights = torch.softmax(torch.tensor(D[0]), dim=0)
        profiles = np.stack([self.stored_profiles[i] for i in I[0]])
        analog_mean = (weights.numpy()[:, None] * profiles).sum(0)
        analog_spread = np.sqrt(((profiles - analog_mean[None])**2 *
                                  weights.numpy()[:, None]).sum(0))
        return analog_mean, analog_spread, I[0], weights
    
    def fuse(self, decoder_pred, analog_mean, blend_weight=0.30):
        return (1 - blend_weight) * decoder_pred + blend_weight * analog_mean
```

### Conformal Calibration (`src/models/uncertainty.py`)

```python
def calibrate_conformal(pred_profiles, true_profiles, alpha=0.10):
    """
    Compute depth-wise conformal quantiles on the calibration (val) set.
    Returns q_lo, q_hi per depth level.
    """
    residuals = np.abs(pred_profiles - true_profiles)  # (N, 15)
    n = len(residuals)
    q = np.quantile(residuals, 1 - alpha, axis=0)       # (15,)
    return q  # add ± q to get 90% coverage bands

def apply_bands(pred, spread_analog, conformal_q):
    """Combine conformal quantile with analog spread for final bands."""
    total_uncertainty = np.sqrt(conformal_q**2 + spread_analog**2)
    return pred - total_uncertainty, pred + total_uncertainty
```

---

## 9. Phase 6 — Validation Framework

### ARGO Collocation (`src/evaluation/argo_colloc.py`)

```python
def load_argo_profiles(incois_path: str) -> pd.DataFrame:
    """Load INCOIS LAS netCDF, return DataFrame with columns:
    date, lat, lon, depth, temp, qc_flag"""
    ...

def collocate_to_grid(argo_df, grid_lats, grid_lons):
    """Snap each ARGO float to nearest 0.25° grid cell."""
    argo_df["ilat"] = np.round((argo_df.lat - 5.0) / 0.25).astype(int)
    argo_df["ilon"] = np.round((argo_df.lon - 45.0) / 0.25).astype(int)
    return argo_df[(argo_df.ilat >= 0) & (argo_df.ilat < 100) &
                   (argo_df.ilon >= 0) & (argo_df.ilon < 240)]

def holdout_protocol(argo_df, holdout_boxes, holdout_years):
    """Return separate DataFrames for in-sample and held-out ARGO."""
    ...
```

### Metrics (`src/evaluation/metrics.py`)

```python
def compute_skill(pred, obs, depths=DEPTHS, seasons=None, region=None):
    """
    Returns DataFrame with columns: depth, season, region, rmse, bias, corr.
    All reported at depth levels, then averaged over space within region.
    """
    rows = []
    for d_idx, d in enumerate(depths):
        for season in (seasons or ["all"]):
            mask = seasonal_mask(obs, season) if season != "all" else True
            p, o = pred[mask, d_idx], obs[mask, d_idx]
            valid = ~np.isnan(o)
            rows.append({
                "depth": d,
                "season": season,
                "rmse": np.sqrt(np.mean((p[valid]-o[valid])**2)),
                "bias": np.mean(p[valid]-o[valid]),
                "corr": np.corrcoef(p[valid], o[valid])[0,1],
            })
    return pd.DataFrame(rows)
```

### Ablation Runner (`src/evaluation/ablation.py`)

| Experiment | Description |
| --- | --- |
| `no_pretrain` | Random encoder weights, supervised only |
| `no_eof` | Decoder predicts 15 depths directly |
| `no_steric` | Remove steric consistency loss |
| `no_analog` | Pure decoder output, no retrieval fusion |
| `full_model` | Everything enabled |

Each ablation variant is a Hydra config override. Run all five and log to the same W&B project for comparison.

---

## 10. Phase 7 — Serving Layer

### FastAPI (`src/serving/api.py`)

```python
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
import numpy as np

app = FastAPI(title="Ocean Deja Vu API", version="1.0")

@app.get("/field/{date}")
async def get_field(
    date: str,                           # YYYY-MM-DD
    var: str = Query("temp_0m"),         # e.g. temp_100m, mld, d20, uhc
    fmt: str = Query("json"),            # json | zarr
):
    """Return a 100×240 field for the given date and variable."""
    field = cache.load_field(date, var)
    return {"lat": lats.tolist(), "lon": lons.tolist(), "data": field.tolist()}

@app.get("/profile/{date}")
async def get_profile(
    date: str,
    lat: float = Query(...),
    lon: float = Query(...),
):
    """Return a temperature profile with uncertainty and analog dates."""
    result = inference_pipeline.run(date, lat, lon)
    return {
        "depths": DEPTHS,
        "temp_pred": result.pred.tolist(),
        "temp_lo":   result.lo.tolist(),
        "temp_hi":   result.hi.tolist(),
        "analog_dates": result.analog_dates,
        "analog_weights": result.weights.tolist(),
    }

@app.get("/diagnostics/{date}")
async def get_diagnostics(date: str, lat: float, lon: float):
    """MLD, thermocline depth, D20, upper heat content."""
    profile = inference_pipeline.run(date, lat, lon).pred
    return {
        "mld": compute_mld(profile),
        "thermocline_depth": compute_thermocline(profile),
        "d20": compute_d20(profile),
        "uhc": compute_uhc(profile),
    }
```

### Derived Diagnostics (`src/serving/inference.py`)

```python
def compute_mld(profile: np.ndarray, criterion_dt=0.2) -> float:
    """Mixed layer depth: first depth where ΔT > 0.2°C from surface."""
    sst = profile[0]
    for i, (d, t) in enumerate(zip(DEPTHS, profile)):
        if abs(t - sst) > criterion_dt and d > 0:
            return float(d)
    return float(DEPTHS[-1])

def compute_d20(profile: np.ndarray) -> float:
    """Depth of the 20°C isotherm (El Niño proxy for Indian Ocean)."""
    from scipy.interpolate import interp1d
    f = interp1d(profile, DEPTHS, kind="linear", fill_value="extrapolate")
    return float(np.clip(f(20.0), 0, 1000))

def compute_uhc(profile: np.ndarray, ref_temp=26.0, max_depth=300.0) -> float:
    """Upper ocean heat content above 26°C isotherm."""
    dz = np.gradient(DEPTHS)
    uhc = np.sum(np.maximum(profile - ref_temp, 0) * dz *
                 1025 * 3990 * 1e-8)   # W·yr/m²
    return float(uhc)
```

---

## 11. Demo UI (`demo/app.py`)

Built in **Streamlit** for speed. Three pages:

### Page 1 — Spatial Explorer (`demo/pages/01_map.py`)

```python
import streamlit as st, plotly.graph_objects as go, httpx

st.set_page_config(layout="wide", page_title="Ocean Deja Vu")
st.title("🌊 Ocean Deja Vu — Subsurface Temperature Explorer")

col1, col2 = st.columns([2, 1])
with col1:
    date = st.date_input("Select date", value=datetime(2023, 6, 1))
    depth = st.select_slider("Depth (m)", options=DEPTHS, value=50)

# Fetch field from API
field = httpx.get(f"{API_URL}/field/{date}?var=temp_{depth}m").json()

with col1:
    fig = go.Figure(go.Heatmap(
        z=field["data"], x=field["lon"], y=field["lat"],
        colorscale="RdBu_r", zmid=28,
        colorbar=dict(title="°C"),
    ))
    fig.update_layout(height=500, margin=dict(l=0,r=0,t=0,b=0))
    clicked = st.plotly_chart(fig, use_container_width=True,
                               on_select="rerun", key="map")

# If user clicked a point, show profile on the right
if clicked and clicked["selection"]["points"]:
    pt = clicked["selection"]["points"][0]
    with col2:
        render_profile(date, pt["x"], pt["y"])
```

### Page 2 — Profile Viewer (`demo/pages/02_profile.py`)

- Vertical profile plot with uncertainty band (shaded ribbon)
- Overlay ARGO observation if available
- Table of top-k analog dates with similarity scores
- Single-line thermocline / MLD / D20 / UHC readout

### Page 3 — Validation Dashboard (`demo/pages/03_validation.py`)

- RMSE vs depth curve (model vs baselines, side-by-side)
- Season × depth heatmap
- BoB vs Arabian Sea comparison
- Calibration plot: predicted uncertainty vs actual error

---

## 12. Pre-Compute Cache (`src/serving/cache_warmer.py`)

Before the demo, pre-render all fields for the test year (2023) so the demo runs without GPU:

```python
VARS_TO_CACHE = [
    *[f"temp_{d}m" for d in DEPTHS],
    "mld", "d20", "uhc", "thermocline_depth"
]

def warm_cache(model, test_dates, out_dir):
    for date in tqdm(test_dates):
        for var in VARS_TO_CACHE:
            field = inference_pipeline.predict_field(model, date, var)
            np.save(f"{out_dir}/{date}_{var}.npy", field)
```

Cache size: \~15 vars × 365 days × 100×240 × 4 bytes ≈ 5 GB. Manageable on a USB drive or shared storage.

---

## 13. Testing Strategy

```
tests/
├── test_regrid.py          # regridding conserves mass (global mean within 0.01%)
├── test_features.py        # curl(constant wind) ≈ 0; grad sanity checks
├── test_model_shapes.py    # encoder output shape, decoder output shape, end-to-end
├── test_eof_roundtrip.py   # encode→decode reconstruction error < 0.01°C mean
├── test_metrics.py         # RMSE of perfect prediction = 0
└── test_api.py             # FastAPI endpoints return expected structure
```

Run: `pytest tests/ -v` — all tests should pass before any training run.

---

## 14. Weights & Biases Tracking

```python
# Every training run logs:
wandb.init(project="ocean-deja-vu", config=OmegaConf.to_container(cfg))

# Metrics logged per epoch:
wandb.log({
    "val/rmse_0m": ..., "val/rmse_100m": ..., "val/rmse_300m": ...,
    "val/rmse_mean": ...,
    "val/corr_0m": ...,
    "pretrain/loss": ...,  # during MAE phase
    "train/total_loss": ..., "train/steric_loss": ...,
})

# Artifact versioning:
artifact = wandb.Artifact("model", type="model")
artifact.add_file("checkpoints/best.ckpt")
wandb.log_artifact(artifact)
```

---

## 15. Build Order & Timeline

```
Week 1 — Data & Infrastructure
  Day 1-2: Repo setup, environment, configs, unit tests scaffold
  Day 3-4: Download pipeline (copernicusmarine + earthaccess)
  Day 5-7: Regrid + features + normalize + zarr_store → verify with EDA notebook

Week 2 — Baselines & Encoder
  Day 1-2: Baseline models + evaluation framework + ARGO collocation
  Day 3-5: EOF compression (verify % variance), adjust n_modes
  Day 5-7: MAE pretraining run (~20 epochs); visualize reconstruction quality

Week 3 — Decoder & Retrieval
  Day 1-3: Decoder Stage 1 (frozen encoder); validate shapes & loss descent
  Day 4-5: Decoder Stage 2 (end-to-end fine-tune)
  Day 6-7: FAISS index build; analog retrieval + fusion; conformal calibration

Week 4 — Validation & Application
  Day 1-2: Full ARGO validation; ablation runs (all 5 variants)
  Day 3-4: FastAPI backend + cache warmer
  Day 5-7: Streamlit demo (all 3 pages); polish, dark theme, mobile-friendly

Week 5 — Buffer & Polish
  Case studies: monsoon onset (June 2023), Cyclone Biparjoy
  Documentation: README, inline docstrings, figure scripts
  W&B report: auto-generated summary of all ablations
  SIH presentation: 5-slide technical deck + live demo script
```

---

## 16. Known Prototype Limitations (Honest Reporting)

| Limitation | Expected Impact | Full-system Fix |
| --- | --- | --- |
| No spatial patch extraction — whole domain per sample | Higher memory, slightly noisier gradients | Patch-based training with overlap |
| FAISS index over daily means (not spatial patches) | Analog retrieval is position-agnostic | Patch-level FAISS |
| Conformal bands from val set only | Bands may be overconfident in edge cases | Isotonic calibration per depth |
| No Bhashini bot | No multilingual alerts | Telegram/WhatsApp API + Bhashini |
| No ESP32 sensor integration | No live shallow-cast feeds | Add as optional data source |
| SSS data gaps during monsoon | Surface state less well-constrained | Channel drop masking handles this |

These are limitations to **name explicitly in the SIH presentation**, not hide. Judges reward honesty and a clear roadmap.

---

## 17. SIH Demo Script (Day-of Checklist)

```
□ Docker container or conda env verified on presentation machine
□ FastAPI running on localhost:8000 (or Render/Railway for cloud backup)
□ Streamlit running on localhost:8501
□ Pre-cached fields loaded (USB backup if internet fails)
□ W&B run URL ready to show validation curves
□ 3 rehearsed demo paths:
    Path A: Pick June 2023 → 50 m depth → click BoB → show profile + uncertainty
    Path B: Switch to Arabian Sea → show thermocline depth difference
    Path C: Show validation page → RMSE curve vs baselines
□ Fallback: Jupyter notebook with pre-run cells if Streamlit crashes
```

---

## 18. What to Prepare in Parallel (Research Thread)

While the above is being built:

- Literature: Ballabrera-Poy 2003 (SSH→subsurface), Su et al. 2015 (SSH+SST regression), recent ML papers on ocean profile prediction
- Domain: understand Indian Ocean Dipole, EICC/WICC, monsoon freshwater flux — these inform which features to weight
- Data: check INCOIS ARGO availability and data access procedure before Week 4
- Physics: verify steric height formula with a test profile from GLORYS before implementing the loss

---

*This document is the single source of truth for prototype development. Any scope decision not addressed here defaults to: build the simpler version, log it as a known limitation, and move forward.*
