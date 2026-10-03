const BASE_URL = 'https://ocean-deja-vu-server.onrender.com';

// ── Generic fetcher ──────────────────────────────────────────────────────────
async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API Error ${res.status}: ${path}`);
  return res.json();
}

// ── Health / status ──────────────────────────────────────────────────────────
export async function getHealth() {
  return apiFetch('/health');
}

// ── 2D Field (for Globe heatmap) ─────────────────────────────────────────────
export async function getField(date, depthStr) {
  const varName = `temp_${depthStr}m`;
  return apiFetch(`/field/${date}?var=${varName}`);
}

// ── Vertical Profile (for DeepDive + Profile page) ───────────────────────────
export async function getProfile(date, lat, lon) {
  return apiFetch(`/profile/${date}?lat=${lat}&lon=${lon}`);
}

// ── Diagnostics (MLD, D20, UHC, Thermocline) ─────────────────────────────────
export async function getDiagnostics(date, lat, lon) {
  return apiFetch(`/diagnostics/${date}?lat=${lat}&lon=${lon}`);
}

// ── Advisory (Heatwave + Upwelling alerts) ────────────────────────────────────
export async function getAdvisory(date, lat, lon) {
  return apiFetch(`/advisory/${date}?lat=${lat}&lon=${lon}`);
}

// ── Transect (vertical 2D slice for CinematicView) ───────────────────────────
export async function getTransect(date, { lat = null, lon = null, var: variable = 'temp' } = {}) {
  const params = new URLSearchParams({ var: variable });
  if (lat !== null) params.append('lat', lat);
  if (lon !== null) params.append('lon', lon);
  return apiFetch(`/transect/${date}?${params.toString()}`);
}

// ── Model Validation metrics ──────────────────────────────────────────────────
export async function getValidation(region = 'Arabian Sea', season = 'Summer') {
  const params = new URLSearchParams({ region, season });
  return apiFetch(`/validation?${params.toString()}`);
}

// ── Ablation study results ────────────────────────────────────────────────────
export async function getAblation() {
  return apiFetch('/ablation');
}
