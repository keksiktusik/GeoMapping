import { useGLTF } from "@react-three/drei";
import { useEffect } from "react";

export default function FacadeGLB({
  modelUrl = "/models/fasada.glb",
  projectionTexture
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

  return <primitive object={scene} />;
}