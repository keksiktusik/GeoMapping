import { useEffect, useMemo } from "react";
import { OrbitControls, Grid, useGLTF, Edges } from "@react-three/drei";
import * as THREE from "three";

const MIN_DISTANCE = 0.5;

function degToRad(v) {
  return THREE.MathUtils.degToRad(Number(v || 0));
}

function clampOpacity(value) {
  return Math.max(0, Math.min(1, Number(value ?? 1)));
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

function createProjectedMaterial(texture, projector, aspect) {
  if (!texture) return null;

  const projectorCamera = makeProjectorCamera(projector, aspect);

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      baseTexture: { value: texture },
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

function FittedProjectedModel({
  modelUrl,
  textures,
  projector,
  modelRotation = [0, 0, 0],
  modelOffset = [0, 0, 0],
  modelScale = 1,
  facadeOpacity = 1,
  depthOffsets = {
    front: 0.06,
    middle: 0,
    back: -0.06
  }
}) {
  const { scene } = useGLTF(modelUrl);
  const safeFacadeOpacity = clampOpacity(facadeOpacity);

  const fit = useMemo(() => {
    const measureClone = scene.clone();
    const box = new THREE.Box3().setFromObject(measureClone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    const targetWidth = 12;
    const targetHeight = 7.5;

    const sx = targetWidth / (size.x || 1);
    const sy = targetHeight / (size.y || 1);
    const scale = Math.min(sx, sy);

    return { center, scale };
  }, [scene]);

  const baseClone = useMemo(() => scene.clone(), [scene]);
  const frontClone = useMemo(() => scene.clone(), [scene]);
  const middleClone = useMemo(() => scene.clone(), [scene]);
  const backClone = useMemo(() => scene.clone(), [scene]);
  const edgesClone = useMemo(() => scene.clone(), [scene]);

  const frontMaterial = useMemo(
    () => createProjectedMaterial(textures?.front, projector, 8 / 5),
    [textures?.front, projector]
  );

  const middleMaterial = useMemo(
    () => createProjectedMaterial(textures?.middle, projector, 8 / 5),
    [textures?.middle, projector]
  );

  const backMaterial = useMemo(
    () => createProjectedMaterial(textures?.back, projector, 8 / 5),
    [textures?.back, projector]
  );

  useEffect(() => {
    baseClone.traverse((obj) => {
      if (obj.isMesh) {
        obj.material = new THREE.MeshStandardMaterial({
          color: "#8e99a8",
          roughness: 0.9,
          metalness: 0.05,
          transparent: true,
          opacity: safeFacadeOpacity,
          depthWrite: false
        });

        obj.visible = safeFacadeOpacity > 0.001;
      }
    });
  }, [baseClone, safeFacadeOpacity]);

  useEffect(() => {
    if (!frontMaterial) return;

    frontClone.traverse((obj) => {
      if (obj.isMesh) obj.material = frontMaterial;
    });

    return () => frontMaterial.dispose();
  }, [frontClone, frontMaterial]);

  useEffect(() => {
    if (!middleMaterial) return;

    middleClone.traverse((obj) => {
      if (obj.isMesh) obj.material = middleMaterial;
    });

    return () => middleMaterial.dispose();
  }, [middleClone, middleMaterial]);

  useEffect(() => {
    if (!backMaterial) return;

    backClone.traverse((obj) => {
      if (obj.isMesh) obj.material = backMaterial;
    });

    return () => backMaterial.dispose();
  }, [backClone, backMaterial]);

  const basePosition = [
    -fit.center.x + Number(modelOffset?.[0] || 0),
    -fit.center.y + Number(modelOffset?.[1] || 0),
    -fit.center.z + Number(modelOffset?.[2] || 0)
  ];

  const frontPosition = [
    basePosition[0],
    basePosition[1],
    basePosition[2] + Number(depthOffsets?.front || 0)
  ];

  const middlePosition = [
    basePosition[0],
    basePosition[1],
    basePosition[2] + Number(depthOffsets?.middle || 0)
  ];

  const backPosition = [
    basePosition[0],
    basePosition[1],
    basePosition[2] + Number(depthOffsets?.back || 0)
  ];

  return (
    <group
      scale={[
        fit.scale * modelScale,
        fit.scale * modelScale,
        fit.scale * modelScale
      ]}
    >
      {safeFacadeOpacity > 0.001 ? (
        <primitive
          object={baseClone}
          position={basePosition}
          rotation={modelRotation}
        />
      ) : null}

      {backMaterial && (
        <primitive
          object={backClone}
          position={backPosition}
          rotation={modelRotation}
        />
      )}

      {middleMaterial && (
        <primitive
          object={middleClone}
          position={middlePosition}
          rotation={modelRotation}
        />
      )}

      {frontMaterial && (
        <primitive
          object={frontClone}
          position={frontPosition}
          rotation={modelRotation}
        />
      )}

      {safeFacadeOpacity > 0.02 ? (
        <group position={basePosition} rotation={modelRotation}>
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
                <Edges
                  color="white"
                  threshold={15}
                />
              </mesh>
            ) : null
          )}
        </group>
      ) : null}
    </group>
  );
}

function PlaneProjected({
  textures,
  projector,
  facadeOpacity = 1,
  depthOffsets = {
    front: 0.06,
    middle: 0,
    back: -0.06
  }
}) {
  const safeFacadeOpacity = clampOpacity(facadeOpacity);

  const frontMaterial = useMemo(
    () => createProjectedMaterial(textures?.front, projector, 8 / 5),
    [textures?.front, projector]
  );

  const middleMaterial = useMemo(
    () => createProjectedMaterial(textures?.middle, projector, 8 / 5),
    [textures?.middle, projector]
  );

  const backMaterial = useMemo(
    () => createProjectedMaterial(textures?.back, projector, 8 / 5),
    [textures?.back, projector]
  );

  useEffect(() => {
    return () => {
      if (frontMaterial) frontMaterial.dispose();
      if (middleMaterial) middleMaterial.dispose();
      if (backMaterial) backMaterial.dispose();
    };
  }, [frontMaterial, middleMaterial, backMaterial]);

  return (
    <group>
      {safeFacadeOpacity > 0.001 ? (
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[8, 5]} />
          <meshStandardMaterial
            color="#bfc7d4"
            transparent
            opacity={safeFacadeOpacity}
            depthWrite={false}
          />
        </mesh>
      ) : null}

      {backMaterial && (
        <mesh position={[0, 0, Number(depthOffsets?.back || 0)]}>
          <planeGeometry args={[8, 5]} />
          <primitive object={backMaterial} attach="material" />
        </mesh>
      )}

      {middleMaterial && (
        <mesh position={[0, 0, Number(depthOffsets?.middle || 0)]}>
          <planeGeometry args={[8, 5]} />
          <primitive object={middleMaterial} attach="material" />
        </mesh>
      )}

      {frontMaterial && (
        <mesh position={[0, 0, Number(depthOffsets?.front || 0)]}>
          <planeGeometry args={[8, 5]} />
          <primitive object={frontMaterial} attach="material" />
        </mesh>
      )}
    </group>
  );
}

export default function ProjectedSimpleScene({
  mode = "plane",
  modelUrl,
  modelRotation = [0, 0, 0],
  modelOffset = [0, 0, 0],
  modelScale = 1,
  facadeOpacity = 1,
  textures,
  projector,
  depthOffsets = {
    front: 0.06,
    middle: 0,
    back: -0.06
  },
  enableControls = false,
  showHelpers = false,
  showGrid = false
}) {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />
      <directionalLight position={[-4, 2, 6]} intensity={0.8} />
      <directionalLight position={[0, 0, 8]} intensity={0.6} />

      {showGrid ? (
        <Grid
          args={[20, 20]}
          cellSize={1}
          sectionSize={5}
          fadeDistance={30}
          fadeStrength={1}
        />
      ) : null}

      {showHelpers ? <ProjectorHelper projector={projector} /> : null}

      {mode === "glb" ? (
        <FittedProjectedModel
          modelUrl={modelUrl}
          textures={textures}
          projector={projector}
          modelRotation={modelRotation}
          modelOffset={modelOffset}
          modelScale={modelScale}
          facadeOpacity={facadeOpacity}
          depthOffsets={depthOffsets}
        />
      ) : (
        <PlaneProjected
          textures={textures}
          projector={projector}
          facadeOpacity={facadeOpacity}
          depthOffsets={depthOffsets}
        />
      )}

      {enableControls ? <OrbitControls /> : null}
    </>
  );
}