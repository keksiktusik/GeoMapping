import { useEffect, useMemo, useState } from "react";
import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber";
import { useFBO, useGLTF } from "@react-three/drei";
import * as THREE from "three";

const STORAGE_KEY = "mapping_output_state_v1";
const MODEL_URL = "/models/fasada.glb";

function getDefaultState() {
  return {
    points: [],
    isClosed: false,
    opacity: 1,
    showGrid: false,
    masks: [],
    warp: {
      tl: { x: 0, y: 0 },
      tr: { x: 800, y: 0 },
      br: { x: 800, y: 500 },
      bl: { x: 0, y: 500 }
    },
    renderMode: "plane",
    projector: {
      distance: 2.5,
      offsetX: 0,
      offsetY: 0,
      angleX: 0,
      angleY: 0,
      angleZ: 0,
      fov: 45
    }
  };
}

function safeParse(json, fallback) {
  try {
    return json ? JSON.parse(json) : fallback;
  } catch {
    return fallback;
  }
}

function degToRad(v) {
  return THREE.MathUtils.degToRad(Number(v || 0));
}

function buildProjectionTexture({
  wallW,
  wallH,
  showGrid,
  masks,
  points,
  opacity
}) {
  const canvas = document.createElement("canvas");
  canvas.width = wallW;
  canvas.height = wallH;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, wallW, wallH);

  ctx.fillStyle = "#ff4fbf";
  ctx.fillRect(0, 0, wallW, wallH);

  if (showGrid) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    const step = 40;

    for (let x = 0; x <= wallW; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, wallH);
      ctx.stroke();
    }

    for (let y = 0; y <= wallH; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(wallW, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  if (Array.isArray(masks)) {
    for (const mask of masks) {
      if (!Array.isArray(mask?.points) || mask.points.length < 3) continue;

      const alpha =
        typeof mask.opacity === "number" ? mask.opacity : opacity ?? 1;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(mask.points[0].x, mask.points[0].y);

      for (let i = 1; i < mask.points.length; i += 1) {
        ctx.lineTo(mask.points[i].x, mask.points[i].y);
      }

      ctx.closePath();
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  if (Array.isArray(points) && points.length >= 3) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.closePath();
    ctx.fillStyle = `rgba(0,0,0,${opacity ?? 1})`;
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,255,0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = false;
  texture.needsUpdate = true;

  return texture;
}

function makeReferenceCamera(aspect) {
  const cam = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
  cam.position.set(0, 0, 8);
  cam.lookAt(0, 0, 0);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return cam;
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

function ScreenCamera() {
  const { set } = useThree();

  const cam = useMemo(() => {
    const c = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
    c.position.set(0, 0, 1);
    c.lookAt(0, 0, 0);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
    return c;
  }, []);

  useEffect(() => {
    set({ camera: cam });
  }, [cam, set]);

  return null;
}

function PlaneDesiredScene({ projectionTexture }) {
  if (!projectionTexture) return null;

  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[8, 5]} />
      <meshBasicMaterial map={projectionTexture} transparent />
    </mesh>
  );
}

function GlbDesiredScene({ modelUrl, projectionTexture }) {
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

  const material = useMemo(() => {
    if (!projectionTexture) return null;

    return new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        baseTexture: { value: projectionTexture }
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
        varying vec3 vWorldPosition;

        void main() {
          vec2 uv;
          uv.x = vWorldPosition.x / 8.0 + 0.5;
          uv.y = vWorldPosition.y / 5.0 + 0.5;
          uv.y = 1.0 - uv.y;

          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            discard;
          }

          vec4 color = texture2D(baseTexture, uv);
          if (color.a < 0.01) {
            discard;
          }

          gl_FragColor = color;
        }
      `
    });
  }, [projectionTexture]);

  useEffect(() => {
    if (!material) return;

    cloned.traverse((obj) => {
      if (obj.isMesh) {
        obj.material = material;
      }
    });
  }, [cloned, material]);

  if (!material) return null;

  return (
    <group scale={[fit.scale, fit.scale, fit.scale]}>
      <primitive
        object={cloned}
        position={[-fit.center.x, -fit.center.y, -fit.center.z]}
      />
    </group>
  );
}

function DesiredPass({
  desiredScene,
  desiredTarget,
  renderMode,
  projectionTexture,
  aspect
}) {
  const { gl } = useThree();

  const referenceCamera = useMemo(() => makeReferenceCamera(aspect), [aspect]);

  useFrame(() => {
    gl.setRenderTarget(desiredTarget);
    gl.setClearColor("black", 1);
    gl.clear(true, true, true);
    gl.render(desiredScene, referenceCamera);
    gl.setRenderTarget(null);
  });

  return createPortal(
    <>
      <color attach="background" args={["black"]} />
      {renderMode === "glb" ? (
        <GlbDesiredScene
          modelUrl={MODEL_URL}
          projectionTexture={projectionTexture}
        />
      ) : (
        <PlaneDesiredScene projectionTexture={projectionTexture} />
      )}
    </>,
    desiredScene
  );
}

function useCompensationMaterial(desiredTexture, referenceCamera, aspect) {
  return useMemo(() => {
    if (!desiredTexture || !referenceCamera) return null;

    return new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        desiredTexture: { value: desiredTexture },
        refViewMatrix: { value: referenceCamera.matrixWorldInverse.clone() },
        refProjectionMatrix: {
          value: referenceCamera.projectionMatrix.clone()
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
        uniform sampler2D desiredTexture;
        uniform mat4 refViewMatrix;
        uniform mat4 refProjectionMatrix;

        varying vec3 vWorldPosition;

        void main() {
          vec4 refClip =
            refProjectionMatrix *
            refViewMatrix *
            vec4(vWorldPosition, 1.0);

          if (refClip.w <= 0.0) {
            discard;
          }

          vec3 ndc = refClip.xyz / refClip.w;
          vec2 uv = ndc.xy * 0.5 + 0.5;
          uv.y = 1.0 - uv.y;

          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            discard;
          }

          vec4 color = texture2D(desiredTexture, uv);
          if (color.a < 0.01) {
            discard;
          }

          gl_FragColor = color;
        }
      `
    });
  }, [desiredTexture, referenceCamera, aspect]);
}

function PlaneCompensationScene({ desiredTexture, referenceCamera, aspect }) {
  const material = useCompensationMaterial(
    desiredTexture,
    referenceCamera,
    aspect
  );

  if (!material) return null;

  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[8, 5]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function GlbCompensationScene({
  modelUrl,
  desiredTexture,
  referenceCamera,
  aspect
}) {
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

  const material = useCompensationMaterial(
    desiredTexture,
    referenceCamera,
    aspect
  );

  useEffect(() => {
    if (!material) return;

    cloned.traverse((obj) => {
      if (obj.isMesh) {
        obj.material = material;
      }
    });
  }, [cloned, material]);

  if (!material) return null;

  return (
    <group scale={[fit.scale, fit.scale, fit.scale]}>
      <primitive
        object={cloned}
        position={[-fit.center.x, -fit.center.y, -fit.center.z]}
      />
    </group>
  );
}

function CompensationPass({
  compensationScene,
  projectorTarget,
  desiredTexture,
  renderMode,
  projector,
  aspect,
  referenceCamera
}) {
  const { gl } = useThree();

  const projectorCamera = useMemo(
    () => makeProjectorCamera(projector, aspect),
    [projector, aspect]
  );

  useFrame(() => {
    gl.setRenderTarget(projectorTarget);
    gl.setClearColor("black", 1);
    gl.clear(true, true, true);
    gl.render(compensationScene, projectorCamera);
    gl.setRenderTarget(null);
  });

  return createPortal(
    <>
      <color attach="background" args={["black"]} />
      {renderMode === "glb" ? (
        <GlbCompensationScene
          modelUrl={MODEL_URL}
          desiredTexture={desiredTexture}
          referenceCamera={referenceCamera}
          aspect={aspect}
        />
      ) : (
        <PlaneCompensationScene
          desiredTexture={desiredTexture}
          referenceCamera={referenceCamera}
          aspect={aspect}
        />
      )}
    </>,
    compensationScene
  );
}

function createWarpGeometry(warp, wallW, wallH) {
  const tl = warp?.tl || { x: 0, y: 0 };
  const tr = warp?.tr || { x: wallW, y: 0 };
  const br = warp?.br || { x: wallW, y: wallH };
  const bl = warp?.bl || { x: 0, y: wallH };

  const positions = new Float32Array([
    (tl.x / wallW) * 2 - 1, 1 - (tl.y / wallH) * 2, 0,
    (tr.x / wallW) * 2 - 1, 1 - (tr.y / wallH) * 2, 0,
    (bl.x / wallW) * 2 - 1, 1 - (bl.y / wallH) * 2, 0,
    (br.x / wallW) * 2 - 1, 1 - (br.y / wallH) * 2, 0
  ]);

  const uvs = new Float32Array([
    0, 1,
    1, 1,
    0, 0,
    1, 0
  ]);

  const indices = [0, 2, 1, 2, 3, 1];

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  return geometry;
}

function WarpOutputSurface({ texture, warp, wallW, wallH }) {
  const geometry = useMemo(
    () => createWarpGeometry(warp, wallW, wallH),
    [warp, wallW, wallH]
  );

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

function OutputPipeline({ state, wallW, wallH }) {
  const desiredTarget = useFBO(wallW, wallH, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    stencilBuffer: false
  });

  const projectorTarget = useFBO(wallW, wallH, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    stencilBuffer: false
  });

  const desiredScene = useMemo(() => new THREE.Scene(), []);
  const compensationScene = useMemo(() => new THREE.Scene(), []);

  const projectionTexture = useMemo(
    () =>
      buildProjectionTexture({
        wallW,
        wallH,
        showGrid: state.showGrid,
        masks: state.masks,
        points: state.points,
        opacity: state.opacity
      }),
    [wallW, wallH, state.showGrid, state.masks, state.points, state.opacity]
  );

  const aspect = wallW / wallH;
  const referenceCamera = useMemo(() => makeReferenceCamera(aspect), [aspect]);

  return (
    <>
      <ScreenCamera />

      <DesiredPass
        desiredScene={desiredScene}
        desiredTarget={desiredTarget}
        renderMode={state.renderMode}
        projectionTexture={projectionTexture}
        aspect={aspect}
      />

      <CompensationPass
        compensationScene={compensationScene}
        projectorTarget={projectorTarget}
        desiredTexture={desiredTarget.texture}
        renderMode={state.renderMode}
        projector={state.projector}
        aspect={aspect}
        referenceCamera={referenceCamera}
      />

      <WarpOutputSurface
        texture={projectorTarget.texture}
        warp={state.warp}
        wallW={wallW}
        wallH={wallH}
      />
    </>
  );
}

export default function ProjectorOutput({ wallW = 800, wallH = 500 }) {
  const [state, setState] = useState(() =>
    safeParse(localStorage.getItem(STORAGE_KEY), getDefaultState())
  );

  useEffect(() => {
    const sync = () => {
      setState(safeParse(localStorage.getItem(STORAGE_KEY), getDefaultState()));
    };

    window.addEventListener("storage", sync);
    const interval = setInterval(sync, 200);

    return () => {
      window.removeEventListener("storage", sync);
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "black",
        overflow: "hidden"
      }}
    >
      <Canvas
        gl={{ antialias: true }}
        style={{ width: "100vw", height: "100vh", display: "block" }}
      >
        <OutputPipeline state={state} wallW={wallW} wallH={wallH} />
      </Canvas>
    </div>
  );
}