import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, useTexture } from "@react-three/drei";
import { useMemo } from "react";

/**
 * points: [{x,y}...] w pikselach (np. 800x500)
 * warp: { tl,tr,br,bl } w pikselach (te same wymiary co wallW/wallH)
 * wallW, wallH: rozmiar "ściany" w px dla przeliczeń
 */
function SceneContent({
  points,
  opacity,
  showGrid,
  warp,
  wallW = 800,
  wallH = 500,
  segmentsX = 40,
  segmentsY = 25
}) {
  const texture = useTexture("/projection.jpg");
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  // Rozmiar ściany w świecie 3D (zachowujemy proporcje)
  const wallSize = useMemo(() => ({ w: 8, h: 5 }), []);

  // ====== helper: px -> world coords (dla OKNA i dla warpa) ======
  const pxToWorld = useMemo(() => {
    return (p) => {
      const nx = (p.x / wallW - 0.5) * wallSize.w;
      const ny = (0.5 - p.y / wallH) * wallSize.h;
      return new THREE.Vector2(nx, ny);
    };
  }, [wallW, wallH, wallSize]);

  // ====== WINDOW polygon geometry (okno blackout) ======
  const windowMesh = useMemo(() => {
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
  }, [points, pxToWorld]);

  // ====== WARPED WALL geometry (plane z segmentami + deformacja) ======
  const wallGeometry = useMemo(() => {
    // fallback warp = pełen prostokąt ściany
    const w = warp || {
      tl: { x: 0, y: 0 },
      tr: { x: wallW, y: 0 },
      br: { x: wallW, y: wallH },
      bl: { x: 0, y: wallH }
    };

    // rogi w world
    const TL = pxToWorld(w.tl);
    const TR = pxToWorld(w.tr);
    const BR = pxToWorld(w.br);
    const BL = pxToWorld(w.bl);

    // Plane z segmentami
    const geom = new THREE.PlaneGeometry(wallSize.w, wallSize.h, segmentsX, segmentsY);

    const pos = geom.attributes.position;
    const v = new THREE.Vector3();

    // Bilinear interpolation:
    // P(u,v) = (1-u)(1-v)TL + u(1-v)TR + u v BR + (1-u) v BL
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);

      // planeGeometry ma x w [-w/2..w/2], y w [-h/2..h/2]
      const u = (v.x / wallSize.w) + 0.5; // 0..1
      const t = (v.y / wallSize.h) + 0.5; // 0..1

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
    geom.computeVertexNormals(); // niekonieczne do basicMaterial, ale ok

    return geom;
  }, [warp, wallW, wallH, pxToWorld, wallSize, segmentsX, segmentsY]);

  // ====== Warp corners helper overlay (opcjonalnie) ======
  const warpCornerLines = useMemo(() => {
    if (!warp) return null;

    const w = warp;
    const TL = pxToWorld(w.tl);
    const TR = pxToWorld(w.tr);
    const BR = pxToWorld(w.br);
    const BL = pxToWorld(w.bl);

    const pts = [
      new THREE.Vector3(TL.x, TL.y, 0.01),
      new THREE.Vector3(TR.x, TR.y, 0.01),
      new THREE.Vector3(BR.x, BR.y, 0.01),
      new THREE.Vector3(BL.x, BL.y, 0.01),
      new THREE.Vector3(TL.x, TL.y, 0.01)
    ];

    const g = new THREE.BufferGeometry().setFromPoints(pts);
    return g;
  }, [warp, pxToWorld]);

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} />

      {/* ŚCIANA z "rzutowaną" teksturą (deformowana warpem) */}
      <mesh geometry={wallGeometry}>
        <meshBasicMaterial map={texture} />
      </mesh>

      {/* OKNO = blackout na projekcji */}
      {windowMesh && (
        <mesh geometry={windowMesh} position={[0, 0, 0.02]}>
          <meshBasicMaterial
            color={"#fafafa"}
            transparent
            opacity={Math.max(0.0, Math.min(1.0, 1 - opacity))}
          />
        </mesh>
      )}

      {/* Opcjonalnie: podgląd obrysu warpa (żeby było widać kalibrację) */}
      {warpCornerLines && (
        <line geometry={warpCornerLines}>
          <lineBasicMaterial color={"red"} />
        </line>
      )}

      {/* Grid kalibracyjny */}
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