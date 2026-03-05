import { useEffect, useRef, useState } from "react";

const STORAGE_OUTPUT = "mapping_output_state_v1";

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function ProjectorOutput({
  wallW = 800,
  wallH = 500,
}) {
  const ref = useRef(null);

  // stan wczytany z localStorage (to jest “prawda” dla projektora)
  const [data, setData] = useState(() =>
    safeParse(localStorage.getItem(STORAGE_OUTPUT), {
      points: [],
      isClosed: false,
      opacity: 1,
      showGrid: false,
      masks: [],
    })
  );

  // 1) Aktualizacja, gdy edytor zapisze localStorage
  useEffect(() => {
    const apply = () => {
      const next = safeParse(localStorage.getItem(STORAGE_OUTPUT), null);
      if (next) setData(next);
    };

    apply();

    const onStorage = (e) => {
      if (e.key === STORAGE_OUTPUT) apply();
    };
    window.addEventListener("storage", onStorage);

    // 2) Fallback (czasem event storage bywa kapryśny w zależności od przeglądarki)
    const id = window.setInterval(apply, 200);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(id);
    };
  }, []);

  // 3) Rysowanie wyjścia na canvas
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const points = Array.isArray(data.points) ? data.points : [];
    const masks = Array.isArray(data.masks) ? data.masks : [];
    const opacity = typeof data.opacity === "number" ? data.opacity : 1;
    const showGrid = !!data.showGrid;

    // tło: pełny róż
    ctx.clearRect(0, 0, wallW, wallH);
    ctx.fillStyle = "#ff4fbf";
    ctx.fillRect(0, 0, wallW, wallH);

    // siatka pomocnicza
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
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

    // wycięcie wielokąta
    const cutPolygon = (poly, alpha = 1) => {
      if (!poly || poly.length < 3) return;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillStyle = "black";

      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    };

    // zapisane maski
    for (const m of masks) {
      cutPolygon(m.points, typeof m.opacity === "number" ? m.opacity : 1);
    }

    // aktywna maska z edytora
    cutPolygon(points, opacity);
  }, [data, wallW, wallH]);

  return (
    <canvas
      ref={ref}
      width={wallW}
      height={wallH}
      style={{
        width: "100vw",
        height: "100vh",
        display: "block",
        background: "black",
      }}
    />
  );
}