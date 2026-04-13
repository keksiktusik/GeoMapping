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
  const cutoutMatch = text.match(/\[cutout:([^\]]+)\]/i);

  return {
    baseName: text
      .replace(/\[blend:[^\]]+\]/gi, "")
      .replace(/\[feather:[^\]]+\]/gi, "")
      .replace(/\[video-start:[^\]]+\]/gi, "")
      .replace(/\[video-speed:[^\]]+\]/gi, "")
      .replace(/\[video-paused:[^\]]+\]/gi, "")
      .replace(/\[video-loop:[^\]]+\]/gi, "")
      .replace(/\[cutout:[^\]]+\]/gi, "")
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
    ),
    cutout: ["1", "true", "yes", "on"].includes(
      String(cutoutMatch?.[1] || "0").toLowerCase()
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
  videoLoop,
  cutout
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

  if (cutout) {
    parts.push("[cutout:true]");
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
  const cutout = meta.cutout === true;
  const hasSelectedMask = selectedMaskId !== null && selectedMaskId !== undefined;
  const isIgnoreZone = maskType === "ignore-zone";

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
        next.videoLoop ?? videoLoop,
        next.cutout ?? cutout
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
        <div style={ui.label}>Nazwa maski</div>
        <input
          style={ui.input}
          value={maskName}
          onChange={(e) => setMaskName(e.target.value)}
          placeholder="np. Lewe okno"
        />
      </div>

      <div>
        <div style={ui.label}>Typ maski</div>
        <select
          style={ui.input}
          value={maskType}
          onChange={(e) => setMaskType(e.target.value)}
        >
          <option value="window">okno</option>
          <option value="door">drzwi</option>
          <option value="balcony">balkon</option>
          <option value="ignore-zone">strefa wycięcia</option>
          <option value="projection-zone">strefa projekcji</option>
        </select>
      </div>

      <div>
        <div style={ui.label}>Operacja warstwy</div>
        <select
          style={ui.input}
          value={isIgnoreZone ? "subtract" : operation}
          onChange={(e) => setOperation(e.target.value)}
          disabled={isIgnoreZone}
        >
          <option value="add">dodaj</option>
          <option value="subtract">odejmij</option>
          <option value="intersect">część wspólna</option>
        </select>
        {isIgnoreZone && (
          <div style={ui.small}>
            Dla strefy wycięcia operacja jest zawsze ustawiona na „odejmij”.
          </div>
        )}
      </div>

      {!isIgnoreZone && (
        <div>
          <button
            type="button"
            style={cutout ? ui.buttonPrimary : ui.button}
            onClick={() => setLayerMeta({ cutout: !cutout })}
          >
            Wycinaj tło pod maską: {cutout ? "WŁ." : "WYŁ."}
          </button>
          <div style={ui.small}>
            Gdy włączone, maska najpierw wytnie tło pod sobą, a potem narysuje własną zawartość.
          </div>
        </div>
      )}

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
        <div style={ui.label}>Przezroczystość</div>
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
        <div style={ui.label}>Nazwa warstwy</div>
        <input
          style={ui.input}
          value={baseLayerName}
          onChange={(e) => setLayerMeta({ baseName: e.target.value })}
          placeholder="default"
        />
      </div>

      <div>
        <div style={ui.label}>Tryb mieszania</div>
        <select
          style={ui.input}
          value={blend}
          onChange={(e) => setLayerMeta({ blend: e.target.value })}
        >
          <option value="source-over">normalny</option>
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
        <div style={ui.label}>Feather / rozmycie</div>
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
        <div style={ui.label}>Typ tekstury</div>
        <select
          style={ui.input}
          value={textureType}
          onChange={handleTextureTypeChange}
          disabled={isIgnoreZone}
        >
          <option value="color">kolor</option>
          <option value="image">obraz</option>
          <option value="video">wideo</option>
        </select>
        {isIgnoreZone && (
          <div style={ui.small}>
            Dla strefy wycięcia tekstura nie ma znaczenia. Liczy się sam kształt.
          </div>
        )}
      </div>

      <div>
        <div style={ui.label}>Wartość tekstury</div>
        <input
          style={ui.input}
          value={textureValue}
          onChange={(e) => setTextureValue(e.target.value)}
          disabled={isIgnoreZone}
          placeholder={
            textureType === "color"
              ? "#ffffff"
              : textureType === "image"
              ? "/textures/window.jpg"
              : "/videos/fasada.mp4"
          }
        />
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            style={ui.button}
            onClick={applyDefaultAssetPath}
            disabled={isIgnoreZone}
          >
            Ustaw domyślną ścieżkę
          </button>
        </div>
      </div>

      {textureType === "video" && !isIgnoreZone && (
        <>
          <div>
            <div style={ui.label}>Start wideo</div>
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
            <div style={ui.label}>Prędkość wideo</div>
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
              {videoPaused ? "Wznów wideo" : "Pauza wideo"}
            </button>

            <button
              type="button"
              style={ui.button}
              onClick={() => setLayerMeta({ videoLoop: !videoLoop })}
            >
              Pętla: {videoLoop ? "WŁ." : "WYŁ."}
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
          Widoczność: {visible ? "WŁ." : "WYŁ."}
        </button>

        <button
          type="button"
          style={locked ? ui.buttonPrimary : ui.button}
          onClick={() => setLocked(!locked)}
        >
          Blokada: {locked ? "WŁ." : "WYŁ."}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button
          style={ui.buttonPrimary}
          onClick={onSaveNew}
          disabled={!canSaveNew}
          type="button"
        >
          Zapisz nową
        </button>

        <button
          style={ui.button}
          onClick={onUpdate}
          disabled={!canUpdate}
          type="button"
        >
          Aktualizuj
        </button>

        <button style={ui.button} onClick={onExportJson} type="button">
          Eksport JSON
        </button>

        <button style={ui.buttonDanger} onClick={onReset} type="button">
          Reset
        </button>
      </div>
    </div>
  );
}