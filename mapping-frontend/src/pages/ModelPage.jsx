import { useEffect, useMemo, useState } from "react";
import CanvasEditor from "../components/CanvasEditor";
import WallScene from "../components/WallScene";
import Toolbar from "../components/Toolbar";
import MaskList from "../components/MaskList";
import ProjectionTexture from "../components/ProjectionTexture";
import ProjectorOutput from "../components/ProjectorOutput";
import {
  getMasks,
  createMask,
  deleteMask as apiDeleteMask,
  updateMask as apiUpdateMask
} from "../services/api";
import TopBar from "../components/layout/TopBar";
import BottomStatusBar from "../components/layout/BottomStatusBar";
import SidebarPanel from "../components/layout/SidebarPanel";
import ProjectorSettings from "../components/ProjectorSettings";
import WarpEditor from "../components/WarpEditor";
import { ui } from "../styles/ui";

// ===== stałe poza komponentem =====
const MODEL_ID = 1;
const WALL_W = 800;
const WALL_H = 500;
const MODEL_URL = "/models/fasada.glb";
const STORAGE_OUTPUT = "mapping_output_state_v1";

export default function ModelPage() {
  const isOutput =
    new URLSearchParams(window.location.search).get("output") === "1";

  // UI / preview
  const [renderMode, setRenderMode] = useState("plane"); // "plane" | "glb"

  // editor state
  const [mode, setMode] = useState("draw"); // draw/edit
  const [points, setPoints] = useState([]);
  const [isClosed, setIsClosed] = useState(false);

  // settings
  const [opacity, setOpacity] = useState(0.35);
  const [showGrid, setShowGrid] = useState(false);

  // warp / keystone
  const [warp, setWarp] = useState({
    tl: { x: 0, y: 0 },
    tr: { x: WALL_W, y: 0 },
    br: { x: WALL_W, y: WALL_H },
    bl: { x: 0, y: WALL_H }
  });

  // projector settings
  const [projector, setProjector] = useState({
    distance: 2.5,
    offsetX: 0,
    offsetY: 0,
    angleX: 0,
    angleY: 0,
    angleZ: 0
  });

  // mask data
  const [maskName, setMaskName] = useState("");
  const [maskType, setMaskType] = useState("window");

  // saved masks
  const [masks, setMasks] = useState([]);
  const [selectedMaskId, setSelectedMaskId] = useState(null);

  // output texture (canvas → three.js)
  const [projectionTexture, setProjectionTexture] = useState(null);

  // simple backend badge
  const [backendStatus] = useState("online");

  // ===== load masks =====
  useEffect(() => {
    (async () => {
      try {
        const data = await getMasks(MODEL_ID);
        setMasks(data);
      } catch (e) {
        console.error(e);
        alert("Nie udało się pobrać masek (sprawdź API / mock).");
      }
    })();
  }, []);

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
    setMaskType("window");
    setOpacity(0.35);
  };

  const exportJson = () => {
    if (!hasPolygon) return;

    const payload = {
      id: selectedMaskId,
      modelId: MODEL_ID,
      name: maskName.trim(),
      type: maskType,
      opacity,
      points: points.map((p) => ({
        x: Math.round(p.x),
        y: Math.round(p.y)
      }))
    };

    console.log("MASK JSON:", payload);
    alert("JSON maski poszedł do konsoli (F12 → Console).");
  };

  const saveNew = async () => {
    if (!canSaveNew) return;

    const payload = {
      name: maskName.trim(),
      type: maskType,
      opacity,
      points: points.map((p) => ({
        x: Math.round(p.x),
        y: Math.round(p.y)
      }))
    };

    try {
      const created = await createMask(MODEL_ID, payload);
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
      type: maskType,
      opacity,
      points: points.map((p) => ({
        x: Math.round(p.x),
        y: Math.round(p.y)
      }))
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
    setMaskType(mask.type || "window");
    setPoints(Array.isArray(mask.points) ? mask.points : []);
    setOpacity(typeof mask.opacity === "number" ? mask.opacity : 0.35);
    setIsClosed(true);
    setMode("edit");
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    resetDraft();
  };

  // ===== SYNC: Editor -> localStorage (dla output okna) =====
  useEffect(() => {
    if (isOutput) return;

    try {
      localStorage.setItem(
        STORAGE_OUTPUT,
        JSON.stringify({
          points,
          isClosed,
          opacity,
          showGrid,
          masks,
          warp,
          projector
        })
      );
    } catch {
      // ignore
    }
  }, [isOutput, points, isClosed, opacity, showGrid, masks, warp, projector]);

  // ===== OUTPUT VIEW (projektor) =====
  if (isOutput) {
    return (
      <div style={{ width: "100vw", height: "100vh", background: "black" }}>
        <ProjectorOutput wallW={WALL_W} wallH={WALL_H} />
      </div>
    );
  }

  const openOutput = () => {
    window.open(
      `${window.location.pathname}?output=1`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div style={ui.page} onContextMenu={handleContextMenu}>
      <TopBar
        renderMode={renderMode}
        masksCount={masks.length}
        backendStatus={backendStatus}
        onOpenOutput={openOutput}
      />

      <ProjectionTexture
        wallW={WALL_W}
        wallH={WALL_H}
        showGrid={showGrid}
        masks={masks}
        activePoints={points}
        opacity={opacity}
        onTexture={setProjectionTexture}
      />

      <div style={ui.shell}>
        <div style={ui.sidebar}>
          <SidebarPanel title="Mask editor">
            <Toolbar
              mode={mode}
              setMode={setMode}
              showGrid={showGrid}
              setShowGrid={setShowGrid}
              opacity={opacity}
              setOpacity={setOpacity}
              maskName={maskName}
              setMaskName={setMaskName}
              maskType={maskType}
              setMaskType={setMaskType}
              canSaveNew={canSaveNew}
              canUpdate={canUpdate}
              onSaveNew={saveNew}
              onUpdate={updateSelected}
              onReset={resetDraft}
              onExportJson={exportJson}
            />
          </SidebarPanel>

          <SidebarPanel title="Saved masks">
            <MaskList
              masks={masks}
              selectedMaskId={selectedMaskId}
              onSelect={handleSelectMask}
              onDelete={deleteMask}
            />
          </SidebarPanel>
        </div>

        <div style={ui.center}>
          <SidebarPanel title="3D preview">
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                style={renderMode === "plane" ? ui.buttonPrimary : ui.button}
                onClick={() => setRenderMode("plane")}
                type="button"
              >
                Plane
              </button>

              <button
                style={renderMode === "glb" ? ui.buttonPrimary : ui.button}
                onClick={() => setRenderMode("glb")}
                type="button"
              >
                GLB
              </button>
            </div>

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
              projector={projector}
/>
          </SidebarPanel>

          <SidebarPanel title="2D editor">
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
          </SidebarPanel>
        </div>

        <div style={ui.sidebar}>
          <SidebarPanel title="Projector settings">
            <ProjectorSettings
              projector={projector}
              setProjector={setProjector}
            />
          </SidebarPanel>

          <SidebarPanel title="Warp / Keystone">
            <WarpEditor
                warp={warp}
                setWarp={setWarp}
                wallW={300}
                wallH={220}
            />
          </SidebarPanel>
        </div>
      </div>

      <BottomStatusBar
        selectedMaskId={selectedMaskId}
        pointsCount={points.length}
        isClosed={isClosed}
        showGrid={showGrid}
        mode={mode}
      />
    </div>
  );
}