import { useEffect, useMemo, useState } from "react";
import { ui } from "../styles/ui";

const DEFAULT_IMAGE_PATH = "/textures/window.jpg";
const DEFAULT_VIDEO_PATH = "/videos/fasada.mp4";
const DEPTH_MIN = -50;
const DEPTH_MAX = 50;

function clampDepth(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(DEPTH_MIN, Math.min(DEPTH_MAX, Math.round(num)));
}

function getDefaultTextureValue(type, currentValue = "") {
  if (type === "color") {
    return currentValue?.startsWith("#") ? currentValue : "#ffffff";
  }
  if (type === "image") return currentValue || DEFAULT_IMAGE_PATH;
  if (type === "video") return currentValue || DEFAULT_VIDEO_PATH;
  return currentValue || "";
}

function parseLayerMeta(layerName = "") {
  const text = String(layerName || "");
  const blendMatch = text.match(/\[blend:([a-z-]+)\]/i);
  const featherMatch = text.match(/\[feather:(\d+)\]/i);
  const videoStartMatch = text.match(/\[video-start:([^\]]+)\]/i);
  const videoSpeedMatch = text.match(/\[video-speed:([^\]]+)\]/i);
  const videoPausedMatch = text.match(/\[video-paused:([^\]]+)\]/i);
  const videoLoopMatch = text.match(/\[video-loop:([^\]]+)\]/i);

  return {
    baseName: text
      .replace(/\[blend:[^\]]+\]/gi, "")
      .replace(/\[feather:[^\]]+\]/gi, "")
      .replace(/\[video-start:[^\]]+\]/gi, "")
      .replace(/\[video-speed:[^\]]+\]/gi, "")
      .replace(/\[video-paused:[^\]]+\]/gi, "")
      .replace(/\[video-loop:[^\]]+\]/gi, "")
      .trim(),
    blend: (blendMatch?.[1] || "source-over").toLowerCase(),
    feather: Math.max(0, Number(featherMatch?.[1] || 0)),
    videoStart: Math.max(0, Number(videoStartMatch?.[1] || 0)),
    videoSpeed: Math.max(0.1, Number(videoSpeedMatch?.[1] || 1) || 1),
    videoPaused: ["1", "true", "yes", "on"].includes(
      String(videoPausedMatch?.[1] || "0").toLowerCase()
    ),
    videoLoop: !["0", "false", "no", "off"].includes(
      String(videoLoopMatch?.[1] || "1").toLowerCase()
    )
  };
}

function buildLayerName(
  baseName,
  blend,
  feather,
  videoStart,
  videoSpeed,
  videoPaused,
  videoLoop
) {
  const parts = [];
  const trimmedBase = String(baseName || "").trim();

  if (trimmedBase) parts.push(trimmedBase);

  if (blend && blend !== "source-over") {
    parts.push(`[blend:${blend}]`);
  }

  if (Number(feather || 0) > 0) {
    parts.push(`[feather:${Math.max(0, Number(feather || 0))}]`);
  }

  if (Number(videoStart || 0) > 0) {
    parts.push(`[video-start:${Math.max(0, Number(videoStart || 0))}]`);
  }

  if (Number(videoSpeed || 1) !== 1) {
    parts.push(`[video-speed:${Math.max(0.1, Number(videoSpeed || 1))}]`);
  }

  if (videoPaused) {
    parts.push("[video-paused:true]");
  }

  if (videoLoop === false) {
    parts.push("[video-loop:false]");
  }

  return parts.join(" ").trim() || "default";
}

export default function Toolbar({
  mode,
  setMode,
  showGrid,
  setShowGrid,
  showPinkBackground,
  setShowPinkBackground,
  opacity,
  setOpacity,
  maskName,
  setMaskName,
  maskType,
  setMaskType,
  operation,
  setOperation,
  zIndex,
  setZIndex,
  selectedMaskId,
  onDepthPreview,
  onDepthCommit,
  visible,
  setVisible,
  locked,
  setLocked,
  layerName,
  setLayerName,
  textureType,
  setTextureType,
  textureValue,
  setTextureValue,
  canSaveNew,
  canUpdate,
  onSaveNew,
  onUpdate,
  onReset,
  onExportJson
}) {
  const meta = parseLayerMeta(layerName);
  const baseLayerName = meta.baseName || "default";
  const blend = meta.blend || "source-over";
  const feather = meta.feather || 0;
  const videoStart = meta.videoStart || 0;
  const videoSpeed = meta.videoSpeed || 1;
  const videoPaused = meta.videoPaused || false;
  const videoLoop = meta.videoLoop !== false;
  const hasSelectedMask = selectedMaskId !== null && selectedMaskId !== undefined;

  const [depthDraft, setDepthDraft] = useState(() => clampDepth(zIndex));

  useEffect(() => {
    setDepthDraft(clampDepth(zIndex));
  }, [zIndex, selectedMaskId]);

  const depthLabel = useMemo(() => {
    if (depthDraft > 0) return `+${depthDraft}`;
    return `${depthDraft}`;
  }, [depthDraft]);

  const setLayerMeta = (next) => {
    setLayerName(
      buildLayerName(
        next.baseName ?? baseLayerName,
        next.blend ?? blend,
        next.feather ?? feather,
        next.videoStart ?? videoStart,
        next.videoSpeed ?? videoSpeed,
        next.videoPaused ?? videoPaused,
        next.videoLoop ?? videoLoop
      )
    );
  };

  const handleTextureTypeChange = (e) => {
    const nextType = e.target.value;
    setTextureType(nextType);
    setTextureValue(getDefaultTextureValue(nextType, ""));
  };

  const applyDefaultAssetPath = () => {
    setTextureValue(getDefaultTextureValue(textureType, ""));
  };

  const previewDepth = (rawValue) => {
    const nextValue = clampDepth(rawValue);
    setDepthDraft(nextValue);
    setZIndex(nextValue);
    onDepthPreview?.(nextValue);
  };

  const commitDepth = (rawValue = depthDraft) => {
    const nextValue = clampDepth(rawValue);
    setDepthDraft(nextValue);
    setZIndex(nextValue);
    onDepthCommit?.(nextValue);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={ui.label}>Mask name</div>
        <input
          style={ui.input}
          value={maskName}
          onChange={(e) => setMaskName(e.target.value)}
          placeholder="np. Left Window"
        />
      </div>

      <div>
        <div style={ui.label}>Mask type</div>
        <select
          style={ui.input}
          value={maskType}
          onChange={(e) => setMaskType(e.target.value)}
        >
          <option value="window">window</option>
          <option value="door">door</option>
          <option value="balcony">balcony</option>
          <option value="ignore-zone">ignore-zone</option>
          <option value="projection-zone">projection-zone</option>
        </select>
      </div>

      <div>
        <div style={ui.label}>Warstwa / operacja</div>
        <select
          style={ui.input}
          value={operation}
          onChange={(e) => setOperation(e.target.value)}
        >
          <option value="add">add</option>
          <option value="subtract">subtract</option>
          <option value="intersect">intersect</option>
        </select>
      </div>

      <div>
        <div style={ui.label}>
          Głębokość maski {hasSelectedMask ? `(${depthLabel})` : ""}
        </div>

        <input
          type="range"
          min={DEPTH_MIN}
          max={DEPTH_MAX}
          step="1"
          value={depthDraft}
          disabled={!hasSelectedMask}
          style={{ width: "100%", opacity: hasSelectedMask ? 1 : 0.5 }}
          onChange={(e) => previewDepth(e.target.value)}
          onMouseUp={(e) => commitDepth(e.target.value)}
          onTouchEnd={(e) => commitDepth(e.target.value)}
        />

        <div style={ui.small}>
          {hasSelectedMask
            ? `Aktualna głębokość: ${depthLabel}`
            : "Najpierw wybierz zapisaną maskę"}
        </div>
      </div>

      <div>
        <div style={ui.label}>Opacity</div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          style={{ width: "100%" }}
        />
        <div style={ui.small}>{opacity.toFixed(2)}</div>
      </div>

      <div>
        <div style={ui.label}>Layer name</div>
        <input
          style={ui.input}
          value={baseLayerName}
          onChange={(e) => setLayerMeta({ baseName: e.target.value })}
          placeholder="default"
        />
      </div>

      <div>
        <div style={ui.label}>Blend mode</div>
        <select
          style={ui.input}
          value={blend}
          onChange={(e) => setLayerMeta({ blend: e.target.value })}
        >
          <option value="source-over">normal</option>
          <option value="multiply">multiply</option>
          <option value="screen">screen</option>
          <option value="overlay">overlay</option>
          <option value="lighten">lighten</option>
          <option value="darken">darken</option>
          <option value="color-dodge">color-dodge</option>
          <option value="color-burn">color-burn</option>
        </select>
      </div>

      <div>
        <div style={ui.label}>Feather</div>
        <input
          type="range"
          min="0"
          max="50"
          step="1"
          value={feather}
          onChange={(e) => setLayerMeta({ feather: Number(e.target.value) })}
          style={{ width: "100%" }}
        />
        <div style={ui.small}>{feather}px</div>
      </div>

      <div>
        <div style={ui.label}>Texture type</div>
        <select
          style={ui.input}
          value={textureType}
          onChange={handleTextureTypeChange}
        >
          <option value="color">color</option>
          <option value="image">image</option>
          <option value="video">video</option>
        </select>
      </div>

      <div>
        <div style={ui.label}>Texture value</div>
        <input
          style={ui.input}
          value={textureValue}
          onChange={(e) => setTextureValue(e.target.value)}
          placeholder={
            textureType === "color"
              ? "#ffffff"
              : textureType === "image"
              ? "/textures/window.jpg"
              : "/videos/fasada.mp4"
          }
        />
        <div style={{ marginTop: 8 }}>
          <button type="button" style={ui.button} onClick={applyDefaultAssetPath}>
            Ustaw domyślną ścieżkę
          </button>
        </div>
      </div>

      {textureType === "video" && (
        <>
          <div>
            <div style={ui.label}>Video start</div>
            <input
              type="number"
              min="0"
              step="0.1"
              style={ui.input}
              value={videoStart}
              onChange={(e) =>
                setLayerMeta({ videoStart: Number(e.target.value || 0) })
              }
            />
          </div>

          <div>
            <div style={ui.label}>Video speed</div>
            <input
              type="number"
              min="0.1"
              step="0.1"
              style={ui.input}
              value={videoSpeed}
              onChange={(e) =>
                setLayerMeta({ videoSpeed: Number(e.target.value || 1) })
              }
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              style={ui.button}
              onClick={() => setLayerMeta({ videoPaused: !videoPaused })}
            >
              {videoPaused ? "Resume video" : "Pause video"}
            </button>

            <button
              type="button"
              style={ui.button}
              onClick={() => setLayerMeta({ videoLoop: !videoLoop })}
            >
              Loop: {videoLoop ? "ON" : "OFF"}
            </button>
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          style={visible ? ui.buttonPrimary : ui.button}
          onClick={() => setVisible(!visible)}
        >
          Visible: {visible ? "ON" : "OFF"}
        </button>

        <button
          type="button"
          style={locked ? ui.buttonPrimary : ui.button}
          onClick={() => setLocked(!locked)}
        >
          Locked: {locked ? "ON" : "OFF"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button
          style={ui.buttonPrimary}
          onClick={onSaveNew}
          disabled={!canSaveNew}
          type="button"
        >
          Save new
        </button>

        <button
          style={ui.button}
          onClick={onUpdate}
          disabled={!canUpdate}
          type="button"
        >
          Update
        </button>

        <button style={ui.button} onClick={onExportJson} type="button">
          Export JSON
        </button>

        <button style={ui.buttonDanger} onClick={onReset} type="button">
          Reset
        </button>
      </div>
    </div>
  );
}