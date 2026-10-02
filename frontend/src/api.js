const BASE_URL = 'http://localhost:8000';

export async function getField(date, depthStr) {
  const varName = `temp_${depthStr}m`;
  const res = await fetch(`${BASE_URL}/field/${date}?var=${varName}`);
  if (!res.ok) throw new Error('API Error');
  return res.json();
}

export async function getProfile(date, lat, lon) {
  const res = await fetch(`${BASE_URL}/profile/${date}?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error('API Error');
  return res.json();
}

export async function getDiagnostics(date, lat, lon) {
  const res = await fetch(`${BASE_URL}/diagnostics/${date}?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error('API Error');
  return res.json();
}

export async function getAdvisory(date, lat, lon) {
  const res = await fetch(`${BASE_URL}/advisory/${date}?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error('API Error');
  return res.json();
}
