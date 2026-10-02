"""
start_server.py — Launches the FastAPI backend for Ocean Deja Vu.

Usage:
    # Mock mode (no trained model needed):
    python backend/start_server.py

    # Live mode (after training):
    set ODV_LIVE_MODEL=1
    python backend/start_server.py
"""
import sys
import os
from pathlib import Path

# Ensure src/ is importable regardless of where the script is run from
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

import uvicorn

if __name__ == "__main__":
    print("=" * 60)
    print("  Ocean Deja Vu — FastAPI Backend")
    print(f"  Mode: {'LIVE (trained model)' if os.environ.get('ODV_LIVE_MODEL') == '1' else 'MOCK (synthetic data)'}")
    print("  URL:  http://127.0.0.1:8000")
    print("  Docs: http://127.0.0.1:8000/docs")
    print("=" * 60)
    uvicorn.run(
        "src.serving.api:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(BACKEND_DIR / "src")],
    )
