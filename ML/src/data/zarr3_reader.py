"""
ML/src/data/zarr3_reader.py
----------------------------
Lightweight reader for Zarr v3 stores that works with Python 3.10 + zarr v2.x.

The Zarr v3 spec (using zarr.json files) is NOT supported by zarr-python < 3.0,
and zarr 3.0+ requires Python >= 3.11. Since our pytorch env uses Python 3.10,
this module provides a pure-Python/NumPy reader for the specific Zarr v3 layout
used by dev3's data pipeline.

Store layout:
    root/
    ├── zarr.json           ← {"zarr_format": 3, "node_type": "group"}
    ├── array_name/
    │   ├── zarr.json       ← array metadata (shape, dtype, codecs, chunks)
    │   └── c/              ← chunks directory
    │       ├── 0           ← chunk files (possibly nested: 0/0, 0/1, etc.)
    │       └── ...
    └── group_name/
        ├── zarr.json       ← {"zarr_format": 3, "node_type": "group"}
        └── child_array/
            └── ...

Supported codecs: bytes (little-endian) + zstd
"""

from __future__ import annotations

import json
import math
import struct
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np

# Try to import zstandard for zstd decompression
try:
    import zstandard as _zstd
    _HAS_ZSTD = True
except ImportError:
    _HAS_ZSTD = False

# Fallback: try the built-in zlib (won't work for zstd, but let's check)
# Actually for zstd we need the zstandard or zstd package.


DTYPE_MAP = {
    "float32": np.float32,
    "float64": np.float64,
    "int32":   np.int32,
    "int64":   np.int64,
    "uint8":   np.uint8,
    "uint16":  np.uint16,
    "uint32":  np.uint32,
    "bool":    np.bool_,
}


class Zarr3Array:
    """Represents a single Zarr v3 array on disk."""

    def __init__(self, path: Path, meta: dict):
        self.path = path
        self.meta = meta
        self.shape = tuple(meta["shape"])
        self.dtype = DTYPE_MAP.get(meta["data_type"], np.float32)
        self.fill_value = meta.get("fill_value", 0)
        self.ndim = len(self.shape)

        # Parse chunk shape
        chunk_cfg = meta.get("chunk_grid", {}).get("configuration", {})
        self.chunk_shape = tuple(chunk_cfg.get("chunk_shape", self.shape))

        # Parse codecs
        self.codecs = meta.get("codecs", [])
        self.has_zstd = any(c.get("name") == "zstd" for c in self.codecs)

        # Chunk key separator
        sep_cfg = meta.get("chunk_key_encoding", {}).get("configuration", {})
        self.separator = sep_cfg.get("separator", "/")

    @property
    def chunks_per_dim(self) -> Tuple[int, ...]:
        return tuple(
            math.ceil(s / c) for s, c in zip(self.shape, self.chunk_shape)
        )

    def _chunk_path(self, chunk_indices: Tuple[int, ...]) -> Path:
        """Build the filesystem path for a chunk."""
        parts = [str(i) for i in chunk_indices]
        # Zarr v3 uses c/ prefix then separator-joined indices
        if self.separator == "/":
            return self.path / "c" / Path(*parts)
        else:
            return self.path / "c" / self.separator.join(parts)

    def _read_chunk(self, chunk_indices: Tuple[int, ...]) -> np.ndarray:
        """Read and decompress a single chunk."""
        chunk_file = self._chunk_path(chunk_indices)

        if not chunk_file.exists():
            # Fill with fill_value
            return np.full(self.chunk_shape, self.fill_value, dtype=self.dtype)

        data = chunk_file.read_bytes()

        # Decompress if zstd
        if self.has_zstd and len(data) > 0:
            if not _HAS_ZSTD:
                raise ImportError(
                    "zstandard package required to read zstd-compressed Zarr v3 chunks. "
                    "Install with: pip install zstandard"
                )
            dctx = _zstd.ZstdDecompressor()
            data = dctx.decompress(data)

        # Convert to numpy
        arr = np.frombuffer(data, dtype=self.dtype)
        return arr.reshape(self.chunk_shape)

    def __getitem__(self, key) -> np.ndarray:
        """Support basic slicing. key=slice(None) reads the entire array."""
        if isinstance(key, slice) and key == slice(None):
            return self._read_full()
        # For simplicity, always read full array and then slice
        full = self._read_full()
        return full[key]

    def _read_full(self) -> np.ndarray:
        """Read the entire array by assembling all chunks."""
        result = np.empty(self.shape, dtype=self.dtype)
        chunks_per = self.chunks_per_dim

        if self.ndim == 1:
            for i in range(chunks_per[0]):
                chunk = self._read_chunk((i,))
                start = i * self.chunk_shape[0]
                end = min(start + self.chunk_shape[0], self.shape[0])
                result[start:end] = chunk[:end - start]

        elif self.ndim == 2:
            for i in range(chunks_per[0]):
                for j in range(chunks_per[1]):
                    chunk = self._read_chunk((i, j))
                    r0 = i * self.chunk_shape[0]
                    r1 = min(r0 + self.chunk_shape[0], self.shape[0])
                    c0 = j * self.chunk_shape[1]
                    c1 = min(c0 + self.chunk_shape[1], self.shape[1])
                    result[r0:r1, c0:c1] = chunk[:r1-r0, :c1-c0]

        elif self.ndim == 3:
            for i in range(chunks_per[0]):
                for j in range(chunks_per[1]):
                    for k in range(chunks_per[2]):
                        chunk = self._read_chunk((i, j, k))
                        d0 = i * self.chunk_shape[0]
                        d1 = min(d0 + self.chunk_shape[0], self.shape[0])
                        r0 = j * self.chunk_shape[1]
                        r1 = min(r0 + self.chunk_shape[1], self.shape[1])
                        c0 = k * self.chunk_shape[2]
                        c1 = min(c0 + self.chunk_shape[2], self.shape[2])
                        result[d0:d1, r0:r1, c0:c1] = chunk[:d1-d0, :r1-r0, :c1-c0]
        else:
            raise NotImplementedError(f"Reading {self.ndim}D arrays not yet supported")

        return result


class Zarr3Store:
    """
    Lightweight read-only accessor for a Zarr v3 directory store.

    Usage:
        store = Zarr3Store("path/to/dataset")
        lat = store["lat"][:]
        surface = store["surface/2023-01-01"][:]
        dates_bytes = store["dates/train"][:]
    """

    def __init__(self, path: Union[str, Path]):
        self.root = Path(path)
        if not self.root.exists():
            raise FileNotFoundError(f"Zarr store not found: {self.root}")

        # Verify it's a Zarr v3 store
        meta_file = self.root / "zarr.json"
        if not meta_file.exists():
            raise ValueError(f"Not a Zarr v3 store (no zarr.json): {self.root}")

        with open(meta_file, "r") as f:
            self._root_meta = json.load(f)

        if self._root_meta.get("zarr_format") != 3:
            raise ValueError(f"Expected zarr_format=3, got {self._root_meta}")

        self._cache: Dict[str, Zarr3Array] = {}

    def __getitem__(self, key: str) -> Zarr3Array:
        """Access an array or nested group/array by path."""
        if key in self._cache:
            return self._cache[key]

        target = self.root / key
        meta_file = target / "zarr.json"

        if not meta_file.exists():
            raise KeyError(f"Array or group not found: {key}")

        with open(meta_file, "r") as f:
            meta = json.load(f)

        node_type = meta.get("node_type", "array")
        if node_type == "group":
            # Return a sub-store view
            return Zarr3Store(target)
        elif node_type == "array":
            arr = Zarr3Array(target, meta)
            self._cache[key] = arr
            return arr
        else:
            raise ValueError(f"Unknown node_type: {node_type}")

    def keys(self) -> List[str]:
        """List immediate children (arrays and groups)."""
        result = []
        for child in sorted(self.root.iterdir()):
            if child.is_dir() and child.name != "c":
                meta = child / "zarr.json"
                if meta.exists():
                    result.append(child.name)
        return result

    def __contains__(self, key: str) -> bool:
        target = self.root / key / "zarr.json"
        return target.exists()

    def __repr__(self) -> str:
        return f"Zarr3Store('{self.root}', children={self.keys()})"


# ── Convenience functions ──────────────────────────────────────────────────

def open_zarr3(path: Union[str, Path]) -> Zarr3Store:
    """Open a Zarr v3 store for reading."""
    return Zarr3Store(path)


def read_dates(store: Zarr3Store, split: str) -> List[str]:
    """Read a dates/{split} uint8 array and decode as JSON list of date strings."""
    raw = store[f"dates/{split}"][:]
    text = bytes(raw.tolist()).decode("utf-8")
    return json.loads(text)
