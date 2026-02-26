import { useEffect, useMemo, useState } from "react";
import CanvasEditor from "../components/CanvasEditor";
import Toolbar from "../components/Toolbar";
import MaskList from "../components/MaskList";
import { getMasks, createMask, deleteMask as apiDeleteMask } from "../services/api";

export default function ModelPage() {
  const modelId = 1;

  // editor state
  const [mode, setMode] = useState("draw"); // draw/edit
  const [points, setPoints] = useState([]);
  const [isClosed, setIsClosed] = useState(false);

  // settings
  const [opacity, setOpacity] = useState(0.35);
  const [showGrid, setShowGrid] = useState(false);

  // saved masks
  const [masks, setMasks] = useState([]);
  const [selectedMaskId, setSelectedMaskId] = useState(null);

  // load masks on start (mock or real API)
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

  const canSave = useMemo(
    () => isClosed && points.length >= 3,
    [isClosed, points.length]
  );

  const resetDraft = () => {
    setPoints([]);
    setIsClosed(false);
    setMode("draw");
  };

  const exportJson = () => {
    if (!canSave) return;

    const payload = {
      type: "polygon",
      opacity,
      points: points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))
    };

    console.log("MASK JSON:", payload);
    alert("JSON maski poszedł do konsoli (F12 → Console).");
  };

  const saveMask = async () => {
    if (!canSave) return;

    const payload = {
      name: `Mask ${masks.length + 1}`,
      type: "polygon",
      opacity,
      points: points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))
    };

    try {
      const created = await createMask(modelId, payload);
      setMasks((prev) => [created, ...prev]);
      setSelectedMaskId(created.id);
      resetDraft();
    } catch (e) {
      console.error(e);
      alert("Nie udało się zapisać maski (sprawdź API / mock).");
    }
  };

  const deleteMask = async (id) => {
    try {
      await apiDeleteMask(id);
      setMasks((prev) => prev.filter((m) => m.id !== id));
      if (selectedMaskId === id) setSelectedMaskId(null);
    } catch (e) {
      console.error(e);
      alert("Nie udało się usunąć maski (sprawdź API / mock).");
    }
  };

  // PPM reset roboczej maski
  const handleContextMenu = (e) => {
    e.preventDefault();
    resetDraft();
  };

  return (
    <div style={styles.page} onContextMenu={handleContextMenu}>
      <h2 style={{ margin: 0 }}>3D Mapping – Mask Editor</h2>

      <Toolbar
        mode={mode}
        setMode={setMode}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        opacity={opacity}
        setOpacity={setOpacity}
        canSave={canSave}
        onSave={saveMask}
        onReset={resetDraft}
        onExportJson={exportJson}
      />

      <div style={styles.main}>
        <div style={styles.left}>
          <MaskList
            masks={masks}
            selectedMaskId={selectedMaskId}
            onSelect={setSelectedMaskId}
            onDelete={deleteMask}
          />

          <div style={styles.tip}>
            Tip: narysuj poligon → kliknij zielony punkt aby zamknąć → Save /
            Export JSON. (PPM = reset roboczej maski)
          </div>
        </div>

        <div style={styles.center}>
          <CanvasEditor
            mode={mode}
            setMode={setMode}
            points={points}
            setPoints={setPoints}
            isClosed={isClosed}
            setIsClosed={setIsClosed}
            opacity={opacity}
            showGrid={showGrid}
          />
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
  main: {
    display: "flex",
    gap: 16,
    alignItems: "flex-start"
  },
  left: {
    display: "flex",
    flexDirection: "column",
    gap: 12
  },
  center: {
    display: "flex",
    flexDirection: "column",
    gap: 12
  },
  tip: {
    width: 340,
    border: "1px solid #eee",
    borderRadius: 8,
    background: "#fff",
    padding: 12,
    color: "#444",
    fontSize: 13
  }
};