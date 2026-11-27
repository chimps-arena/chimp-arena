"use client";

/**
 * A Meshy model for a hero property (one built from its own NFT art), placed in
 * the building's own space: scaled to `width` metres across x, centred on x/z,
 * base on y=0. Overlays (signs, props) are measured in this same space.
 *
 * Meshy's PBR maps read as crumpled foil: too metallic, too mirror-like, a noisy
 * normal map. The materials are calmed toward dark, worn steel.
 */
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/** `tone` darkens the model's colours (1 = as delivered); the NFT art is darker and moodier than Meshy's output. */
export function HeroModel({ url, width = 12, tone = 0.88 }: { url: string; width?: number; tone?: number }) {
  const { scene } = useGLTF(url, false, true);
  const model = useMemo(() => {
    const s = scene.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const k = width / box.getSize(new THREE.Vector3()).x;
    s.scale.setScalar(k);
    const c = box.getCenter(new THREE.Vector3());
    s.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    const tuned = new Map<THREE.Material, THREE.Material>();
    s.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshStandardMaterial;
      let m = tuned.get(src) as THREE.MeshStandardMaterial | undefined;
      if (!m) {
        m = src.clone();
        m.metalness = 0.5;
        m.roughness = 1;
        m.envMapIntensity = 0.6;
        m.normalScale?.setScalar(0.5);
        m.color.multiplyScalar(tone);
        tuned.set(src, m);
      }
      mesh.material = m;
    });
    return s;
  }, [scene, width, tone]);
  return <primitive object={model} />;
}
