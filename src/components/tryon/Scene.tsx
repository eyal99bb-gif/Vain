"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import {
  Environment,
  Html,
  Lightformer,
  OrbitControls,
  PerspectiveCamera,
  useGLTF,
  useTexture,
} from "@react-three/drei";
import * as THREE from "three";
import { ANCHORS, type Anchor } from "./anchors";
import {
  DangleBody,
  designById,
  RingBody,
  StudBody,
  type MetalId,
} from "./catalog";

const HEAD_URL = "/models/LeePerrySmith.glb";
const HEAD_HEIGHT = 3.0;

export type Placement = { designId: string; metal: MetalId };

type SceneProps = {
  placements: Record<string, Placement>;
  selectedSpot: string | null;
  onSelectSpot: (id: string) => void;
  debug?: boolean;
};

/* ─── Head model ──────────────────────────────────────────────────────────── */

function Head({ debug }: { debug?: boolean }) {
  const { scene } = useGLTF(HEAD_URL);
  const [col, nrm] = useTexture([
    "/models/Map-COL.jpg",
    "/models/Infinite-Level_02_Tangent_SmoothUV.jpg",
  ]);

  const { s, offset } = useMemo(() => {
    const map = col.clone();
    map.colorSpace = THREE.SRGBColorSpace;
    const skin = new THREE.MeshStandardMaterial({
      map,
      normalMap: nrm,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.62,
      envMapIntensity: 0.45,
    });
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = skin;
    });
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = HEAD_HEIGHT / size.y;
    return {
      s,
      offset: [-center.x * s, -center.y * s, -center.z * s] as [number, number, number],
    };
  }, [scene, col, nrm]);

  const onDown = debug
    ? (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        const p = e.point;
        const n = e.face!.normal
          .clone()
          .transformDirection(e.object.matrixWorld)
          .normalize();
        console.log(
          `ANCHOR {"position":[${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(
            3
          )}],"normal":[${n.x.toFixed(2)},${n.y.toFixed(2)},${n.z.toFixed(2)}]}`
        );
      }
    : undefined;

  return (
    // rotate the head so its left ear faces the camera (+Z)
    <group rotation={[0, -Math.PI / 2, 0]}>
      <group scale={s} position={offset}>
        <primitive object={scene} onPointerDown={onDown} />
      </group>
    </group>
  );
}

useGLTF.preload(HEAD_URL);

/* ─── Placed earrings ─────────────────────────────────────────────────────── */

const DOWN = new THREE.Vector3(0, -1, 0);
const Z = new THREE.Vector3(0, 0, 1);

function useAnchorFrames(anchor: Anchor) {
  return useMemo(() => {
    const n = new THREE.Vector3(...anchor.normal).normalize();
    const pos = new THREE.Vector3(...anchor.position);
    // stud: +Z of the design maps onto the surface normal
    const studQ = new THREE.Quaternion().setFromUnitVectors(Z, n);
    // ring: hang the hoop from the piercing point. The physically flat
    // orientation (hoop plane = normal × gravity) reads as a thin sliver
    // from the try-on camera, so tilt the hoop about its vertical diameter
    // toward the viewer — the way jewelry try-ons present hoops.
    const TILT = 0.62;
    const lz0 = new THREE.Vector3().crossVectors(n, DOWN).normalize();
    const lx = new THREE.Vector3().crossVectors(n, lz0).normalize();
    const axis = lz0
      .clone()
      .multiplyScalar(Math.cos(TILT))
      .addScaledVector(n, Math.sin(TILT))
      .normalize();
    const ly = new THREE.Vector3().crossVectors(axis, lx).normalize();
    const ringQ = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(lx, ly, axis)
    );
    const studRot = new THREE.Euler().setFromQuaternion(studQ);
    const ringRot = new THREE.Euler().setFromQuaternion(ringQ);
    return {
      n,
      pos,
      studRot: [studRot.x, studRot.y, studRot.z] as [number, number, number],
      ringRot: [ringRot.x, ringRot.y, ringRot.z] as [number, number, number],
    };
  }, [anchor]);
}

function PlacedEarring({
  anchor,
  placement,
}: {
  anchor: Anchor;
  placement: Placement;
}) {
  const design = designById(placement.designId);
  const { n, pos, studRot, ringRot } = useAnchorFrames(anchor);

  if (design.kind === "stud") {
    return (
      <group position={pos} rotation={studRot}>
        <StudBody id={design.id} metal={placement.metal} />
      </group>
    );
  }
  if (design.kind === "ring") {
    const R = design.ringRadius ?? 0.03;
    return (
      <group position={pos} rotation={ringRot}>
        <group position={[-R * 0.92, 0, 0]}>
          <RingBody id={design.id} metal={placement.metal} R={R} />
        </group>
      </group>
    );
  }
  return (
    <group position={pos}>
      <DangleBody id={design.id} metal={placement.metal} n={n} />
    </group>
  );
}

/* ─── Piercing spot markers ───────────────────────────────────────────────── */

function SpotMarker({
  anchor,
  selected,
  placed,
  onSelect,
}: {
  anchor: Anchor;
  selected: boolean;
  placed: boolean;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const pos = useMemo(() => {
    const n = new THREE.Vector3(...anchor.normal).normalize();
    return new THREE.Vector3(...anchor.position).addScaledVector(n, 0.022);
  }, [anchor]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const base = placed && !selected ? 0.55 : 1;
    const pulse = selected ? 1.25 : 1 + Math.sin(clock.elapsedTime * 2.6) * 0.12;
    ref.current.scale.setScalar((hovered ? pulse * 1.3 : pulse) * base);
  });

  const color = selected ? "#ffffff" : placed ? "#8f7a4e" : "#e8b64a";

  return (
    <group position={pos}>
      <mesh
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(anchor.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[0.011, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={placed && !selected ? 0.22 : 0.95}
        />
      </mesh>
      {(hovered || selected) && (
        <Html center distanceFactor={1.4} style={{ pointerEvents: "none" }}>
          <div
            dir="rtl"
            style={{
              transform: "translateY(-26px)",
              whiteSpace: "nowrap",
              background: "rgba(12,10,9,0.85)",
              border: "1px solid rgba(232,182,74,0.4)",
              color: "#f5f5f4",
              fontSize: 11,
              letterSpacing: "0.08em",
              padding: "3px 10px",
              borderRadius: 999,
            }}
          >
            {anchor.name}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ─── Studio lighting ─────────────────────────────────────────────────────── */

function StudioLights() {
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[1.5, 2, 4]} intensity={1.1} color="#fff4e4" />
      <directionalLight position={[-3, 0.5, 1]} intensity={0.35} color="#dfe8ff" />
      <Environment resolution={256}>
        <Lightformer
          intensity={2.4}
          position={[0, 4, 3]}
          rotation-x={-Math.PI / 4}
          scale={[8, 4, 1]}
        />
        <Lightformer
          intensity={1.4}
          position={[-5, 1, 2]}
          rotation-y={Math.PI / 3}
          scale={[2.5, 5, 1]}
          color="#ffe9c8"
        />
        <Lightformer
          intensity={1.1}
          position={[5, 0.5, 2]}
          rotation-y={-Math.PI / 3}
          scale={[2.5, 5, 1]}
          color="#e8efff"
        />
        <Lightformer
          intensity={0.7}
          position={[0, -3, 4]}
          rotation-x={Math.PI / 4}
          scale={[6, 2, 1]}
          color="#ffd9b3"
        />
      </Environment>
    </>
  );
}

/* ─── Canvas ──────────────────────────────────────────────────────────────── */

export default function Scene({
  placements,
  selectedSpot,
  onSelectSpot,
  debug,
}: SceneProps) {
  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true }}>
      <PerspectiveCamera makeDefault position={[0.18, 0.62, 1.7]} fov={30} />
      <OrbitControls
        makeDefault
        target={[-0.07, 0.5, 0.55]}
        enablePan={debug}
        minDistance={debug ? 0.2 : 0.5}
        maxDistance={debug ? 12 : 2.6}
        minAzimuthAngle={debug ? -Infinity : -1.0}
        maxAzimuthAngle={debug ? Infinity : 1.0}
        minPolarAngle={debug ? 0 : Math.PI / 2 - 0.65}
        maxPolarAngle={debug ? Math.PI : Math.PI / 2 + 0.5}
      />
      <StudioLights />
      <Suspense
        fallback={
          <Html center>
            <div dir="rtl" style={{ color: "#a8a29e", fontSize: 13, whiteSpace: "nowrap" }}>
              טוען מודל תלת־ממד…
            </div>
          </Html>
        }
      >
        <Head debug={debug} />
        {ANCHORS.map((a) => (
          <SpotMarker
            key={a.id}
            anchor={a}
            selected={selectedSpot === a.id}
            placed={!!placements[a.id]}
            onSelect={onSelectSpot}
          />
        ))}
        {Object.entries(placements).map(([spotId, placement]) => {
          const anchor = ANCHORS.find((a) => a.id === spotId);
          if (!anchor) return null;
          return <PlacedEarring key={spotId} anchor={anchor} placement={placement} />;
        })}
      </Suspense>
    </Canvas>
  );
}
