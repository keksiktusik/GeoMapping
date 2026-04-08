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

const MODEL_ID = 1;
const WALL_W = 800;
const WALL_H = 500;
const STORAGE_OUTPUT = "mapping_output_state_v1";
const SCENE_PRESETS_KEY = "mapping_scene_presets_v1";
const DEFAULT_VIDEO_PATH = "/videos/pociag.mp4";

const MODEL_CONFIG = {
  mickiewicz: {
    label: "Szkoła im. Adama Mickiewicza",
    url: "/models/fasada.glb",
    enabled: true
  },
  kolejowa: {
    label: "Fasada szkoły Kolejowej",
    url: "/models/fasada2.glb",
    enabled: true
  },
  dworzec: {
    label: "Dworzec Główny",
    url: "/models/fasada3.glb",
    enabled: false
  }
};

function safeParse(json, fallback) {
  try {
    return json ? JSON.parse(json) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeTextureValue(type, value) {
  if (type === "color") return value || "#ffffff";
  if (type === "image") return value || "/projection.jpg";
  if (type === "video") return value || DEFAULT_VIDEO_PATH;
  return value || "#ffffff";
}

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

function ensureMeshWarp(warp, wallW, wallH, cols = 5, rows = 5) {
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

  return createMeshWarp(wallW, wallH, cols, rows);
}

function resolveUpdater(currentValue, nextValueOrFn) {
  return typeof nextValueOrFn === "function"
    ? nextValueOrFn(currentValue)
    : nextValueOrFn;
}

function getStoredEditorState() {
  if (typeof window === "undefined") return {};
  return safeParse(localStorage.getItem(STORAGE_OUTPUT), {});
}

function getStoredScenePresets() {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(SCENE_PRESETS_KEY), []);
}

function offsetPoints(points, dx, dy, wallW, wallH) {
  return (points || []).map((p) => ({
    x: Math.max(0, Math.min(wallW, Number(p.x || 0) + dx)),
    y: Math.max(0, Math.min(wallH, Number(p.y || 0) + dy))
  }));
}

function offsetWarp(warp, dx, dy, wallW, wallH, cols = 4, rows = 4) {
  const mesh = ensureMeshWarp(warp, wallW, wallH, cols, rows);

  return {
    ...mesh,
    points: mesh.points.map((p) => ({
      ...p,
      x: Math.max(0, Math.min(wallW, Number(p.x || 0) + dx)),
      y: Math.max(0, Math.min(wallH, Number(p.y || 0) + dy))
    }))
  };
}

function normalizeIncomingMasks(list) {
  return (Array.isArray(list) ? list : []).map((m) => ({
    ...m,
    visible: m.visible !== false,
    locked: Boolean(m.locked),
    zIndex: typeof m.zIndex === "number" ? m.zIndex : 0
  }));
}

function sortMasksByZIndex(list) {
  return [...list].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}

export default function ModelPage() {
  const isOutput =
    new URLSearchParams(window.location.search).get("output") === "1";

  const stored = useMemo(() => getStoredEditorState(), []);
  const [scenePresets, setScenePresets] = useState(() => getStoredScenePresets());
  const [sceneName, setSceneName] = useState("");

  const [renderMode, setRenderMode] = useState(
    stored?.renderMode === "plane" ? "plane" : "glb"
  );

  const [selectedModelKey, setSelectedModelKey] = useState(() => {
    const key = stored?.selectedModelKey;
    return MODEL_CONFIG[key] ? key : "mickiewicz";
  });

  const selectedModel = useMemo(() => {
    return MODEL_CONFIG[selectedModelKey] || MODEL_CONFIG.mickiewicz;
  }, [selectedModelKey]);

  const selectedModelUrl = selectedModel.url;
  const selectedModelEnabled = selectedModel.enabled !== false;

  const [outputSurfaceMode, setOutputSurfaceMode] = useState(() => {
    const mode = stored?.outputSurfaceMode;
    if (mode === "glb" || mode === "lightGlb" || mode === "plane") {
      return mode;
    }
    return "lightGlb";
  });

  const [outputModelUrl, setOutputModelUrl] = useState(
    stored?.outputModelUrl || selectedModelUrl
  );

  const [mode, setMode] = useState("draw");
  const [points, setPoints] = useState([]);
  const [isClosed, setIsClosed] = useState(false);

  const [opacity, setOpacity] = useState(0.35);
  const [showGrid, setShowGrid] = useState(Boolean(stored?.showGrid));
  const [showPinkBackground, setShowPinkBackground] = useState(
    stored?.showPinkBackground !== false
  );

  const [warp, setWarp] = useState(() =>
    ensureMeshWarp(stored?.warp, WALL_W, WALL_H, 5, 5)
  );

  const [maskWarps, setMaskWarps] = useState(() => {
    const raw = stored?.maskWarps || {};
    const normalized = {};

    Object.entries(raw).forEach(([key, value]) => {
      normalized[key] = ensureMeshWarp(value, WALL_W, WALL_H, 4, 4);
    });

    return normalized;
  });

  const [draftLocalWarp, setDraftLocalWarp] = useState(() =>
    ensureMeshWarp(stored?.draftLocalWarp, WALL_W, WALL_H, 4, 4)
  );

  const [projector, setProjector] = useState({
    distance: 2.5,
    offsetX: 0,
    offsetY: 0,
    angleX: 0,
    angleY: 0,
    angleZ: 0,
    fov: 45
  });

  const [maskName, setMaskName] = useState("");
  const [maskType, setMaskType] = useState("window");
  const [operation, setOperation] = useState("add");
  const [zIndex, setZIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [locked, setLocked] = useState(false);
  const [layerName, setLayerName] = useState("default");

  const [textureType, setTextureType] = useState("color");
  const [textureValue, setTextureValue] = useState("#ffffff");

  const [masks, setMasks] = useState([]);
  const [selectedMaskId, setSelectedMaskId] = useState(null);

  const [projectionTexture, setProjectionTexture] = useState(null);
  const [backendStatus] = useState("online");

  useEffect(() => {
    (async () => {
      try {
        const data = await getMasks(MODEL_ID);
        const normalizedMasks = normalizeIncomingMasks(data);

        setMasks(sortMasksByZIndex(normalizedMasks));

        const nextWarps = {};
        normalizedMasks.forEach((m) => {
          nextWarps[m.id] = ensureMeshWarp(m.localWarp, WALL_W, WALL_H, 4, 4);
        });
        setMaskWarps(nextWarps);
      } catch (e) {
        console.error(e);
        alert("Nie udało się pobrać masek (sprawdź API / mock).");
      }
    })();
  }, []);

  useEffect(() => {
    if (renderMode === "glb" && selectedModelEnabled) {
      setOutputModelUrl(selectedModelUrl);
    }
  }, [selectedModelUrl, renderMode, selectedModelEnabled]);

  useEffect(() => {
    localStorage.setItem(SCENE_PRESETS_KEY, JSON.stringify(scenePresets));
  }, [scenePresets]);

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

  const canDuplicate = useMemo(
    () => selectedMaskId !== null && hasPolygon,
    [selectedMaskId, hasPolygon]
  );

  const normalizedTextureValue = useMemo(
    () => normalizeTextureValue(textureType, textureValue),
    [textureType, textureValue]
  );

  const selectedOrDraftLocalWarp = useMemo(() => {
    if (selectedMaskId !== null) {
      return ensureMeshWarp(maskWarps[selectedMaskId], WALL_W, WALL_H, 4, 4);
    }

    return ensureMeshWarp(draftLocalWarp, WALL_W, WALL_H, 4, 4);
  }, [selectedMaskId, maskWarps, draftLocalWarp]);

  const setSelectedOrDraftLocalWarp = (nextValueOrFn) => {
    if (selectedMaskId !== null) {
      setMaskWarps((prev) => {
        const current = ensureMeshWarp(prev[selectedMaskId], WALL_W, WALL_H, 4, 4);
        const next = resolveUpdater(current, nextValueOrFn);

        return {
          ...prev,
          [selectedMaskId]: ensureMeshWarp(next, WALL_W, WALL_H, 4, 4)
        };
      });
      return;
    }

    setDraftLocalWarp((prev) => {
      const current = ensureMeshWarp(prev, WALL_W, WALL_H, 4, 4);
      const next = resolveUpdater(current, nextValueOrFn);
      return ensureMeshWarp(next, WALL_W, WALL_H, 4, 4);
    });
  };

  const masksWithLocalWarp = useMemo(
    () =>
      masks.map((m) => ({
        ...m,
        localWarp: maskWarps[m.id]
          ? ensureMeshWarp(maskWarps[m.id], WALL_W, WALL_H, 4, 4)
          : null
      })),
    [masks, maskWarps]
  );

  const activeDraft = useMemo(
    () => ({
      id: selectedMaskId ?? "__draft__",
      name: maskName,
      type: maskType,
      operation,
      zIndex,
      visible,
      locked,
      layerName,
      textureType,
      textureValue: normalizedTextureValue,
      points,
      opacity,
      isClosed,
      localWarp: selectedOrDraftLocalWarp
    }),
    [
      selectedMaskId,
      maskName,
      maskType,
      operation,
      zIndex,
      visible,
      locked,
      layerName,
      textureType,
      normalizedTextureValue,
      points,
      opacity,
      isClosed,
      selectedOrDraftLocalWarp
    ]
  );

  const resetDraft = () => {
    setPoints([]);
    setIsClosed(false);
    setMode("draw");
    setSelectedMaskId(null);
    setMaskName("");
    setMaskType("window");
    setOperation("add");
    setZIndex(0);
    setVisible(true);
    setLocked(false);
    setLayerName("default");
    setTextureType("color");
    setTextureValue("#ffffff");
    setOpacity(0.35);
    setDraftLocalWarp(createMeshWarp(WALL_W, WALL_H, 4, 4));
  };

  const exportJson = () => {
    if (!hasPolygon) return;

    const payload = {
      id: selectedMaskId,
      modelId: MODEL_ID,
      name: maskName.trim(),
      type: maskType,
      operation,
      zIndex,
      visible,
      locked,
      layerName,
      textureType,
      textureValue: normalizedTextureValue,
      opacity,
      points: points.map((p) => ({
        x: Math.round(p.x),
        y: Math.round(p.y)
      })),
      localWarp:
        selectedMaskId !== null ? maskWarps[selectedMaskId] || null : draftLocalWarp
    };

    console.log("MASK JSON:", payload);
    alert("JSON maski poszedł do konsoli.");
  };

  const saveNew = async () => {
    if (!canSaveNew) return;

    const localWarp = ensureMeshWarp(draftLocalWarp, WALL_W, WALL_H, 4, 4);

    const payload = {
      name: maskName.trim(),
      type: maskType,
      operation,
      zIndex,
      visible,
      locked,
      layerName,
      textureType,
      textureValue: normalizedTextureValue,
      opacity,
      points: points.map((p) => ({
        x: Math.round(p.x),
        y: Math.round(p.y)
      })),
      localWarp
    };

    try {
      const created = await createMask(MODEL_ID, payload);

      setMasks((prev) =>
        sortMasksByZIndex([...prev, { ...created, visible: created.visible !== false }])
      );

      setMaskWarps((prev) => ({
        ...prev,
        [created.id]: ensureMeshWarp(created.localWarp || localWarp, WALL_W, WALL_H, 4, 4)
      }));

      setSelectedMaskId(created.id);
      setMode("edit");
    } catch (e) {
      console.error(e);
      alert("Nie udało się zapisać maski (sprawdź API / backend).");
    }
  };

  const updateSelected = async () => {
    if (!canUpdate) return;

    const localWarp = ensureMeshWarp(
      selectedOrDraftLocalWarp,
      WALL_W,
      WALL_H,
      4,
      4
    );

    const patch = {
      name: maskName.trim(),
      type: maskType,
      operation,
      zIndex,
      visible,
      locked,
      layerName,
      textureType,
      textureValue: normalizedTextureValue,
      opacity,
      points: points.map((p) => ({
        x: Math.round(p.x),
        y: Math.round(p.y)
      })),
      localWarp
    };

    try {
      const updated = await apiUpdateMask(selectedMaskId, patch);

      setMasks((prev) =>
        sortMasksByZIndex(
          prev.map((m) =>
            m.id === updated.id
              ? {
                  ...updated,
                  visible: updated.visible !== false,
                  locked: Boolean(updated.locked)
                }
              : m
          )
        )
      );

      setMaskWarps((prev) => ({
        ...prev,
        [updated.id]: ensureMeshWarp(updated.localWarp || localWarp, WALL_W, WALL_H, 4, 4)
      }));

      alert("Zaktualizowano maskę ✅");
    } catch (e) {
      console.error(e);
      alert("Nie udało się zaktualizować maski (sprawdź API / backend).");
    }
  };

  const duplicateSelected = async () => {
    if (!canDuplicate) return;

    const dx = 24;
    const dy = 18;

    const duplicatedPoints = offsetPoints(points, dx, dy, WALL_W, WALL_H);
    const duplicatedWarp = offsetWarp(
      selectedOrDraftLocalWarp,
      dx,
      dy,
      WALL_W,
      WALL_H,
      4,
      4
    );

    const payload = {
      name: `${maskName.trim() || "Mask"} copy`,
      type: maskType,
      operation,
      zIndex: Number(zIndex || 0) + 1,
      visible,
      locked,
      layerName,
      textureType,
      textureValue: normalizedTextureValue,
      opacity,
      points: duplicatedPoints.map((p) => ({
        x: Math.round(p.x),
        y: Math.round(p.y)
      })),
      localWarp: duplicatedWarp
    };

    try {
      const created = await createMask(MODEL_ID, payload);

      setMasks((prev) =>
        sortMasksByZIndex([...prev, { ...created, visible: created.visible !== false }])
      );

      setMaskWarps((prev) => ({
        ...prev,
        [created.id]: ensureMeshWarp(created.localWarp || duplicatedWarp, WALL_W, WALL_H, 4, 4)
      }));

      setSelectedMaskId(created.id);
      setMaskName(created.name || payload.name);
      setMaskType(payload.type);
      setOperation(payload.operation);
      setZIndex(payload.zIndex);
      setVisible(payload.visible);
      setLocked(payload.locked);
      setLayerName(payload.layerName);
      setTextureType(payload.textureType);
      setTextureValue(payload.textureValue);
      setPoints(duplicatedPoints);
      setOpacity(payload.opacity);
      setIsClosed(true);
      setMode("edit");

      alert("Utworzono kopię maski ✅");
    } catch (e) {
      console.error(e);
      alert("Nie udało się zduplikować maski.");
    }
  };

  const deleteMask = async (id) => {
    try {
      await apiDeleteMask(id);

      setMasks((prev) => prev.filter((m) => m.id !== id));
      setMaskWarps((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      if (selectedMaskId === id) {
        resetDraft();
      }
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
    setOperation(mask.operation || "add");
    setZIndex(typeof mask.zIndex === "number" ? mask.zIndex : 0);
    setVisible(mask.visible !== false);
    setLocked(Boolean(mask.locked));
    setLayerName(mask.layerName || "default");

    const nextTextureType = mask.textureType || "color";
    const nextTextureValue = normalizeTextureValue(
      nextTextureType,
      mask.textureValue
    );

    setTextureType(nextTextureType);
    setTextureValue(nextTextureValue);

    setPoints(Array.isArray(mask.points) ? mask.points : []);
    setOpacity(typeof mask.opacity === "number" ? mask.opacity : 0.35);
    setIsClosed(true);
    setMode("edit");

    setMaskWarps((prev) => ({
      ...prev,
      [id]: ensureMeshWarp(mask.localWarp || prev[id], WALL_W, WALL_H, 4, 4)
    }));
  };

   const patchMaskLocal = async (id, patch) => {
  const current = masks.find((m) => m.id === id);
  if (!current) return null;

  const merged = { ...current, ...patch };

  try {
    const updatedRaw = await apiUpdateMask(id, {
      name: merged.name,
      type: merged.type,
      operation: merged.operation,
      zIndex: merged.zIndex,
      visible: merged.visible,
      locked: merged.locked,
      layerName: merged.layerName,
      textureType: merged.textureType,
      textureValue: merged.textureValue,
      opacity: merged.opacity,
      points: (merged.points || []).map((p) => ({
        x: Math.round(p.x),
        y: Math.round(p.y)
      })),
      localWarp: maskWarps[id] || merged.localWarp || null
    });

    const updated = {
      ...updatedRaw,
      visible: updatedRaw.visible !== false,
      locked: Boolean(updatedRaw.locked),
      zIndex:
        typeof updatedRaw.zIndex === "number"
          ? updatedRaw.zIndex
          : Number(updatedRaw.zIndex || 0)
    };

    setMasks((prev) =>
      sortMasksByZIndex(
        prev.map((m) => (m.id === id ? updated : m))
      )
    );

    setMaskWarps((prev) => ({
      ...prev,
      [id]: ensureMeshWarp(
        updated.localWarp || maskWarps[id] || merged.localWarp,
        WALL_W,
        WALL_H,
        4,
        4
      )
    }));

    if (selectedMaskId === id) {
      setMaskName(updated.name || "");
      setMaskType(updated.type || "window");
      setOperation(updated.operation || "add");
      setZIndex(typeof updated.zIndex === "number" ? updated.zIndex : 0);
      setVisible(updated.visible !== false);
      setLocked(Boolean(updated.locked));
      setLayerName(updated.layerName || "default");

      const nextTextureType = updated.textureType || "color";
      const nextTextureValue = normalizeTextureValue(
        nextTextureType,
        updated.textureValue
      );

      setTextureType(nextTextureType);
      setTextureValue(nextTextureValue);

      setPoints(Array.isArray(updated.points) ? updated.points : []);
      setOpacity(typeof updated.opacity === "number" ? updated.opacity : 0.35);
      setIsClosed(true);
      setMode("edit");
    }

    return updated;
  } catch (e) {
    console.error(e);
    alert("Nie udało się wykonać akcji na masce.");
    return null;
  }
};

  const toggleMaskVisible = async (id) => {
    const mask = masks.find((m) => m.id === id);
    if (!mask) return;
    await patchMaskLocal(id, { visible: !mask.visible });
  };

  const toggleMaskLocked = async (id) => {
    const mask = masks.find((m) => m.id === id);
    if (!mask) return;
    await patchMaskLocal(id, { locked: !mask.locked });
  };

  const moveMaskBy = async (id, delta) => {
    const mask = masks.find((m) => m.id === id);
    if (!mask) return;
    await patchMaskLocal(id, { zIndex: Number(mask.zIndex || 0) + delta });
  };

  const soloMask = async (id) => {
    const target = masks.find((m) => m.id === id);
    if (!target) return;

    const currentlySolo =
      target.visible !== false &&
      masks.every((m) => (m.id === id ? m.visible !== false : m.visible === false));

    if (currentlySolo) {
      await Promise.all(
        masks.map((m) =>
          patchMaskLocal(m.id, {
            visible: true
          })
        )
      );
      return;
    }

    await Promise.all(
      masks.map((m) =>
        patchMaskLocal(m.id, {
          visible: m.id === id
        })
      )
    );
  };

  const quickShowAll = async () => {
    await Promise.all(masks.map((m) => patchMaskLocal(m.id, { visible: true })));
  };

  const quickHideAll = async () => {
    await Promise.all(masks.map((m) => patchMaskLocal(m.id, { visible: false })));
  };

  const quickBlackout = async () => {
    await quickHideAll();
  };

  const quickUnlockAll = async () => {
    await Promise.all(masks.map((m) => patchMaskLocal(m.id, { locked: false })));
  };

  const quickResetGlobalWarp = () => {
    setWarp(createMeshWarp(WALL_W, WALL_H, 5, 5));
  };

  const saveScenePreset = () => {
    const name = sceneName.trim();
    if (!name) {
      alert("Podaj nazwę sceny.");
      return;
    }

    const snapshot = {
      id: `${Date.now()}`,
      name,
      createdAt: Date.now(),
      selectedModelKey,
      renderMode,
      outputSurfaceMode,
      outputModelUrl,
      projector,
      warp,
      masks: masks.map((m) => ({
        id: m.id,
        visible: m.visible !== false,
        locked: Boolean(m.locked),
        zIndex: m.zIndex ?? 0,
        opacity: typeof m.opacity === "number" ? m.opacity : 1,
        operation: m.operation || "add",
        textureType: m.textureType || "color",
        textureValue: m.textureValue || "#ffffff",
        layerName: m.layerName || "default"
      }))
    };

    setScenePresets((prev) => [...prev, snapshot]);
    setSceneName("");
  };

  const loadScenePreset = async (preset) => {
    if (!preset) return;

    setSelectedModelKey(preset.selectedModelKey || "mickiewicz");
    setRenderMode(preset.renderMode || "glb");
    setOutputSurfaceMode(preset.outputSurfaceMode || "lightGlb");
    setOutputModelUrl(
  preset.outputModelUrl ||
    MODEL_CONFIG[preset.selectedModelKey || "mickiewicz"]?.url ||
    MODEL_CONFIG.mickiewicz.url
);
    setProjector(preset.projector || projector);
    setWarp(ensureMeshWarp(preset.warp, WALL_W, WALL_H, 5, 5));

    for (const saved of preset.masks || []) {
      const current = masks.find((m) => m.id === saved.id);
      if (!current) continue;

      await patchMaskLocal(saved.id, {
        visible: saved.visible,
        locked: saved.locked,
        zIndex: saved.zIndex,
        opacity: saved.opacity,
        operation: saved.operation,
        textureType: saved.textureType,
        textureValue: saved.textureValue,
        layerName: saved.layerName
      });
    }
  };

  const deleteScenePreset = (id) => {
    setScenePresets((prev) => prev.filter((s) => s.id !== id));
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    resetDraft();
  };

  useEffect(() => {
    setTextureValue((prev) => normalizeTextureValue(textureType, prev));
  }, [textureType]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!selectedMaskId) return;

      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        return;
      }

      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        toggleMaskVisible(selectedMaskId);
      }

      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        toggleMaskLocked(selectedMaskId);
      }

      if (e.key === "Delete") {
        e.preventDefault();
        deleteMask(selectedMaskId);
      }

      if ((e.key === "d" || e.key === "D") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        duplicateSelected();
      }

      if (e.key === "]") {
        e.preventDefault();
        moveMaskBy(selectedMaskId, 1);
      }

      if (e.key === "[") {
        e.preventDefault();
        moveMaskBy(selectedMaskId, -1);
      }

      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        soloMask(selectedMaskId);
      }

      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        quickBlackout();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedMaskId, masks, points, opacity, maskWarps]);

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
          showPinkBackground,
          masks: masksWithLocalWarp,
          maskWarps,
          draftLocalWarp,
          warp,
          projector,
          renderMode,
          selectedModelKey,
          outputSurfaceMode,
          outputModelUrl,
          draft: {
            id: selectedMaskId ?? "__draft__",
            name: maskName,
            type: maskType,
            operation,
            zIndex,
            visible,
            locked,
            layerName,
            textureType,
            textureValue: normalizedTextureValue,
            points,
            opacity,
            isClosed,
            localWarp: selectedOrDraftLocalWarp
          }
        })
      );
    } catch {
      // ignore
    }
  }, [
    isOutput,
    points,
    isClosed,
    opacity,
    showGrid,
    showPinkBackground,
    masksWithLocalWarp,
    maskWarps,
    draftLocalWarp,
    warp,
    projector,
    renderMode,
    selectedModelKey,
    outputSurfaceMode,
    outputModelUrl,
    selectedMaskId,
    maskName,
    maskType,
    operation,
    zIndex,
    visible,
    locked,
    layerName,
    textureType,
    normalizedTextureValue,
    selectedOrDraftLocalWarp
  ]);

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
  showPinkBackground={showPinkBackground}
  masks={masksWithLocalWarp}
  activeDraft={activeDraft}
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
  showPinkBackground={showPinkBackground}
  setShowPinkBackground={setShowPinkBackground}
  opacity={opacity}
  setOpacity={setOpacity}
  maskName={maskName}
  setMaskName={setMaskName}
  maskType={maskType}
  setMaskType={setMaskType}
  operation={operation}
  setOperation={setOperation}
  zIndex={zIndex}
  setZIndex={setZIndex}
  selectedMaskId={selectedMaskId}
  onDepthPreview={(nextDepth) => {
    if (selectedMaskId === null) return;
    setMasks((prev) =>
      sortMasksByZIndex(
        prev.map((m) =>
          m.id === selectedMaskId ? { ...m, zIndex: nextDepth } : m
        )
      )
    );
  }}
  onDepthCommit={async (nextDepth) => {
    if (selectedMaskId === null) return;
    await patchMaskLocal(selectedMaskId, { zIndex: nextDepth });
  }}
  visible={visible}
  setVisible={setVisible}
  locked={locked}
  setLocked={setLocked}
  layerName={layerName}
  setLayerName={setLayerName}
  textureType={textureType}
  setTextureType={setTextureType}
  textureValue={textureValue}
  setTextureValue={setTextureValue}
  canSaveNew={canSaveNew}
  canUpdate={canUpdate}
  onSaveNew={saveNew}
  onUpdate={updateSelected}
  onReset={resetDraft}
  onExportJson={exportJson}
/>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 8,
                marginTop: 12
              }}
            >
              <button
                type="button"
                onClick={duplicateSelected}
                disabled={!canDuplicate}
                style={
                  canDuplicate
                    ? ui.button
                    : { ...ui.button, opacity: 0.5, cursor: "not-allowed" }
                }
              >
                Duplicate selected mask
              </button>
            </div>
          </SidebarPanel>

          <SidebarPanel title="Quick actions">
            <div style={{ display: "grid", gap: 8 }}>
              <button type="button" style={ui.button} onClick={quickShowAll}>
                Show all
              </button>
              <button type="button" style={ui.button} onClick={quickHideAll}>
                Hide all
              </button>
              <button type="button" style={ui.buttonDanger} onClick={quickBlackout}>
                Blackout
              </button>
              <button type="button" style={ui.button} onClick={quickUnlockAll}>
                Unlock all
              </button>
              <button type="button" style={ui.button} onClick={quickResetGlobalWarp}>
                Reset global warp
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
              Skróty: V visible, L lock, S solo, [ ] z-index, Ctrl+D duplicate, B blackout, Delete usuń
            </div>
          </SidebarPanel>

          <SidebarPanel title="Saved masks">
            <MaskList
  masks={masks}
  selectedMaskId={selectedMaskId}
  onSelect={handleSelectMask}
  onDelete={deleteMask}
  onToggleVisible={toggleMaskVisible}
  onToggleLocked={toggleMaskLocked}
  onMoveUp={(id) => moveMaskBy(id, 1)}
  onMoveDown={(id) => moveMaskBy(id, -1)}
  onDepthChange={async (id, nextDepth) => {
    setMasks((prev) =>
      sortMasksByZIndex(
        prev.map((m) =>
          m.id === id ? { ...m, zIndex: nextDepth } : m
        )
      )
    );

    if (selectedMaskId === id) {
      setZIndex(nextDepth);
    }

    await patchMaskLocal(id, { zIndex: nextDepth });
  }}
  onDuplicate={async (id) => {
    const mask = masks.find((m) => m.id === id);
    if (!mask) return;

    const nextTextureType = mask.textureType || "color";
    const nextTextureValue = normalizeTextureValue(
      nextTextureType,
      mask.textureValue
    );

    const dx = 24;
    const dy = 18;
    const duplicatedPoints = offsetPoints(
      Array.isArray(mask.points) ? mask.points : [],
      dx,
      dy,
      WALL_W,
      WALL_H
    );
    const duplicatedWarp = offsetWarp(
      maskWarps[id] || mask.localWarp,
      dx,
      dy,
      WALL_W,
      WALL_H,
      4,
      4
    );

    const payload = {
      name: `${(mask.name || "Mask").trim()} copy`,
      type: mask.type || "window",
      operation: mask.operation || "add",
      zIndex: Number(mask.zIndex || 0) + 1,
      visible: mask.visible !== false,
      locked: Boolean(mask.locked),
      layerName: mask.layerName || "default",
      textureType: nextTextureType,
      textureValue: nextTextureValue,
      opacity: typeof mask.opacity === "number" ? mask.opacity : 0.35,
      points: duplicatedPoints.map((p) => ({
        x: Math.round(p.x),
        y: Math.round(p.y)
      })),
      localWarp: duplicatedWarp
    };

    try {
      const created = await createMask(MODEL_ID, payload);

      setMasks((prev) =>
        sortMasksByZIndex([...prev, { ...created, visible: created.visible !== false }])
      );

      setMaskWarps((prev) => ({
        ...prev,
        [created.id]: ensureMeshWarp(
          created.localWarp || duplicatedWarp,
          WALL_W,
          WALL_H,
          4,
          4
        )
      }));
    } catch (e) {
      console.error(e);
      alert("Nie udało się zduplikować maski.");
    }
  }}
  onSolo={soloMask}
/>
          </SidebarPanel>
        </div>

        <div style={ui.center}>
          <SidebarPanel title="3D preview">
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button
                style={renderMode === "plane" ? ui.buttonPrimary : ui.button}
                onClick={() => setRenderMode("plane")}
                type="button"
              >
                Plane
              </button>

              <button
                style={
                  renderMode === "glb" && selectedModelKey === "mickiewicz"
                    ? ui.buttonPrimary
                    : ui.button
                }
                onClick={() => {
                  setRenderMode("glb");
                  setSelectedModelKey("mickiewicz");
                }}
                type="button"
              >
                Szkoła im. Adama Mickiewicza
              </button>

              <button
                style={
                  renderMode === "glb" && selectedModelKey === "kolejowa"
                    ? ui.buttonPrimary
                    : ui.button
                }
                onClick={() => {
                  setRenderMode("glb");
                  setSelectedModelKey("kolejowa");
                }}
                type="button"
              >
                Fasada szkoły Kolejowej
              </button>

              <button
  style={
    renderMode === "glb" && selectedModelKey === "dworzec"
      ? ui.buttonPrimary
      : ui.button
  }
  onClick={() => {
    if (!MODEL_CONFIG.dworzec.enabled) return;
    setRenderMode("glb");
    setSelectedModelKey("dworzec");
  }}
  type="button"
  disabled={!MODEL_CONFIG.dworzec.enabled}
>
  Dworzec Główny
</button>
            </div>

            {renderMode === "plane" || selectedModelEnabled ? (
              <WallScene
                renderMode={renderMode}
                modelUrl={selectedModelUrl}
                points={hasPolygon ? points : []}
                opacity={opacity}
                showGrid={showGrid}
                warp={warp}
                wallW={WALL_W}
                wallH={WALL_H}
                projectionTexture={projectionTexture}
                projector={projector}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  minHeight: 420,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.03)",
                  color: "rgba(255,255,255,0.75)",
                  textAlign: "center",
                  padding: 24
                }}
              >
                Model <strong style={{ marginLeft: 6, marginRight: 6 }}>{selectedModel.label}</strong>
                nie jest jeszcze dodany.
              </div>
            )}
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
          <SidebarPanel title="Scene presets">
            <div style={{ display: "grid", gap: 8 }}>
              <input
                type="text"
                value={sceneName}
                onChange={(e) => setSceneName(e.target.value)}
                style={ui.input}
                placeholder="Nazwa sceny"
              />
              <button type="button" style={ui.buttonPrimary} onClick={saveScenePreset}>
                Save current scene
              </button>
            </div>

            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {scenePresets.length === 0 ? (
                <div style={{ fontSize: 12, opacity: 0.75 }}>Brak zapisanych scen.</div>
              ) : (
                scenePresets.map((scene) => (
                  <div
                    key={scene.id}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.03)"
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>{scene.name}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        style={ui.button}
                        onClick={() => loadScenePreset(scene)}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        style={ui.buttonDanger}
                        onClick={() => deleteScenePreset(scene.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SidebarPanel>

          <SidebarPanel title="Output surface">
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                To steruje tylko Open Output. Lewy preview zostaje osobno.
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={
                    outputSurfaceMode === "plane"
                      ? ui.buttonPrimary
                      : ui.button
                  }
                  onClick={() => setOutputSurfaceMode("plane")}
                >
                  Plane
                </button>

                <button
                  type="button"
                  style={
                    outputSurfaceMode === "lightGlb"
                      ? ui.buttonPrimary
                      : ui.button
                  }
                  onClick={() => setOutputSurfaceMode("lightGlb")}
                >
                  Light GLB
                </button>

                <button
                  type="button"
                  style={
                    outputSurfaceMode === "glb"
                      ? ui.buttonPrimary
                      : ui.button
                  }
                  onClick={() => setOutputSurfaceMode("glb")}
                >
                  Full GLB
                </button>
              </div>

              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Aktualny model outputu:
              </div>

              <input
                type="text"
                value={outputModelUrl}
                onChange={(e) => setOutputModelUrl(e.target.value)}
                style={ui.input}
                placeholder="/models/fasada.glb"
              />
            </div>
          </SidebarPanel>

          <SidebarPanel title="Selected mask / draft warp">
            <WarpEditor
              warp={selectedOrDraftLocalWarp}
              setWarp={setSelectedOrDraftLocalWarp}
              wallW={WALL_W}
              wallH={WALL_H}
              sourcePoints={hasPolygon ? points : []}
              sourceEnabled={hasPolygon}
              autoFitLabel="Auto-fit do maski"
            />
          </SidebarPanel>

          <SidebarPanel title="Global output warp">
            <WarpEditor
              warp={warp}
              setWarp={setWarp}
              wallW={WALL_W}
              wallH={WALL_H}
              sourcePoints={[]}
              sourceEnabled={false}
              autoFitLabel="Auto-fit"
            />
          </SidebarPanel>

          <SidebarPanel title="Projector settings">
            <ProjectorSettings
              projector={projector}
              setProjector={setProjector}
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