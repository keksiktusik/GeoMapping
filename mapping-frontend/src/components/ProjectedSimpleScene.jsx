import { useEffect, useMemo } from "react";
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

function useProjectedMaterial(projectionTexture, projector, aspect, renderOrder = 0) {
  return useMemo(() => {
    if (!projectionTexture) return null;

    const projectorCamera = makeProjectorCamera(projector, aspect);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1 - renderOrder,
      polygonOffsetUnits: -1 - renderOrder,
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
  }, [projectionTexture, projector, aspect, renderOrder]);
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

function LayeredPlane({
  textures,
  projector,
  depthOffsets
}) {
  const backMaterial = useProjectedMaterial(textures?.back, projector, 8 / 5, 0);
  const middleMaterial = useProjectedMaterial(textures?.middle, projector, 8 / 5, 1);
  const frontMaterial = useProjectedMaterial(textures?.front, projector, 8 / 5, 2);

  useEffect(() => {
    return () => {
      backMaterial?.dispose?.();
      middleMaterial?.dispose?.();
      frontMaterial?.dispose?.();
    };
  }, [backMaterial, middleMaterial, frontMaterial]);

  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[8, 5]} />
        <meshStandardMaterial color="#bfc7d4" />
      </mesh>

      {backMaterial && (
        <mesh position={[0, 0, depthOffsets.back]} renderOrder={1}>
          <planeGeometry args={[8, 5]} />
          <primitive object={backMaterial} attach="material" />
        </mesh>
      )}

      {middleMaterial && (
        <mesh position={[0, 0, depthOffsets.middle]} renderOrder={2}>
          <planeGeometry args={[8, 5]} />
          <primitive object={middleMaterial} attach="material" />
        </mesh>
      )}

      {frontMaterial && (
        <mesh position={[0, 0, depthOffsets.front]} renderOrder={3}>
          <planeGeometry args={[8, 5]} />
          <primitive object={frontMaterial} attach="material" />
        </mesh>
      )}
    </group>
  );
}

function FittedLayeredGlbModel({
  modelUrl,
  textures,
  projector,
  depthOffsets,
  showEdges = true
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

  const baseClone = useMemo(() => scene.clone(), [scene]);

  const backClone = useMemo(() => scene.clone(), [scene]);
  const middleClone = useMemo(() => scene.clone(), [scene]);
  const frontClone = useMemo(() => scene.clone(), [scene]);
  const edgesClone = useMemo(() => scene.clone(), [scene]);

  const backMaterial = useProjectedMaterial(textures?.back, projector, 8 / 5, 0);
  const middleMaterial = useProjectedMaterial(textures?.middle, projector, 8 / 5, 1);
  const frontMaterial = useProjectedMaterial(textures?.front, projector, 8 / 5, 2);

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
    if (!backMaterial) return;
    backClone.traverse((obj) => {
      if (obj.isMesh) obj.material = backMaterial;
    });
  }, [backClone, backMaterial]);

  useEffect(() => {
    if (!middleMaterial) return;
    middleClone.traverse((obj) => {
      if (obj.isMesh) obj.material = middleMaterial;
    });
  }, [middleClone, middleMaterial]);

  useEffect(() => {
    if (!frontMaterial) return;
    frontClone.traverse((obj) => {
      if (obj.isMesh) obj.material = frontMaterial;
    });
  }, [frontClone, frontMaterial]);

  useEffect(() => {
    return () => {
      backMaterial?.dispose?.();
      middleMaterial?.dispose?.();
      frontMaterial?.dispose?.();
    };
  }, [backMaterial, middleMaterial, frontMaterial]);

  const basePos = [-fit.center.x, -fit.center.y, -fit.center.z];

  return (
    <group scale={[fit.scale, fit.scale, fit.scale]}>
      <primitive object={baseClone} position={basePos} />

      {backMaterial && (
        <primitive
          object={backClone}
          position={[basePos[0], basePos[1], basePos[2] + depthOffsets.back]}
          renderOrder={1}
        />
      )}

      {middleMaterial && (
        <primitive
          object={middleClone}
          position={[basePos[0], basePos[1], basePos[2] + depthOffsets.middle]}
          renderOrder={2}
        />
      )}

      {frontMaterial && (
        <primitive
          object={frontClone}
          position={[basePos[0], basePos[1], basePos[2] + depthOffsets.front]}
          renderOrder={3}
        />
      )}

      {showEdges && (
        <group position={basePos}>
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

function SceneContent({
  mode,
  modelUrl,
  textures,
  projector,
  depthOffsets
}) {
  return (
    <>
      <color attach="background" args={["black"]} />
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

      {mode === "glb" ? (
        <FittedLayeredGlbModel
          modelUrl={modelUrl}
          textures={textures}
          projector={projector}
          depthOffsets={depthOffsets}
          showEdges={true}
        />
      ) : (
        <LayeredPlane
          textures={textures}
          projector={projector}
          depthOffsets={depthOffsets}
        />
      )}
    </>
  );
}

export default function ProjectedSimpleScene({
  mode = "plane",
  modelUrl,
  textures,
  projector,
  depthOffsets = {
    front: 0.06,
    middle: 0,
    back: -0.06
  }
}) {
  return (
    <>
      <SceneContent
        mode={mode}
        modelUrl={modelUrl}
        textures={textures}
        projector={projector}
        depthOffsets={depthOffsets}
      />
      <OrbitControls />
    </>
  );
}