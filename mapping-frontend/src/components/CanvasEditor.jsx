import { useEffect, useMemo, useRef, useState } from "react";

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
  showGrid,
  wallW = 800,
  wallH = 500
}) {
  const canvasRef = useRef(null);
  const [dragIndex, setDragIndex] = useState(null);

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const canClose = useMemo(
    () => points.length >= 3 && !isClosed,
    [points.length, isClosed]
  );

  // DPI + rozmiar canvas (reaguje na wallW/wallH + zmiany DPR)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;

    // CSS size (jak duży jest "na ekranie")
    canvas.style.width = `${wallW}px`;
    canvas.style.height = `${wallH}px`;

    // buffer size (ile ma pikseli naprawdę)
    canvas.width = Math.round(wallW * dpr);
    canvas.height = Math.round(wallH * dpr);

    const ctx = canvas.getContext("2d");
    // Ustawiamy przekształcenie tak, by rysować w jednostkach "CSS px"
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [wallW, wallH]);

  // rysowanie
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // Czyścimy w "CSS px" (bo mamy setTransform(dpr,...))
    ctx.clearRect(0, 0, wallW, wallH);

    // wall
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, wallW, wallH);

    // grid
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

    // border
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, wallW, wallH);

    // fill (zamknięty polygon)
    if (isClosed && points.length >= 3) {
      ctx.save();
      ctx.globalAlpha = typeof opacity === "number" ? opacity : 0.35;
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
        : "EDIT: złap i przeciągnij punkt.";

    ctx.fillText(hint, 16, 24);
  }, [points, isClosed, opacity, showGrid, mode, canClose, wallW, wallH]);

  // przeliczanie pozycji myszy na układ canvas (w CSS px)
  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // rect.width/height mogą się różnić (np. zoom, responsywność)
    const scaleX = wallW / rect.width;
    const scaleY = wallH / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
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

    // zamknięcie wielokąta kliknięciem w pierwszy (zielony) punkt
    if (canClose && dist(p, points[0]) <= HIT_RADIUS_CLOSE) {
      setIsClosed(true);
      setMode("edit");
      return;
    }

    setPoints((prev) => [...prev, p]);
  };

  const handleMouseDown = (e) => {
    if (mode !== "edit") return;

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
    setDragIndex(null);
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        border: "1px solid #ccc",
        background: "white",
        cursor: mode === "draw" ? "crosshair" : dragIndex !== null ? "grabbing" : "grab"
      }}
    />
  );
}