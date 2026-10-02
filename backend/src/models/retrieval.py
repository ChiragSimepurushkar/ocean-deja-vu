"""
src/models/retrieval.py
-----------------------
FAISS-based analog retrieval and decoder-analog fusion for the
Ocean Deja Vu explainability & uncertainty module.

Design overview:
  1. During training, run every training-day surface map through the (frozen)
     encoder, spatially average the embedding, L2-normalise, and add to a
     FAISS IndexFlatIP index (inner-product = cosine similarity after norm).
  2. At inference, query the index with the current embedding to find the k
     nearest historical days, optionally restricted to a seasonal window.
  3. Blend the similarity-weighted analog profile with the decoder prediction.
  4. Return the analog spread as a first-order uncertainty signal
     (refined later by conformal calibration in uncertainty.py).

Seasonal restriction is implemented by pre-computing per-day-of-year (DOY)
membership flags and passing a FAISS ID-selector at query time.

All arrays are float32; the index lives in CPU RAM and is serialised to
`data/cache/faiss.index` so it can be reloaded without re-running the encoder.
"""

from __future__ import annotations

import os
import pickle
from dataclasses import dataclass, field
from datetime import date
from typing import Optional

import numpy as np
import torch

try:
    import faiss
    HAS_FAISS = True
except ImportError:
    faiss = None
    HAS_FAISS = False


class NumpyIndexFlatIP:
    """Pure NumPy fallback for FAISS IndexFlatIP (cosine similarity via inner product)."""
    def __init__(self, d: int):
        self.d = d
        self.vectors: np.ndarray = np.empty((0, d), dtype=np.float32)

    @property
    def ntotal(self) -> int:
        return len(self.vectors)

    def add(self, x: np.ndarray):
        x = np.asarray(x, dtype=np.float32)
        if x.ndim == 1:
            x = x[None, :]
        self.vectors = np.vstack([self.vectors, x])

    def search(self, q: np.ndarray, k: int) -> tuple[np.ndarray, np.ndarray]:
        if len(self.vectors) == 0:
            return np.zeros((q.shape[0], k), dtype=np.float32), np.zeros((q.shape[0], k), dtype=int)
        scores = q @ self.vectors.T
        k_val = min(k, scores.shape[1])
        top_idx = np.argsort(-scores, axis=1)[:, :k_val]
        top_scores = np.take_along_axis(scores, top_idx, axis=1)
        return top_scores.astype(np.float32), top_idx.astype(np.int64)

    def reconstruct(self, i: int) -> np.ndarray:
        return self.vectors[i]


from src.models.encoder import SurfaceEncoder


# ──────────────────────────────────────────────────────────────────────────────
# Data container for a single retrieval result
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class AnalogResult:
    analog_profile: np.ndarray        # (n_depths,) or (H, W, n_depths) weighted mean
    analog_spread:  np.ndarray        # same shape — weighted std across k analogs
    analog_dates:   list[str]         # ISO-8601 date strings for top-k
    weights:        np.ndarray        # (k,) similarity weights
    raw_profiles:   np.ndarray        # (k, n_depths) individual analog profiles


# ──────────────────────────────────────────────────────────────────────────────
# AnalogRetriever
# ──────────────────────────────────────────────────────────────────────────────

class AnalogRetriever:
    """
    FAISS cosine-similarity retriever over daily encoder embeddings.

    Parameters
    ----------
    embed_dim : int
        Encoder embedding dimension (128 by default).
    k : int
        Number of nearest neighbors to retrieve.
    seasonal_window_days : int
        Half-width (in days) of the DOY window used to restrict retrieval.
        Set to 183 to disable seasonal restriction.
    """

    def __init__(
        self,
        embed_dim: int = 128,
        k: int = 8,
        seasonal_window_days: int = 45,
    ) -> None:
        self.embed_dim = embed_dim
        self.k = k
        self.sw = seasonal_window_days

        # FAISS index (inner product; cosine when embeddings are L2-normalised)
        self.index = faiss.IndexFlatIP(embed_dim) if HAS_FAISS else NumpyIndexFlatIP(embed_dim)

        # Metadata stored in parallel lists (index in these == FAISS row id)
        self._dates: list[str] = []         # ISO date strings
        self._doys:  list[int] = []         # day-of-year (1–366)
        self._profiles: list[np.ndarray] = []  # (n_depths,) mean profile per day

    # ------------------------------------------------------------------
    # Building the index
    # ------------------------------------------------------------------

    def build(
        self,
        encoder: SurfaceEncoder,
        dataloader: torch.utils.data.DataLoader,  # type: ignore[name-defined]
        glorys_profiles: dict[str, np.ndarray],   # date → (H*W, n_depths) array
        device: torch.device,
        cache_dir: str = "data/cache",
    ) -> None:
        """
        Encode every training day and add to the FAISS index.

        Parameters
        ----------
        encoder : trained (or pretrained) SurfaceEncoder
        dataloader : yields (surface, eof_target, mask, date_str) tuples
        glorys_profiles : pre-loaded dict of GLORYS profiles keyed by date
        device : torch device
        cache_dir : where to save the index + metadata
        """
        encoder.eval()
        encoder.to(device)

        with torch.no_grad():
            for batch in dataloader:
                surfaces, _, masks, date_strs = batch  # date_strs: list[str]
                surfaces = surfaces.to(device)

                z = encoder(surfaces)                  # (B, D, h, w)
                z_mean = z.mean(dim=[-2, -1])          # (B, D) spatial mean
                z_norm = self._l2_norm(z_mean.cpu().numpy())  # (B, D) cosine-ready

                for i, ds in enumerate(date_strs):
                    self.index.add(z_norm[i : i + 1].astype(np.float32))
                    self._dates.append(ds)
                    doy = self._doy_from_str(ds)
                    self._doys.append(doy)

                    if ds in glorys_profiles:
                        # Spatially average the GLORYS profile for this date
                        prof = glorys_profiles[ds]          # (H*W, n_depths)
                        self._profiles.append(prof.mean(axis=0))
                    else:
                        self._profiles.append(
                            np.zeros(15, dtype=np.float32)
                        )

        os.makedirs(cache_dir, exist_ok=True)
        self._save(cache_dir)
        print(f"[AnalogRetriever] Index built: {self.index.ntotal} entries.")

    # ------------------------------------------------------------------
    # Querying
    # ------------------------------------------------------------------

    def query(
        self,
        z_query: np.ndarray,   # (D,) or (1, D) — already L2-normalised
        query_doy: int,
    ) -> AnalogResult:
        """
        Find k nearest analog days by cosine similarity, restricted to a
        ±seasonal_window_days DOY window.

        Parameters
        ----------
        z_query : (D,) normalised query embedding
        query_doy : day-of-year of the query (1–366)

        Returns
        -------
        AnalogResult
        """
        z_q = z_query.reshape(1, -1).astype(np.float32)

        # Seasonal subset IDs
        sel_ids = self._seasonal_ids(query_doy)

        if len(sel_ids) >= self.k:
            D_scores, I_ids = self._restricted_search(z_q, sel_ids)
        else:
            D_scores, I_ids = self.index.search(z_q, self.k)
            D_scores, I_ids = D_scores[0], I_ids[0]

        # Softmax-normalised similarity weights
        weights = self._softmax(D_scores)

        raw_profiles = np.stack([self._profiles[i] for i in I_ids])  # (k, n_depths)
        analog_mean  = (weights[:, None] * raw_profiles).sum(0)       # (n_depths,)
        analog_spread = np.sqrt(
            ((raw_profiles - analog_mean[None]) ** 2 * weights[:, None]).sum(0)
        )  # (n_depths,)

        return AnalogResult(
            analog_profile=analog_mean,
            analog_spread=analog_spread,
            analog_dates=[self._dates[i] for i in I_ids],
            weights=weights,
            raw_profiles=raw_profiles,
        )

    # ------------------------------------------------------------------
    # Fusion
    # ------------------------------------------------------------------

    @staticmethod
    def fuse(
        decoder_pred: np.ndarray,
        analog_result: AnalogResult,
        blend_weight: float = 0.30,
    ) -> np.ndarray:
        """
        Weighted blend: (1 - w) * decoder + w * analog.

        Parameters
        ----------
        decoder_pred : (n_depths,) decoder profile prediction
        analog_result : result from `.query()`
        blend_weight : how much to weight the analog (0 = pure decoder)

        Returns
        -------
        fused : (n_depths,) blended profile
        """
        return (
            (1.0 - blend_weight) * decoder_pred
            + blend_weight * analog_result.analog_profile
        )

    # ------------------------------------------------------------------
    # Encode a batch for index building or query
    # ------------------------------------------------------------------

    @staticmethod
    def encode_surface(
        encoder: SurfaceEncoder,
        surface: torch.Tensor,
        device: torch.device,
    ) -> np.ndarray:
        """Encode a single surface map and return L2-normalised (D,) vector."""
        encoder.eval()
        with torch.no_grad():
            z = encoder(surface.unsqueeze(0).to(device))  # (1, D, h, w)
            z_mean = z.mean(dim=[-2, -1]).cpu().numpy()   # (1, D)
        return AnalogRetriever._l2_norm(z_mean)[0]        # (D,)

    # ------------------------------------------------------------------
    # Save / load
    # ------------------------------------------------------------------

    def _save(self, cache_dir: str) -> None:
        if HAS_FAISS:
            faiss.write_index(self.index, os.path.join(cache_dir, "faiss.index"))
        else:
            np.save(os.path.join(cache_dir, "numpy_index.npy"), self.index.vectors)
        meta = {
            "dates": self._dates,
            "doys":  self._doys,
            "profiles": self._profiles,
            "embed_dim": self.embed_dim,
            "k": self.k,
            "sw": self.sw,
        }
        with open(os.path.join(cache_dir, "retriever_meta.pkl"), "wb") as f:
            pickle.dump(meta, f)
        print(f"[AnalogRetriever] Saved to {cache_dir}/")

    @classmethod
    def load(cls, cache_dir: str) -> "AnalogRetriever":
        with open(os.path.join(cache_dir, "retriever_meta.pkl"), "rb") as f:
            meta = pickle.load(f)
        obj = cls(
            embed_dim=meta["embed_dim"],
            k=meta["k"],
            seasonal_window_days=meta["sw"],
        )
        faiss_file = os.path.join(cache_dir, "faiss.index")
        npy_file = os.path.join(cache_dir, "numpy_index.npy")
        if HAS_FAISS and os.path.exists(faiss_file):
            obj.index = faiss.read_index(faiss_file)
        elif os.path.exists(npy_file):
            obj.index = NumpyIndexFlatIP(meta["embed_dim"])
            obj.index.vectors = np.load(npy_file)
        else:
            obj.index = NumpyIndexFlatIP(meta["embed_dim"])
        obj._dates = meta["dates"]
        obj._doys  = meta["doys"]
        obj._profiles = meta["profiles"]
        print(f"[AnalogRetriever] Loaded {obj.index.ntotal} entries from {cache_dir}/")
        return obj

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _l2_norm(x: np.ndarray) -> np.ndarray:
        norm = np.linalg.norm(x, axis=-1, keepdims=True) + 1e-8
        return x / norm

    @staticmethod
    def _softmax(scores: np.ndarray, temperature: float = 1.0) -> np.ndarray:
        s = scores / temperature
        s -= s.max()
        e = np.exp(s)
        return e / e.sum()

    @staticmethod
    def _doy_from_str(date_str: str) -> int:
        d = date.fromisoformat(date_str)
        return d.timetuple().tm_yday

    def _seasonal_ids(self, query_doy: int) -> list[int]:
        """Return index IDs whose DOY is within ±sw of query_doy (circular)."""
        ids = []
        for idx, doy in enumerate(self._doys):
            diff = abs(doy - query_doy)
            diff = min(diff, 365 - diff)   # circular distance
            if diff <= self.sw:
                ids.append(idx)
        return ids

    def _restricted_search(
        self, z_q: np.ndarray, sel_ids: list[int]
    ) -> tuple[np.ndarray, np.ndarray]:
        """
        Brute-force cosine search over a seasonal subset.
        Faster than full-index search when the subset is small.
        """
        sub_vecs = np.stack([
            self.index.reconstruct(int(i)) for i in sel_ids
        ])  # (|subset|, D)
        scores = (sub_vecs @ z_q.T).squeeze(-1)   # (|subset|,)
        top_idx = np.argsort(-scores)[: self.k]
        return scores[top_idx], [sel_ids[i] for i in top_idx]
