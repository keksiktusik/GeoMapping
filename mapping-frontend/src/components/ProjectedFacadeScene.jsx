import { useEffect, useMemo } from "react";
import { useGLTF, Edges } from "@react-three/drei";
import * as THREE from "three";

const MIN_DISTANCE = 0.5;

function degToRad(v) {
  return THREE.MathUtils.degToRad(Number(v || 0));
}

export function getSafeProjector(projector = {}) {
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

export function makeProjectorCamera(projector, aspect) {
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

    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
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

function FittedGlbModel({
  modelUrl,
  projectionTexture,
  projector,
  showEdges = true,
  simplified = false,
  aspect = 8 / 5
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
    aspect
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
          metalness: 0.05,
          transparent: simplified,
          opacity: simplified ? 0.55 : 1
        });
      }
    });

    return () => {
      baseClone.traverse((obj) => {
        if (obj.isMesh) obj.material?.dispose?.();
      });
    };
  }, [baseClone, simplified]);

  useEffect(() => {
    if (!projectedMaterial) return;

    projectionClone.traverse((obj) => {
      if (obj.isMesh) {
        obj.material = projectedMaterial;
        obj.renderOrder = 2;
      }
    });

    return () => {
      projectedMaterial.dispose();
    };
  }, [projectionClone, projectedMaterial]);

  return (
    <group scale={[fit.scale, fit.scale, fit.scale]}>
      <primitive
        object={baseClone}
        position={[-fit.center.x, -fit.center.y, -fit.center.z]}
      />

      {projectedMaterial && (
        <primitive
          object={projectionClone}
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

function PlanePreview({ projectionTexture, projector, aspect = 8 / 5 }) {
  const projectedMaterial = useProjectedMaterial(
    projectionTexture,
    projector,
    aspect
  );

  useEffect(() => {
    return () => {
      projectedMaterial?.dispose?.();
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

export default function ProjectedFacadeScene({
  renderMode = "plane",
  modelUrl,
  projectionTexture,
  projector,
  showEdges = true,
  showGrid = false,
  showProjectorHelper = false,
  simplified = false,
  aspect = 8 / 5
}) {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />
      <directionalLight position={[-4, 2, 6]} intensity={0.8} />
      <directionalLight position={[0, 0, 8]} intensity={0.6} />

      {showProjectorHelper ? <ProjectorHelper projector={projector} /> : null}

      {renderMode === "glb" ? (
        <FittedGlbModel
          modelUrl={modelUrl}
          projectionTexture={projectionTexture}
          projector={projector}
          showEdges={showEdges}
          simplified={simplified}
          aspect={aspect}
        />
      ) : (
        <PlanePreview
          projectionTexture={projectionTexture}
          projector={projector}
          aspect={aspect}
        />
      )}
    </>
  );
}