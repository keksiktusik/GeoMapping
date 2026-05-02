import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import ProjectionTexture from "./ProjectionTexture";
import ProjectedSimpleScene from "./ProjectedSimpleScene";

const STORAGE_KEY = "mapping_output_state_v1";

const BACKGROUND_AUDIO_BY_MODEL = {
  "/models/fasada.glb": "/audio/chopin.mp3",
  "/models/fasada2.glb": "/audio/kolej.mp3",
  "/models/fasada3.glb": "/audio/pociag.mp3"
};

function getBackgroundAudioUrl(modelUrl) {
  return BACKGROUND_AUDIO_BY_MODEL[modelUrl] || "/audio/chopin.mp3";
}

const DEFAULT_CALIBRATION = {
  showOverlay: true,
  showGrid: true,
  showCrosshair: true,
  nudgeStep: 0.05,
  angleStep: 1,
  showInfo: true,
  pattern: "none",
  patternOpacity: 0.8,
  maskOutlineMode: "off",
  maskOutlineColor: "#ffffff",
  maskOutlineWidth: 0.5,
  selectedMaskFlashMode: "off",
  selectedMaskFlashColor: "#ffea00",
  selectedMaskFlashSpeed: 1.6,
  selectedMaskSoloInOutput: false,
  outputBlackoutMode: false,
  selectedMaskOutlineBoost: true,
  operatorZoomEnabled: false,
  operatorZoom: 2,
  operatorPanX: 0,
  operatorPanY: 0,
  operatorPanelSize: 320
};

const PATTERN_KEYS = ["none", "frame", "checkerboard", "windows", "bands", "cross"];
const OUTLINE_MODE_KEYS = ["off", "overlay", "only"];
const FLASH_MODE_KEYS = ["off", "fill", "outline", "both"];

function useProjectorBackgroundAudio(modelUrl, enabled = true) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const audioUrl = getBackgroundAudioUrl(modelUrl);
    const audio = new Audio(audioUrl);

    audio.loop = true;
    audio.volume = 0.35;
    audio.preload = "auto";

    audioRef.current = audio;

    const startAudio = () => {
      audio.play().catch(() => {
        //
      });
    };

    window.addEventListener("pointerdown", startAudio, { once: true });
    window.addEventListener("keydown", startAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", startAudio);
      window.removeEventListener("keydown", startAudio);
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, [modelUrl, enabled]);
}

function getDepthSource(mask = {}) {
  return `${mask?.name || ""} ${mask?.layerName || ""}`.toLowerCase();
}

function parseLegacyDepthDirective(mask = {}) {
  const text = getDepthSource(mask);
  if (text.includes("[depth:front]")) return "front";
  if (text.includes("[depth:back]")) return "back";
  return null;
}

function normalizeZIndex(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num) : 0;
}

function getDepthBucket(mask = {}) {
  const z = normalizeZIndex(mask?.zIndex);
  if (z > 0) return "front";
  if (z < 0) return "back";
  return parseLegacyDepthDirective(mask) || "middle";
}

function filterMasksByDepth(masks = [], depth = "middle") {
  return (masks || []).filter((mask) => getDepthBucket(mask) === depth);
}

function getDraftDepth(draft) {
  if (!draft) return "middle";
  return getDepthBucket(draft);
}

function normalizeProjector(projector = {}) {
  return {
    distance: Math.max(0.5, Number(projector?.distance || 2.5)),
    offsetX: Number(projector?.offsetX || 0),
    offsetY: Number(projector?.offsetY || 0),
    angleX: Number(projector?.angleX || 0),
    angleY: Number(projector?.angleY || 0),
    angleZ: Number(projector?.angleZ || 0),
    fov: Math.max(10, Math.min(150, Number(projector?.fov || 45)))
  };
}

function normalizeCalibration(calibration = {}) {
  const isHexColor = (value) =>
    typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);

  return {
    showOverlay: calibration?.showOverlay !== false,
    showGrid: calibration?.showGrid !== false,
    showCrosshair: calibration?.showCrosshair !== false,
    nudgeStep: [0.01, 0.02, 0.05, 0.1, 0.25].includes(Number(calibration?.nudgeStep))
      ? Number(calibration.nudgeStep)
      : DEFAULT_CALIBRATION.nudgeStep,
    angleStep: [0.5, 1, 2, 5].includes(Number(calibration?.angleStep))
      ? Number(calibration.angleStep)
      : DEFAULT_CALIBRATION.angleStep,
    showInfo: calibration?.showInfo !== false,
    pattern: PATTERN_KEYS.includes(calibration?.pattern)
      ? calibration.pattern
      : DEFAULT_CALIBRATION.pattern,
    patternOpacity: Math.max(
      0.1,
      Math.min(1, Number(calibration?.patternOpacity ?? DEFAULT_CALIBRATION.patternOpacity))
    ),
    maskOutlineMode: OUTLINE_MODE_KEYS.includes(calibration?.maskOutlineMode)
      ? calibration.maskOutlineMode
      : DEFAULT_CALIBRATION.maskOutlineMode,
    maskOutlineColor: isHexColor(calibration?.maskOutlineColor)
      ? calibration.maskOutlineColor
      : DEFAULT_CALIBRATION.maskOutlineColor,
    maskOutlineWidth: Math.max(
      0.2,
      Math.min(12, Number(calibration?.maskOutlineWidth ?? DEFAULT_CALIBRATION.maskOutlineWidth))
    ),
    selectedMaskFlashMode: FLASH_MODE_KEYS.includes(calibration?.selectedMaskFlashMode)
      ? calibration.selectedMaskFlashMode
      : DEFAULT_CALIBRATION.selectedMaskFlashMode,
    selectedMaskFlashColor: isHexColor(calibration?.selectedMaskFlashColor)
      ? calibration.selectedMaskFlashColor
      : DEFAULT_CALIBRATION.selectedMaskFlashColor,
    selectedMaskFlashSpeed: Math.max(
      0.2,
      Math.min(6, Number(calibration?.selectedMaskFlashSpeed ?? DEFAULT_CALIBRATION.selectedMaskFlashSpeed))
    ),
    selectedMaskSoloInOutput: Boolean(calibration?.selectedMaskSoloInOutput),
    outputBlackoutMode: Boolean(calibration?.outputBlackoutMode),
    selectedMaskOutlineBoost: calibration?.selectedMaskOutlineBoost !== false,
    operatorZoomEnabled: Boolean(calibration?.operatorZoomEnabled),
    operatorZoom: Math.max(
      1,
      Math.min(6, Number(calibration?.operatorZoom ?? DEFAULT_CALIBRATION.operatorZoom))
    ),
    operatorPanX: Number(calibration?.operatorPanX || 0),
    operatorPanY: Number(calibration?.operatorPanY || 0),
    operatorPanelSize: Math.max(
      220,
      Math.min(520, Number(calibration?.operatorPanelSize ?? DEFAULT_CALIBRATION.operatorPanelSize))
    )
  };
}

function normalizeVector3(value, fallback = [0, 0, 0]) {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  return [
    Number(value[0] || 0),
    Number(value[1] || 0),
    Number(value[2] || 0)
  ];
}

function getOutputCameraPosition(modelRotation = [0, 0, 0]) {
  const ry = Number(modelRotation?.[1] || 0);
  const quarterTurn = Math.PI / 2;
  const epsilon = 0.001;

  if (Math.abs(Math.abs(ry) - quarterTurn) < epsilon) {
    return [10, 0, 0];
  }

  if (Math.abs(Math.abs(ry) - Math.PI) < epsilon) {
    return [0, 0, -8];
  }

  return [0, 0, 8];
}

function updateStoredState(updater) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    const next = typeof updater === "function" ? updater(parsed) : updater;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    //
  }
}

function updateStoredProjector(updater) {
  updateStoredState((parsed) => ({
    ...parsed,
    projector: normalizeProjector(
      typeof updater === "function" ? updater(parsed?.projector || {}) : updater
    )
  }));
}

function updateStoredCalibration(updater) {
  updateStoredState((parsed) => ({
    ...parsed,
    calibration: normalizeCalibration(
      typeof updater === "function" ? updater(parsed?.calibration || {}) : updater
    )
  }));
}

function movePoints(points, dx, dy, wallW, wallH) {
  return (points || []).map((p) => ({
    ...p,
    x: Math.max(0, Math.min(wallW, Number(p?.x || 0) + dx)),
    y: Math.max(0, Math.min(wallH, Number(p?.y || 0) + dy))
  }));
}

function ensureMeshWarp(warp, wallW, wallH, cols = 4, rows = 4) {
  if (
    warp?.mode === "mesh" &&
    Array.isArray(warp?.points) &&
    Number(warp?.cols) >= 2 &&
    Number(warp?.rows) >= 2
  ) {
    return {
      ...warp,
      points: warp.points.map((p) => ({
        ...p,
        x: Number(p?.x || 0),
        y: Number(p?.y || 0),
        pinned: Boolean(p?.pinned)
      }))
    };
  }

  const points = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      points.push({
        x: (col / (cols - 1)) * wallW,
        y: (row / (rows - 1)) * wallH,
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

function moveStoredSelectedMask(dx, dy, wallW, wallH) {
  updateStoredState((parsed) => {
    const selectedId = parsed?.selectedMaskId;
    if (!selectedId || selectedId === "__draft__") return parsed;

    const masks = Array.isArray(parsed?.masks) ? [...parsed.masks] : [];
    const index = masks.findIndex((m) => String(m?.id) === String(selectedId));
    if (index < 0) return parsed;

    const mask = masks[index];
    const movedPoints = movePoints(mask?.points || [], dx, dy, wallW, wallH);
    const movedWarp = offsetWarp(mask?.localWarp, dx, dy, wallW, wallH, 4, 4);

    masks[index] = {
      ...mask,
      points: movedPoints,
      localWarp: movedWarp
    };

    return {
      ...parsed,
      masks
    };
  });
}

function bumpStoredSelectedMaskZ(delta) {
  updateStoredState((parsed) => {
    const selectedId = parsed?.selectedMaskId;
    if (!selectedId || selectedId === "__draft__") return parsed;

    const masks = Array.isArray(parsed?.masks) ? [...parsed.masks] : [];
    const index = masks.findIndex((m) => String(m?.id) === String(selectedId));
    if (index < 0) return parsed;

    masks[index] = {
      ...masks[index],
      zIndex: Number(masks[index]?.zIndex || 0) + delta
    };

    return {
      ...parsed,
      masks
    };
  });
}

function getOrderedMasks(parsed) {
  const masks = Array.isArray(parsed?.masks) ? [...parsed.masks] : [];
  return masks.sort((a, b) => Number(a?.zIndex || 0) - Number(b?.zIndex || 0));
}

function getOrderedMaskIds(parsed) {
  return getOrderedMasks(parsed)
    .map((m) => m?.id)
    .filter((id) => id != null);
}

function selectStoredMaskByStep(step) {
  updateStoredState((parsed) => {
    const orderedIds = getOrderedMaskIds(parsed);
    if (!orderedIds.length) return parsed;

    const currentId = parsed?.selectedMaskId;
    if (!currentId || currentId === "__draft__") {
      return {
        ...parsed,
        selectedMaskId: orderedIds[step > 0 ? 0 : orderedIds.length - 1]
      };
    }

    const currentIndex = orderedIds.findIndex((id) => String(id) === String(currentId));
    if (currentIndex < 0) {
      return {
        ...parsed,
        selectedMaskId: orderedIds[0]
      };
    }

    const nextIndex = Math.max(0, Math.min(orderedIds.length - 1, currentIndex + step));

    return {
      ...parsed,
      selectedMaskId: orderedIds[nextIndex]
    };
  });
}

function selectStoredMaskEdge(edge) {
  updateStoredState((parsed) => {
    const orderedIds = getOrderedMaskIds(parsed);
    if (!orderedIds.length) return parsed;

    return {
      ...parsed,
      selectedMaskId: edge === "first" ? orderedIds[0] : orderedIds[orderedIds.length - 1]
    };
  });
}

function getSelectedMaskMeta(parsed) {
  const orderedMasks = getOrderedMasks(parsed);
  const total = orderedMasks.length;
  const selectedId = parsed?.selectedMaskId;

  if (!selectedId || selectedId === "__draft__") {
    return {
      total,
      index: null,
      label: selectedId === "__draft__" ? "Draft" : "Brak wyboru"
    };
  }

  const idx = orderedMasks.findIndex((m) => String(m?.id) === String(selectedId));
  if (idx < 0) {
    return {
      total,
      index: null,
      label: "Brak wyboru"
    };
  }

  const mask = orderedMasks[idx];
  return {
    total,
    index: idx + 1,
    label: mask?.name || `Maska ${mask?.id}`
  };
}

function OutputCalibrationOverlay({
  projector,
  calibration,
  selectedMaskId,
  selectedMeta,
  compact = false
}) {
  if (!calibration?.showOverlay) return null;

  return (
    <>
      {calibration?.showGrid ? <GridOverlay compact={compact} /> : null}
      {calibration?.showCrosshair ? <CrosshairOverlay compact={compact} /> : null}
      {calibration?.pattern !== "none" ? (
        <PatternOverlay
          pattern={calibration.pattern}
          opacity={calibration.patternOpacity}
          compact={compact}
        />
      ) : null}
      {selectedMeta ? <SelectedMaskBadge selectedMeta={selectedMeta} compact={compact} /> : null}
      {calibration?.showInfo ? (
        <InfoOverlay
          projector={projector}
          calibration={calibration}
          selectedMaskId={selectedMaskId}
          selectedMeta={selectedMeta}
          compact={compact}
        />
      ) : null}
    </>
  );
}

function GridOverlay({ compact = false }) {
  const lines = [];

  for (let i = 1; i < 10; i += 1) {
    const pos = `${i * 10}%`;

    lines.push(
      <div
        key={`v-${i}`}
        style={{
          position: "absolute",
          left: pos,
          top: 0,
          bottom: 0,
          width: 1,
          background: compact ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.14)"
        }}
      />
    );

    lines.push(
      <div
        key={`h-${i}`}
        style={{
          position: "absolute",
          top: pos,
          left: 0,
          right: 0,
          height: 1,
          background: compact ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.14)"
        }}
      />
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: compact
            ? "1px solid rgba(255,255,255,0.18)"
            : "2px solid rgba(255,255,255,0.25)",
          boxSizing: "border-box"
        }}
      />
      {lines}
    </div>
  );
}

function CrosshairOverlay({ compact = false }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 1,
          background: "rgba(255,80,80,0.8)"
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: 1,
          background: "rgba(255,80,80,0.8)"
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: compact ? 10 : 14,
          height: compact ? 10 : 14,
          transform: "translate(-50%, -50%)",
          border: "1px solid rgba(255,80,80,0.95)",
          borderRadius: "50%"
        }}
      />
    </div>
  );
}

function PatternOverlay({ pattern, opacity }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity
      }}
    >
      {pattern === "frame" ? <FramePattern /> : null}
      {pattern === "checkerboard" ? <CheckerboardPattern /> : null}
      {pattern === "windows" ? <WindowsPattern /> : null}
      {pattern === "bands" ? <BandsPattern /> : null}
      {pattern === "cross" ? <CrossPattern /> : null}
    </div>
  );
}

function FramePattern() {
  return (
    <>
      <div style={frameRect("4%", "4%", "92%", "92%", 3)} />
      <div style={frameRect("10%", "10%", "80%", "80%", 2)} />
      <div style={frameRect("20%", "20%", "60%", "60%", 2)} />
    </>
  );
}

function CheckerboardPattern() {
  const cells = [];
  const size = 10;

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const isWhite = (row + col) % 2 === 0;
      cells.push(
        <div
          key={`${row}-${col}`}
          style={{
            position: "absolute",
            left: `${col * 10}%`,
            top: `${row * 10}%`,
            width: "10%",
            height: "10%",
            background: isWhite ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.7)",
            outline: "1px solid rgba(255,255,255,0.18)",
            boxSizing: "border-box"
          }}
        />
      );
    }
  }

  return <>{cells}</>;
}

function WindowsPattern() {
  const windows = [
    ["12%", "18%"], ["30%", "18%"], ["48%", "18%"], ["66%", "18%"],
    ["12%", "42%"], ["30%", "42%"], ["48%", "42%"], ["66%", "42%"]
  ];

  return (
    <>
      <div style={frameRect("4%", "4%", "92%", "92%", 2)} />
      {windows.map(([left, top], index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left,
            top,
            width: "12%",
            height: "20%",
            border: "2px solid rgba(255,255,255,0.95)",
            background: "rgba(255,255,255,0.12)",
            boxSizing: "border-box"
          }}
        />
      ))}
    </>
  );
}

function BandsPattern() {
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            top: `${i * 16.6667}%`,
            width: "100%",
            height: "8.3333%",
            background: i % 2 === 0 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.18)"
          }}
        />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={`v-${i}`}
          style={{
            position: "absolute",
            top: 0,
            left: `${i * 16.6667}%`,
            width: "8.3333%",
            height: "100%",
            background: i % 2 === 1 ? "rgba(255,255,255,0.14)" : "transparent"
          }}
        />
      ))}
    </>
  );
}

function CrossPattern() {
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 3,
          transform: "translateX(-50%)",
          background: "rgba(255,255,255,0.95)"
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: 3,
          transform: "translateY(-50%)",
          background: "rgba(255,255,255,0.95)"
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 90,
          height: 90,
          transform: "translate(-50%, -50%)",
          border: "2px solid rgba(255,255,255,0.95)",
          borderRadius: "50%"
        }}
      />
      <div style={frameRect("4%", "4%", "92%", "92%", 2)} />
    </>
  );
}

function frameRect(left, top, width, height, borderWidth = 2) {
  return {
    position: "absolute",
    left,
    top,
    width,
    height,
    border: `${borderWidth}px solid rgba(255,255,255,0.95)`,
    boxSizing: "border-box"
  };
}

function SelectedMaskBadge({ selectedMeta, compact = false }) {
  const counter =
    selectedMeta?.index != null && selectedMeta?.total != null
      ? `${selectedMeta.index} / ${selectedMeta.total}`
      : selectedMeta?.total
        ? `0 / ${selectedMeta.total}`
        : null;

  return (
    <div
      style={{
        position: "absolute",
        top: compact ? 8 : 12,
        right: compact ? 8 : 12,
        maxWidth: compact ? 180 : 320,
        padding: compact ? "6px 8px" : "10px 12px",
        borderRadius: 10,
        background: "rgba(0,0,0,0.7)",
        color: "#fff",
        fontSize: compact ? 10 : 12,
        lineHeight: 1.4,
        pointerEvents: "none",
        textAlign: "right"
      }}
    >
      <div style={{ fontSize: compact ? 9 : 11, opacity: 0.75, marginBottom: 2 }}>
        Wybrana maska
      </div>
      <div style={{ fontWeight: 700, fontSize: compact ? 11 : 13 }}>
        {selectedMeta?.label || "Brak wyboru"}
      </div>
      {counter ? (
        <div style={{ marginTop: 2, opacity: 0.85 }}>
          {counter}
        </div>
      ) : null}
    </div>
  );
}

function InfoOverlay({ projector, calibration, selectedMaskId, selectedMeta, compact = false }) {
  const patternLabels = {
    none: "Brak",
    frame: "Ramka",
    checkerboard: "Szachownica",
    windows: "Test okien",
    bands: "Pasy",
    cross: "Krzyż + środek"
  };

  const outlineLabels = {
    off: "Brak",
    overlay: "Na treści",
    only: "Same kontury"
  };

  const flashLabels = {
    off: "Brak",
    fill: "Fill",
    outline: "Kontur",
    both: "Fill + kontur"
  };

  const counter =
    selectedMeta?.index != null && selectedMeta?.total != null
      ? `${selectedMeta.index}/${selectedMeta.total}`
      : selectedMeta?.total
        ? `0/${selectedMeta.total}`
        : "-";

  return (
    <div
      style={{
        position: "absolute",
        top: compact ? 8 : 12,
        left: compact ? 8 : 12,
        padding: compact ? "6px 8px" : "10px 12px",
        borderRadius: 10,
        background: "rgba(0,0,0,0.6)",
        color: "#fff",
        fontSize: compact ? 9 : 12,
        lineHeight: 1.45,
        pointerEvents: "none",
        whiteSpace: "pre-line"
      }}
    >
      {`OffsetX: ${projector.offsetX.toFixed(2)}
OffsetY: ${projector.offsetY.toFixed(2)}
Distance: ${projector.distance.toFixed(2)}
AngleX: ${projector.angleX.toFixed(2)}
AngleY: ${projector.angleY.toFixed(2)}
AngleZ: ${projector.angleZ.toFixed(2)}
FOV: ${projector.fov.toFixed(2)}
Plansza: ${patternLabels[calibration.pattern] || calibration.pattern}
Kontury: ${outlineLabels[calibration.maskOutlineMode] || calibration.maskOutlineMode}
Flash: ${flashLabels[calibration.selectedMaskFlashMode] || calibration.selectedMaskFlashMode}
Solo output: ${calibration.selectedMaskSoloInOutput ? "Tak" : "Nie"}
Blackout: ${calibration.outputBlackoutMode ? "Tak" : "Nie"}
Selected ID: ${selectedMaskId ?? "-"}
Maska: ${selectedMeta?.label || "-"}
Pozycja: ${counter}`}
    </div>
  );
}

function HiddenProjectionTextures({
  wallW,
  wallH,
  frontMasks,
  middleMasks,
  backMasks,
  finalFrontDraft,
  finalMiddleDraft,
  finalBackDraft,
  globalWarp,
  contourProps,
  setFrontTexture,
  setMiddleTexture,
  setBackTexture
}) {
  return (
    <>
      <ProjectionTexture
        wallW={wallW}
        wallH={wallH}
        showGrid={false}
        showPinkBackground={false}
        masks={frontMasks}
        activeDraft={finalFrontDraft}
        finalWarp={globalWarp}
        onTexture={setFrontTexture}
        {...contourProps}
      />

      <ProjectionTexture
        wallW={wallW}
        wallH={wallH}
        showGrid={false}
        showPinkBackground={false}
        masks={middleMasks}
        activeDraft={finalMiddleDraft}
        finalWarp={globalWarp}
        onTexture={setMiddleTexture}
        {...contourProps}
      />

      <ProjectionTexture
        wallW={wallW}
        wallH={wallH}
        showGrid={false}
        showPinkBackground={false}
        masks={backMasks}
        activeDraft={finalBackDraft}
        finalWarp={globalWarp}
        onTexture={setBackTexture}
        {...contourProps}
      />
    </>
  );
}

function OutputStage({
  wallW,
  wallH,
  calibration,
  selectedMaskId,
  selectedMeta,
  projector,
  mode,
  modelUrl,
  modelRotation,
  modelOffset,
  outputCameraPosition,
  textures,
  compact = false
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: calibration.outputBlackoutMode ? "#000000" : "black",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <Canvas
        camera={{
          position: outputCameraPosition,
          fov: 45
        }}
      >
        <ProjectedSimpleScene
          mode={mode}
          modelUrl={modelUrl}
          modelRotation={modelRotation}
          modelOffset={modelOffset}
          textures={textures}
          projector={projector}
          depthOffsets={{
            front: 0.06,
            middle: 0,
            back: -0.06
          }}
          enableControls={false}
          showHelpers={false}
          showGrid={false}
        />
      </Canvas>

      <OutputCalibrationOverlay
        projector={projector}
        calibration={calibration}
        selectedMaskId={selectedMaskId}
        selectedMeta={selectedMeta}
        compact={compact}
      />
    </div>
  );
}

function OperatorZoomPanel({
  enabled,
  panelSize,
  zoom,
  panX,
  panY,
  stageProps
}) {
  if (!enabled) return null;

  return (
    <div
      style={{
        position: "absolute",
        right: 18,
        bottom: 18,
        width: panelSize,
        height: panelSize,
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(7,10,16,0.92)",
        boxShadow: "0 14px 32px rgba(0,0,0,0.45)",
        zIndex: 50,
        pointerEvents: "none"
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          right: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 2,
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          background: "rgba(0,0,0,0.5)",
          padding: "6px 8px",
          borderRadius: 8
        }}
      >
        <span>Zoom operatorski</span>
        <span>x{Number(zoom).toFixed(1)}</span>
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden"
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "100vw",
            height: "100vh",
            transform: `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: "center center"
          }}
        >
          <OutputStage {...stageProps} compact />
        </div>
      </div>
    </div>
  );
}

export default function ProjectorOutput({ wallW = 800, wallH = 500 }) {
  const [state, setState] = useState({});
  const [frontTexture, setFrontTexture] = useState(null);
  const [middleTexture, setMiddleTexture] = useState(null);
  const [backTexture, setBackTexture] = useState(null);

  const lastRawRef = useRef(null);

  const currentModelUrl = state?.outputModelUrl || "/models/fasada.glb";

  useProjectorBackgroundAudio(currentModelUrl, true);

  useEffect(() => {
    const load = () => {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw || raw === lastRawRef.current) return;

      lastRawRef.current = raw;

      try {
        setState(JSON.parse(raw));
      } catch {
        //
      }
    };

    load();
    window.addEventListener("storage", load);
    const i = setInterval(load, 120);

    return () => {
      window.removeEventListener("storage", load);
      clearInterval(i);
    };
  }, []);

  const masks = state?.masks || [];
  const draft = state?.draft || null;
  const globalWarp = state?.warp || null;
  const selectedMaskId = state?.selectedMaskId ?? null;
  const calibration = normalizeCalibration(state?.calibration || {});
  const projector = normalizeProjector(state?.projector || {});
  const selectedMeta = useMemo(() => getSelectedMaskMeta(state || {}), [state]);

  const modelRotation = useMemo(
    () => normalizeVector3(state?.selectedModelRotation || [0, 0, 0]),
    [state]
  );

  const modelOffset = useMemo(
    () => normalizeVector3(state?.selectedModelOffset || [0, 0, 0]),
    [state]
  );

  const outputCameraPosition = useMemo(
    () => getOutputCameraPosition(modelRotation),
    [modelRotation]
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
        return;
      }

      const moveStep = e.shiftKey
        ? Math.max(0.01, calibration.nudgeStep / 2)
        : calibration.nudgeStep;

      const angleStep = e.shiftKey
        ? Math.max(0.25, calibration.angleStep / 2)
        : calibration.angleStep;

      let handled = true;

      if (e.altKey) {
        if (e.key === "PageDown") {
          selectStoredMaskByStep(1);
          e.preventDefault();
          return;
        }

        if (e.key === "PageUp") {
          selectStoredMaskByStep(-1);
          e.preventDefault();
          return;
        }

        if (e.key === "Home") {
          selectStoredMaskEdge("first");
          e.preventDefault();
          return;
        }

        if (e.key === "End") {
          selectStoredMaskEdge("last");
          e.preventDefault();
          return;
        }

        if (e.key.toLowerCase() === "z") {
          updateStoredCalibration((prev) => ({
            ...prev,
            operatorZoomEnabled: !prev?.operatorZoomEnabled
          }));
          e.preventDefault();
          return;
        }

        if (e.key === "=" || e.key === "+") {
          updateStoredCalibration((prev) => ({
            ...prev,
            operatorZoom: Math.min(6, Number(prev?.operatorZoom || 1) + 0.1)
          }));
          e.preventDefault();
          return;
        }

        if (e.key === "-" || e.key === "_") {
          updateStoredCalibration((prev) => ({
            ...prev,
            operatorZoom: Math.max(1, Number(prev?.operatorZoom || 1) - 0.1)
          }));
          e.preventDefault();
          return;
        }

        if (e.key === "0") {
          updateStoredCalibration((prev) => ({
            ...prev,
            operatorZoomEnabled: false,
            operatorZoom: DEFAULT_CALIBRATION.operatorZoom,
            operatorPanX: DEFAULT_CALIBRATION.operatorPanX,
            operatorPanY: DEFAULT_CALIBRATION.operatorPanY,
            operatorPanelSize: DEFAULT_CALIBRATION.operatorPanelSize
          }));
          e.preventDefault();
          return;
        }

        if (e.key.toLowerCase() === "i") {
          updateStoredCalibration((prev) => ({
            ...prev,
            operatorPanY: Number(prev?.operatorPanY || 0) - 20
          }));
          e.preventDefault();
          return;
        }

        if (e.key.toLowerCase() === "k") {
          updateStoredCalibration((prev) => ({
            ...prev,
            operatorPanY: Number(prev?.operatorPanY || 0) + 20
          }));
          e.preventDefault();
          return;
        }

        if (e.key.toLowerCase() === "j") {
          updateStoredCalibration((prev) => ({
            ...prev,
            operatorPanX: Number(prev?.operatorPanX || 0) - 20
          }));
          e.preventDefault();
          return;
        }

        if (e.key.toLowerCase() === "l") {
          updateStoredCalibration((prev) => ({
            ...prev,
            operatorPanX: Number(prev?.operatorPanX || 0) + 20
          }));
          e.preventDefault();
          return;
        }
      }

      if (e.altKey && e.shiftKey && selectedMaskId && selectedMaskId !== "__draft__") {
        const maskStep = 2;

        if (e.key === "ArrowLeft") {
          moveStoredSelectedMask(-maskStep, 0, wallW, wallH);
        } else if (e.key === "ArrowRight") {
          moveStoredSelectedMask(maskStep, 0, wallW, wallH);
        } else if (e.key === "ArrowUp") {
          moveStoredSelectedMask(0, -maskStep, wallW, wallH);
        } else if (e.key === "ArrowDown") {
          moveStoredSelectedMask(0, maskStep, wallW, wallH);
        } else {
          handled = false;
        }

        if (handled) {
          e.preventDefault();
          return;
        }
      }

      if (e.altKey && selectedMaskId && selectedMaskId !== "__draft__") {
        if (e.key === "[") {
          bumpStoredSelectedMaskZ(-1);
          e.preventDefault();
          return;
        }

        if (e.key === "]") {
          bumpStoredSelectedMaskZ(1);
          e.preventDefault();
          return;
        }

        if (e.key.toLowerCase() === "s") {
          updateStoredCalibration((prev) => ({
            ...prev,
            selectedMaskSoloInOutput: !prev?.selectedMaskSoloInOutput
          }));
          e.preventDefault();
          return;
        }

        if (e.key.toLowerCase() === "b") {
          updateStoredCalibration((prev) => ({
            ...prev,
            outputBlackoutMode: !prev?.outputBlackoutMode
          }));
          e.preventDefault();
          return;
        }
      }

      switch (e.key) {
        case "ArrowLeft":
          updateStoredProjector((prev) => ({ ...prev, offsetX: Number(prev?.offsetX || 0) - moveStep }));
          break;
        case "ArrowRight":
          updateStoredProjector((prev) => ({ ...prev, offsetX: Number(prev?.offsetX || 0) + moveStep }));
          break;
        case "ArrowUp":
          updateStoredProjector((prev) => ({ ...prev, offsetY: Number(prev?.offsetY || 0) + moveStep }));
          break;
        case "ArrowDown":
          updateStoredProjector((prev) => ({ ...prev, offsetY: Number(prev?.offsetY || 0) - moveStep }));
          break;
        case "q":
        case "Q":
          updateStoredProjector((prev) => ({ ...prev, angleZ: Number(prev?.angleZ || 0) - angleStep }));
          break;
        case "e":
        case "E":
          updateStoredProjector((prev) => ({ ...prev, angleZ: Number(prev?.angleZ || 0) + angleStep }));
          break;
        case "w":
        case "W":
          updateStoredProjector((prev) => ({ ...prev, angleX: Number(prev?.angleX || 0) + angleStep }));
          break;
        case "s":
        case "S":
          updateStoredProjector((prev) => ({ ...prev, angleX: Number(prev?.angleX || 0) - angleStep }));
          break;
        case "a":
        case "A":
          updateStoredProjector((prev) => ({ ...prev, angleY: Number(prev?.angleY || 0) - angleStep }));
          break;
        case "d":
        case "D":
          updateStoredProjector((prev) => ({ ...prev, angleY: Number(prev?.angleY || 0) + angleStep }));
          break;
        case "r":
        case "R":
          updateStoredProjector((prev) => ({ ...prev, distance: Number(prev?.distance || 0) + moveStep }));
          break;
        case "f":
        case "F":
          updateStoredProjector((prev) => ({ ...prev, distance: Number(prev?.distance || 0) - moveStep }));
          break;
        case "+":
          updateStoredProjector((prev) => ({ ...prev, fov: Number(prev?.fov || 45) + 1 }));
          break;
        default:
          handled = false;
      }

      if (handled) e.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [calibration, selectedMaskId, wallW, wallH]);

  const baseFrontMasks = useMemo(() => filterMasksByDepth(masks, "front"), [masks]);
  const baseMiddleMasks = useMemo(() => filterMasksByDepth(masks, "middle"), [masks]);
  const baseBackMasks = useMemo(() => filterMasksByDepth(masks, "back"), [masks]);

  const frontDraft = useMemo(() => {
    if (!draft) return null;
    return getDraftDepth(draft) === "front" ? draft : null;
  }, [draft]);

  const middleDraft = useMemo(() => {
    if (!draft) return null;
    return getDraftDepth(draft) === "middle" ? draft : null;
  }, [draft]);

  const backDraft = useMemo(() => {
    if (!draft) return null;
    return getDraftDepth(draft) === "back" ? draft : null;
  }, [draft]);

  const isSolo = calibration.selectedMaskSoloInOutput && selectedMaskId != null;

  const pickSelected = (list) => {
    if (!isSolo) return list;
    if (selectedMaskId === "__draft__") return [];
    return list.filter((m) => String(m?.id) === String(selectedMaskId));
  };

  const frontMasks = useMemo(() => pickSelected(baseFrontMasks), [baseFrontMasks, isSolo, selectedMaskId]);
  const middleMasks = useMemo(() => pickSelected(baseMiddleMasks), [baseMiddleMasks, isSolo, selectedMaskId]);
  const backMasks = useMemo(() => pickSelected(baseBackMasks), [baseBackMasks, isSolo, selectedMaskId]);

  const finalFrontDraft = isSolo
    ? (selectedMaskId === "__draft__" ? frontDraft : null)
    : frontDraft;

  const finalMiddleDraft = isSolo
    ? (selectedMaskId === "__draft__" ? middleDraft : null)
    : middleDraft;

  const finalBackDraft = isSolo
    ? (selectedMaskId === "__draft__" ? backDraft : null)
    : backDraft;

  const mode =
    state?.outputSurfaceMode === "glb" ||
    state?.outputSurfaceMode === "lightGlb"
      ? "glb"
      : "plane";

  const contourProps = {
    outlineMode: calibration.maskOutlineMode,
    outlineColor: calibration.maskOutlineColor,
    outlineWidth: calibration.maskOutlineWidth,
    selectedMaskId,
    selectedMaskFlashMode: calibration.selectedMaskFlashMode,
    selectedMaskFlashColor: calibration.selectedMaskFlashColor,
    selectedMaskFlashSpeed: calibration.selectedMaskFlashSpeed,
    selectedMaskOutlineBoost: calibration.selectedMaskOutlineBoost
  };

  const stageProps = {
    wallW,
    wallH,
    calibration,
    selectedMaskId,
    selectedMeta,
    projector,
    mode,
    modelUrl: currentModelUrl,
    modelRotation,
    modelOffset,
    outputCameraPosition,
    textures: {
      front: frontTexture,
      middle: middleTexture,
      back: backTexture
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: calibration.outputBlackoutMode ? "#000000" : "black",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <HiddenProjectionTextures
        wallW={wallW}
        wallH={wallH}
        frontMasks={frontMasks}
        middleMasks={middleMasks}
        backMasks={backMasks}
        finalFrontDraft={finalFrontDraft}
        finalMiddleDraft={finalMiddleDraft}
        finalBackDraft={finalBackDraft}
        globalWarp={globalWarp}
        contourProps={contourProps}
        setFrontTexture={setFrontTexture}
        setMiddleTexture={setMiddleTexture}
        setBackTexture={setBackTexture}
      />

      <OutputStage {...stageProps} />

      <OperatorZoomPanel
        enabled={calibration.operatorZoomEnabled}
        panelSize={calibration.operatorPanelSize}
        zoom={calibration.operatorZoom}
        panX={calibration.operatorPanX}
        panY={calibration.operatorPanY}
        stageProps={stageProps}
      />
    </div>
  );
}