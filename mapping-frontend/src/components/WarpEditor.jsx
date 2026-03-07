import { useEffect, useRef, useState } from "react";
import { ui } from "../styles/ui";

export default function WarpEditor({ warp, setWarp, wallW = 300, wallH = 220 }) {
  const ref = useRef(null);
  const [dragKey, setDragKey] = useState(null);
  const keys = ["tl", "tr", "br", "bl"];

  const getMouse = (e) => {
    const r = ref.current.getBoundingClientRect();
    const scaleX = wallW / r.width;
    const scaleY = wallH / r.height;

    return {
      x: (e.clientX - r.left) * scaleX,
      y: (e.clientY - r.top) * scaleY
    };
  };

  const hit = (m) => {
    const R = 12;
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

  const resetWarp = () => {
    setWarp({
      tl: { x: 0, y: 0 },
      tr: { x: wallW, y: 0 },
      br: { x: wallW, y: wallH },
      bl: { x: 0, y: wallH }
    });
  };

  const onDown = (e) => {
    const m = getMouse(e);
    const k = hit(m);
    if (k) setDragKey(k);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "100%",
          aspectRatio: `${wallW} / ${wallH}`,
          minHeight: 220
        }}
      >
        <canvas
          ref={ref}
          width={wallW}
          height={wallH}
          onMouseDown={onDown}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            border: "1px solid #243041",
            borderRadius: 12,
            background: "#0b1220"
          }}
        />
        <Overlay warp={warp} wallW={wallW} wallH={wallH} />
      </div>

      <button style={ui.button} type="button" onClick={resetWarp}>
        Reset Warp
      </button>
    </div>
  );
}

function Overlay({ warp, wallW, wallH }) {
  const pts = [warp.tl, warp.tr, warp.br, warp.bl];

  return (
    <svg
      viewBox={`0 0 ${wallW} ${wallH}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none"
      }}
    >
      <polygon
        points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="rgba(56,189,248,0.12)"
        stroke="rgba(56,189,248,1)"
        strokeWidth="2"
      />
      {Object.entries(warp).map(([k, p]) => (
        <g key={k}>
          <circle cx={p.x} cy={p.y} r="9" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
          <text x={p.x + 12} y={p.y - 10} fontSize="12" fill="#38bdf8">
            {k.toUpperCase()}
          </text>
        </g>
      ))}
    </svg>
  );
}