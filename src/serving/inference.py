import numpy as np
from scipy.interpolate import interp1d

def compute_mld(profile: np.ndarray, depths: list, criterion_dt=0.2) -> float:
    """Mixed layer depth: first depth where ΔT > 0.2°C from surface."""
    sst = profile[0]
    for i, (d, t) in enumerate(zip(depths, profile)):
        if abs(t - sst) > criterion_dt and d > 0:
            return float(d)
    return float(depths[-1])

def compute_d20(profile: np.ndarray, depths: list) -> float:
    """Depth of the 20°C isotherm (El Niño proxy for Indian Ocean)."""
    f = interp1d(profile, depths, kind="linear", fill_value="extrapolate")
    return float(np.clip(f(20.0), 0, 1000))

def compute_uhc(profile: np.ndarray, depths: list, ref_temp=26.0, max_depth=300.0) -> float:
    """Upper ocean heat content above 26°C isotherm."""
    dz = np.gradient(depths)
    uhc = np.sum(np.maximum(profile - ref_temp, 0) * dz *
                 1025 * 3990 * 1e-8)   # W·yr/m²
    return float(uhc)
