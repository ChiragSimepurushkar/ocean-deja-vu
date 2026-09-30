const STOPS = [
  [0.00, [8, 16, 96]],
  [0.15, [0, 60, 200]],
  [0.30, [0, 170, 230]],
  [0.42, [64, 224, 208]],
  [0.58, [245, 220, 30]],
  [0.72, [250, 150, 30]],
  [0.85, [235, 60, 40]],
  [1.00, [200, 20, 30]],
];

function colorAt(t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1], [t1, c1] = STOPS[i];
      const k = (t - t0) / (t1 - t0);
      return c0.map((v, j) => v + (c1[j] - v) * k);
    }
  }
  return STOPS[STOPS.length - 1][1];
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

export async function buildSstTexture(oceanData, {
  baseUrl = "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
  W = 4096, H = 2048, vmin = 24, vmax = 31, opacity = 0.92,
} = {}) {
  // Assuming oceanData is the response from /field/{date}?var=temp_0m
  // So it has { lat: [...], lon: [...], data: [[...]] }
  const lats = oceanData.lat;
  const lons = oceanData.lon;
  const sst = oceanData.data;
  const latMin = lats[0];
  const lonMin = lons[0];
  const res = lats[1] - lats[0];
  const latMax = lats[lats.length - 1];
  const lonMax = lons[lons.length - 1];

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(await loadImage(baseUrl), 0, 0, W, H);

  const x0 = Math.floor(((lonMin + 180) / 360) * W);
  const x1 = Math.ceil(((lonMax + 180) / 360) * W);
  const y0 = Math.floor(((90 - latMax) / 180) * H);
  const y1 = Math.ceil(((90 - latMin) / 180) * H);
  const img = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
  const d = img.data;

  for (let py = 0; py < img.height; py++) {
    const lat = 90 - ((py + y0 + 0.5) / H) * 180;
    const gy = (lat - latMin) / res;
    for (let px = 0; px < img.width; px++) {
      const lon = ((px + x0 + 0.5) / W) * 360 - 180;
      const gx = (lon - lonMin) / res;
      const ix = Math.floor(gx), iy = Math.floor(gy);
      const fx = gx - ix, fy = gy - iy;

      // bilinear, ignoring null (land) cells
      let sum = 0, wsum = 0;
      for (const [dx, dy, w] of [
        [0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)],
        [0, 1, (1 - fx) * fy],       [1, 1, fx * fy],
      ]) {
        const v = sst[iy + dy]?.[ix + dx];
        if (v !== null && v !== undefined) { sum += v * w; wsum += w; }
      }
      if (wsum < 0.5) continue; // land / no data -> keep base texture

      const [r, g, b] = colorAt((sum / wsum - vmin) / (vmax - vmin));
      const a = opacity * Math.min(1, (wsum - 0.5) * 4); // soft coastline
      const i = (py * img.width + px) * 4;
      d[i]     = d[i]     * (1 - a) + r * a;
      d[i + 1] = d[i + 1] * (1 - a) + g * a;
      d[i + 2] = d[i + 2] * (1 - a) + b * a;
    }
  }
  ctx.putImageData(img, x0, y0);
  return canvas.toDataURL("image/jpeg", 0.92);
}
