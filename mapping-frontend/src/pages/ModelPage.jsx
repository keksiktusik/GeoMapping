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
    enabled: true,
    offset: [0, 0, -20]
  },
  kolejowa: {
    label: "Fasada szkoły Kolejowej",
    url: "/models/fasada2.glb",
    enabled: true,
    offset: [0, 0, -20]
  },
  dworzec: {
    label: "Dworzec Główny",
    url: "/models/fasada3.glb",
    enabled: true,
    rotation: [0, -Math.PI / 2, 0],
    offset: [0, 0, -450]
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

function normalizeMaskOperation(type, operation) {
  if (type === "ignore-zone") return "subtract";
  return operation || "add";
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

function movePoints(points, dx, dy, wallW, wallH) {
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

function getPolygonCenter(points = [], fallbackX = WALL_W / 2, fallbackY = WALL_H / 2) {
  if (!Array.isArray(points) || points.length === 0) {
    return { x: fallbackX, y: fallbackY };
  }

  const sum = points.reduce(
    (acc, p) => ({
      x: acc.x + Number(p?.x || 0),
      y: acc.y + Number(p?.y || 0)
    }),
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / points.length,
    y: sum.y / points.length
  };
}

function scalePointsAroundCenter(points, scale, wallW, wallH) {
  const center = getPolygonCenter(points, wallW / 2, wallH / 2);

  return (points || []).map((p) => ({
    x: Math.max(
      0,
      Math.min(wallW, center.x + (Number(p?.x || 0) - center.x) * scale)
    ),
    y: Math.max(
      0,
      Math.min(wallH, center.y + (Number(p?.y || 0) - center.y) * scale)
    )
  }));
}

function scaleWarpAroundCenter(warp, scale, wallW, wallH, cols = 4, rows = 4) {
  const mesh = ensureMeshWarp(warp, wallW, wallH, cols, rows);
  const center = getPolygonCenter(mesh.points, wallW / 2, wallH / 2);

  return {
    ...mesh,
    points: mesh.points.map((p) => ({
      ...p,
      x: Math.max(
        0,
        Math.min(wallW, center.x + (Number(p?.x || 0) - center.x) * scale)
      ),
      y: Math.max(
        0,
        Math.min(wallH, center.y + (Number(p?.y || 0) - center.y) * scale)
      )
    }))
  };
}

function getMaskBounds(points = []) {
  if (!Array.isArray(points) || points.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0
    };
  }

  const xs = points.map((p) => Number(p?.x || 0));
  const ys = points.map((p) => Number(p?.y || 0));

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function normalizeIncomingMasks(list) {
  return (Array.isArray(list) ? list : []).map((m) => ({
    ...m,
    visible: m.visible !== false,
    locked: Boolean(m.locked),
    zIndex: typeof m.zIndex === "number" ? m.zIndex : Number(m.zIndex || 0),
    operation: normalizeMaskOperation(m.type, m.operation)
  }));
}

function sortMasksByZIndex(list) {
  return [...list].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}

function pointInPolygon(point, polygon) {
  const pts = Array.isArray(polygon) ? polygon : [];
  if (pts.length < 3) return false;

  let inside = false;

  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = Number(pts[i]?.x || 0);
    const yi = Number(pts[i]?.y || 0);
    const xj = Number(pts[j]?.x || 0);
    const yj = Number(pts[j]?.y || 0);

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-9) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
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
  const selectedModelRotation = selectedModel.rotation || [0, 0, 0];
  const selectedModelOffset = selectedModel.offset || [0, 0, 0];

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
  const [editorSoloSelected, setEditorSoloSelected] = useState(
    Boolean(stored?.editorSoloSelected)
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

  const [projector, setProjector] = useState(() => ({
    distance: Number(stored?.projector?.distance ?? 2.5),
    offsetX: Number(stored?.projector?.offsetX ?? 0),
    offsetY: Number(stored?.projector?.offsetY ?? 0),
    angleX: Number(stored?.projector?.angleX ?? 0),
    angleY: Number(stored?.projector?.angleY ?? 0),
    angleZ: Number(stored?.projector?.angleZ ?? 0),
    fov: Number(stored?.projector?.fov ?? 45)
  }));

  const [calibration, setCalibration] = useState(() => ({
    showOverlay: stored?.calibration?.showOverlay !== false,
    showGrid: stored?.calibration?.showGrid !== false,
    showCrosshair: stored?.calibration?.showCrosshair !== false,
    nudgeStep: [0.01, 0.02, 0.05, 0.1, 0.25].includes(Number(stored?.calibration?.nudgeStep))
      ? Number(stored.calibration.nudgeStep)
      : 0.05,
    angleStep: [0.5, 1, 2, 5].includes(Number(stored?.calibration?.angleStep))
      ? Number(stored.calibration.angleStep)
      : 1,
    showInfo: stored?.calibration?.showInfo !== false,
    pattern: ["none", "frame", "checkerboard", "windows", "bands", "cross"].includes(
      stored?.calibration?.pattern
    )
      ? stored.calibration.pattern
      : "none",
    patternOpacity: Math.max(
      0.1,
      Math.min(1, Number(stored?.calibration?.patternOpacity || 0.8))
    ),
    maskOutlineMode: ["off", "overlay", "only"].includes(stored?.calibration?.maskOutlineMode)
      ? stored.calibration.maskOutlineMode
      : "off",
    maskOutlineColor:
      typeof stored?.calibration?.maskOutlineColor === "string"
        ? stored.calibration.maskOutlineColor
        : "#ffffff",
    maskOutlineWidth: Math.max(
      1,
      Math.min(12, Number(stored?.calibration?.maskOutlineWidth || 2))
    ),
    selectedMaskFlashMode: ["off", "fill", "outline", "both"].includes(
      stored?.calibration?.selectedMaskFlashMode
    )
      ? stored.calibration.selectedMaskFlashMode
      : "off",
    selectedMaskFlashColor:
      typeof stored?.calibration?.selectedMaskFlashColor === "string"
        ? stored.calibration.selectedMaskFlashColor
        : "#ffea00",
    selectedMaskFlashSpeed: Math.max(
      0.2,
      Math.min(6, Number(stored?.calibration?.selectedMaskFlashSpeed || 1.6))
    ),
    selectedMaskSoloInOutput: Boolean(stored?.calibration?.selectedMaskSoloInOutput),
    outputBlackoutMode: Boolean(stored?.calibration?.outputBlackoutMode),
    selectedMaskOutlineBoost: stored?.calibration?.selectedMaskOutlineBoost !== false
  }));

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
  const [isSavingOutputBackend, setIsSavingOutputBackend] = useState(false);
  const [isSavingSceneSnapshot, setIsSavingSceneSnapshot] = useState(false);

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
        alert("Nie udało się pobrać masek (sprawdź API / backend).");
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
      operation: normalizeMaskOperation(maskType, operation),
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

  const editorVisibleMasks = useMemo(() => {
    if (!editorSoloSelected || selectedMaskId == null) {
      return masksWithLocalWarp;
    }

    return masksWithLocalWarp.filter(
      (m) => String(m.id) === String(selectedMaskId)
    );
  }, [editorSoloSelected, selectedMaskId, masksWithLocalWarp]);

  const editorActiveDraft = useMemo(() => {
    if (!editorSoloSelected) return activeDraft;
    if (selectedMaskId == null) return activeDraft;
    return activeDraft;
  }, [editorSoloSelected, selectedMaskId, activeDraft]);

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
      operation: normalizeMaskOperation(maskType, operation),
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
    alert("JSON maski został wypisany w konsoli.");
  };

  const saveNew = async () => {
    if (!canSaveNew) return;

    const localWarp = ensureMeshWarp(draftLocalWarp, WALL_W, WALL_H, 4, 4);

    const payload = {
      name: maskName.trim(),
      type: maskType,
      operation: normalizeMaskOperation(maskType, operation),
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
      alert("Nie udało się zapisać maski.");
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
      operation: normalizeMaskOperation(maskType, operation),
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
                  locked: Boolean(updated.locked),
                  operation: normalizeMaskOperation(updated.type, updated.operation)
                }
              : m
          )
        )
      );

      setMaskWarps((prev) => ({
        ...prev,
        [updated.id]: ensureMeshWarp(updated.localWarp || localWarp, WALL_W, WALL_H, 4, 4)
      }));

      alert("Zaktualizowano maskę.");
    } catch (e) {
      console.error(e);
      alert("Nie udało się zaktualizować maski.");
    }
  };

  const duplicateSelected = async () => {
    if (!canDuplicate) return;

    const bounds = getMaskBounds(points);
    const dx = Math.max(30, bounds.width + 20);
    const dy = 0;

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
      name: `${maskName.trim() || "Maska"} kopia`,
      type: maskType,
      operation: normalizeMaskOperation(maskType, operation),
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

      alert("Utworzono kopię maski obok oryginału.");
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
      alert("Nie udało się usunąć maski.");
    }
  };

  const handleSelectMask = (id) => {
    const mask = masks.find((m) => m.id === id);
    if (!mask) return;

    setSelectedMaskId(id);
    setMaskName(mask.name || "");
    setMaskType(mask.type || "window");
    setOperation(normalizeMaskOperation(mask.type, mask.operation));
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

    const merged = {
      ...current,
      ...patch,
      operation: normalizeMaskOperation(
        patch.type ?? current.type,
        patch.operation ?? current.operation
      )
    };

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
            : Number(updatedRaw.zIndex || 0),
        operation: normalizeMaskOperation(updatedRaw.type, updatedRaw.operation)
      };

      setMasks((prev) =>
        sortMasksByZIndex(prev.map((m) => (m.id === id ? updated : m)))
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
        setOperation(normalizeMaskOperation(updated.type, updated.operation));
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

  const moveSelectedMask = async (dx, dy) => {
    if (selectedMaskId === null) return;

    const current = masks.find((m) => m.id === selectedMaskId);
    if (!current) return;

    const movedPoints = movePoints(
      Array.isArray(current.points) ? current.points : [],
      dx,
      dy,
      WALL_W,
      WALL_H
    );

    const movedWarp = offsetWarp(
      maskWarps[selectedMaskId] || current.localWarp,
      dx,
      dy,
      WALL_W,
      WALL_H,
      4,
      4
    );

    setPoints(movedPoints);

    setMaskWarps((prev) => ({
      ...prev,
      [selectedMaskId]: movedWarp
    }));

    await patchMaskLocal(selectedMaskId, {
      points: movedPoints,
      localWarp: movedWarp
    });
  };

  const scaleSelectedMask = async (scaleFactor) => {
    if (selectedMaskId === null) return;

    const current = masks.find((m) => m.id === selectedMaskId);
    if (!current) return;

    const scaledPoints = scalePointsAroundCenter(
      Array.isArray(current.points) ? current.points : [],
      scaleFactor,
      WALL_W,
      WALL_H
    );

    const scaledWarp = scaleWarpAroundCenter(
      maskWarps[selectedMaskId] || current.localWarp,
      scaleFactor,
      WALL_W,
      WALL_H,
      4,
      4
    );

    setPoints(scaledPoints);

    setMaskWarps((prev) => ({
      ...prev,
      [selectedMaskId]: scaledWarp
    }));

    await patchMaskLocal(selectedMaskId, {
      points: scaledPoints,
      localWarp: scaledWarp
    });
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
      calibration,
      warp,
      showGrid,
      showPinkBackground,
      selectedMaskId,
      editorSoloSelected,
      masks: masks.map((m) => ({
        id: m.id,
        visible: m.visible !== false,
        locked: Boolean(m.locked),
        zIndex: m.zIndex ?? 0,
        opacity: typeof m.opacity === "number" ? m.opacity : 1,
        operation: normalizeMaskOperation(m.type, m.operation),
        textureType: m.textureType || "color",
        textureValue: m.textureValue || "#ffffff",
        layerName: m.layerName || "default"
      }))
    };

    setScenePresets((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.name.trim().toLowerCase() === name.toLowerCase()
      );

      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...snapshot,
          id: prev[existingIndex].id
        };
        return next;
      }

      return [...prev, snapshot];
    });

    setSceneName("");
  };

  const saveCalibrationSnapshot = async () => {
    setIsSavingSceneSnapshot(true);
    try {
      const name = sceneName.trim() || `Kalibracja ${new Date().toLocaleString()}`;
      setSceneName(name);

      const snapshot = {
        id: `${Date.now()}`,
        name,
        createdAt: Date.now(),
        selectedModelKey,
        renderMode,
        outputSurfaceMode,
        outputModelUrl,
        projector,
        calibration,
        warp,
        showGrid,
        showPinkBackground,
        selectedMaskId,
        editorSoloSelected,
        masks: masks.map((m) => ({
          id: m.id,
          visible: m.visible !== false,
          locked: Boolean(m.locked),
          zIndex: m.zIndex ?? 0,
          opacity: typeof m.opacity === "number" ? m.opacity : 1,
          operation: normalizeMaskOperation(m.type, m.operation),
          textureType: m.textureType || "color",
          textureValue: m.textureValue || "#ffffff",
          layerName: m.layerName || "default"
        }))
      };

      setScenePresets((prev) => {
        const existingIndex = prev.findIndex(
          (item) => item.name.trim().toLowerCase() === name.toLowerCase()
        );

        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = {
            ...snapshot,
            id: prev[existingIndex].id
          };
          return next;
        }

        return [...prev, snapshot];
      });

      alert("Zapisano kalibrację sceny.");
    } catch (e) {
      console.error(e);
      alert("Nie udało się zapisać kalibracji sceny.");
    } finally {
      setIsSavingSceneSnapshot(false);
    }
  };

  const syncOutputStateToBackend = async () => {
    setIsSavingOutputBackend(true);
    try {
      const raw = localStorage.getItem(STORAGE_OUTPUT);
      const parsed = safeParse(raw, null);

      if (!parsed) {
        alert("Brak stanu outputu do zapisania.");
        return;
      }

      const outputMasks = Array.isArray(parsed.masks) ? parsed.masks : [];
      if (!outputMasks.length) {
        alert("Brak masek w aktualnym stanie outputu.");
        return;
      }

      for (const mask of outputMasks) {
        if (!mask?.id) continue;

        await apiUpdateMask(mask.id, {
          name: mask.name,
          type: mask.type,
          operation: normalizeMaskOperation(mask.type, mask.operation),
          zIndex: Number(mask.zIndex || 0),
          visible: mask.visible !== false,
          locked: Boolean(mask.locked),
          layerName: mask.layerName || "default",
          textureType: mask.textureType || "color",
          textureValue: normalizeTextureValue(mask.textureType, mask.textureValue),
          opacity: typeof mask.opacity === "number" ? mask.opacity : 0.35,
          points: (mask.points || []).map((p) => ({
            x: Math.round(Number(p.x || 0)),
            y: Math.round(Number(p.y || 0))
          })),
          localWarp: mask.localWarp || null
        });
      }

      const refreshed = await getMasks(MODEL_ID);
      const normalizedMasks = normalizeIncomingMasks(refreshed);

      setMasks(sortMasksByZIndex(normalizedMasks));

      const nextWarps = {};
      normalizedMasks.forEach((m) => {
        nextWarps[m.id] = ensureMeshWarp(m.localWarp, WALL_W, WALL_H, 4, 4);
      });
      setMaskWarps(nextWarps);

      alert("Zapisano aktualny stan outputu do backendu.");
    } catch (e) {
      console.error(e);
      alert("Nie udało się zapisać zmian z outputu do backendu.");
    } finally {
      setIsSavingOutputBackend(false);
    }
  };

  const loadScenePreset = async (preset) => {
    if (!preset) return;

    resetDraft();

    setSelectedModelKey(preset.selectedModelKey || "mickiewicz");
    setRenderMode(preset.renderMode || "glb");
    setOutputSurfaceMode(preset.outputSurfaceMode || "lightGlb");
    setOutputModelUrl(
      preset.outputModelUrl ||
        MODEL_CONFIG[preset.selectedModelKey || "mickiewicz"]?.url ||
        MODEL_CONFIG.mickiewicz.url
    );

    setProjector(preset.projector || projector);
    setCalibration((prev) => ({
      ...prev,
      ...(preset.calibration || {})
    }));
    setWarp(ensureMeshWarp(preset.warp, WALL_W, WALL_H, 5, 5));
    setShowGrid(Boolean(preset.showGrid));
    setShowPinkBackground(preset.showPinkBackground !== false);
    setEditorSoloSelected(Boolean(preset.editorSoloSelected));

    const presetMaskIds = new Set((preset.masks || []).map((m) => String(m.id)));

    for (const currentMask of masks) {
      if (!presetMaskIds.has(String(currentMask.id))) {
        await patchMaskLocal(currentMask.id, {
          visible: false
        });
      }
    }

    for (const saved of preset.masks || []) {
      const current = masks.find((m) => m.id === saved.id);
      if (!current) continue;

      await patchMaskLocal(saved.id, {
        visible: saved.visible,
        locked: saved.locked,
        zIndex: saved.zIndex,
        opacity: saved.opacity,
        operation: normalizeMaskOperation(current.type, saved.operation),
        textureType: saved.textureType,
        textureValue: saved.textureValue,
        layerName: saved.layerName
      });
    }

    if (preset.selectedMaskId != null) {
      const selectedExists = masks.find(
        (m) => String(m.id) === String(preset.selectedMaskId)
      );
      if (selectedExists) {
        handleSelectMask(preset.selectedMaskId);
      } else {
        setSelectedMaskId(null);
      }
    } else {
      setSelectedMaskId(null);
    }
  };

  const deleteScenePreset = (id) => {
    setScenePresets((prev) => prev.filter((s) => s.id !== id));
  };

  const selectMaskByIndex = (index) => {
    const ordered = [...masks].sort(
      (a, b) => Number(a.zIndex || 0) - Number(b.zIndex || 0)
    );

    if (!ordered.length) return;

    const safeIndex = Math.max(0, Math.min(ordered.length - 1, index));
    const nextMask = ordered[safeIndex];
    if (nextMask) {
      handleSelectMask(nextMask.id);
    }
  };

  useEffect(() => {
    setTextureValue((prev) => normalizeTextureValue(textureType, prev));
  }, [textureType]);

  useEffect(() => {
    if (isOutput) return;

    try {
      localStorage.setItem(
        STORAGE_OUTPUT,
        JSON.stringify({
          points,
          isClosed,
          opacity,
          editorSoloSelected,
          showGrid,
          showPinkBackground,
          masks: masksWithLocalWarp,
          maskWarps,
          draftLocalWarp,
          warp,
          projector,
          calibration,
          selectedMaskId: selectedMaskId ?? "__draft__",
          renderMode,
          selectedModelKey,
          selectedModelRotation,
          selectedModelOffset,
          outputSurfaceMode,
          outputModelUrl,
          draft: {
            id: selectedMaskId ?? "__draft__",
            name: maskName,
            type: maskType,
            operation: normalizeMaskOperation(maskType, operation),
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
      //
    }
  }, [
    isOutput,
    points,
    isClosed,
    opacity,
    editorSoloSelected,
    showGrid,
    showPinkBackground,
    masksWithLocalWarp,
    maskWarps,
    draftLocalWarp,
    warp,
    projector,
    calibration,
    renderMode,
    selectedModelKey,
    selectedModelRotation,
    selectedModelOffset,
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

  useEffect(() => {
    if (isOutput) return;

    const onStorage = (e) => {
      if (e.key !== STORAGE_OUTPUT || !e.newValue) return;

      const parsed = safeParse(e.newValue, null);
      if (!parsed) return;

      const nextMasks = normalizeIncomingMasks(parsed.masks || []);
      if (nextMasks.length) {
        setMasks(sortMasksByZIndex(nextMasks));

        const nextWarps = {};
        nextMasks.forEach((m) => {
          nextWarps[m.id] = ensureMeshWarp(m.localWarp, WALL_W, WALL_H, 4, 4);
        });
        setMaskWarps(nextWarps);
      }

      setProjector((prev) => ({
        ...prev,
        ...(parsed.projector || {})
      }));

      setCalibration((prev) => ({
        ...prev,
        ...(parsed.calibration || {})
      }));

      setEditorSoloSelected(Boolean(parsed.editorSoloSelected));

      const nextSelectedId =
        parsed.selectedMaskId && parsed.selectedMaskId !== "__draft__"
          ? parsed.selectedMaskId
          : null;

      setSelectedMaskId(nextSelectedId);

      if (nextSelectedId != null) {
        const selectedMask = nextMasks.find((m) => String(m.id) === String(nextSelectedId));
        if (selectedMask) {
          setMaskName(selectedMask.name || "");
          setMaskType(selectedMask.type || "window");
          setOperation(normalizeMaskOperation(selectedMask.type, selectedMask.operation));
          setZIndex(
            typeof selectedMask.zIndex === "number"
              ? selectedMask.zIndex
              : Number(selectedMask.zIndex || 0)
          );
          setVisible(selectedMask.visible !== false);
          setLocked(Boolean(selectedMask.locked));
          setLayerName(selectedMask.layerName || "default");

          const nextTextureType = selectedMask.textureType || "color";
          const nextTextureValue = normalizeTextureValue(
            nextTextureType,
            selectedMask.textureValue
          );

          setTextureType(nextTextureType);
          setTextureValue(nextTextureValue);
          setPoints(Array.isArray(selectedMask.points) ? selectedMask.points : []);
          setOpacity(typeof selectedMask.opacity === "number" ? selectedMask.opacity : 0.35);
          setIsClosed(true);
          setMode("edit");
        }
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [isOutput]);

  useEffect(() => {
    if (isOutput) return;

    const onKeyDown = async (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" || tag === "textarea" || tag === "select";

      if (isTyping) return;

      if (e.key === "Delete" && selectedMaskId !== null) {
        e.preventDefault();
        await deleteMask(selectedMaskId);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        if (selectedMaskId !== null) {
          e.preventDefault();
          await duplicateSelected();
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        resetDraft();
        return;
      }

      if (e.key.toLowerCase() === "g") {
        e.preventDefault();
        setShowGrid((prev) => !prev);
        return;
      }

      if (e.altKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setEditorSoloSelected((prev) => !prev);
        return;
      }

      if (e.key === "PageDown") {
        e.preventDefault();

        const ordered = [...masks].sort(
          (a, b) => Number(a.zIndex || 0) - Number(b.zIndex || 0)
        );

        if (!ordered.length) return;

        if (selectedMaskId == null) {
          handleSelectMask(ordered[0].id);
          return;
        }

        const currentIndex = ordered.findIndex(
          (m) => String(m.id) === String(selectedMaskId)
        );

        const nextIndex =
          currentIndex < 0
            ? 0
            : Math.min(ordered.length - 1, currentIndex + 1);

        handleSelectMask(ordered[nextIndex].id);
        return;
      }

      if (e.key === "PageUp") {
        e.preventDefault();

        const ordered = [...masks].sort(
          (a, b) => Number(a.zIndex || 0) - Number(b.zIndex || 0)
        );

        if (!ordered.length) return;

        if (selectedMaskId == null) {
          handleSelectMask(ordered[ordered.length - 1].id);
          return;
        }

        const currentIndex = ordered.findIndex(
          (m) => String(m.id) === String(selectedMaskId)
        );

        const nextIndex =
          currentIndex < 0
            ? ordered.length - 1
            : Math.max(0, currentIndex - 1);

        handleSelectMask(ordered[nextIndex].id);
        return;
      }

      if (e.key === "Home") {
        e.preventDefault();
        selectMaskByIndex(0);
        return;
      }

      if (e.key === "End") {
        e.preventDefault();
        const ordered = [...masks].sort(
          (a, b) => Number(a.zIndex || 0) - Number(b.zIndex || 0)
        );
        if (!ordered.length) return;
        selectMaskByIndex(ordered.length - 1);
        return;
      }

      if (e.key === "[" && selectedMaskId !== null) {
        e.preventDefault();
        const nextDepth = Number(zIndex || 0) - 1;
        setZIndex(nextDepth);
        await patchMaskLocal(selectedMaskId, { zIndex: nextDepth });
        return;
      }

      if (e.key === "]" && selectedMaskId !== null) {
        e.preventDefault();
        const nextDepth = Number(zIndex || 0) + 1;
        setZIndex(nextDepth);
        await patchMaskLocal(selectedMaskId, { zIndex: nextDepth });
        return;
      }

      if (e.key === "," && selectedMaskId !== null) {
        e.preventDefault();
        await scaleSelectedMask(0.9);
        return;
      }

      if (e.key === "." && selectedMaskId !== null) {
        e.preventDefault();
        await scaleSelectedMask(1.1);
        return;
      }

      if (e.shiftKey && selectedMaskId !== null) {
        const step = 2;

        if (e.key === "ArrowLeft") {
          e.preventDefault();
          await moveSelectedMask(-step, 0);
          return;
        }

        if (e.key === "ArrowRight") {
          e.preventDefault();
          await moveSelectedMask(step, 0);
          return;
        }

        if (e.key === "ArrowUp") {
          e.preventDefault();
          await moveSelectedMask(0, -step);
          return;
        }

        if (e.key === "ArrowDown") {
          e.preventDefault();
          await moveSelectedMask(0, step);
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isOutput,
    selectedMaskId,
    zIndex,
    masks,
    maskWarps,
    editorSoloSelected
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

  const handlePreviewPick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = ((e.clientX - rect.left) / rect.width) * WALL_W;
    const y = ((e.clientY - rect.top) / rect.height) * WALL_H;

    const candidates = [...masks]
      .filter((m) => m.visible !== false && Array.isArray(m.points) && m.points.length >= 3)
      .sort((a, b) => Number(b.zIndex || 0) - Number(a.zIndex || 0));

    const hit = candidates.find((mask) => pointInPolygon({ x, y }, mask.points));
    if (hit) {
      handleSelectMask(hit.id);
    }
  };

  return (
    <div style={ui.page}>
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
        masks={editorVisibleMasks}
        activeDraft={editorActiveDraft}
        onTexture={setProjectionTexture}
      />

      <div style={ui.shell}>
        <div style={ui.sidebar}>
          <SidebarPanel title="Edytor maski">
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
                gridTemplateColumns: "1fr 1fr",
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
                    ? { ...ui.button, gridColumn: "1 / span 2" }
                    : {
                        ...ui.button,
                        gridColumn: "1 / span 2",
                        opacity: 0.5,
                        cursor: "not-allowed"
                      }
                }
              >
                Duplikuj wybraną maskę
              </button>

              <button
                type="button"
                onClick={() => scaleSelectedMask(0.9)}
                disabled={selectedMaskId === null}
                style={
                  selectedMaskId !== null
                    ? ui.button
                    : { ...ui.button, opacity: 0.5, cursor: "not-allowed" }
                }
              >
                Zmniejsz 10%
              </button>

              <button
                type="button"
                onClick={() => scaleSelectedMask(1.1)}
                disabled={selectedMaskId === null}
                style={
                  selectedMaskId !== null
                    ? ui.button
                    : { ...ui.button, opacity: 0.5, cursor: "not-allowed" }
                }
              >
                Powiększ 10%
              </button>
            </div>
          </SidebarPanel>

          <SidebarPanel title="Zapisane maski">
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

                const bounds = getMaskBounds(Array.isArray(mask.points) ? mask.points : []);
                const dx = Math.max(30, bounds.width + 20);
                const dy = 0;

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
                  name: `${(mask.name || "Maska").trim()} kopia`,
                  type: mask.type || "window",
                  operation: normalizeMaskOperation(mask.type, mask.operation),
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

                  handleSelectMask(created.id);
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
  <SidebarPanel title="Podgląd 3D">
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: 420
      }}
    >
      <WallScene
        renderMode={renderMode}
        modelUrl={selectedModelUrl}
        modelRotation={selectedModelRotation}
        modelOffset={selectedModelOffset}
        points={hasPolygon ? points : []}
        opacity={opacity}
        showGrid={showGrid}
        warp={warp}
        wallW={WALL_W}
        wallH={WALL_H}
        projectionTexture={projectionTexture}
        projector={projector}
      />

      <div
        onPointerDown={handlePreviewPick}
        title="Kliknij maskę na podglądzie, aby ją wybrać"
        style={{
          position: "absolute",
          inset: 0,
          cursor: "crosshair",
          background: "transparent"
        }}
      />
    </div>
  </SidebarPanel>

  <SidebarPanel title="Edytor rysowania">
    <CanvasEditor
      points={points}
      setPoints={setPoints}
      isClosed={isClosed}
      setIsClosed={setIsClosed}
      wallW={WALL_W}
      wallH={WALL_H}
      mode={mode}
      setMode={setMode}
      showGrid={showGrid}
      opacity={opacity}
    />
  </SidebarPanel>

  <SidebarPanel title="Globalny warp">
    <WarpEditor
      wallW={WALL_W}
      wallH={WALL_H}
      warp={warp}
      setWarp={setWarp}
    />
  </SidebarPanel>

  <SidebarPanel title="Warp wybranej maski">
    {selectedMaskId === null ? (
      <div
        style={{
          fontSize: 12,
          opacity: 0.72,
          lineHeight: 1.5
        }}
      >
        Wybierz maskę z listy albo kliknij ją na podglądzie 3D,
        żeby edytować jej lokalny warp.
      </div>
    ) : (
      <WarpEditor
        wallW={WALL_W}
        wallH={WALL_H}
        warp={selectedOrDraftLocalWarp}
        setWarp={setSelectedOrDraftLocalWarp}
      />
    )}
  </SidebarPanel>
</div>

        <div style={ui.sidebarRight}>
          <SidebarPanel title="Model i output">
            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={ui.label}>Tryb podglądu</span>
                <select
                  style={ui.input}
                  value={renderMode}
                  onChange={(e) => setRenderMode(e.target.value)}
                >
                  <option value="glb">GLB</option>
                  <option value="plane">Plane</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={ui.label}>Wybrana fasada</span>
                <select
                  style={ui.input}
                  value={selectedModelKey}
                  onChange={(e) => {
                    const nextKey = e.target.value;
                    setSelectedModelKey(nextKey);

                    const nextModel = MODEL_CONFIG[nextKey];
                    if (nextModel?.url) {
                      setOutputModelUrl(nextModel.url);
                    }
                  }}
                >
                  {Object.entries(MODEL_CONFIG)
                    .filter(([, model]) => model.enabled !== false)
                    .map(([key, model]) => (
                      <option key={key} value={key}>
                        {model.label}
                      </option>
                    ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={ui.label}>Powierzchnia outputu</span>
                <select
                  style={ui.input}
                  value={outputSurfaceMode}
                  onChange={(e) => setOutputSurfaceMode(e.target.value)}
                >
                  <option value="plane">Plane</option>
                  <option value="lightGlb">Light GLB</option>
                  <option value="glb">Full GLB</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={ui.label}>URL modelu output</span>
                <input
                  style={ui.input}
                  value={outputModelUrl}
                  onChange={(e) => setOutputModelUrl(e.target.value)}
                />
              </label>
            </div>
          </SidebarPanel>

          <SidebarPanel title="Ustawienia projekcji">
            <ProjectorSettings
              projector={projector}
              setProjector={setProjector}
              calibration={calibration}
              setCalibration={setCalibration}
            />
          </SidebarPanel>

          <SidebarPanel title="Zapis kalibracji i backend">
            <div style={{ display: "grid", gap: 8 }}>
              <button
                type="button"
                onClick={syncOutputStateToBackend}
                disabled={isSavingOutputBackend}
                style={
                  isSavingOutputBackend
                    ? { ...ui.button, opacity: 0.6, cursor: "not-allowed" }
                    : ui.buttonPrimary
                }
              >
                {isSavingOutputBackend
                  ? "Zapisywanie outputu..."
                  : "Zapisz output do backendu"}
              </button>

              <button
                type="button"
                onClick={saveCalibrationSnapshot}
                disabled={isSavingSceneSnapshot}
                style={
                  isSavingSceneSnapshot
                    ? { ...ui.button, opacity: 0.6, cursor: "not-allowed" }
                    : ui.button
                }
              >
                {isSavingSceneSnapshot
                  ? "Zapisywanie kalibracji..."
                  : "Zapisz kalibrację sceny"}
              </button>

              <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>
                1. Najpierw dopasuj maski w editorze / output.
                <br />
                2. Zapisz output do backendu, żeby zmiany były trwałe.
                <br />
                3. Zapisz kalibrację sceny, żeby wrócić do ustawień później.
              </div>
            </div>
          </SidebarPanel>

          <SidebarPanel title="Checklist przed mappingiem">
            <div style={{ fontSize: 12, lineHeight: 1.65, opacity: 0.88 }}>
              □ Wybrana poprawna fasada / model GLB
              <br />
              □ Output otwiera się na właściwym ekranie / projektorze
              <br />
              □ Tryb outputu ustawiony poprawnie: Plane / Light GLB / Full GLB
              <br />
              □ Projektor reaguje na offset, kąty i FOV
              <br />
              □ Kontury masek są widoczne i czytelne
              <br />
              □ Pulse wybranej maski działa
              <br />
              □ Solo wybranej maski działa
              <br />
              □ Blackout działa
              <br />
              □ Wideo / tekstury są wyświetlane poprawnie
              <br />
              □ Maski trafiają w okna / detale fasady
              <br />
              □ Zmiany z outputu zapisane do backendu
              <br />
              □ Kalibracja sceny zapisana
            </div>
          </SidebarPanel>

          <SidebarPanel title="Skróty">
            <div style={{ fontSize: 12, lineHeight: 1.6, opacity: 0.85 }}>
              Editor:
              <br />
              Delete — usuń wybraną maskę
              <br />
              Ctrl + D — duplikuj maskę
              <br />
              Escape — reset / odznacz
              <br />
              G — pokaż / ukryj grid
              <br />
              [ / ] — zmień głębokość maski
              <br />
              Shift + strzałki — przesuń wybraną maskę
              <br />
              , / . — zmniejsz / powiększ wybraną maskę
              <br />
              Alt + E — solo wybranej maski w editorze
              <br />
              PageUp / PageDown — poprzednia / następna maska
              <br />
              Home / End — pierwsza / ostatnia maska
              <br />
              <br />
              Open Output:
              <br />
              Alt + Shift + strzałki — przesuń wybraną maskę
              <br />
              Alt + [ / ] — zIndex wybranej maski
              <br />
              Alt + S — solo wybranej maski
              <br />
              Alt + B — blackout
            </div>
          </SidebarPanel>

          <SidebarPanel title="Zapisane sceny">
            <div style={{ display: "grid", gap: 8 }}>
              <input
                style={ui.input}
                value={sceneName}
                onChange={(e) => setSceneName(e.target.value)}
                placeholder="Nazwa sceny"
              />

              <button type="button" style={ui.buttonPrimary} onClick={saveScenePreset}>
                Zapisz scenę
              </button>
            </div>

            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {scenePresets.length === 0 ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>Brak zapisanych scen.</div>
              ) : (
                scenePresets
                  .slice()
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((preset) => (
                    <div
                      key={preset.id}
                      style={{
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10,
                        padding: 10,
                        background: "rgba(255,255,255,0.02)"
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>{preset.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
                        {new Date(preset.createdAt).toLocaleString()}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          style={ui.button}
                          onClick={() => loadScenePreset(preset)}
                        >
                          Wczytaj
                        </button>
                        <button
                          type="button"
                          style={ui.buttonDanger}
                          onClick={() => deleteScenePreset(preset.id)}
                        >
                          Usuń
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
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