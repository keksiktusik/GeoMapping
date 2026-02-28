import { useEffect, useRef, useState } from "react";

export default function WarpEditor({ warp, setWarp, wallW = 800, wallH = 500 }) {
  const ref = useRef(null);
  const [dragKey, setDragKey] = useState(null);

  const keys = ["tl", "tr", "br", "bl"];

  const getMouse = (e) => {
    const r = ref.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const hit = (m) => {
    const R = 10;
    for (const k of keys) {
      const p = warp[k];
      const dx = m.x - p.x;
      const dy = m.y - p.y;
      if (dx * dx + dy * dy <= R * R) return k;
    }
    return null;
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragKey) return;
      const m = getMouse(e);
      setWarp((prev) => ({
        ...prev,
        [dragKey]: {
          x: Math.max(0, Math.min(wallW, m.x)),
          y: Math.max(0, Math.min(wallH, m.y))
        }
      }));
    };
    const onUp = () => setDragKey(null);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragKey, setWarp, wallW, wallH]);

  const onDown = (e) => {
    const m = getMouse(e);
    const k = hit(m);
    if (k) setDragKey(k);
  };

  return (
    <div style={{ position: "relative", width: wallW, height: wallH }}>
      <canvas
        ref={ref}
        width={wallW}
        height={wallH}
        onMouseDown={onDown}
        style={{ border: "1px solid #ddd", borderRadius: 8, background: "#fff" }}
      />
      <Overlay warp={warp} wallW={wallW} wallH={wallH} />
    </div>
  );
}

function Overlay({ warp, wallW, wallH }) {
  const pts = [warp.tl, warp.tr, warp.br, warp.bl];
  return (
    <svg
      width={wallW}
      height={wallH}
      style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
    >
      <polygon
        points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="rgba(255,0,0,0.12)"
        stroke="rgba(255,0,0,0.8)"
        strokeWidth="2"
      />
      {Object.entries(warp).map(([k, p]) => (
        <g key={k}>
          <circle cx={p.x} cy={p.y} r="8" fill="white" stroke="red" strokeWidth="2" />
          <text x={p.x + 10} y={p.y - 10} fontSize="12" fill="red">
            {k.toUpperCase()}
          </text>
        </g>
      ))}
    </svg>
  );
}