import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, useTexture } from "@react-three/drei";
import { useMemo } from "react";
import FacadeModel from "./FacadeModel";

function SceneContent({
  renderMode = "plane",
  modelUrl = "/models/fasada.glb",

  points,
  opacity,
  showGrid,
  warp,
  wallW = 800,
  wallH = 500,
  segmentsX = 40,
  segmentsY = 25,
  projectionTexture = null
}) {
  // ✅ hook jest tu OK, bo SceneContent jest dzieckiem Canvas
  const fallbackTexture = useTexture("/projection.jpg");

  const texture = useMemo(() => {
    const t = projectionTexture ?? fallbackTexture;
    if (!t) return null;

    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }, [projectionTexture, fallbackTexture]);

  const wallSize = useMemo(() => ({ w: 8, h: 5 }), []);

  const pxToWorld = useMemo(() => {
    return (p) => {
      const nx = (p.x / wallW - 0.5) * wallSize.w;
      const ny = (0.5 - p.y / wallH) * wallSize.h;
      return new THREE.Vector2(nx, ny);
    };
  }, [wallW, wallH, wallSize]);

  const windowMesh = useMemo(() => {
    if (renderMode !== "plane") return null;
    if (!points || points.length < 3) return null;

    const shape = new THREE.Shape();
    const p0 = pxToWorld(points[0]);
    shape.moveTo(p0.x, p0.y);
    for (let i = 1; i < points.length; i++) {
      const pi = pxToWorld(points[i]);
      shape.lineTo(pi.x, pi.y);
    }
    shape.closePath();

    return new THREE.ShapeGeometry(shape);
  }, [renderMode, points, pxToWorld]);

  const wallGeometry = useMemo(() => {
    if (renderMode !== "plane") return null;

    const w = warp || {
      tl: { x: 0, y: 0 },
      tr: { x: wallW, y: 0 },
      br: { x: wallW, y: wallH },
      bl: { x: 0, y: wallH }
    };

    const TL = pxToWorld(w.tl);
    const TR = pxToWorld(w.tr);
    const BR = pxToWorld(w.br);
    const BL = pxToWorld(w.bl);

    const geom = new THREE.PlaneGeometry(wallSize.w, wallSize.h, segmentsX, segmentsY);
    const pos = geom.attributes.position;
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const u = v.x / wallSize.w + 0.5;
      const t = v.y / wallSize.h + 0.5;

      const x =
        (1 - u) * (1 - t) * TL.x +
        u * (1 - t) * TR.x +
        u * t * BR.x +
        (1 - u) * t * BL.x;

      const y =
        (1 - u) * (1 - t) * TL.y +
        u * (1 - t) * TR.y +
        u * t * BR.y +
        (1 - u) * t * BL.y;

      pos.setXYZ(i, x, y, 0);
    }

    pos.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
  }, [renderMode, warp, wallW, wallH, pxToWorld, wallSize, segmentsX, segmentsY]);

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} />

      {renderMode === "plane" && wallGeometry && (
        <mesh geometry={wallGeometry}>
          <meshBasicMaterial map={texture ?? null} />
        </mesh>
      )}

      {renderMode === "glb" && (
        <FacadeModel modelUrl={modelUrl} projectionTexture={texture} />
      )}

      {windowMesh && (
        <mesh geometry={windowMesh} position={[0, 0, 0.02]}>
          <meshBasicMaterial
            color={"#fafafa"}
            transparent
            opacity={Math.max(0.0, Math.min(1.0, 1 - opacity))}
          />
        </mesh>
      )}

      {showGrid && (
        <Grid
          args={[10, 10]}
          cellSize={0.5}
          cellThickness={1}
          sectionSize={2.5}
          sectionThickness={1.5}
          fadeDistance={15}
          fadeStrength={1}
          position={[0, 0, 0.005]}
        />
      )}

      <OrbitControls enablePan={false} />
    </>
  );
}

export default function WallScene(props) {
  // ✅ Canvas jest TU, więc hooks w SceneContent zawsze mają kontekst
  return (
    <div
      style={{
        width: 900,
        height: 600,
        border: "1px solid #ddd",
        borderRadius: 8,
        background: "#fff"
      }}
    >
      <Canvas camera={{ position: [0, 0, 9], fov: 45 }}>
        <SceneContent {...props} />
      </Canvas>
    </div>
  );
}