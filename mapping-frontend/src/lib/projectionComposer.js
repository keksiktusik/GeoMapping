import * as THREE from "three";

export function safePlay(video) {
  if (!video) return;
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;

  const p = video.play();
  if (p && typeof p.catch === "function") {
    p.catch(() => {});
  }
}

function clampVideoTime(video, seconds) {
  const duration = Number(video?.duration);
  const safeSeconds = Math.max(0, Number(seconds || 0));

  if (Number.isFinite(duration) && duration > 0) {
    return Math.min(safeSeconds, Math.max(0, duration - 0.05));
  }

  return safeSeconds;
}

function normalizeVideoSettings(settings = {}) {
  return {
    startOffset: Math.max(0, Number(settings?.startOffset || 0)),
    playbackRate: Math.max(0.1, Number(settings?.playbackRate || 1) || 1),
    paused: Boolean(settings?.paused),
    loop: settings?.loop !== false
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
  if (!Array.isArray(pts) || pts.length < 3) return false;

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

function applyVideoSettings(entry, settings = {}) {
  const video = entry?.video;
  if (!video) return;

  const normalized = normalizeVideoSettings(settings);
  entry.runtimeSettings = normalized;

  video.playbackRate = normalized.playbackRate;
  video.defaultPlaybackRate = normalized.playbackRate;
  video.loop = false;

  const startOffset = clampVideoTime(video, normalized.startOffset);

  const settingsChanged =
    entry.lastAppliedStartOffset !== normalized.startOffset ||
    entry.lastAppliedPlaybackRate !== normalized.playbackRate ||
    entry.lastAppliedPaused !== normalized.paused ||
    entry.lastAppliedLoop !== normalized.loop;

  if (!entry.startOffsetApplied || settingsChanged) {
    if (video.readyState >= 1) {
      try {
        video.currentTime = startOffset;
      } catch {
        //
      }
      entry.startOffsetApplied = true;
      entry.pendingStartOffset = null;
    } else {
      entry.pendingStartOffset = startOffset;
      entry.startOffsetApplied = false;
    }
  }

  if (entry.onEnded) {
    video.removeEventListener("ended", entry.onEnded);
    entry.onEnded = null;
  }

  if (normalized.loop) {
    entry.onEnded = () => {
      const restartAt = clampVideoTime(video, normalized.startOffset);
      try {
        video.currentTime = restartAt;
      } catch {
        //
      }

      if (!normalized.paused) {
        safePlay(video);
      }
    };

    video.addEventListener("ended", entry.onEnded);
  }

  if (normalized.paused) {
    video.pause();
  } else {
    safePlay(video);
  }

  entry.lastAppliedStartOffset = normalized.startOffset;
  entry.lastAppliedPlaybackRate = normalized.playbackRate;
  entry.lastAppliedPaused = normalized.paused;
  entry.lastAppliedLoop = normalized.loop;
}

function getLoadedVideo(cacheKey, videoCache, settings) {
  if (!cacheKey) return null;

  const cached = videoCache.current.get(cacheKey);
  if (!cached?.video) return null;

  const { video } = cached;

  if (video.readyState >= 2) {
    if (cached.status !== "playing") {
      cached.status = "loaded";
    }

    applyVideoSettings(cached, settings);
    return video;
  }

  return null;
}

function loadVideo(cacheKey, src, videoCache, settings, onReady) {
  if (!src || !cacheKey) return null;

  const cached = videoCache.current.get(cacheKey);
  if (cached?.video) {
    if (cached.video.readyState >= 2) {
      if (cached.status !== "playing") {
        cached.status = "loaded";
      }
      applyVideoSettings(cached, settings);
      return cached.video;
    }
    return null;
  }

  const video = document.createElement("video");
  video.src = src;
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.preload = "auto";
  video.loop = false;

  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");

  const entry = {
    status: "loading",
    video,
    runtimeSettings: normalizeVideoSettings(settings),
    startOffsetApplied: false,
    pendingStartOffset: null,
    onEnded: null,
    lastAppliedStartOffset: null,
    lastAppliedPlaybackRate: null,
    lastAppliedPaused: null,
    lastAppliedLoop: null
  };

  videoCache.current.set(cacheKey, entry);

  const markReady = () => {
    if (video.readyState >= 2) {
      if (entry.status !== "playing") {
        entry.status = "loaded";
      }

      if (entry.pendingStartOffset !== null && video.readyState >= 1) {
        try {
          video.currentTime = clampVideoTime(video, entry.pendingStartOffset);
        } catch {
          //
        }
        entry.startOffsetApplied = true;
        entry.pendingStartOffset = null;
      }

      applyVideoSettings(entry, settings);
      onReady?.();
    }
  };

  const markPlaying = () => {
    entry.status = "playing";
    applyVideoSettings(entry, settings);
    onReady?.();
  };

  const markError = () => {
    entry.status = "error";
    onReady?.();
  };

  video.addEventListener("loadedmetadata", markReady);
  video.addEventListener("loadeddata", markReady);
  video.addEventListener("canplay", markReady);
  video.addEventListener("canplaythrough", markReady);
  video.addEventListener("play", markPlaying);
  video.addEventListener("error", markError);

  video.load();
  applyVideoSettings(entry, settings);

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
    return {
      ...warp,
      points: warp.points.map((p) => ({
        x: Number(p?.x || 0),
        y: Number(p?.y || 0),
        pinned: Boolean(p?.pinned)
      }))
    };
  }

  return createMeshWarp(wallW, wallH, 4, 4);
}

function applyMeshWarpToCanvas(sourceCanvas, warp, wallW, wallH) {
  const mesh = ensureMeshWarp(warp, wallW, wallH);
  const { cols, rows, points } = mesh;

  const out = document.createElement("canvas");
  out.width = wallW;
  out.height = wallH;
  const outCtx = out.getContext("2d");

  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;

  const srcStepX = sw / (cols - 1);
  const srcStepY = sh / (rows - 1);

  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      const p00 = points[row * cols + col];
      const p10 = points[row * cols + col + 1];
      const p01 = points[(row + 1) * cols + col];
      const p11 = points[(row + 1) * cols + col + 1];

      const sx = col * srcStepX;
      const sy = row * srcStepY;

      const quad = [
        { x: p00.x, y: p00.y, u: 0, v: 0 },
        { x: p10.x, y: p10.y, u: 1, v: 0 },
        { x: p11.x, y: p11.y, u: 1, v: 1 },
        { x: p01.x, y: p01.y, u: 0, v: 1 }
      ];

      const triangles = [
        [quad[0], quad[1], quad[2]],
        [quad[0], quad[2], quad[3]]
      ];

      for (const tri of triangles) {
        outCtx.save();
        outCtx.beginPath();
        outCtx.moveTo(tri[0].x, tri[0].y);
        outCtx.lineTo(tri[1].x, tri[1].y);
        outCtx.lineTo(tri[2].x, tri[2].y);
        outCtx.closePath();
        outCtx.clip();

        const denom =
          tri[0].u * (tri[1].v - tri[2].v) +
          tri[1].u * (tri[2].v - tri[0].v) +
          tri[2].u * (tri[0].v - tri[1].v);

        if (Math.abs(denom) > 1e-6) {
          const a =
            (tri[0].x * (tri[1].v - tri[2].v) +
              tri[1].x * (tri[2].v - tri[0].v) +
              tri[2].x * (tri[0].v - tri[1].v)) /
            denom;
          const b =
            (tri[0].x * (tri[2].u - tri[1].u) +
              tri[1].x * (tri[0].u - tri[2].u) +
              tri[2].x * (tri[1].u - tri[0].u)) /
            denom;
          const c =
            (tri[0].x * (tri[1].u * tri[2].v - tri[2].u * tri[1].v) +
              tri[1].x * (tri[2].u * tri[0].v - tri[0].u * tri[2].v) +
              tri[2].x * (tri[0].u * tri[1].v - tri[1].u * tri[0].v)) /
            denom;

          const d =
            (tri[0].y * (tri[1].v - tri[2].v) +
              tri[1].y * (tri[2].v - tri[0].v) +
              tri[2].y * (tri[0].v - tri[1].v)) /
            denom;
          const e =
            (tri[0].y * (tri[2].u - tri[1].u) +
              tri[1].y * (tri[0].u - tri[2].u) +
              tri[2].y * (tri[1].u - tri[0].u)) /
            denom;
          const f =
            (tri[0].y * (tri[1].u * tri[2].v - tri[2].u * tri[1].v) +
              tri[1].y * (tri[2].u * tri[0].v - tri[0].u * tri[2].v) +
              tri[2].y * (tri[0].u * tri[1].v - tri[1].u * tri[0].v)) /
            denom;

          outCtx.transform(a, d, b, e, c, f);
          outCtx.drawImage(
            sourceCanvas,
            sx,
            sy,
            srcStepX,
            srcStepY,
            0,
            0,
            1,
            1
          );
        }

        outCtx.restore();
      }
    }
  }

  return out;
}

function parseLayerDirectives(layerName = "") {
  const text = String(layerName || "");

  const readNumber = (name, fallback) => {
    const match = text.match(new RegExp(`\\[${name}:([^\\]]+)\\]`, "i"));
    if (!match) return fallback;
    const num = Number(match[1]);
    return Number.isFinite(num) ? num : fallback;
  };

  const readString = (name, fallback) => {
    const match = text.match(new RegExp(`\\[${name}:([^\\]]+)\\]`, "i"));
    return match ? String(match[1]).trim() : fallback;
  };

  const readBoolFlag = (name, fallback) => {
    const raw = readString(name, null);
    if (raw === null) return fallback;
    if (raw === "1" || raw.toLowerCase() === "true") return true;
    if (raw === "0" || raw.toLowerCase() === "false") return false;
    return fallback;
  };

  const baseName = text.replace(/\[[^\]]+\]/g, "").trim();

  return {
    baseName,
    blend: readString("blend", "source-over"),
    feather: Math.max(0, readNumber("feather", 0)),
    videoStart: Math.max(0, readNumber("video-start", 0)),
    videoSpeed: Math.max(0.1, readNumber("video-speed", 1)),
    videoPaused: readBoolFlag("video-paused", false),
    videoLoop: readBoolFlag("video-loop", true),
    cutout: readBoolFlag("cutout", false)
  };
}

function normalizeBlendMode(mode) {
  const allowed = new Set([
    "source-over",
    "multiply",
    "screen",
    "overlay",
    "lighten",
    "darken",
    "color-dodge",
    "color-burn",
    "hard-light",
    "soft-light",
    "difference",
    "exclusion"
  ]);

  return allowed.has(mode) ? mode : "source-over";
}

function isCutoutShape(shape) {
  return shape?.type === "ignore-zone" || shape?.operation === "subtract";
}

function hasAutoCutout(shape) {
  if (!shape) return false;
  if (isCutoutShape(shape)) return false;
  const directives = parseLayerDirectives(shape?.layerName);
  return directives.cutout === true;
}

function renderCutoutShape(shape, wallW, wallH) {
  const { canvas, ctx } = createBuffer(wallW, wallH);

  if (!drawPolygonPath(ctx, shape?.points || [])) {
    return canvas;
  }

  const alpha = typeof shape.opacity === "number" ? shape.opacity : 1;
  const directives = parseLayerDirectives(shape?.layerName);
  const feather = directives.feather;

  ctx.save();
  ctx.globalAlpha = alpha;

  if (feather > 0) {
    ctx.filter = `blur(${feather}px)`;
  }

  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  return shape?.localWarp
    ? applyMeshWarpToCanvas(canvas, shape.localWarp, wallW, wallH)
    : canvas;
}

function renderShape(shape, wallW, wallH, imageCache, videoCache, onAssetReady) {
  if (isCutoutShape(shape)) {
    return renderCutoutShape(shape, wallW, wallH);
  }

  const { canvas, ctx } = createBuffer(wallW, wallH);

  if (!drawPolygonPath(ctx, shape?.points || [])) {
    return canvas;
  }

  const alpha = typeof shape.opacity === "number" ? shape.opacity : 1;
  const textureType = shape?.textureType || "color";
  const textureValue = shape?.textureValue || "#ffffff";
  const directives = parseLayerDirectives(shape?.layerName);
  const feather = directives.feather;

  ctx.save();
  ctx.globalAlpha = alpha;

  if (feather > 0) {
    ctx.filter = `blur(${feather}px)`;
  }

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
    const videoSettings = {
      startOffset: directives.videoStart,
      playbackRate: directives.videoSpeed,
      paused: directives.videoPaused,
      loop: directives.videoLoop
    };

    const videoCacheKey = `${shape?.id ?? shape?.name ?? textureValue}::${textureValue}`;

    const loadedVideo =
      getLoadedVideo(videoCacheKey, videoCache, videoSettings) ||
      loadVideo(videoCacheKey, textureValue, videoCache, videoSettings, onAssetReady);

    ctx.save();
    ctx.clip();

    if (loadedVideo && loadedVideo.readyState >= 2) {
      if (!videoSettings.paused) {
        safePlay(loadedVideo);
      }
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

function applyDestinationOut(compositeCtx, shapeCanvas) {
  compositeCtx.save();
  compositeCtx.globalCompositeOperation = "destination-out";
  compositeCtx.drawImage(shapeCanvas, 0, 0);
  compositeCtx.restore();
}

function applyShapeToComposite(compositeCanvas, shapeCanvas, shape, wallW, wallH) {
  const compositeCtx = compositeCanvas.getContext("2d");
  const operation = shape?.operation || "add";
  const directives = parseLayerDirectives(shape?.layerName);
  const blend = normalizeBlendMode(directives.blend);

  if (isCutoutShape(shape)) {
    applyDestinationOut(compositeCtx, shapeCanvas);
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

  if (hasAutoCutout(shape)) {
    applyDestinationOut(compositeCtx, shapeCanvas);
  }

  compositeCtx.save();
  compositeCtx.globalCompositeOperation = blend;
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
      locked: Boolean(activeDraft.locked),
      layerName: activeDraft.layerName || "default",
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

      if (az !== bz) return az - bz;
      if (isCutoutShape(a) === isCutoutShape(b)) return 0;
      return isCutoutShape(a) ? 1 : -1;
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

    applyShapeToComposite(compositeCanvas, shapeCanvas, shape, wallW, wallH);
  }

  return compositeCanvas;
}

export function createProjectionTextureAsset({
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