import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useMemo } from "react";

function degToRad(v) {
  return THREE.MathUtils.degToRad(Number(v || 0));
}

function PlanePreview({ projectionTexture, projector }) {
  const material = useMemo(() => {
    if (!projectionTexture) return new THREE.MeshBasicMaterial({ color: "#666" });

    const tex = projectionTexture.clone();
    tex.needsUpdate = true;

    return new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true
    });
  }, [projectionTexture]);

  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[8, 5]} />
        <meshStandardMaterial color="#d6d6d6" />
      </mesh>

      <mesh
        position={[
          Number(projector?.offsetX || 0),
          Number(projector?.offsetY || 0),
          0.02 + (Number(projector?.distance || 2.5) - 2.5) * 0.15
        ]}
        rotation={[
          degToRad(projector?.angleX),
          degToRad(projector?.angleY),
          degToRad(projector?.angleZ)
        ]}
      >
        <planeGeometry args={[8, 5]} />
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  );
}

function GlbPreview({ modelUrl, projectionTexture, projector }) {
  const { scene } = useGLTF(modelUrl);

  const cloned = useMemo(() => scene.clone(), [scene]);

  const material = useMemo(() => {
    if (!projectionTexture) return null;
    const tex = projectionTexture.clone();
    tex.needsUpdate = true;

    return new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true
    });
  }, [projectionTexture]);

  return (
    <group>
      <primitive object={cloned} scale={1} />

      <mesh
        position={[
          Number(projector?.offsetX || 0),
          Number(projector?.offsetY || 0),
          0.3 + (Number(projector?.distance || 2.5) - 2.5) * 0.15
        ]}
        rotation={[
          degToRad(projector?.angleX),
          degToRad(projector?.angleY),
          degToRad(projector?.angleZ)
        ]}
      >
        <planeGeometry args={[8, 5]} />
        {material ? (
          <primitive object={material} attach="material" />
        ) : (
          <meshBasicMaterial color="#888" transparent opacity={0.4} />
        )}
      </mesh>
    </group>
  );
}

export default function WallScene({
  renderMode = "plane",
  modelUrl,
  projectionTexture,
  projector
}) {
  return (
    <div
      style={{
        width: "100%",
        height: 600,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #243041",
        background: "#0b1220"
      }}
    >
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />

        <Grid args={[20, 20]} cellSize={1} sectionSize={5} fadeDistance={30} fadeStrength={1} />

        {renderMode === "plane" ? (
          <PlanePreview projectionTexture={projectionTexture} projector={projector} />
        ) : (
          <GlbPreview
            modelUrl={modelUrl}
            projectionTexture={projectionTexture}
            projector={projector}
          />
        )}

        <OrbitControls />
      </Canvas>
    </div>
  );
}