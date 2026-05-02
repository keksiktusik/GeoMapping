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

function getBoundingBox(points) {
  if (!Array.isArray(points) || points.length < 3) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    minX = Math.min(minX, Number(p.x || 0));
    minY = Math.min(minY, Number(p.y || 0));
    maxX = Math.max(maxX, Number(p.x || 0));
    maxY = Math.max(maxY, Number(p.y || 0));
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;

  return { minX, minY, maxX, maxY };
}

function createMeshWarpFromBox(box, cols = 4, rows = 4) {
  const width = Math.max(2, box.maxX - box.minX);
  const height = Math.max(2, box.maxY - box.minY);

  const points = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      points.push({
        x: box.minX + (col / (cols - 1)) * width,
        y: box.minY + (row / (rows - 1)) * height,
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

function pointInRect(p, rect) {
  const minX = Math.min(rect.x1, rect.x2);
  const maxX = Math.max(rect.x1, rect.x2);
  const minY = Math.min(rect.y1, rect.y2);
  const maxY = Math.max(rect.y1, rect.y2);

  return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
}

export default function WarpEditor({
  warp,
  setWarp,
  wallW = 800,
  wallH = 500,
  sourcePoints = [],
  sourceEnabled = false,
  autoFitLabel = "Auto-fit"
}) {
  const ref = useRef(null);

  const dragIndexRef = useRef(null);
  const lastMouseRef = useRef(null);

  const selectingRef = useRef(false);
  const selectionStartRef = useRef(null);
  const movingSelectionRef = useRef(false);

  const [brushRadius, setBrushRadius] = useState(120);
  const [softness, setSoftness] = useState(0.72);
  const [showIndices, setShowIndices] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [hoverMouse, setHoverMouse] = useState(null);
  const [selectionRect, setSelectionRect] = useState(null);
  const [selectedIndices, setSelectedIndices] = useState([]);

  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  const meshWarp = useMemo(
    () => ensureMeshWarp(warp, wallW, wallH),
    [warp, wallW, wallH]
  );

  const selectedSet = useMemo(
    () => new Set(selectedIndices),
    [selectedIndices]
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
    setSelectedIndices([]);
    setWarp(createMeshWarp(wallW, wallH, meshWarp.cols || 5, meshWarp.rows || 5));
  };

  const changeDensity = (cols, rows) => {
    pushHistory(meshWarp);
    setSelectedIndices([]);
    setWarp(createMeshWarp(wallW, wallH, cols, rows));
  };

  const undo = () => {
    if (!history.length) return;

    const previous = history[history.length - 1];
    setFuture((prev) => [JSON.parse(JSON.stringify(meshWarp)), ...prev.slice(0, 29)]);
    setHistory((prev) => prev.slice(0, -1));
    setSelectedIndices([]);
    setWarp(previous);
  };

  const redo = () => {
    if (!future.length) return;

    const next = future[0];
    setHistory((prev) => [...prev.slice(-29), JSON.parse(JSON.stringify(meshWarp))]);
    setFuture((prev) => prev.slice(1));
    setSelectedIndices([]);
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

  const autoFitToSource = () => {
    const box = getBoundingBox(sourcePoints);
    if (!box) return;

    pushHistory(meshWarp);
    setSelectedIndices([]);

    const marginX = 8;
    const marginY = 8;

    const fitted = createMeshWarpFromBox(
      {
        minX: clamp(box.minX - marginX, 0, wallW),
        minY: clamp(box.minY - marginY, 0, wallH),
        maxX: clamp(box.maxX + marginX, 0, wallW),
        maxY: clamp(box.maxY + marginY, 0, wallH)
      },
      meshWarp.cols || 4,
      meshWarp.rows || 4
    );

    setWarp(fitted);
  };

  const clearSelection = () => {
    setSelectedIndices([]);
  };

  const selectAll = () => {
    setSelectedIndices(meshWarp.points.map((_, i) => i));
  };

  const pinSelected = () => {
    if (!selectedIndices.length) return;
    pushHistory(meshWarp);

    setWarp((prev) => {
      const next = ensureMeshWarp(prev, wallW, wallH);
      return {
        ...next,
        points: next.points.map((p, i) =>
          selectedSet.has(i) ? { ...p, pinned: true } : { ...p }
        )
      };
    });
  };

  const unpinSelected = () => {
    if (!selectedIndices.length) return;
    pushHistory(meshWarp);

    setWarp((prev) => {
      const next = ensureMeshWarp(prev, wallW, wallH);
      return {
        ...next,
        points: next.points.map((p, i) =>
          selectedSet.has(i) ? { ...p, pinned: false } : { ...p }
        )
      };
    });
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!ref.current) return;

      const m = getMouse(e);

      if (selectingRef.current && selectionStartRef.current) {
        setSelectionRect({
          x1: selectionStartRef.current.x,
          y1: selectionStartRef.current.y,
          x2: m.x,
          y2: m.y
        });
        return;
      }

      if (movingSelectionRef.current && selectedIndices.length) {
        const last = lastMouseRef.current || m;
        const dx = m.x - last.x;
        const dy = m.y - last.y;
        lastMouseRef.current = m;

        if (dx === 0 && dy === 0) return;

        setWarp((prev) => {
          const next = ensureMeshWarp(prev, wallW, wallH);
          const points = next.points.map((p) => ({ ...p }));

          for (let i = 0; i < points.length; i += 1) {
            if (!selectedSet.has(i)) continue;
            if (points[i].pinned) continue;

            points[i].x = clamp(points[i].x + dx, 0, wallW);
            points[i].y = clamp(points[i].y + dy, 0, wallH);
          }

          return {
            ...next,
            points
          };
        });

        return;
      }

      if (dragIndexRef.current === null) return;

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
      if (selectingRef.current && selectionRect) {
        const picked = [];

        meshWarp.points.forEach((p, i) => {
          if (pointInRect(p, selectionRect)) picked.push(i);
        });

        setSelectedIndices(picked);
      }

      dragIndexRef.current = null;
      lastMouseRef.current = null;
      selectingRef.current = false;
      selectionStartRef.current = null;
      movingSelectionRef.current = false;
      setSelectionRect(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [
    setWarp,
    wallW,
    wallH,
    brushRadius,
    softness,
    selectionRect,
    meshWarp.points,
    selectedIndices,
    selectedSet
  ]);

  const onMouseDown = (e) => {
    const m = getMouse(e);
    const index = hitPoint(m);

    if (selectMode) {
      if (index !== null && selectedSet.has(index)) {
        pushHistory(meshWarp);
        movingSelectionRef.current = true;
        lastMouseRef.current = m;
        return;
      }

      selectingRef.current = true;
      selectionStartRef.current = m;
      setSelectionRect({
        x1: m.x,
        y1: m.y,
        x2: m.x,
        y2: m.y
      });
      return;
    }

    if (index === null) return;

    if (pinMode || e.altKey) {
      togglePin(index);
      return;
    }

    pushHistory(meshWarp);
    dragIndexRef.current = index;
    lastMouseRef.current = m;
  };

  const onMouseMove = (e) => {
    if (!ref.current) return;
    setHoverMouse(getMouse(e));
  };

  const onMouseLeave = () => {
    setHoverMouse(null);
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
  const canAutoFit = sourceEnabled && Array.isArray(sourcePoints) && sourcePoints.length >= 3;

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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8
        }}
      >
        <button
          type="button"
          onClick={() => setPinMode((v) => !v)}
          style={pinMode ? ui.buttonPrimary : ui.button}
        >
          {pinMode ? "Pin mode: ON" : "Pin mode: OFF"}
        </button>

        <button
          type="button"
          onClick={() => setSelectMode((v) => !v)}
          style={selectMode ? ui.buttonPrimary : ui.button}
        >
          {selectMode ? "Select mode: ON" : "Select mode: OFF"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8
        }}
      >
        <button
          type="button"
          onClick={autoFitToSource}
          style={canAutoFit ? ui.button : { ...ui.button, opacity: 0.5, cursor: "not-allowed" }}
          disabled={!canAutoFit}
        >
          {autoFitLabel}
        </button>

        <button
          type="button"
          onClick={clearSelection}
          style={ui.button}
        >
          Clear selection
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8
        }}
      >
        <button type="button" onClick={selectAll} style={ui.button}>
          Select all
        </button>
        <button type="button" onClick={pinSelected} style={ui.button} disabled={!selectedIndices.length}>
          Pin selected
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8
        }}
      >
        <button
          type="button"
          onClick={unpinSelected}
          style={ui.button}
          disabled={!selectedIndices.length}
        >
          Unpin selected
        </button>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showIndices}
            onChange={(e) => setShowIndices(e.target.checked)}
          />
          Pokaż indeksy
        </label>
      </div>

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
        Normal mode: drag = miękki warp. <br />
        Shift + drag = tylko jeden punkt. <br />
        Pin mode lub Alt + klik = pin / unpin punktu. <br />
        Select mode = zaznaczanie prostokątem i przesuwanie grupy punktów. <br />
        Kółko pokazuje promień wpływu.
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
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          style={{
            position: "absolute",
            inset: 0,
            border: "1px solid #243041",
            borderRadius: 12,
            background: "#0b1220",
            overflow: "hidden",
            cursor: selectMode ? "default" : pinMode ? "pointer" : "crosshair"
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

            {hoverMouse && !pinMode && !selectMode && (
              <circle
                cx={hoverMouse.x}
                cy={hoverMouse.y}
                r={brushRadius}
                fill="rgba(56,189,248,0.08)"
                stroke="rgba(56,189,248,0.55)"
                strokeWidth="1.5"
                pointerEvents="none"
              />
            )}

            {selectionRect && (
              <rect
                x={Math.min(selectionRect.x1, selectionRect.x2)}
                y={Math.min(selectionRect.y1, selectionRect.y2)}
                width={Math.abs(selectionRect.x2 - selectionRect.x1)}
                height={Math.abs(selectionRect.y2 - selectionRect.y1)}
                fill="rgba(56,189,248,0.12)"
                stroke="rgba(56,189,248,0.95)"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
            )}

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

            {points.map((p, i) => {
              const isSelected = selectedSet.has(i);

              return (
                <g key={i}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSelected ? "9" : "7"}
                    fill={p.pinned ? "#ef4444" : isSelected ? "#1d4ed8" : "#0f172a"}
                    stroke={
                      p.pinned
                        ? "#fca5a5"
                        : isSelected
                        ? "#93c5fd"
                        : "#38bdf8"
                    }
                    strokeWidth={isSelected ? "3" : "2"}
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
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}