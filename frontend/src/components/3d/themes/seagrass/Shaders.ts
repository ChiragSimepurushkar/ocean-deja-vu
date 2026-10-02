export const SEAGRASS_VERTEX = `
  attribute vec4 aInstanceParams; // x: phase, y: amp, z: speed, w: dir
  varying vec2 vUv;
  varying vec3 vWorldPos;
  uniform float uTime;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Sway amplitude increases toward tip (uv.y)
    float tipFactor = pow(uv.y, 1.4);
    float sway = sin(uTime * aInstanceParams.z + aInstanceParams.x) * aInstanceParams.y * tipFactor;

    pos.x += sway * cos(aInstanceParams.w);
    pos.z += sway * sin(aInstanceParams.w);

    vec4 worldPos = modelMatrix * instanceMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const SEAGRASS_FRAGMENT = `
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    // Gradient from dark root to bright emerald tip
    vec3 rootColor = vec3(0.04, 0.28, 0.16);
    vec3 tipColor = vec3(0.18, 0.72, 0.35);
    vec3 color = mix(rootColor, tipColor, vUv.y);
    gl_FragColor = vec4(color, 1.0);
  }
`;
