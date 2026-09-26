import os
from pathlib import Path
from typing import Any, Dict
import yaml

def load_yaml(path: str | Path) -> Dict[str, Any]:
    """Load a YAML configuration file."""
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def get_project_root() -> Path:
    """Return the absolute path to the project root directory."""
    return Path(__file__).resolve().parents[2]

def load_all_configs(config_dir: str | Path | None = None) -> Dict[str, Any]:
    """Load data, model, and train configurations into a single dictionary."""
    if config_dir is None:
        config_dir = get_project_root() / "configs"
    else:
        config_dir = Path(config_dir)

    return {
        "data": load_yaml(config_dir / "data.yaml"),
        "model": load_yaml(config_dir / "model.yaml"),
        "train": load_yaml(config_dir / "train.yaml"),
    }
