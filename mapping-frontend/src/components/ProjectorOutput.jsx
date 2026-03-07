import { useEffect, useState } from "react";

const STORAGE_KEY = "mapping_output_state_v1";

function safeParse(json, fallback) {
  try {
    return json ? JSON.parse(json) : fallback;
  } catch {
    return fallback;
  }
}

export default function ProjectorOutput({ wallW = 800, wallH = 500 }) {
  const [state, setState] = useState(() =>
    safeParse(localStorage.getItem(STORAGE_KEY), {
      points: [],
      isClosed: false,
      opacity: 1,
      showGrid: false,
      masks: [],
      warp: null,
      projector: {
        distance: 2.5,
        offsetX: 0,
        offsetY: 0,
        angleX: 0,
        angleY: 0,
        angleZ: 0
      }
    })
  );

  useEffect(() => {
    const sync = () => {
      setState(
        safeParse(localStorage.getItem(STORAGE_KEY), {
          points: [],
          isClosed: false,
          opacity: 1,
          showGrid: false,
          masks: [],
          warp: null,
          projector: {
            distance: 2.5,
            offsetX: 0,
            offsetY: 0,
            angleX: 0,
            angleY: 0,
            angleZ: 0
          }
        })
      );
    };

    window.addEventListener("storage", sync);
    const interval = setInterval(sync, 250);

    return () => {
      window.removeEventListener("storage", sync);
      clearInterval(interval);
    };
  }, []);

  const { showGrid, masks, opacity, projector } = state;

  const pxX = Number(projector?.offsetX || 0) * 20;
  const pxY = Number(projector?.offsetY || 0) * 20;
  const rot = Number(projector?.angleZ || 0);
  const scale = 1 + (Number(projector?.distance || 2.5) - 2.5) * 0.08;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "black",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          width: wallW,
          height: wallH,
          position: "relative",
          background: "#ff4fbf",
          transform: `translate(${pxX}px, ${pxY}px) rotate(${rot}deg) scale(${scale})`,
          transformOrigin: "center center",
          transition: "transform 120ms linear"
        }}
      >
        {showGrid && (
          <Grid wallW={wallW} wallH={wallH} />
        )}

        {masks.map((mask) => (
          <PolygonMask
            key={mask.id}
            points={mask.points || []}
            opacity={typeof mask.opacity === "number" ? mask.opacity : opacity}
            wallW={wallW}
            wallH={wallH}
          />
        ))}
      </div>
    </div>
  );
}

function Grid({ wallW, wallH }) {
  const lines = [];
  const step = 40;

  for (let x = 0; x <= wallW; x += step) {
    lines.push(
      <line
        key={`vx-${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={wallH}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1"
      />
    );
  }

  for (let y = 0; y <= wallH; y += step) {
    lines.push(
      <line
        key={`hy-${y}`}
        x1={0}
        y1={y}
        x2={wallW}
        y2={y}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1"
      />
    );
  }

  return (
    <svg
      width={wallW}
      height={wallH}
      style={{ position: "absolute", inset: 0 }}
    >
      {lines}
    </svg>
  );
}

function PolygonMask({ points, opacity, wallW, wallH }) {
  if (!Array.isArray(points) || points.length < 3) return null;

  return (
    <svg
      width={wallW}
      height={wallH}
      style={{ position: "absolute", inset: 0 }}
    >
      <polygon
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill={`rgba(0,0,0,${opacity})`}
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="2"
      />
    </svg>
  );
}