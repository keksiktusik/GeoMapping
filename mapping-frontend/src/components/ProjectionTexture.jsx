import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

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
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
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

function safePlay(video) {
  if (!video) return;
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;

  const p = video.play();
  if (p && typeof p.catch === "function") {
    p.catch(() => {});
  }
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

  if (
    (cached.status === "loaded" || cached.status === "playing") &&
    cached.video
  ) {
    safePlay(cached.video);
    return cached.video;
  }

  return null;
}

function loadVideo(src, videoCache, onReady) {
  if (!src) return null;

  const cached = videoCache.current.get(src);
  if (cached) {
    if (
      (cached.status === "loaded" || cached.status === "playing") &&
      cached.video
    ) {
      safePlay(cached.video);
      return cached.video;
    }
    return null;
  }

  const video = document.createElement("video");
  video.src = src;
  video.crossOrigin = "anonymous";
  video.loop = true;
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.preload = "auto";

  const entry = {
    status: "loading",
    video
  };

  videoCache.current.set(src, entry);

  const markReady = () => {
    if (entry.status !== "playing") {
      entry.status = "loaded";
    }
    safePlay(video);
    onReady?.();
  };

  const markPlaying = () => {
    entry.status = "playing";
    onReady?.();
  };

  const markError = () => {
    entry.status = "error";
    onReady?.();
  };

  video.addEventListener("loadeddata", markReady);
  video.addEventListener("canplay", markReady);
  video.addEventListener("play", markPlaying);
  video.addEventListener("error", markError);

  video.load();
  safePlay(video);

  return null;
}

function createMeshWarp(w, h, cols = 4, rows = 4) {
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

function ensureMeshWarp(warp, wallW, wallH) {
  if (
    warp?.mode === "mesh" &&
    Array.isArray(warp?.points) &&
    Number(warp?.cols) >= 2 &&
    Number(warp?.rows) >= 2
  ) {
    return warp;
  }

  return createMeshWarp(wallW, wallH, 4, 4);
}

function drawImageTriangle(ctx, image, srcTri, dstTri) {
  const [s0, s1, s2] = srcTri;
  const [d0, d1, d2] = dstTri;

  const denom =
    s0.x * (s1.y - s2.y) +
    s1.x * (s2.y - s0.y) +
    s2.x * (s0.y - s1.y);

  if (Math.abs(denom) < 1e-6) return;

  const a =
    (d0.x * (s1.y - s2.y) +
      d1.x * (s2.y - s0.y) +
      d2.x * (s0.y - s1.y)) /
    denom;

  const b =
    (d0.y * (s1.y - s2.y) +
      d1.y * (s2.y - s0.y) +
      d2.y * (s0.y - s1.y)) /
    denom;

  const c =
    (d0.x * (s2.x - s1.x) +
      d1.x * (s0.x - s2.x) +
      d2.x * (s1.x - s0.x)) /
    denom;

  const d =
    (d0.y * (s2.x - s1.x) +
      d1.y * (s0.x - s2.x) +
      d2.y * (s1.x - s0.x)) /
    denom;

  const e =
    (d0.x * (s1.x * s2.y - s2.x * s1.y) +
      d1.x * (s2.x * s0.y - s0.x * s2.y) +
      d2.x * (s0.x * s1.y - s1.x * s0.y)) /
    denom;

  const f =
    (d0.y * (s1.x * s2.y - s2.x * s1.y) +
      d1.y * (s2.x * s0.y - s0.x * s2.y) +
      d2.y * (s0.x * s1.y - s1.x * s0.y)) /
    denom;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();

  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(image, 0, 0);

  ctx.restore();
}

function applyMeshWarpToCanvas(sourceCanvas, warp, wallW, wallH) {
  const mesh = ensureMeshWarp(warp, wallW, wallH);
  const { cols, rows, points } = mesh;

  const { canvas: outCanvas, ctx } = createBuffer(wallW, wallH);

  const getPoint = (col, row) => points[row * cols + col];

  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      const sx0 = (col / (cols - 1)) * wallW;
      const sy0 = (row / (rows - 1)) * wallH;
      const sx1 = ((col + 1) / (cols - 1)) * wallW;
      const sy1 = sy0;
      const sx2 = sx0;
      const sy2 = ((row + 1) / (rows - 1)) * wallH;
      const sx3 = sx1;
      const sy3 = sy2;

      const p00 = getPoint(col, row);
      const p10 = getPoint(col + 1, row);
      const p01 = getPoint(col, row + 1);
      const p11 = getPoint(col + 1, row + 1);

      drawImageTriangle(
        ctx,
        sourceCanvas,
        [
          { x: sx0, y: sy0 },
          { x: sx1, y: sy1 },
          { x: sx2, y: sy2 }
        ],
        [
          { x: p00.x, y: p00.y },
          { x: p10.x, y: p10.y },
          { x: p01.x, y: p01.y }
        ]
      );

      drawImageTriangle(
        ctx,
        sourceCanvas,
        [
          { x: sx2, y: sy2 },
          { x: sx1, y: sy1 },
          { x: sx3, y: sy3 }
        ],
        [
          { x: p01.x, y: p01.y },
          { x: p10.x, y: p10.y },
          { x: p11.x, y: p11.y }
        ]
      );
    }
  }

  return outCanvas;
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
      ctx.fillStyle = "#f0f0f0";
      ctx.fill();
    }

    ctx.restore();
    ctx.restore();

    return shape?.localWarp
      ? applyMeshWarpToCanvas(canvas, shape.localWarp, wallW, wallH)
      : canvas;
  }

  if (textureType === "video") {
    const loadedVideo =
      getLoadedVideo(textureValue, videoCache) ||
      loadVideo(textureValue, videoCache, onAssetReady);

    ctx.save();
    ctx.clip();

    if (loadedVideo && loadedVideo.readyState >= 2) {
      safePlay(loadedVideo);
      ctx.drawImage(loadedVideo, 0, 0, wallW, wallH);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();
    }

    ctx.restore();
    ctx.restore();

    return shape?.localWarp
      ? applyMeshWarpToCanvas(canvas, shape.localWarp, wallW, wallH)
      : canvas;
  }

  ctx.fillStyle = textureType === "color" ? textureValue : "#ffffff";
  ctx.fill();
  ctx.restore();

  return shape?.localWarp
    ? applyMeshWarpToCanvas(canvas, shape.localWarp, wallW, wallH)
    : canvas;
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

  let allShapes = [...(masks || [])];

  if (activeDraft?.id !== undefined && activeDraft?.id !== null) {
    allShapes = allShapes.filter((shape) => shape?.id !== activeDraft.id);
  }

  if (
    activeDraft?.isClosed &&
    Array.isArray(activeDraft?.points) &&
    activeDraft.points.length >= 3 &&
    activeDraft.visible !== false
  ) {
    allShapes.push({
      id: activeDraft.id ?? "__draft__",
      name: activeDraft.name || "draft",
      type: activeDraft.type || "polygon",
      operation: activeDraft.operation || "add",
      zIndex:
        typeof activeDraft.zIndex === "number" ? activeDraft.zIndex : 999999,
      visible: activeDraft.visible,
      opacity: typeof activeDraft.opacity === "number" ? activeDraft.opacity : 1,
      textureType: activeDraft.textureType || "color",
      textureValue: activeDraft.textureValue || "#ffffff",
      points: activeDraft.points,
      localWarp: activeDraft.localWarp || null
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
      ctx.fillStyle = "#1a1f2e";
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

export default function ProjectionTexture({
  wallW = 800,
  wallH = 500,
  showGrid = false,
  showPinkBackground = true,
  masks = [],
  activeDraft = null,
  onTexture
}) {
  const imageCache = useRef(new Map());
  const videoCache = useRef(new Map());
  const [forceVersion, setForceVersion] = useState(0);

  const asset = useMemo(
    () =>
      createProjectionTextureAsset({
        wallW,
        wallH,
        showGrid,
        showPinkBackground,
        masks,
        activeDraft,
        imageCache,
        videoCache,
        onAssetReady: () => {
          setForceVersion((v) => v + 1);
        }
      }),
    [
      wallW,
      wallH,
      showGrid,
      showPinkBackground,
      masks,
      activeDraft,
      forceVersion
    ]
  );

  useEffect(() => {
    if (!asset?.texture) return;

    onTexture?.(asset.texture);

    let raf = 0;

    const loop = () => {
      videoCache.current.forEach((entry) => {
        if (entry?.video) {
          safePlay(entry.video);
        }
      });

      asset.redraw();
      asset.texture.needsUpdate = true;
      raf = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(raf);
      asset.texture.dispose();
      onTexture?.(null);
    };
  }, [asset, onTexture]);

  useEffect(() => {
    const reviveVideos = () => {
      videoCache.current.forEach((entry) => {
        if (entry?.video) {
          safePlay(entry.video);
        }
      });
    };

    const handleVisibility = () => {
      reviveVideos();
    };

    const handleFocus = () => {
      reviveVideos();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handleFocus);
    };
  }, []);

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

  return null;
}