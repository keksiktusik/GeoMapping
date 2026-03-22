import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber";
import { useFBO, useGLTF } from "@react-three/drei";
import * as THREE from "three";

const STORAGE_KEY = "mapping_output_state_v1";
const MODEL_URL = "/models/fasada.glb";
const MIN_DISTANCE = 0.5;

function createMeshWarp(w, h, cols = 5, rows = 5) {
  const points = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      points.push({
        x: (col / (cols - 1)) * w,
        y: (row / (rows - 1)) * h
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

function ensureMeshWarp(warp, wallW, wallH) {
  if (
    warp?.mode === "mesh" &&
    Array.isArray(warp?.points) &&
    warp.points.length >= 4 &&
    Number(warp?.cols) >= 2 &&
    Number(warp?.rows) >= 2
  ) {
    return warp;
  }

  // fallback dla starego 4-corner warp
  const tl = warp?.tl || { x: 0, y: 0 };
  const tr = warp?.tr || { x: wallW, y: 0 };
  const br = warp?.br || { x: wallW, y: wallH };
  const bl = warp?.bl || { x: 0, y: wallH };

  return {
    mode: "mesh",
    cols: 2,
    rows: 2,
    points: [tl, tr, bl, br]
  };
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
      isClosed: false
    },
    warp: createMeshWarp(800, 500, 5, 5),
    renderMode: "plane",
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

function createBuffer(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  return { canvas, ctx };
}

function drawPolygonPath(ctx, pts) {
  if (!pts || pts.length < 3) return false;

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.closePath();
  return true;
}

function drawGrid(ctx, wallW, wallH) {
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

function getLoadedImage(src, imageCache) {
  if (!src) return null;
  const cached = imageCache.current.get(src);
  if (cached?.status === "loaded") return cached.img;
  return null;
}

function loadImage(src, imageCache, onReady) {
  if (!src) return null;

  const cached = imageCache.current.get(src);
  if (cached) {
    if (cached.status === "loaded") return cached.img;
    return null;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";

  const entry = {
    status: "loading",
    img
  };

  imageCache.current.set(src, entry);

  img.onload = () => {
    entry.status = "loaded";
    onReady?.();
  };

  img.onerror = () => {
    entry.status = "error";
    onReady?.();
  };

  img.src = src;

  return null;
}

function getLoadedVideo(src, videoCache) {
  if (!src) return null;
  const cached = videoCache.current.get(src);
  if (!cached) return null;
  if (cached.status === "loaded" || cached.status === "playing") {
    return cached.video;
  }
  return null;
}

function loadVideo(src, videoCache, onReady) {
  if (!src) return null;

  const cached = videoCache.current.get(src);
  if (cached) {
    if (cached.status === "loaded" || cached.status === "playing") {
      return cached.video;
    }
    return null;
  }

  const video = document.createElement("video");
  video.src = src;
  video.crossOrigin = "anonymous";
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  const entry = {
    status: "loading",
    video
  };

  videoCache.current.set(src, entry);

  const markReady = () => {
    entry.status = "loaded";
    onReady?.();
  };

  video.addEventListener("loadeddata", markReady);
  video.addEventListener("canplay", markReady);

  video.addEventListener("play", () => {
    entry.status = "playing";
    onReady?.();
  });

  video.addEventListener("error", () => {
    entry.status = "error";
    onReady?.();
  });

  video.play().catch(() => {});

  return null;
}

function renderShape(shape, wallW, wallH, imageCache, videoCache, onAssetReady) {
  const { canvas, ctx } = createBuffer(wallW, wallH);

  if (!drawPolygonPath(ctx, shape.points)) {
    return canvas;
  }

  const alpha = typeof shape.opacity === "number" ? shape.opacity : 1;
  const textureType = shape?.textureType || "color";
  const textureValue = shape?.textureValue || "#ffffff";

  ctx.save();
  ctx.globalAlpha = alpha;

  if (textureType === "image") {
    const loadedImg =
      getLoadedImage(textureValue, imageCache) ||
      loadImage(textureValue, imageCache, onAssetReady);

    ctx.save();
    ctx.clip();

    if (loadedImg) {
      ctx.drawImage(loadedImg, 0, 0, wallW, wallH);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }

    ctx.restore();
    ctx.restore();
    return canvas;
  }

  if (textureType === "video") {
    const loadedVideo =
      getLoadedVideo(textureValue, videoCache) ||
      loadVideo(textureValue, videoCache, onAssetReady);

    ctx.save();
    ctx.clip();

    if (loadedVideo && loadedVideo.readyState >= 2) {
      ctx.drawImage(loadedVideo, 0, 0, wallW, wallH);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }

    ctx.restore();
    ctx.restore();
    return canvas;
  }

  ctx.fillStyle = textureType === "color" ? textureValue : "#ffffff";
  ctx.fill();
  ctx.restore();

  return canvas;
}

function applyShapeToComposite(compositeCanvas, shapeCanvas, operation, wallW, wallH) {
  const compositeCtx = compositeCanvas.getContext("2d");

  if (operation === "subtract") {
    compositeCtx.save();
    compositeCtx.globalCompositeOperation = "destination-out";
    compositeCtx.drawImage(shapeCanvas, 0, 0);
    compositeCtx.restore();
    return;
  }

  if (operation === "intersect") {
    const { canvas: temp, ctx: tempCtx } = createBuffer(wallW, wallH);

    tempCtx.drawImage(compositeCanvas, 0, 0);
    tempCtx.globalCompositeOperation = "destination-in";
    tempCtx.drawImage(shapeCanvas, 0, 0);

    compositeCtx.clearRect(0, 0, wallW, wallH);
    compositeCtx.drawImage(temp, 0, 0);
    return;
  }

  compositeCtx.save();
  compositeCtx.globalCompositeOperation = "source-over";
  compositeCtx.drawImage(shapeCanvas, 0, 0);
  compositeCtx.restore();
}

function buildCompositeTexture({
  wallW,
  wallH,
  masks = [],
  activeDraft = null,
  imageCache,
  videoCache,
  onAssetReady
}) {
  const { canvas: compositeCanvas, ctx: compositeCtx } = createBuffer(wallW, wallH);
  compositeCtx.clearRect(0, 0, wallW, wallH);

  const allShapes = [...(masks || [])];

  if (
    activeDraft?.isClosed &&
    Array.isArray(activeDraft?.points) &&
    activeDraft.points.length >= 3 &&
    activeDraft.visible !== false
  ) {
    allShapes.push({
      id: "__draft__",
      name: activeDraft.name || "draft",
      type: activeDraft.type || "polygon",
      operation: activeDraft.operation || "add",
      zIndex:
        typeof activeDraft.zIndex === "number" ? activeDraft.zIndex : 999999,
      visible: activeDraft.visible,
      opacity: typeof activeDraft.opacity === "number" ? activeDraft.opacity : 1,
      textureType: activeDraft.textureType || "color",
      textureValue: activeDraft.textureValue || "#ffffff",
      points: activeDraft.points
    });
  }

  const orderedShapes = allShapes
    .filter((shape) => shape?.visible !== false)
    .filter((shape) => Array.isArray(shape?.points) && shape.points.length >= 3)
    .sort((a, b) => {
      const az = typeof a.zIndex === "number" ? a.zIndex : 0;
      const bz = typeof b.zIndex === "number" ? b.zIndex : 0;
      return az - bz;
    });

  for (const shape of orderedShapes) {
    const shapeCanvas = renderShape(
      shape,
      wallW,
      wallH,
      imageCache,
      videoCache,
      onAssetReady
    );

    applyShapeToComposite(
      compositeCanvas,
      shapeCanvas,
      shape.operation || "add",
      wallW,
      wallH
    );
  }

  return compositeCanvas;
}

function createProjectionTextureAsset({
  wallW,
  wallH,
  showGrid,
  showPinkBackground,
  masks,
  activeDraft,
  imageCache,
  videoCache,
  onAssetReady
}) {
  const canvas = document.createElement("canvas");
  canvas.width = wallW;
  canvas.height = wallH;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const redraw = () => {
    ctx.clearRect(0, 0, wallW, wallH);

    if (showPinkBackground) {
      ctx.fillStyle = "#ff4fbf";
      ctx.fillRect(0, 0, wallW, wallH);
    }

    if (showGrid) {
      drawGrid(ctx, wallW, wallH);
    }

    const compositeTexture = buildCompositeTexture({
      wallW,
      wallH,
      masks,
      activeDraft,
      imageCache,
      videoCache,
      onAssetReady
    });

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(compositeTexture, 0, 0);
    ctx.restore();
  };

  redraw();

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = false;
  texture.needsUpdate = true;

  return {
    canvas,
    texture,
    redraw
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
          uv = clamp(uv, 0.0, 1.0);

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
  const mesh = ensureMeshWarp(warp, wallW, wallH);
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
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(uvs, 2)
  );
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
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

function OutputPipeline({ state, wallW, wallH, viewportW, viewportH, assetVersion }) {
  const renderW = Math.max(2, Math.floor(viewportW || wallW));
  const renderH = Math.max(2, Math.floor(viewportH || wallH));

  const desiredTarget = useFBO(renderW, renderH, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    stencilBuffer: false
  });

  const projectorTarget = useFBO(renderW, renderH, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    stencilBuffer: false
  });

  const desiredScene = useMemo(() => new THREE.Scene(), []);
  const compensationScene = useMemo(() => new THREE.Scene(), []);
  const imageCache = useRef(new Map());
  const videoCache = useRef(new Map());

  const activeDraft = useMemo(() => {
    if (state?.draft) return state.draft;

    return {
      points: state.points || [],
      opacity: typeof state.opacity === "number" ? state.opacity : 1,
      operation: "add",
      zIndex: 999999,
      visible: true,
      textureType: "color",
      textureValue: "#ffffff",
      isClosed: Boolean(state.isClosed)
    };
  }, [state]);

  const projectionAsset = useMemo(
    () =>
      createProjectionTextureAsset({
        wallW,
        wallH,
        showGrid: state.showGrid,
        showPinkBackground: state.showPinkBackground,
        masks: state.masks,
        activeDraft,
        imageCache,
        videoCache,
        onAssetReady: assetVersion.bump
      }),
    [
      wallW,
      wallH,
      state.showGrid,
      state.showPinkBackground,
      state.masks,
      activeDraft,
      assetVersion.value
    ]
  );

  useEffect(() => {
    return () => {
      if (projectionAsset?.texture) {
        projectionAsset.texture.dispose();
      }
    };
  }, [projectionAsset]);

  useEffect(() => {
    return () => {
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
        renderMode={state.renderMode}
        projectionTexture={projectionAsset?.texture || null}
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
  const [state, setState] = useState(() => {
    const parsed = safeParse(localStorage.getItem(STORAGE_KEY), getDefaultState());

    return {
      ...parsed,
      warp: ensureMeshWarp(parsed?.warp, wallW, wallH),
      projector: getSafeProjector(parsed?.projector || {})
    };
  });

  const rootRef = React.useRef(null);
  const [viewport, setViewport] = useState({ width: wallW, height: wallH });
  const [canvasKey, setCanvasKey] = useState(0);
  const [assetVersionValue, setAssetVersionValue] = useState(0);

  const assetVersion = useMemo(
    () => ({
      value: assetVersionValue,
      bump: () => setAssetVersionValue((v) => v + 1)
    }),
    [assetVersionValue]
  );

  useEffect(() => {
    const sync = () => {
      const nextState = safeParse(
        localStorage.getItem(STORAGE_KEY),
        getDefaultState()
      );

      setState({
        ...nextState,
        warp: ensureMeshWarp(nextState?.warp, wallW, wallH),
        projector: getSafeProjector(nextState?.projector || {})
      });
    };

    sync();

    window.addEventListener("storage", sync);
    const interval = setInterval(sync, 200);

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
        background: "black",
        overflow: "hidden"
      }}
    >
      <Canvas
        key={canvasKey}
        dpr={[1, 1.5]}
        frameloop="always"
        resize={{ scroll: false, debounce: { resize: 0, scroll: 0 } }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance"
        }}
        onCreated={({ gl }) => {
          gl.setClearColor("#000000", 1);
        }}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          background: "black"
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