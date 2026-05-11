import { useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, useGLTF, Edges } from "@react-three/drei";
import * as THREE from "three";

const MIN_DISTANCE = 0.5;

function degToRad(v) {
  return THREE.MathUtils.degToRad(Number(v || 0));
}

function getSafeProjector(projector = {}) {
  return {
    distance: Math.max(MIN_DISTANCE, Number(projector?.distance || 2.5)),
    offsetX: Number(projector?.offsetX || 0),
    offsetY: Number(projector?.offsetY || 0),
    angleX: Number(projector?.angleX || 0),
    angleY: Number(projector?.angleY || 0),
    angleZ: Number(projector?.angleZ || 0),
    fov: Math.max(10, Math.min(150, Number(projector?.fov || 45)))
  };
}

function makeProjectorCamera(projector, aspect) {
  const p = getSafeProjector(projector);

  const cam = new THREE.PerspectiveCamera(p.fov, aspect, 0.1, 100);
  cam.rotation.order = "YXZ";

  cam.position.set(p.offsetX, p.offsetY, p.distance);
  cam.rotation.set(
    degToRad(p.angleX),
    degToRad(p.angleY),
    degToRad(p.angleZ)
  );

  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();

  return cam;
}

function useProjectedMaterial(projectionTexture, projector, aspect) {
  return useMemo(() => {
    if (!projectionTexture) return null;

    const projectorCamera = makeProjectorCamera(projector, aspect);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        baseTexture: { value: projectionTexture },
        projectorViewMatrix: {
          value: projectorCamera.matrixWorldInverse.clone()
        },
        projectorProjectionMatrix: {
          value: projectorCamera.projectionMatrix.clone()
        }
      },
      vertexShader: `
        varying vec3 vWorldPosition;

        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D baseTexture;
        uniform mat4 projectorViewMatrix;
        uniform mat4 projectorProjectionMatrix;

        varying vec3 vWorldPosition;

        void main() {
          vec4 projectorClip =
            projectorProjectionMatrix *
            projectorViewMatrix *
            vec4(vWorldPosition, 1.0);

          if (projectorClip.w <= 0.0) discard;

          vec3 ndc = projectorClip.xyz / projectorClip.w;
          vec2 uv = ndc.xy * 0.5 + 0.5;
          uv.y = 1.0 - uv.y;

          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;

          vec4 color = texture2D(baseTexture, uv);
          if (color.a < 0.01) discard;

          gl_FragColor = color;
        }
      `
    });

    return material;
  }, [projectionTexture, projector, aspect]);
}

function ProjectorHelper({ projector }) {
  const p = getSafeProjector(projector);

  return (
    <group position={[p.offsetX, p.offsetY, p.distance]}>
      <mesh>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#38bdf8"
          emissiveIntensity={0.35}
        />
      </mesh>
    </group>
  );
}

function getInsetCameraPosition(modelRotation = [0, 0, 0]) {
  const ry = Number(modelRotation?.[1] || 0);
  const eps = 0.001;

  if (Math.abs(ry + Math.PI / 2) < eps || Math.abs(ry - Math.PI / 2) < eps) {
    return [0, 0, 12];
  }

  if (Math.abs(Math.abs(ry) - Math.PI) < eps) {
    return [10, 0, 0];
  }

  return [12, 0, 0];
}

function FittedGlbModel({
  modelUrl,
  projectionTexture,
  projector,
  showEdges = true,
  modelRotation = [0, 0, 0],
  modelOffset = [0, 0, 0]
}) {
  const { scene } = useGLTF(modelUrl);

  const fit = useMemo(() => {
    const measureClone = scene.clone();
    const box = new THREE.Box3().setFromObject(measureClone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    const targetWidth = 8;
    const targetHeight = 5;

    const sx = targetWidth / (size.x || 1);
    const sy = targetHeight / (size.y || 1);
    const scale = Math.min(sx, sy);

    return { center, scale };
  }, [scene]);

  const projectedMaterial = useProjectedMaterial(
    projectionTexture,
    projector,
    8 / 5
  );

  const baseClone = useMemo(() => scene.clone(), [scene]);
  const projectionClone = useMemo(() => scene.clone(), [scene]);
  const edgesClone = useMemo(() => scene.clone(), [scene]);

  useEffect(() => {
    baseClone.traverse((obj) => {
      if (obj.isMesh) {
        obj.material = new THREE.MeshStandardMaterial({
          color: "#8e99a8",
          roughness: 0.9,
          metalness: 0.05
        });
      }
    });
  }, [baseClone]);

  useEffect(() => {
    if (!projectedMaterial) return;

    projectionClone.traverse((obj) => {
      if (obj.isMesh) {
        obj.material = projectedMaterial;
      }
    });

    return () => {
      projectedMaterial.dispose();
    };
  }, [projectionClone, projectedMaterial]);

  const finalPosition = [
    -fit.center.x + Number(modelOffset?.[0] || 0),
    -fit.center.y + Number(modelOffset?.[1] || 0),
    -fit.center.z + Number(modelOffset?.[2] || 0)
  ];

  return (
    <group scale={[fit.scale, fit.scale, fit.scale]}>
      <primitive
        object={baseClone}
        position={finalPosition}
        rotation={modelRotation}
      />

      {projectedMaterial && (
        <primitive
          object={projectionClone}
          position={finalPosition}
          rotation={modelRotation}
        />
      )}

      {showEdges && (
        <group position={finalPosition} rotation={modelRotation}>
          {edgesClone.children.map((child, index) =>
            child.isMesh ? (
              <mesh
                key={index}
                geometry={child.geometry}
                position={child.position}
                rotation={child.rotation}
                scale={child.scale}
              >
                <meshBasicMaterial transparent opacity={0} />
                <Edges color="white" threshold={15} />
              </mesh>
            ) : null
          )}
        </group>
      )}
    </group>
  );
}

function PlanePreview({ projectionTexture, projector }) {
  const projectedMaterial = useProjectedMaterial(
    projectionTexture,
    projector,
    8 / 5
  );

  useEffect(() => {
    return () => {
      if (projectedMaterial) {
        projectedMaterial.dispose();
      }
    };
  }, [projectedMaterial]);

  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[8, 5]} />
        <meshStandardMaterial color="#bfc7d4" />
      </mesh>

      {projectedMaterial && (
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[8, 5]} />
          <primitive object={projectedMaterial} attach="material" />
        </mesh>
      )}
    </group>
  );
}

function SceneContent({
  renderMode,
  modelUrl,
  modelRotation = [0, 0, 0],
  modelOffset = [0, 0, 0],
  projectionTexture,
  projector,
  showEdges = true
}) {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />
      <directionalLight position={[-4, 2, 6]} intensity={0.8} />
      <directionalLight position={[0, 0, 8]} intensity={0.6} />

      <Grid
        args={[20, 20]}
        cellSize={1}
        sectionSize={5}
        fadeDistance={30}
        fadeStrength={1}
      />

      <ProjectorHelper projector={projector} />

      {renderMode === "glb" ? (
        <FittedGlbModel
          modelUrl={modelUrl}
          projectionTexture={projectionTexture}
          projector={projector}
          showEdges={showEdges}
          modelRotation={modelRotation}
          modelOffset={modelOffset}
        />
      ) : (
        <PlanePreview
          projectionTexture={projectionTexture}
          projector={projector}
        />
      )}
    </>
  );
}

export default function WallScene({
  renderMode = "plane",
  modelUrl,
  modelRotation = [0, 0, 0],
  modelOffset = [0, 0, 0],
  projectionTexture,
  projector,
  wallW = 800,
  wallH = 500
}) {
  const insetCameraPosition = getInsetCameraPosition(modelRotation);

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: `${wallW} / ${wallH}`,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #243041",
        background: "#0b1220",
        position: "relative"
      }}
    >
      <Canvas camera={{ position: [0, 0, 10.5], fov: 45 }}>
        <color attach="background" args={["#0b1220"]} />
        <SceneContent
          renderMode={renderMode}
          modelUrl={modelUrl}
          modelRotation={modelRotation}
          modelOffset={modelOffset}
          projectionTexture={projectionTexture}
          projector={projector}
          showEdges={true}
        />
        <OrbitControls />
      </Canvas>

      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 12,
          width: "26%",
          maxWidth: 220,
          minWidth: 140,
          aspectRatio: "220 / 160",
          border: "1px solid #2f4159",
          borderRadius: 10,
          overflow: "hidden",
          background: "#0b1220",
          boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
          pointerEvents: "none"
        }}
      >
        <Canvas camera={{ position: insetCameraPosition, fov: 35 }}>
          <color attach="background" args={["#0b1220"]} />
          <SceneContent
            renderMode={renderMode}
            modelUrl={modelUrl}
            modelRotation={modelRotation}
            modelOffset={modelOffset}
            projectionTexture={projectionTexture}
            projector={projector}
            showEdges={true}
          />
          <OrbitControls enablePan={false} />
        </Canvas>

        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            padding: "4px 8px",
            background: "rgba(12,18,32,0.85)",
            color: "white",
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid #2f4159"
          }}
        >
          Side view
        </div>
      </div>
    </div>
  );
}