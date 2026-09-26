.PHONY: help data baselines test clean lint

help:
	@echo "Ocean Deja Vu - Development Commands"
	@echo "======================================"
	@echo "  make data       - Run end-to-end data pipeline (generate/download, regrid, features, EOF, Zarr)"
	@echo "  make baselines  - Run baseline benchmarks (Climatology, Persistence, Linear, Plain U-Net)"
	@echo "  make test       - Run all unit tests with pytest"
	@echo "  make clean      - Clean temporary files and caches"

data:
	python3 -m src.data.pipeline

baselines:
	python3 -m src.baselines.evaluate

test:
	pytest tests/ -v

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache
