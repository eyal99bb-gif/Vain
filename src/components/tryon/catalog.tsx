"use client";

import { useMemo } from "react";
import * as THREE from "three";

/* ─── Metals ──────────────────────────────────────────────────────────────── */

export type MetalId = "gold" | "white" | "rose";

export const METALS: Record<
  MetalId,
  { label: string; color: string; swatch: string; roughness: number }
> = {
  gold: { label: "זהב צהוב", color: "#f5c65a", swatch: "#e8b64a", roughness: 0.14 },
  white: { label: "זהב לבן", color: "#e9ebee", swatch: "#d4d7dc", roughness: 0.17 },
  rose: { label: "רוז גולד", color: "#efac88", swatch: "#dfa080", roughness: 0.15 },
};

const metalMats = new Map<MetalId, THREE.MeshStandardMaterial>();
export function metalMaterial(id: MetalId): THREE.MeshStandardMaterial {
  let m = metalMats.get(id);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: METALS[id].color,
      metalness: 1,
      roughness: METALS[id].roughness,
      envMapIntensity: 1.6,
    });
    metalMats.set(id, m);
  }
  return m;
}

const gemMats = new Map<string, THREE.MeshPhysicalMaterial>();
export function gemMaterial(color = "#eef3ff"): THREE.MeshPhysicalMaterial {
  let m = gemMats.get(color);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.3,
      roughness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0,
      envMapIntensity: 3.6,
      flatShading: true,
    });
    gemMats.set(color, m);
  }
  return m;
}

const pearlMat = new THREE.MeshPhysicalMaterial({
  color: "#f7f2ea",
  metalness: 0,
  roughness: 0.22,
  clearcoat: 1,
  clearcoatRoughness: 0.18,
  sheen: 1,
  sheenColor: new THREE.Color("#ffe9f0"),
  envMapIntensity: 1.1,
});

/* ─── Shared gem geometry (brilliant-cut approximation) ──────────────────── */

/** Faceted stone built from a crown + pavilion, table facing +Y. */
export function Gem({
  size,
  color,
  position,
  quaternion,
  rotation,
}: {
  size: number; // girdle diameter in world units
  color?: string;
  position?: [number, number, number];
  quaternion?: THREE.Quaternion;
  rotation?: [number, number, number];
}) {
  const mat = gemMaterial(color);
  const r = size / 2;
  return (
    <group position={position} quaternion={quaternion} rotation={rotation}>
      {/* crown (girdle → table) */}
      <mesh material={mat} position={[0, r * 0.18, 0]}>
        <cylinderGeometry args={[r * 0.55, r, r * 0.36, 8, 1]} />
      </mesh>
      {/* pavilion (girdle → culet) */}
      <mesh material={mat} position={[0, -r * 0.45, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[r, r * 0.9, 8]} />
      </mesh>
    </group>
  );
}

/* ─── Earring designs ─────────────────────────────────────────────────────── */

export type DesignKind = "stud" | "ring" | "dangle";

export type Design = {
  id: string;
  name: string;
  kind: DesignKind;
  price: number;
  /** ring designs: inner radius in world units (1mm ≈ 0.012) */
  ringRadius?: number;
};

export const DESIGNS: Design[] = [
  { id: "solitaire", name: "סוליטר יהלום", kind: "stud", price: 420 },
  { id: "trinity", name: "טריו יהלומים", kind: "stud", price: 560 },
  { id: "sapphire", name: "ספיר כחול", kind: "stud", price: 490 },
  { id: "ball", name: "כדור קלאסי", kind: "stud", price: 190 },
  { id: "pearl", name: "פנינה", kind: "stud", price: 260 },
  { id: "plain-ring", name: "חישוק חלק", kind: "ring", price: 310, ringRadius: 0.026 },
  { id: "pave-ring", name: "חישוק פאווה", kind: "ring", price: 680, ringRadius: 0.028 },
  { id: "bead-ring", name: "טבעת חרוז", kind: "ring", price: 350, ringRadius: 0.026 },
  { id: "drop", name: "טיפת יהלום", kind: "dangle", price: 540 },
];

export function designById(id: string): Design {
  const d = DESIGNS.find((d) => d.id === id);
  if (!d) throw new Error(`unknown design ${id}`);
  return d;
}

/* ─── 3D components per design ────────────────────────────────────────────── */

const TUBE = 0.006; // ring wire thickness

/** Stud designs are built with the ear-surface normal along +Z. */
function StudBody({ id, metal }: { id: string; metal: MetalId }) {
  const mMat = metalMaterial(metal);
  switch (id) {
    case "solitaire":
      return (
        <group rotation={[Math.PI / 2, 0, 0]}>
          {/* small basket behind the stone */}
          <mesh material={mMat} position={[0, -0.007, 0]}>
            <cylinderGeometry args={[0.012, 0.008, 0.012, 12]} />
          </mesh>
          <Gem size={0.032} position={[0, 0.007, 0]} />
        </group>
      );
    case "sapphire":
      return (
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh material={mMat} position={[0, -0.007, 0]}>
            <cylinderGeometry args={[0.012, 0.008, 0.012, 12]} />
          </mesh>
          <Gem size={0.032} color="#4f7dff" position={[0, 0.007, 0]} />
        </group>
      );
    case "trinity": {
      const s = 0.02;
      const d = 0.0125;
      return (
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh material={mMat} position={[0, -0.006, 0]}>
            <cylinderGeometry args={[0.016, 0.01, 0.01, 12]} />
          </mesh>
          <Gem size={s} position={[0, 0.006, -d]} />
          <Gem size={s} position={[-d * 0.87, 0.006, d * 0.5]} />
          <Gem size={s} position={[d * 0.87, 0.006, d * 0.5]} />
        </group>
      );
    }
    case "ball":
      return (
        <mesh material={metalMaterial(metal)} position={[0, 0, 0.008]}>
          <sphereGeometry args={[0.014, 24, 24]} />
        </mesh>
      );
    case "pearl":
      return (
        <mesh material={pearlMat} position={[0, 0, 0.009]}>
          <sphereGeometry args={[0.017, 28, 28]} />
        </mesh>
      );
    default:
      return null;
  }
}

/** Ring designs are built centered on the hoop, hoop plane = local XY, anchor at +X·R. */
function RingBody({ id, metal, R }: { id: string; metal: MetalId; R: number }) {
  const mMat = metalMaterial(metal);
  const paveGems = useMemo(() => {
    if (id !== "pave-ring") return [];
    const out: { pos: [number, number, number]; rot: [number, number, number] }[] = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      // arc away from the piercing point (+X), around the visible lower half,
      // stones sitting proud of the wire
      const a = Math.PI * 0.55 + (i / (n - 1)) * Math.PI * 0.9;
      const rOut = R + 0.005;
      out.push({
        pos: [Math.cos(a) * rOut, Math.sin(a) * rOut, 0],
        rot: [0, 0, a - Math.PI / 2],
      });
    }
    return out;
  }, [id, R]);

  return (
    <group>
      <mesh material={mMat}>
        <torusGeometry args={[R, TUBE, 20, 56]} />
      </mesh>
      {id === "bead-ring" && (
        <mesh material={mMat} position={[-R, 0, 0]}>
          <sphereGeometry args={[TUBE * 2.3, 20, 20]} />
        </mesh>
      )}
      {paveGems.map((g, i) => (
        <Gem key={i} size={0.015} position={g.pos} rotation={g.rot} />
      ))}
    </group>
  );
}

/** Dangle designs hang along world -Y; `n` is the outward surface normal. */
function DangleBody({ metal, n }: { id: string; metal: MetalId; n: THREE.Vector3 }) {
  const mMat = metalMaterial(metal);
  const off: [number, number, number] = [n.x * 0.012, 0, n.z * 0.012];
  return (
    <group position={off}>
      <mesh material={mMat}>
        <sphereGeometry args={[0.01, 20, 20]} />
      </mesh>
      <mesh material={mMat} position={[0, -0.017, 0]}>
        <torusGeometry args={[0.0085, 0.0025, 12, 24]} />
      </mesh>
      <mesh material={mMat} position={[0, -0.031, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.0085, 0.0025, 12, 24]} />
      </mesh>
      <Gem size={0.036} position={[0, -0.062, 0]} />
    </group>
  );
}

export { StudBody, RingBody, DangleBody };
