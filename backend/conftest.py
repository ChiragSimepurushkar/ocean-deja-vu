"""
conftest.py
-----------
Pytest configuration and shared fixtures.

Adds the project root to sys.path so `src.*` imports work without installing
the package.
"""
import sys
import os

# Ensure the project root is on sys.path
sys.path.insert(0, os.path.dirname(__file__))
