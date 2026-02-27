import { useEffect, useMemo, useState } from "react";
import CanvasEditor from "../components/CanvasEditor";
import Toolbar from "../components/Toolbar";
import MaskList from "../components/MaskList";
import {
  getMasks,
  createMask,
  deleteMask as apiDeleteMask,
  updateMask as apiUpdateMask
} from "../services/api";

export default function ModelPage() {
  const modelId = 1;

  // editor state
  const [mode, setMode] = useState("draw"); // draw/edit
  const [points, setPoints] = useState([]);
  const [isClosed, setIsClosed] = useState(false);

  // settings
  const [opacity, setOpacity] = useState(0.35);
  const [showGrid, setShowGrid] = useState(false);

  // mask name
  const [maskName, setMaskName] = useState("");

  // saved masks
  const [masks, setMasks] = useState([]);
  const [selectedMaskId, setSelectedMaskId] = useState(null);

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
  };

  const exportJson = () => {
    if (!hasPolygon) return;

    const payload = {
      id: selectedMaskId,
      name: maskName,
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
      // zostawiamy w edytorze jako aktualnie wybraną
    } catch (e) {
      console.error(e);
      alert("Nie udało się zapisać maski (sprawdź API / mock).");
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
      alert("Nie udało się zaktualizować maski (sprawdź API / mock).");
    }
  };

  const deleteMask = async (id) => {
    try {
      await apiDeleteMask(id);
      setMasks((prev) => prev.filter((m) => m.id !== id));
      if (selectedMaskId === id) resetDraft();
    } catch (e) {
      console.error(e);
      alert("Nie udało się usunąć maski (sprawdź API / mock).");
    }
  };

  const handleSelectMask = (id) => {
    const mask = masks.find((m) => m.id === id);
    if (!mask) return;

    setSelectedMaskId(id);
    setMaskName(mask.name || "");
    setPoints(mask.points || []);
    setOpacity(typeof mask.opacity === "number" ? mask.opacity : 0.35);
    setIsClosed(true);
    setMode("edit");
  };

  // PPM reset
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
        maskName={maskName}
        setMaskName={setMaskName}
        canSaveNew={canSaveNew}
        canUpdate={canUpdate}
        onSaveNew={saveNew}
        onUpdate={updateSelected}
        onReset={resetDraft}
        onExportJson={exportJson}
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
            Flow: narysuj poligon → zamknij zielonym punktem → wpisz nazwę → Save new.
            Kliknij maskę z listy → edytuj punkty → Update.
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
  left: { display: "flex", flexDirection: "column", gap: 12 },
  center: { display: "flex", flexDirection: "column", gap: 12 },
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