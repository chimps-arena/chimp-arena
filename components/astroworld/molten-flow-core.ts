/**
 * Plain three.js build of the foundry pour (see molten-flow.tsx), kept free of
 * React so it can also be previewed on the bare model.
 */

import * as THREE from "three";

/** Where the pour starts (spout lip), bends, and lands (crucible surface). */
const SPOUT = new THREE.Vector3(0.45, 3.45, 2.4);
const BEND = new THREE.Vector3(0.47, 3.05, 4.0);
const POOL = new THREE.Vector3(0.46, 1.46, 4.15);
const POOL_R = 0.62;
const EMBERS = 36;

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const streamFrag = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    // uv.x runs down the stream: bright bands slide toward the crucible.
    float flow = sin(vUv.x * 28.0 - uTime * 9.0) * 0.5 + 0.5;
    float ripple = sin(vUv.y * 18.85 + vUv.x * 40.0 - uTime * 6.0) * 0.5 + 0.5;
    float heat = 0.55 + 0.3 * flow + 0.15 * ripple;
    gl_FragColor = vec4(mix(vec3(1.0, 0.28, 0.02), vec3(1.0, 0.85, 0.35), heat * heat) * 1.6, 1.0);
  }
`;
const poolFrag = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float a = atan(p.y, p.x);
    // Slow swirl, brightest in the middle where the stream lands, crusting at the rim.
    float swirl = sin(a * 5.0 + r * 9.0 - uTime * 1.7) * 0.5 + 0.5;
    float churn = sin(r * 14.0 - uTime * 3.0) * 0.5 + 0.5;
    float heat = clamp(0.45 + 0.3 * swirl + 0.2 * churn - r * 0.35, 0.0, 1.0);
    gl_FragColor = vec4(mix(vec3(0.55, 0.08, 0.0), vec3(1.0, 0.8, 0.3), heat) * 1.5, 1.0);
  }
`;

/** Soft radial glow texture, shared by every foundry. */
let glowTexture: THREE.Texture | null = null;
function glowMap() {
  if (glowTexture) return glowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,190,90,1)");
  grad.addColorStop(0.35, "rgba(255,110,20,0.45)");
  grad.addColorStop(1, "rgba(255,60,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false } as const;

export function buildMolten() {
  const group = new THREE.Group();
  const uniforms = { uTime: { value: 0 } };

  const streamMat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: streamFrag, toneMapped: false });
  const streamGeo = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(SPOUT, BEND, POOL), 24, 0.2, 8, false);
  group.add(new THREE.Mesh(streamGeo, streamMat));

  const poolMat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: poolFrag, toneMapped: false });
  const poolGeo = new THREE.CircleGeometry(POOL_R, 24);
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.position.copy(POOL);
  pool.rotation.x = -Math.PI / 2;
  group.add(pool);

  const emberPos = new Float32Array(EMBERS * 3);
  const life = Float32Array.from({ length: EMBERS }, (_, i) => (i * 0.618) % 1);
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPos, 3));
  const emberMat = new THREE.PointsMaterial({ color: "#ffb347", map: glowMap(), size: 0.16, ...additive });
  const embers = new THREE.Points(emberGeo, emberMat);
  embers.frustumCulled = false;
  group.add(embers);

  const haloMat = new THREE.SpriteMaterial({ map: glowMap(), ...additive });
  const halo = new THREE.Sprite(haloMat);
  halo.position.set(POOL.x, POOL.y + 0.5, POOL.z + 0.2);
  halo.scale.setScalar(4.2);
  group.add(halo);

  // Heat light spilling onto the lot in front of the crucible.
  const floorMat = new THREE.MeshBasicMaterial({ map: glowMap(), ...additive });
  const floorGeo = new THREE.PlaneGeometry(6, 6);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(POOL.x, 0.06, POOL.z + 1.6);
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  let last = 0;
  function tick(t: number) {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    uniforms.uTime.value = t;
    // Embers: born on the pool, drift up and sideways, fade out, respawn.
    for (let i = 0; i < EMBERS; i++) {
      let l = life[i] + dt * (0.45 + (i % 5) * 0.08);
      if (l >= 1) l -= 1;
      life[i] = l;
      const ang = i * 2.399 + t * 0.3;
      const rr = POOL_R * 0.8 * ((i * 0.618) % 1);
      emberPos[i * 3] = POOL.x + Math.cos(ang) * rr + Math.sin(t * 1.3 + i) * 0.25 * l;
      emberPos[i * 3 + 1] = POOL.y + l * 3.2;
      emberPos[i * 3 + 2] = POOL.z + Math.sin(ang) * rr + Math.cos(t * 1.1 + i) * 0.25 * l;
    }
    emberGeo.attributes.position.needsUpdate = true;
    // Flicker: a few unrelated sines so it never looks like a loop.
    const f = 0.85 + 0.1 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 17.1 + 1.3);
    emberMat.opacity = 0.9 * f;
    haloMat.opacity = 0.75 * f;
    floorMat.opacity = 0.7 * f;
  }

  function dispose() {
    for (const o of [streamGeo, streamMat, poolGeo, poolMat, emberGeo, emberMat, haloMat, floorGeo, floorMat]) o.dispose();
  }

  return { group, tick, dispose };
}
