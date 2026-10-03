export const WATER_SURFACE_VERTEX = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  uniform float uTime;

  void main() {
    vUv = uv;
    vec3 pos = position;
    // Gentle surface wave undulation
    pos.z += sin(pos.x * 0.1 + uTime * 1.2) * 0.35 + cos(pos.y * 0.15 + uTime * 0.9) * 0.25;
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const WATER_SURFACE_FRAGMENT = `
  uniform vec3 uSunColor;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    // Snell's window fresnel reflection
    float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
    vec3 waterColor = mix(vec3(0.1, 0.6, 0.8), vec3(0.9, 0.98, 1.0), fresnel);
    gl_FragColor = vec4(waterColor, 0.75 + fresnel * 0.25);
  }
`;
