import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, useGLTF, Edges } from "@react-three/drei";
import * as THREE from "three";

function degToRad(v) {
  return THREE.MathUtils.degToRad(Number(v || 0));
}

function makeProjectorCamera(projector, aspect) {
  const cam = new THREE.PerspectiveCamera(
    Number(projector?.fov || 45),
    aspect,
    0.1,
    100
  );

  cam.position.set(
    Number(projector?.offsetX || 0),
    Number(projector?.offsetY || 0),
    Number(projector?.distance || 2.5)
  );

  cam.rotation.set(
    degToRad(projector?.angleX),
    degToRad(projector?.angleY),
    degToRad(projector?.angleZ)
  );

  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();

  return cam;
}

function useProjectedMaterial(projectionTexture, projector, aspect) {
  return useMemo(() => {
    if (!projectionTexture) return null;

    const projectorCamera = makeProjectorCamera(projector, aspect);

    return new THREE.ShaderMaterial({
      transparent: true,
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
          gl_Position = projectionMatrix * viewMatrix * worldPos;
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
  }, [projectionTexture, projector, aspect]);
}

function FittedGlbModel({ modelUrl, projectionTexture, projector, showEdges = true }) {
  const { scene } = useGLTF(modelUrl);
  const cloned = useMemo(() => scene.clone(), [scene]);

  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
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
  }, [cloned]);

  const projectedMaterial = useProjectedMaterial(
    projectionTexture,
    projector,
    8 / 5
  );

  const baseClone = useMemo(() => scene.clone(), [scene]);
  const edgesClone = useMemo(() => scene.clone(), [scene]);

  useMemo(() => {
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

  useMemo(() => {
    if (!projectedMaterial) return;
    cloned.traverse((obj) => {
      if (obj.isMesh) {
        obj.material = projectedMaterial;
      }
    });
  }, [cloned, projectedMaterial]);

  return (
    <group scale={[fit.scale, fit.scale, fit.scale]}>
      <primitive
        object={baseClone}
        position={[-fit.center.x, -fit.center.y, -fit.center.z]}
      />

      {projectedMaterial && (
        <primitive
          object={cloned}
          position={[-fit.center.x, -fit.center.y, -fit.center.z]}
        />
      )}

      {showEdges && (
        <group position={[-fit.center.x, -fit.center.y, -fit.center.z]}>
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

function SceneContent({ renderMode, modelUrl, projectionTexture, projector, showEdges = true }) {
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

      {renderMode === "glb" ? (
        <FittedGlbModel
          modelUrl={modelUrl}
          projectionTexture={projectionTexture}
          projector={projector}
          showEdges={showEdges}
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

function SideCamera() {
  return (
    <Canvas camera={{ position: [10, 0, 0], fov: 35 }}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 5, 5]} intensity={1.1} />
      <directionalLight position={[-5, 3, 2]} intensity={0.7} />
      <color attach="background" args={["#0b1220"]} />
    </Canvas>
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
        background: "#0b1220",
        position: "relative"
      }}
    >
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <color attach="background" args={["#0b1220"]} />
        <SceneContent
          renderMode={renderMode}
          modelUrl={modelUrl}
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
          width: 220,
          height: 160,
          border: "1px solid #2f4159",
          borderRadius: 10,
          overflow: "hidden",
          background: "#0b1220",
          boxShadow: "0 8px 20px rgba(0,0,0,0.35)"
        }}
      >
        <Canvas camera={{ position: [10, 0, 0], fov: 35 }}>
          <color attach="background" args={["#0b1220"]} />
          <SceneContent
            renderMode={renderMode}
            modelUrl={modelUrl}
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