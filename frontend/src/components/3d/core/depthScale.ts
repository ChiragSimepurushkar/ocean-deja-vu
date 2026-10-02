/**
 * depthScale.ts
 * Piecewise depth-to-world Y mapping adhering to the build spec:
 * - 0–50 m   -> 0 to -60 units (expanded resolution for reefs, sunlight, surface caustics)
 * - 50–200 m -> -60 to -120 units (thermocline & twilight transition)
 * - 200–1000 m -> -120 to -200 units (deep pelagic, OMZ, and abyssal descent)
 * - >1000 m  -> smoothly extends downward to -260 units (hadal trench & abyssal plain)
 */

export function depthToY(depthMeters: number): number {
  const d = Math.max(0, depthMeters);

  if (d <= 50) {
    // 0 to 50m maps to 0 to -60
    return -(d / 50) * 60;
  } else if (d <= 200) {
    // 50 to 200m maps to -60 to -120
    const frac = (d - 50) / 150;
    return -60 - frac * 60;
  } else if (d <= 1000) {
    // 200 to 1000m maps to -120 to -200
    const frac = (d - 200) / 800;
    return -120 - frac * 80;
  } else {
    // >1000m extends toward trench floor
    const frac = Math.min(1.0, (d - 1000) / 2000);
    return -200 - frac * 60;
  }
}

export function yToDepth(y: number): number {
  const absY = -y;
  if (absY <= 0) return 0;
  if (absY <= 60) {
    return (absY / 60) * 50;
  } else if (absY <= 120) {
    return 50 + ((absY - 60) / 60) * 150;
  } else if (absY <= 200) {
    return 200 + ((absY - 120) / 80) * 800;
  } else {
    return 1000 + ((absY - 200) / 60) * 2000;
  }
}
