import { useEffect, useMemo, useRef, useState } from "react";

const W = 800;
const H = 500;

const HIT_RADIUS_CLOSE = 10;
const HIT_RADIUS_DRAG = 12;

export default function CanvasEditor({
  mode,
  setMode,
  points,
  setPoints,
  isClosed,
  setIsClosed,
  opacity,
  showGrid
}) {
  const canvasRef = useRef(null);
  const [dragIndex, setDragIndex] = useState(null);

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const canClose = useMemo(
    () => points.length >= 3 && !isClosed,
    [points.length, isClosed]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, W, H);

    // wall
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, W, H);

    // grid
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,0,0,0.35)";
      ctx.lineWidth = 1;
      const step = 50;

      for (let x = 0; x <= W; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y <= H; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // border
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, W, H);

    // fill
    if (isClosed && points.length >= 3) {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // lines
    if (points.length > 1) {
      ctx.strokeStyle = "blue";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      if (isClosed) ctx.lineTo(points[0].x, points[0].y);
      ctx.stroke();
    }

    // points
    points.forEach((p, idx) => {
      const isFirst = idx === 0;
      ctx.fillStyle = isFirst ? "green" : "blue";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();

      if (mode === "edit") {
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, HIT_RADIUS_DRAG, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // hint
    ctx.fillStyle = "#333";
    ctx.font = "14px sans-serif";
    const hint =
      mode === "draw"
        ? canClose
          ? "DRAW: klikaj punkty. Kliknij zielony punkt aby zamknąć."
          : "DRAW: klikaj punkty (min 3)."
        : "EDIT: złap i przeciągnij punkt. (PPM reset w ModelPage)";

    ctx.fillText(hint, 16, 24);
  }, [points, isClosed, opacity, showGrid, mode, canClose]);

  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const findPointIndexNear = (pt) => {
    for (let i = 0; i < points.length; i++) {
      if (dist(pt, points[i]) <= HIT_RADIUS_DRAG) return i;
    }
    return null;
  };

  const handleClick = (e) => {
    if (mode !== "draw") return;
    if (isClosed) return;

    const p = getCanvasPoint(e);

    if (canClose && dist(p, points[0]) <= HIT_RADIUS_CLOSE) {
      setIsClosed(true);
      setMode("edit");
      return;
    }

    setPoints((prev) => [...prev, p]);
  };

  const handleMouseDown = (e) => {
    if (mode !== "edit") return;
    if (points.length === 0) return;

    const p = getCanvasPoint(e);
    const idx = findPointIndexNear(p);
    if (idx !== null) setDragIndex(idx);
  };

  const handleMouseMove = (e) => {
    if (mode !== "edit") return;
    if (dragIndex === null) return;

    const p = getCanvasPoint(e);
    setPoints((prev) => {
      const next = [...prev];
      next[dragIndex] = p;
      return next;
    });
  };

  const handleMouseUp = () => {
    if (dragIndex !== null) setDragIndex(null);
  };

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        border: "1px solid #ccc",
        background: "white",
        cursor: mode === "draw" ? "crosshair" : "grab"
      }}
    />
  );
}