"""
start_server.py — Launches the FastAPI backend for Ocean Deja Vu.

Usage (from SIH/ directory):
    # Mock mode (no trained model needed):
    python start_server.py

    # Live mode (after training):
    set ODV_LIVE_MODEL=1
    python start_server.py
"""
import sys
import os

# Ensure ML/src is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "ML"))

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
        reload_dirs=["ML/src"],
    )
