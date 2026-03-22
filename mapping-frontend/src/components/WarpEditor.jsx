import { useEffect, useMemo, useRef, useState } from "react";
import { ui } from "../styles/ui";

function createMeshWarp(w, h, cols = 5, rows = 5) {
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

  return createMeshWarp(wallW, wallH, 5, 5);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export default function WarpEditor({ warp, setWarp, wallW = 800, wallH = 500 }) {
  const ref = useRef(null);
  const dragIndexRef = useRef(null);
  const lastMouseRef = useRef(null);

  const [brushRadius, setBrushRadius] = useState(120);
  const [softness, setSoftness] = useState(0.72);
  const [showIndices, setShowIndices] = useState(false);

  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  const meshWarp = useMemo(
    () => ensureMeshWarp(warp, wallW, wallH),
    [warp, wallW, wallH]
  );

  const pushHistory = (snapshot) => {
    setHistory((prev) => [...prev.slice(-29), JSON.parse(JSON.stringify(snapshot))]);
    setFuture([]);
  };

  const getMouse = (e) => {
    const r = ref.current.getBoundingClientRect();
    const scaleX = wallW / r.width;
    const scaleY = wallH / r.height;

    return {
      x: (e.clientX - r.left) * scaleX,
      y: (e.clientY - r.top) * scaleY
    };
  };

  const hitPoint = (m) => {
    const hitRadius = 16;
    const pts = meshWarp.points || [];

    for (let i = pts.length - 1; i >= 0; i -= 1) {
      const p = pts[i];
      const dx = m.x - p.x;
      const dy = m.y - p.y;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) return i;
    }

    return null;
  };

  const resetWarp = () => {
    pushHistory(meshWarp);
    setWarp(createMeshWarp(wallW, wallH, meshWarp.cols || 5, meshWarp.rows || 5));
  };

  const changeDensity = (cols, rows) => {
    pushHistory(meshWarp);
    setWarp(createMeshWarp(wallW, wallH, cols, rows));
  };

  const undo = () => {
    if (!history.length) return;

    const previous = history[history.length - 1];
    setFuture((prev) => [JSON.parse(JSON.stringify(meshWarp)), ...prev.slice(0, 29)]);
    setHistory((prev) => prev.slice(0, -1));
    setWarp(previous);
  };

  const redo = () => {
    if (!future.length) return;

    const next = future[0];
    setHistory((prev) => [...prev.slice(-29), JSON.parse(JSON.stringify(meshWarp))]);
    setFuture((prev) => prev.slice(1));
    setWarp(next);
  };

  const togglePin = (index) => {
    pushHistory(meshWarp);

    setWarp((prev) => {
      const next = ensureMeshWarp(prev, wallW, wallH);
      const points = next.points.map((p, i) =>
        i === index ? { ...p, pinned: !p.pinned } : { ...p }
      );

      return {
        ...next,
        points
      };
    });
  };

  useEffect(() => {
    const onMove = (e) => {
      if (dragIndexRef.current === null) return;
      if (!ref.current) return;

      const m = getMouse(e);
      const last = lastMouseRef.current || m;
      const dx = m.x - last.x;
      const dy = m.y - last.y;
      lastMouseRef.current = m;

      if (dx === 0 && dy === 0) return;

      setWarp((prev) => {
        const next = ensureMeshWarp(prev, wallW, wallH);
        const points = next.points.map((p) => ({ ...p }));
        const anchor = points[dragIndexRef.current];
        if (!anchor) return prev;

        const onlySinglePoint = e.shiftKey;

        for (let i = 0; i < points.length; i += 1) {
          if (i !== dragIndexRef.current && points[i].pinned) continue;

          let influence = 1;

          if (onlySinglePoint) {
            influence = i === dragIndexRef.current ? 1 : 0;
          } else {
            const ddx = points[i].x - anchor.x;
            const ddy = points[i].y - anchor.y;
            const dist = Math.sqrt(ddx * ddx + ddy * ddy);

            if (dist > brushRadius) {
              influence = 0;
            } else {
              const t = 1 - dist / brushRadius;
              influence = Math.pow(t, 1 + softness * 4);
            }
          }

          if (influence <= 0) continue;

          points[i].x = clamp(points[i].x + dx * influence, 0, wallW);
          points[i].y = clamp(points[i].y + dy * influence, 0, wallH);
        }

        return {
          ...next,
          points
        };
      });
    };

    const onUp = () => {
      dragIndexRef.current = null;
      lastMouseRef.current = null;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setWarp, wallW, wallH, brushRadius, softness]);

  const onMouseDown = (e) => {
    const m = getMouse(e);
    const index = hitPoint(m);
    if (index === null) return;

    if (e.altKey) {
      togglePin(index);
      return;
    }

    pushHistory(meshWarp);
    dragIndexRef.current = index;
    lastMouseRef.current = m;
  };

  const unpinAll = () => {
    pushHistory(meshWarp);

    setWarp((prev) => {
      const next = ensureMeshWarp(prev, wallW, wallH);
      return {
        ...next,
        points: next.points.map((p) => ({ ...p, pinned: false }))
      };
    });
  };

  const { cols, rows, points } = meshWarp;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8
        }}
      >
        <button style={ui.button} type="button" onClick={() => changeDensity(4, 4)}>
          Siatka 4×4
        </button>
        <button style={ui.button} type="button" onClick={() => changeDensity(5, 5)}>
          Siatka 5×5
        </button>
        <button style={ui.button} type="button" onClick={() => changeDensity(6, 6)}>
          Siatka 6×6
        </button>
        <button style={ui.button} type="button" onClick={() => changeDensity(7, 7)}>
          Siatka 7×7
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8
        }}
      >
        <button style={ui.button} type="button" onClick={undo} disabled={!history.length}>
          Undo
        </button>
        <button style={ui.button} type="button" onClick={redo} disabled={!future.length}>
          Redo
        </button>
        <button style={ui.button} type="button" onClick={unpinAll}>
          Unpin all
        </button>
        <button style={ui.button} type="button" onClick={resetWarp}>
          Reset Warp
        </button>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={showIndices}
          onChange={(e) => setShowIndices(e.target.checked)}
        />
        Pokaż indeksy punktów
      </label>

      <div>
        <div style={ui.label}>Promień wpływu</div>
        <input
          type="range"
          min="20"
          max="220"
          value={brushRadius}
          onChange={(e) => setBrushRadius(Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      <div>
        <div style={ui.label}>Miękkość</div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={softness}
          onChange={(e) => setSoftness(Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
        Drag = miękki mesh warp. <br />
        Shift + drag = tylko jeden punkt. <br />
        Alt + klik = pin / unpin punktu.
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: `${wallW} / ${wallH}`,
          minHeight: 220
        }}
      >
        <div
          ref={ref}
          onMouseDown={onMouseDown}
          style={{
            position: "absolute",
            inset: 0,
            border: "1px solid #243041",
            borderRadius: 12,
            background: "#0b1220",
            overflow: "hidden",
            cursor: "crosshair"
          }}
        >
          <svg
            viewBox={`0 0 ${wallW} ${wallH}`}
            preserveAspectRatio="none"
            style={{
              width: "100%",
              height: "100%",
              display: "block"
            }}
          >
            <rect x="0" y="0" width={wallW} height={wallH} fill="#0b1220" />

            {Array.from({ length: rows }).map((_, row) => {
              const rowPoints = [];
              for (let col = 0; col < cols; col += 1) {
                const p = points[row * cols + col];
                rowPoints.push(`${p.x},${p.y}`);
              }

              return (
                <polyline
                  key={`row-${row}`}
                  points={rowPoints.join(" ")}
                  fill="none"
                  stroke="rgba(56,189,248,0.9)"
                  strokeWidth="1.5"
                />
              );
            })}

            {Array.from({ length: cols }).map((_, col) => {
              const colPoints = [];
              for (let row = 0; row < rows; row += 1) {
                const p = points[row * cols + col];
                colPoints.push(`${p.x},${p.y}`);
              }

              return (
                <polyline
                  key={`col-${col}`}
                  points={colPoints.join(" ")}
                  fill="none"
                  stroke="rgba(56,189,248,0.9)"
                  strokeWidth="1.5"
                />
              );
            })}

            {points.map((p, i) => (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="7"
                  fill={p.pinned ? "#ef4444" : "#0f172a"}
                  stroke={p.pinned ? "#fca5a5" : "#38bdf8"}
                  strokeWidth="2"
                />
                {showIndices && (
                  <text
                    x={p.x + 9}
                    y={p.y - 9}
                    fill="#e2e8f0"
                    fontSize="12"
                    fontFamily="sans-serif"
                  >
                    {i}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}