function createBuffer(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  return { canvas, ctx };
}

function drawPolygonPath(ctx, points) {
  if (!Array.isArray(points) || points.length < 3) return false;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  return true;
}

function renderShapeAlpha(shape, wallW, wallH) {
  const { canvas, ctx } = createBuffer(wallW, wallH);
  if (!drawPolygonPath(ctx, shape.points)) return canvas;

  const alpha = typeof shape.opacity === "number" ? shape.opacity : 1;
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fill();
  ctx.restore();

  return canvas;
}

function applyShapeToMask(maskCanvas, shapeCanvas, operation, wallW, wallH) {
  const maskCtx = maskCanvas.getContext("2d");

  if (operation === "subtract") {
    maskCtx.save();
    maskCtx.globalCompositeOperation = "destination-out";
    maskCtx.drawImage(shapeCanvas, 0, 0);
    maskCtx.restore();
    return;
  }

  if (operation === "intersect") {
    const { canvas: temp, ctx: tempCtx } = createBuffer(wallW, wallH);
    tempCtx.drawImage(maskCanvas, 0, 0);
    tempCtx.globalCompositeOperation = "destination-in";
    tempCtx.drawImage(shapeCanvas, 0, 0);

    maskCtx.clearRect(0, 0, wallW, wallH);
    maskCtx.drawImage(temp, 0, 0);
    return;
  }

  maskCtx.save();
  maskCtx.globalCompositeOperation = "source-over";
  maskCtx.drawImage(shapeCanvas, 0, 0);
  maskCtx.restore();
}

export function buildCompositeMask({
  wallW,
  wallH,
  masks = [],
  activeDraft = null
}) {
  const { canvas: maskCanvas, ctx: maskCtx } = createBuffer(wallW, wallH);
  maskCtx.clearRect(0, 0, wallW, wallH);

  const all = [...masks];

  if (
    activeDraft?.isClosed &&
    Array.isArray(activeDraft?.points) &&
    activeDraft.points.length >= 3
  ) {
    all.push({
      id: "__draft__",
      name: activeDraft.name || "draft",
      points: activeDraft.points,
      opacity: activeDraft.opacity ?? 1,
      operation: activeDraft.operation || "add",
      zIndex: activeDraft.zIndex ?? 999999,
      visible: true
    });
  }

  const ordered = all
    .filter((m) => m?.visible !== false)
    .filter((m) => Array.isArray(m?.points) && m.points.length >= 3)
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  for (const mask of ordered) {
    const shapeCanvas = renderShapeAlpha(mask, wallW, wallH);
    applyShapeToMask(
      maskCanvas,
      shapeCanvas,
      mask.operation || "add",
      wallW,
      wallH
    );
  }

  return maskCanvas;
}

export function renderProjectionComposite({
  ctx,
  wallW,
  wallH,
  image,
  showGrid = false,
  masks = [],
  activeDraft = null
}) {
  ctx.clearRect(0, 0, wallW, wallH);

  if (image) {
    ctx.drawImage(image, 0, 0, wallW, wallH);
  } else {
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, wallW, wallH);
  }

  if (showGrid) {
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

  const compositeMask = buildCompositeMask({
    wallW,
    wallH,
    masks,
    activeDraft
  });

  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(compositeMask, 0, 0);
  ctx.restore();

  return compositeMask;
}