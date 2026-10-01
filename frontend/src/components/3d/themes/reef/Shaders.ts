export const CAUSTIC_VERTEX = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const CAUSTIC_FRAGMENT = `
  uniform float uTime;
  uniform float uBleach;
  uniform vec3 uBaseColor;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  // Simple procedural caustic wave pattern
  float causticPattern(vec2 p, float t) {
    vec2 p1 = p + vec2(sin(t + p.y * 3.0), cos(t + p.x * 2.5)) * 0.15;
    vec2 p2 = p + vec2(cos(t * 1.3 - p.y * 2.0), sin(t * 0.9 + p.x * 3.5)) * 0.15;
    float c1 = sin(p1.x * 12.0) * sin(p1.y * 12.0);
    float c2 = sin(p2.x * 14.0) * sin(p2.y * 14.0);
    return pow(max(0.0, (c1 + c2) * 0.5 + 0.5), 3.0);
  }

  void main() {
    float caustic = causticPattern(vWorldPosition.xz * 0.35, uTime * 1.5) * max(0.0, vNormal.y);
    vec3 healthyColor = uBaseColor + vec3(caustic * 0.6);
    // Bleached white lerp, then dead algae grey-brown
    vec3 bleachedColor = vec3(0.95, 0.95, 0.9);
    vec3 deadColor = vec3(0.35, 0.32, 0.28);

    vec3 finalColor = mix(healthyColor, bleachedColor, clamp(uBleach * 1.5, 0.0, 1.0));
    finalColor = mix(finalColor, deadColor, clamp((uBleach - 0.6) * 2.5, 0.0, 1.0));

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
