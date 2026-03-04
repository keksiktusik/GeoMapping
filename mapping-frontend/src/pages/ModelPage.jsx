import { useEffect, useMemo, useState } from "react";
import CanvasEditor from "../components/CanvasEditor";
import WallScene from "../components/WallScene";
import Toolbar from "../components/Toolbar";
import MaskList from "../components/MaskList";
import ProjectionTexture from "../components/ProjectionTexture";
import {
  getMasks,
  createMask,
  deleteMask as apiDeleteMask,
  updateMask as apiUpdateMask
} from "../services/api";

export default function ModelPage() {
  const modelId = 1;

  // (ważne: te wartości muszą zgadzać się z CanvasEditor i całym pipeline)
  const WALL_W = 800;
  const WALL_H = 500;

  // ✅ ścieżka do modelu (jak koleżanka wrzuci do public/models)
  const MODEL_URL = "/models/fasada.glb";

  // ✅ przełącznik trybu renderowania
  const [renderMode, setRenderMode] = useState("plane"); // "plane" | "glb"

  // editor state
  const [mode, setMode] = useState("draw"); // draw/edit
  const [points, setPoints] = useState([]);
  const [isClosed, setIsClosed] = useState(false);

  // settings
  const [opacity, setOpacity] = useState(0.35);
  const [showGrid, setShowGrid] = useState(false);

  // 4 rogi projekcji (warp / keystone) - używane głównie w trybie plane
  const [warp, setWarp] = useState({
    tl: { x: 0, y: 0 },
    tr: { x: WALL_W, y: 0 },
    br: { x: WALL_W, y: WALL_H },
    bl: { x: 0, y: WALL_H }
  });

  // mask name
  const [maskName, setMaskName] = useState("");

  // saved masks
  const [masks, setMasks] = useState([]);
  const [selectedMaskId, setSelectedMaskId] = useState(null);

  // 🔥 output texture (canvas → three.js)
  const [projectionTexture, setProjectionTexture] = useState(null);

  // load masks on start
  useEffect(() => {
    (async () => {
      try {
        const data = await getMasks(modelId);
        setMasks(data);
      } catch (e) {
        console.error(e);
        alert("Nie udało się pobrać masek (sprawdź API / mock).");
      }
    })();
  }, [modelId]);

  const hasPolygon = useMemo(
    () => isClosed && points.length >= 3,
    [isClosed, points.length]
  );

  const canSaveNew = useMemo(
    () => hasPolygon && maskName.trim().length > 0,
    [hasPolygon, maskName]
  );

  const canUpdate = useMemo(
    () => selectedMaskId !== null && hasPolygon && maskName.trim().length > 0,
    [selectedMaskId, hasPolygon, maskName]
  );

  const resetDraft = () => {
    setPoints([]);
    setIsClosed(false);
    setMode("draw");
    setSelectedMaskId(null);
    setMaskName("");
    setOpacity(0.35);
  };

  const exportJson = () => {
    if (!hasPolygon) return;

    const payload = {
      id: selectedMaskId,
      modelId,
      name: maskName.trim(),
      type: "polygon",
      opacity,
      points: points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))
    };

    console.log("MASK JSON:", payload);
    alert("JSON maski poszedł do konsoli (F12 → Console).");
  };

  const saveNew = async () => {
    if (!canSaveNew) return;

    const payload = {
      name: maskName.trim(),
      type: "polygon",
      opacity,
      points: points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))
    };

    try {
      const created = await createMask(modelId, payload);
      setMasks((prev) => [created, ...prev]);
      setSelectedMaskId(created.id);
      setMode("edit");
    } catch (e) {
      console.error(e);
      alert("Nie udało się zapisać maski (sprawdź API / backend).");
    }
  };

  const updateSelected = async () => {
    if (!canUpdate) return;

    const patch = {
      name: maskName.trim(),
      opacity,
      points: points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))
    };

    try {
      const updated = await apiUpdateMask(selectedMaskId, patch);
      setMasks((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      alert("Zaktualizowano maskę ✅");
    } catch (e) {
      console.error(e);
      alert("Nie udało się zaktualizować maski (sprawdź API / backend).");
    }
  };

  const deleteMask = async (id) => {
    try {
      await apiDeleteMask(id);
      setMasks((prev) => prev.filter((m) => m.id !== id));
      if (selectedMaskId === id) resetDraft();
    } catch (e) {
      console.error(e);
      alert("Nie udało się usunąć maski (sprawdź API / backend).");
    }
  };

  const handleSelectMask = (id) => {
    const mask = masks.find((m) => m.id === id);
    if (!mask) return;

    setSelectedMaskId(id);
    setMaskName(mask.name || "");
    setPoints(Array.isArray(mask.points) ? mask.points : []);
    setOpacity(typeof mask.opacity === "number" ? mask.opacity : 0.35);
    setIsClosed(true);
    setMode("edit");
  };

  // PPM reset (opcjonalnie)
  const handleContextMenu = (e) => {
    e.preventDefault();
    resetDraft();
  };

  return (
    <div style={styles.page} onContextMenu={handleContextMenu}>
      <h2 style={{ margin: 0 }}>3D Mapping – Ściana + Okno (Maska)</h2>

      <Toolbar
        mode={mode}
        setMode={setMode}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        opacity={opacity}
        setOpacity={setOpacity}
        maskName={maskName}
        setMaskName={setMaskName}
        canSaveNew={canSaveNew}
        canUpdate={canUpdate}
        onSaveNew={saveNew}
        onUpdate={updateSelected}
        onReset={resetDraft}
        onExportJson={exportJson}
      />

      {/* ✅ PRZEŁĄCZNIK TRYBU */}
      <div style={styles.modeBar}>
        <span style={styles.modeLabel}>Tryb podglądu:</span>

        <button
          style={{
            ...styles.modeBtn,
            ...(renderMode === "plane" ? styles.modeBtnActive : null)
          }}
          onClick={() => setRenderMode("plane")}
          type="button"
        >
          PLANE (test + warp)
        </button>

        <button
          style={{
            ...styles.modeBtn,
            ...(renderMode === "glb" ? styles.modeBtnActive : null)
          }}
          onClick={() => setRenderMode("glb")}
          type="button"
        >
          GLB (UV z Blendera)
        </button>

        <span style={styles.modeHint}>
          Model: <code>{MODEL_URL}</code>
        </span>
      </div>

      {/* 🔥 To generuje teksturę wynikową (tło + grid + zapisane maski + aktualna maska) */}
      <ProjectionTexture
        wallW={WALL_W}
        wallH={WALL_H}
        showGrid={showGrid}
        masks={masks}
        activePoints={points}
        opacity={opacity}
        onTexture={setProjectionTexture}
      />

      <div style={styles.main}>
        <div style={styles.left}>
          <MaskList
            masks={masks}
            selectedMaskId={selectedMaskId}
            onSelect={handleSelectMask}
            onDelete={deleteMask}
          />

          <div style={styles.tip}>
            Demo: projekcja + maski. Tryb <b>PLANE</b> jest do testów i warpa. Tryb <b>GLB</b> zadziała,
            gdy w repo będzie <code>public/models/fasada.glb</code> z UV.
          </div>
        </div>

        <div style={styles.center}>
          {/* PODGLĄD 3D (mapping) */}
          <div style={styles.block}>
            <div style={styles.blockTitle}>Podgląd 3D</div>

            <WallScene
              renderMode={renderMode}
              modelUrl={MODEL_URL}
              points={hasPolygon ? points : []}
              opacity={opacity}
              showGrid={showGrid}
              warp={warp}
              wallW={WALL_W}
              wallH={WALL_H}
              projectionTexture={projectionTexture}
            />
          </div>

          {/* EDYTOR 2D */}
          <div style={styles.block}>
            <div style={styles.blockTitle}>Edytor 2D (rysowanie i kalibracja maski)</div>
            <CanvasEditor
              mode={mode}
              setMode={setMode}
              points={points}
              setPoints={setPoints}
              isClosed={isClosed}
              setIsClosed={setIsClosed}
              opacity={opacity}
              showGrid={showGrid}
              wallW={WALL_W}
              wallH={WALL_H}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: 24,
    fontFamily: "sans-serif",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    background: "#fafafa",
    minHeight: "100vh"
  },
  modeBar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 10,
    padding: 10
  },
  modeLabel: {
    fontSize: 13,
    color: "#444",
    fontWeight: 600
  },
  modeBtn: {
    border: "1px solid #ddd",
    background: "#f7f7f7",
    padding: "8px 10px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13
  },
  modeBtnActive: {
    background: "#e9f0ff",
    border: "1px solid #9db9ff"
  },
  modeHint: {
    marginLeft: "auto",
    fontSize: 12,
    color: "#666"
  },
  main: {
    display: "flex",
    gap: 16,
    alignItems: "flex-start"
  },
  left: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: 360
  },
  center: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    flex: 1
  },
  block: {
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 10,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10
  },
  blockTitle: {
    fontSize: 13,
    color: "#444",
    fontWeight: 600
  },
  tip: {
    border: "1px solid #eee",
    borderRadius: 8,
    background: "#fff",
    padding: 12,
    color: "#444",
    fontSize: 13
  }
};