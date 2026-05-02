import { useGLTF } from "@react-three/drei";
import { useEffect } from "react";

export default function FacadeGLB({
  modelUrl = "/models/fasada.glb",
  projectionTexture,
  scale = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0]
}) {
  const { scene } = useGLTF(modelUrl);

  useEffect(() => {
    if (!scene || !projectionTexture) return;

    scene.traverse((child) => {
      if (child.isMesh) {
        child.material.map = projectionTexture;
        child.material.needsUpdate = true;
      }
    });
  }, [scene, projectionTexture]);

  return (
    <group scale={scale} position={position} rotation={rotation}>
      <primitive object={scene} />
    </group>
  );
}