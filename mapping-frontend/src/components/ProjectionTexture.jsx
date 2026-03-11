import { useEffect, useMemo, useRef } from "react";
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

function drawPolygonStroke(ctx, pts) {
  if (!pts || pts.length < 2) return;

  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = "rgba(0,0,255,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

function getShapeFillStyle(shape) {
  if (shape?.textureType === "color") {
    return shape.textureValue || "#ffffff";
  }

  return "#ffffff";
}

function renderShape(shape, wallW, wallH) {
  const { canvas, ctx } = createBuffer(wallW, wallH);

  if (!drawPolygonPath(ctx, shape.points)) {
    return canvas;
  }

  const alpha = typeof shape.opacity === "number" ? shape.opacity : 1;
  const fillStyle = getShapeFillStyle(shape);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();

  return canvas;
}

function applyShapeToComposite(
  compositeCanvas,
  shapeCanvas,
  operation,
  wallW,
  wallH
) {
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

function buildCompositeTexture({ wallW, wallH, masks = [], activeDraft = null }) {
  const { canvas: compositeCanvas, ctx: compositeCtx } = createBuffer(wallW, wallH);
  compositeCtx.clearRect(0, 0, wallW, wallH);

  const allShapes = [...masks];

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
      zIndex: typeof activeDraft.zIndex === "number" ? activeDraft.zIndex : 999999,
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
    const shapeCanvas = renderShape(shape, wallW, wallH);
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

function drawGrid(ctx, wallW, wallH) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,0,0,0.35)";
  ctx.lineWidth = 1;
  const step = 50;

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

export default function ProjectionTexture({
  wallW = 800,
  wallH = 500,
  showGrid = false,
  masks = [],
  activeDraft = null,
  imageUrl = "/projection.jpg",
  onTexture
}) {
  const canvasRef = useRef(document.createElement("canvas"));
  const imgRef = useRef(null);
  const imgLoadedRef = useRef(false);

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvasRef.current);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }, []);

  useEffect(() => {
    const img = new Image();
    imgRef.current = img;
    imgLoadedRef.current = false;

    const handleLoad = () => {
      imgLoadedRef.current = true;
    };

    const handleError = () => {
      imgLoadedRef.current = false;
      console.warn("ProjectionTexture: nie udało się wczytać imageUrl:", imageUrl);
    };

    img.addEventListener("load", handleLoad);
    img.addEventListener("error", handleError);
    img.src = imageUrl;

    return () => {
      img.removeEventListener("load", handleLoad);
      img.removeEventListener("error", handleError);
    };
  }, [imageUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = wallW;
    canvas.height = wallH;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, wallW, wallH);

    const img = imgRef.current;
    const loaded = imgLoadedRef.current;

    if (img && loaded) {
      ctx.drawImage(img, 0, 0, wallW, wallH);
    } else {
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, wallW, wallH);
    }

    if (showGrid) {
      drawGrid(ctx, wallW, wallH);
    }

    const compositeTexture = buildCompositeTexture({
      wallW,
      wallH,
      masks,
      activeDraft
    });

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(compositeTexture, 0, 0);
    ctx.restore();

    if (activeDraft?.points && activeDraft.points.length >= 2) {
      drawPolygonStroke(ctx, activeDraft.points);
    }

    texture.needsUpdate = true;
    onTexture?.(texture);
  }, [wallW, wallH, showGrid, masks, activeDraft, texture, onTexture]);

  return null;
}