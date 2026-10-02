"""
tests/test_metrics.py
----------------------
Unit tests for the evaluation metrics module.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from src.evaluation.metrics import (
    rmse, bias, correlation,
    compute_skill, rmse_profile, compare_models,
    DEPTHS, SEASONS, BASINS,
)


class TestScalarMetrics:
    def test_rmse_perfect(self):
        x = np.array([1.0, 2.0, 3.0])
        assert rmse(x, x) == pytest.approx(0.0, abs=1e-7)

    def test_rmse_known(self):
        pred = np.array([0.0])
        obs  = np.array([3.0])
        assert rmse(pred, obs) == pytest.approx(3.0)

    def test_bias_sign(self):
        pred = np.array([5.0, 5.0])
        obs  = np.array([3.0, 3.0])
        assert bias(pred, obs) == pytest.approx(2.0)

    def test_bias_negative(self):
        pred = np.array([1.0])
        obs  = np.array([4.0])
        assert bias(pred, obs) == pytest.approx(-3.0)

    def test_correlation_perfect(self):
        x = np.arange(10, dtype=float)
        assert correlation(x, x) == pytest.approx(1.0)

    def test_correlation_anticorrelated(self):
        x = np.arange(10, dtype=float)
        assert correlation(x, -x) == pytest.approx(-1.0)

    def test_nan_handling(self):
        pred = np.array([1.0, np.nan, 3.0])
        obs  = np.array([1.0, 2.0, np.nan])
        # Only [0] is valid for both
        assert rmse(pred, obs) == pytest.approx(0.0)

    def test_all_nan_returns_nan(self):
        pred = np.array([np.nan])
        obs  = np.array([np.nan])
        assert np.isnan(rmse(pred, obs))


class TestSkillTable:
    @pytest.fixture
    def synthetic_data(self):
        """100 profiles over the full NIO domain."""
        rng = np.random.default_rng(0)
        N, D = 100, 15
        obs  = rng.normal(28.0, 2.0, (N, D))
        pred = obs + rng.normal(0, 0.5, (N, D))
        months = rng.integers(1, 13, N)
        # Mix of BoB and AS locations
        lats = np.concatenate([
            rng.uniform(5, 22, N // 2),   # BoB
            rng.uniform(5, 25, N // 2),   # AS
        ])
        lons = np.concatenate([
            rng.uniform(80, 100, N // 2),  # BoB
            rng.uniform(45, 78, N // 2),   # AS
        ])
        return pred, obs, months, lats, lons

    def test_output_is_dataframe(self, synthetic_data):
        pred, obs, months, lats, lons = synthetic_data
        df = compute_skill(pred, obs, months, lats, lons)
        assert isinstance(df, pd.DataFrame)

    def test_required_columns(self, synthetic_data):
        pred, obs, months, lats, lons = synthetic_data
        df = compute_skill(pred, obs, months, lats, lons)
        for col in ["depth", "season", "basin", "n_obs", "rmse", "bias", "corr"]:
            assert col in df.columns

    def test_rmse_nonnegative(self, synthetic_data):
        pred, obs, months, lats, lons = synthetic_data
        df = compute_skill(pred, obs, months, lats, lons)
        assert (df["rmse"].dropna() >= 0).all()

    def test_corr_bounded(self, synthetic_data):
        pred, obs, months, lats, lons = synthetic_data
        df = compute_skill(pred, obs, months, lats, lons)
        assert (df["corr"].dropna().abs() <= 1.0 + 1e-6).all()

    def test_depth_levels_present(self, synthetic_data):
        pred, obs, months, lats, lons = synthetic_data
        df = compute_skill(pred, obs, months, lats, lons,
                           seasons=["annual"], basins=["full_domain"])
        assert set(df["depth"].unique()) == set(DEPTHS)

    def test_perfect_prediction_rmse_zero(self):
        N, D = 50, 15
        obs    = np.ones((N, D)) * 25.0
        months = np.ones(N, dtype=int) * 6
        lats   = np.ones(N) * 15.0
        lons   = np.ones(N) * 85.0
        df = compute_skill(obs, obs, months, lats, lons,
                           seasons=["annual"], basins=["full_domain"])
        assert (df["rmse"].dropna() < 1e-6).all()


class TestRMSEProfile:
    def test_shape(self):
        pred = np.random.randn(50, 15)
        obs  = np.random.randn(50, 15)
        r = rmse_profile(pred, obs)
        assert r.shape == (15,)

    def test_zero_for_perfect(self):
        x = np.random.randn(30, 15)
        r = rmse_profile(x, x)
        np.testing.assert_allclose(r, 0.0, atol=1e-7)


class TestCompareModels:
    def test_output_has_model_column(self):
        N, D = 40, 15
        obs    = np.random.randn(N, D)
        months = np.random.randint(1, 13, N)
        lats   = np.random.uniform(5, 30, N)
        lons   = np.random.uniform(45, 105, N)
        preds  = {"modelA": obs + 0.5, "modelB": obs - 0.3}
        df = compare_models(preds, obs, months, lats, lons)
        assert "model" in df.columns
        assert set(df["model"].unique()) == {"modelA", "modelB"}
