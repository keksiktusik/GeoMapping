import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber";
import { useFBO, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  createProjectionTextureAsset,
  safePlay
} from "../lib/projectionComposer";

const STORAGE_KEY = "mapping_output_state_v1";
const MODEL_URL = "/models/fasada.glb";
const MIN_DISTANCE = 0.5;

function createMeshWarp(w, h, cols = 5, rows = 5) {
  const points = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      points.push({
        x: (col / (cols - 1)) * w,
        y: (row / (rows - 1)) * h,
        pinned: false
      });
    }
  }

  return {
    mode: "mesh",
    cols,
    rows,
    points
  };
}

function ensureMeshWarp(warp, wallW, wallH, cols = 5, rows = 5) {
  if (
    warp?.mode === "mesh" &&
    Array.isArray(warp?.points) &&
    warp.points.length >= 4 &&
    Number(warp?.cols) >= 2 &&
    Number(warp?.rows) >= 2
  ) {
    return warp;
  }

  const tl = warp?.tl || { x: 0, y: 0 };
  const tr = warp?.tr || { x: wallW, y: 0 };
  const br = warp?.br || { x: wallW, y: wallH };
  const bl = warp?.bl || { x: 0, y: wallH };

  if (warp?.tl || warp?.tr || warp?.br || warp?.bl) {
    return {
      mode: "mesh",
      cols: 2,
      rows: 2,
      points: [tl, tr, bl, br]
    };
  }

  return createMeshWarp(wallW, wallH, cols, rows);
}

function getDefaultState() {
  return {
    points: [],
    isClosed: false,
    opacity: 1,
    showGrid: false,
    showPinkBackground: true,
    masks: [],
    draft: {
      id: "__draft__",
      name: "",
      type: "polygon",
      operation: "add",
      zIndex: 999999,
      visible: true,
      locked: false,
      layerName: "default",
      textureType: "color",
      textureValue: "#ffffff",
      points: [],
      opacity: 1,
      isClosed: false,
      localWarp: createMeshWarp(800, 500, 4, 4)
    },
    maskWarps: {},
    draftLocalWarp: createMeshWarp(800, 500, 4, 4),
    warp: createMeshWarp(800, 500, 5, 5),
    renderMode: "plane",
    outputSurfaceMode: "lightGlb",
    outputModelUrl: MODEL_URL,
    projector: {
      distance: 5,
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

function makeReferenceCamera(aspect) {
  const cam = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
  cam.position.set(0, 0, 8);
  cam.lookAt(0, 0, 0);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return cam;
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

function DesiredPass({
  desiredScene,
  desiredTarget,
  projectionTexture,
  aspect
}) {
  const { gl } = useThree();
  const referenceCamera = useMemo(() => makeReferenceCamera(aspect), [aspect]);

  useFrame(() => {
    gl.setRenderTarget(desiredTarget);
    gl.setClearColor("#000000", 0);
    gl.clear(true, true, true);
    gl.render(desiredScene, referenceCamera);
    gl.setRenderTarget(null);
  });

  return createPortal(
    <PlaneDesiredScene projectionTexture={projectionTexture} />,
    desiredScene
  );
}

function usePlaneCompensationMaterial(desiredTexture, referenceCamera) {
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
  }, [desiredTexture, referenceCamera]);
}

function useGlbCompensationMaterial(desiredTexture, simplified = false) {
  return useMemo(() => {
    if (!desiredTexture) return null;

    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: !simplified,
      uniforms: {
        desiredTexture: { value: desiredTexture }
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
        varying vec3 vWorldPosition;

        void main() {
          vec2 uv;
          uv.x = vWorldPosition.x / 8.0 + 0.5;
          uv.y = vWorldPosition.y / 5.0 + 0.5;

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
  }, [desiredTexture, simplified]);
}

function PlaneCompensationScene({ desiredTexture, referenceCamera }) {
  const material = usePlaneCompensationMaterial(desiredTexture, referenceCamera);

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
  simplified = false
}) {
  const { scene } = useGLTF(modelUrl || MODEL_URL);
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

  const material = useGlbCompensationMaterial(desiredTexture, simplified);

  useEffect(() => {
    if (!material) return;

    cloned.traverse((obj) => {
      if (obj.isMesh) {
        obj.material = material;
        if (simplified) {
          obj.castShadow = false;
          obj.receiveShadow = false;
          obj.frustumCulled = true;
        }
      }
    });
  }, [cloned, material, simplified]);

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
  modelUrl,
  simplified,
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
    gl.setClearColor("#000000", 0);
    gl.clear(true, true, true);
    gl.render(compensationScene, projectorCamera);
    gl.setRenderTarget(null);
  });

  return createPortal(
    <>
      {renderMode === "glb" ? (
        <GlbCompensationScene
          modelUrl={modelUrl}
          simplified={simplified}
          desiredTexture={desiredTexture}
        />
      ) : (
        <PlaneCompensationScene
          desiredTexture={desiredTexture}
          referenceCamera={referenceCamera}
        />
      )}
    </>,
    compensationScene
  );
}

function createWarpGeometry(warp, wallW, wallH) {
  const mesh = ensureMeshWarp(warp, wallW, wallH, 5, 5);
  const cols = Number(mesh.cols);
  const rows = Number(mesh.rows);
  const points = Array.isArray(mesh.points) ? mesh.points : [];

  const vertices = [];
  const uvs = [];
  const indices = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const i = row * cols + col;
      const p = points[i] || { x: 0, y: 0 };

      const nx = (p.x / wallW) * 2 - 1;
      const ny = 1 - (p.y / wallH) * 2;

      vertices.push(nx, ny, 0);

      const u = col / (cols - 1);
      const v = 1 - row / (rows - 1);
      uvs.push(u, v);
    }
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      const a = row * cols + col;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;

      indices.push(a, c, b);
      indices.push(c, d, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

function WarpOutputSurface({ texture, warp, wallW, wallH }) {
  const geometry = useMemo(
    () => createWarpGeometry(warp, wallW, wallH),
    [warp, wallW, wallH]
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        map={texture}
        transparent
        toneMapped={false}
        opacity={1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function revivePlayableVideos(videoCache) {
  if (!videoCache?.current) return;

  videoCache.current.forEach((entry) => {
    if (entry?.video && !entry?.runtimeSettings?.paused) {
      safePlay(entry.video);
    }
  });
}

function OutputPipeline({
  state,
  wallW,
  wallH,
  viewportW,
  viewportH,
  assetVersion
}) {
  const compensationRenderMode =
    state?.outputSurfaceMode === "lightGlb" || state?.outputSurfaceMode === "glb"
      ? "glb"
      : "plane";

  const effectiveModelUrl = state?.outputModelUrl || MODEL_URL;
  const isSimplified = state?.outputSurfaceMode === "lightGlb";

  const renderScale =
    compensationRenderMode === "glb"
      ? isSimplified
        ? 0.75
        : 0.62
      : 1;

  const renderW = Math.max(2, Math.floor((viewportW || wallW) * renderScale));
  const renderH = Math.max(2, Math.floor((viewportH || wallH) * renderScale));

  const desiredTarget = useFBO(renderW, renderH, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    stencilBuffer: false,
    depthBuffer: true
  });

  const projectorTarget = useFBO(renderW, renderH, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    stencilBuffer: false,
    depthBuffer: true
  });

  const desiredScene = useMemo(() => new THREE.Scene(), []);
  const compensationScene = useMemo(() => new THREE.Scene(), []);
  const imageCache = useRef(new Map());
  const videoCache = useRef(new Map());

  const activeDraft = useMemo(() => {
    if (state?.draft) return state.draft;

    return {
      id: "__draft__",
      points: state.points || [],
      opacity: typeof state.opacity === "number" ? state.opacity : 1,
      operation: "add",
      zIndex: 999999,
      visible: true,
      textureType: "color",
      textureValue: "#ffffff",
      isClosed: Boolean(state.isClosed),
      localWarp: state?.draftLocalWarp || createMeshWarp(wallW, wallH, 4, 4)
    };
  }, [state, wallW, wallH]);

  const projectionAsset = useMemo(
    () =>
      createProjectionTextureAsset({
        wallW,
        wallH,
        showGrid: false,
        showPinkBackground: false,
        masks: state.masks,
        activeDraft,
        imageCache,
        videoCache,
        onAssetReady: assetVersion.bump
      }),
    [wallW, wallH, state.masks, activeDraft, assetVersion]
  );

  useEffect(() => {
    return () => {
      if (projectionAsset?.texture) {
        projectionAsset.texture.dispose();
      }
    };
  }, [projectionAsset]);

  useEffect(() => {
    const handleVisibility = () => {
      revivePlayableVideos(videoCache);
    };

    const handleFocus = () => {
      revivePlayableVideos(videoCache);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handleFocus);

      videoCache.current.forEach((entry) => {
        if (entry?.video) {
          entry.video.pause();
          entry.video.src = "";
          entry.video.load?.();
        }
      });
    };
  }, []);

  useFrame(() => {
    if (!projectionAsset) return;

    revivePlayableVideos(videoCache);

    projectionAsset.redraw();
    projectionAsset.texture.needsUpdate = true;
  });

  const aspect = renderW / renderH;
  const referenceCamera = useMemo(() => makeReferenceCamera(aspect), [aspect]);

  return (
    <>
      <ScreenCamera />

      <DesiredPass
        desiredScene={desiredScene}
        desiredTarget={desiredTarget}
        projectionTexture={projectionAsset?.texture || null}
        aspect={aspect}
      />

      <CompensationPass
        compensationScene={compensationScene}
        projectorTarget={projectorTarget}
        desiredTexture={desiredTarget.texture}
        renderMode={compensationRenderMode}
        modelUrl={effectiveModelUrl}
        simplified={isSimplified}
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

function normalizeParsedState(parsed, wallW, wallH) {
  return {
    ...parsed,
    masks: Array.isArray(parsed?.masks) ? parsed.masks : [],
    draft: parsed?.draft
      ? {
          ...parsed.draft,
          localWarp:
            parsed?.draft?.localWarp || createMeshWarp(wallW, wallH, 4, 4)
        }
      : getDefaultState().draft,
    draftLocalWarp:
      parsed?.draftLocalWarp || createMeshWarp(wallW, wallH, 4, 4),
    warp: ensureMeshWarp(parsed?.warp, wallW, wallH, 5, 5),
    projector: getSafeProjector(parsed?.projector || {}),
    outputSurfaceMode:
      parsed?.outputSurfaceMode === "plane" ||
      parsed?.outputSurfaceMode === "glb" ||
      parsed?.outputSurfaceMode === "lightGlb"
        ? parsed.outputSurfaceMode
        : undefined,
    outputModelUrl: parsed?.outputModelUrl || MODEL_URL
  };
}

export default function ProjectorOutput({ wallW = 800, wallH = 500 }) {
  const initialRaw =
    typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_KEY)
      : null;

  const [state, setState] = useState(() => {
    const parsed = safeParse(initialRaw, getDefaultState());
    return normalizeParsedState(parsed, wallW, wallH);
  });

  const rootRef = React.useRef(null);
  const [viewport, setViewport] = useState({ width: wallW, height: wallH });
  const [canvasKey, setCanvasKey] = useState(0);
  const [assetVersionValue, setAssetVersionValue] = useState(0);
  const lastRawRef = useRef(initialRaw);

  const assetVersion = useMemo(
    () => ({
      value: assetVersionValue,
      bump: () => setAssetVersionValue((v) => v + 1)
    }),
    [assetVersionValue]
  );

  useEffect(() => {
    const sync = () => {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw === lastRawRef.current) {
        return;
      }

      lastRawRef.current = raw;

      const nextState = safeParse(raw, getDefaultState());
      setState(normalizeParsedState(nextState, wallW, wallH));
    };

    sync();

    window.addEventListener("storage", sync);
    const interval = setInterval(sync, 250);

    return () => {
      window.removeEventListener("storage", sync);
      clearInterval(interval);
    };
  }, [wallW, wallH]);

  useEffect(() => {
    const updateSize = () => {
      const el = rootRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      setViewport({
        width: Math.max(2, Math.floor(rect.width)),
        height: Math.max(2, Math.floor(rect.height))
      });
    };

    updateSize();

    const ro = new ResizeObserver(() => {
      updateSize();
    });

    if (rootRef.current) {
      ro.observe(rootRef.current);
    }

    const onFullscreenChange = () => {
      updateSize();
      setCanvasKey((k) => k + 1);
    };

    window.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("resize", updateSize);

    return () => {
      ro.disconnect();
      window.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("resize", updateSize);
    };
  }, [wallW, wallH]);

  return (
    <div
      ref={rootRef}
      style={{
        width: "100%",
        height: "100%",
        minWidth: "100vw",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at center, #0a0f1f 0%, #000000 100%)",
        overflow: "hidden"
      }}
    >
      <Canvas
        key={canvasKey}
        dpr={1}
        frameloop="always"
        resize={{ scroll: false, debounce: { resize: 0, scroll: 0 } }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance"
        }}
        onCreated={({ gl }) => {
          gl.setClearColor("#000000", 0);
        }}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          background: "transparent"
        }}
      >
        <OutputPipeline
          state={state}
          wallW={wallW}
          wallH={wallH}
          viewportW={viewport.width}
          viewportH={viewport.height}
          assetVersion={assetVersion}
        />
      </Canvas>
    </div>
  );
} 