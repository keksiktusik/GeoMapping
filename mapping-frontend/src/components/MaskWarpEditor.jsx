import { useEffect, useMemo, useRef, useState } from "react";
import { ui } from "../styles/ui";

function createDefaultLocalWarp() {
  return {
    enabled: false,
    tl: { x: 0, y: 0 },
    tr: { x: 1, y: 0 },
    br: { x: 1, y: 1 },
    bl: { x: 0, y: 1 }
  };
}

function normalizeLocalWarp(warp) {
  if (!warp) return createDefaultLocalWarp();

  return {
    enabled: Boolean(warp.enabled),
    tl: {
      x: Number(warp?.tl?.x ?? 0),
      y: Number(warp?.tl?.y ?? 0)
    },
    tr: {
      x: Number(warp?.tr?.x ?? 1),
      y: Number(warp?.tr?.y ?? 0)
    },
    br: {
      x: Number(warp?.br?.x ?? 1),
      y: Number(warp?.br?.y ?? 1)
    },
    bl: {
      x: Number(warp?.bl?.x ?? 0),
      y: Number(warp?.bl?.y ?? 1)
    }
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const POINT_KEYS = ["tl", "tr", "br", "bl"];

export default function MaskWarpEditor({
  localWarp,
  setLocalWarp,
  disabled = false,
  width = 280,
  height = 180
}) {
  const rootRef = useRef(null);
  const [dragKey, setDragKey] = useState(null);

  const warp = useMemo(() => normalizeLocalWarp(localWarp), [localWarp]);

  const getMouse = (e) => {
    const r = rootRef.current.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / r.width, 0, 1),
      y: clamp((e.clientY - r.top) / r.height, 0, 1)
    };
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragKey || disabled) return;

      const m = getMouse(e);

      setLocalWarp((prev) => {
        const next = normalizeLocalWarp(prev);
        return {
          ...next,
          [dragKey]: {
            x: m.x,
            y: m.y
          }
        };
      });
    };

    const onUp = () => setDragKey(null);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragKey, setLocalWarp, disabled]);

  const handleMouseDown = (key) => {
    if (disabled) return;
    setDragKey(key);
  };

  const resetWarp = () => {
    setLocalWarp(createDefaultLocalWarp());
  };

  const toggleEnabled = () => {
    setLocalWarp((prev) => {
      const next = normalizeLocalWarp(prev);
      return {
        ...next,
        enabled: !next.enabled
      };
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, opacity: disabled ? 0.5 : 1 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={warp.enabled}
          onChange={toggleEnabled}
          disabled={disabled}
        />
        Włącz local warp dla maski
      </label>

      <button
        type="button"
        style={ui.button}
        onClick={resetWarp}
        disabled={disabled}
      >
        Reset local warp
      </button>

      <div
        ref={rootRef}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: `${width} / ${height}`,
          border: "1px solid #243041",
          borderRadius: 12,
          background: "#0b1220",
          overflow: "hidden"
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          <rect x="0" y="0" width={width} height={height} fill="#0b1220" />

          <polygon
            points={[
              `${warp.tl.x * width},${warp.tl.y * height}`,
              `${warp.tr.x * width},${warp.tr.y * height}`,
              `${warp.br.x * width},${warp.br.y * height}`,
              `${warp.bl.x * width},${warp.bl.y * height}`
            ].join(" ")}
            fill="rgba(56,189,248,0.12)"
            stroke="rgba(56,189,248,0.9)"
            strokeWidth="2"
          />

          {POINT_KEYS.map((key) => {
            const p = warp[key];
            return (
              <g key={key}>
                <circle
                  cx={p.x * width}
                  cy={p.y * height}
                  r="7"
                  fill="#0f172a"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  onMouseDown={() => handleMouseDown(key)}
                  style={{ cursor: disabled ? "not-allowed" : "grab" }}
                />
                <text
                  x={p.x * width + 10}
                  y={p.y * height - 10}
                  fill="#e2e8f0"
                  fontSize="12"
                  fontFamily="sans-serif"
                >
                  {key.toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
        To działa tylko na wybraną maskę.<br />
        Najpierw deformujesz maskę lokalnie, potem cały output idzie przez global warp.
      </div>
    </div>
  );
}