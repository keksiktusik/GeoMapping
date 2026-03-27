import { ui } from "../styles/ui";

const DEFAULT_IMAGE_PATH = "/textures/window.jpg";
const DEFAULT_VIDEO_PATH = "/videos/fasada.mp4";

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

  return {
    baseName: text
      .replace(/\[blend:[^\]]+\]/gi, "")
      .replace(/\[feather:[^\]]+\]/gi, "")
      .trim(),
    blend: (blendMatch?.[1] || "source-over").toLowerCase(),
    feather: Math.max(0, Number(featherMatch?.[1] || 0))
  };
}

function buildLayerName(baseName, blend, feather) {
  const parts = [];
  const trimmedBase = String(baseName || "").trim();

  if (trimmedBase) parts.push(trimmedBase);

  if (blend && blend !== "source-over") {
    parts.push(`[blend:${blend}]`);
  }

  if (Number(feather || 0) > 0) {
    parts.push(`[feather:${Math.max(0, Number(feather || 0))}]`);
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

  const setLayerMeta = (next) => {
    setLayerName(
      buildLayerName(
        next.baseName ?? baseLayerName,
        next.blend ?? blend,
        next.feather ?? feather
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
          <option value="add">Normal</option>
          <option value="subtract">Cutout / wytnij</option>
          <option value="intersect">Mask / zostaw część wspólną</option>
        </select>
      </div>

      <div>
        <div style={ui.label}>Nazwa warstwy</div>
        <input
          style={ui.input}
          value={baseLayerName}
          onChange={(e) => setLayerMeta({ baseName: e.target.value })}
          placeholder="np. facade-base"
        />
      </div>

      <div>
        <div style={ui.label}>Blend mode</div>
        <select
          style={ui.input}
          value={blend}
          onChange={(e) => setLayerMeta({ blend: e.target.value })}
        >
          <option value="source-over">Normal</option>
          <option value="multiply">Multiply</option>
          <option value="screen">Screen</option>
          <option value="overlay">Overlay</option>
          <option value="lighten">Lighten</option>
          <option value="darken">Darken</option>
          <option value="hard-light">Hard light</option>
          <option value="soft-light">Soft light</option>
          <option value="difference">Difference</option>
          <option value="exclusion">Exclusion</option>
        </select>
      </div>

      <div>
        <div style={ui.label}>Feather krawędzi: {feather}px</div>
        <input
          style={{ width: "100%" }}
          type="range"
          min="0"
          max="20"
          step="1"
          value={feather}
          onChange={(e) =>
            setLayerMeta({ feather: Number(e.target.value || 0) })
          }
        />
      </div>

      <div>
        <div style={ui.label}>Projection material</div>
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
        <div style={ui.label}>Material value</div>

        {textureType === "color" ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              style={{ ...ui.input, height: 42, padding: 4, minWidth: 64 }}
              type="color"
              value={textureValue || "#ffffff"}
              onChange={(e) => setTextureValue(e.target.value)}
            />

            <input
              style={ui.input}
              value={textureValue || "#ffffff"}
              onChange={(e) => setTextureValue(e.target.value)}
              placeholder="#ffffff"
            />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              style={ui.input}
              value={textureValue || ""}
              onChange={(e) => setTextureValue(e.target.value)}
              placeholder={
                textureType === "image"
                  ? "np. /textures/window.jpg"
                  : "np. /videos/fasada.mp4"
              }
            />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                style={ui.button}
                type="button"
                onClick={applyDefaultAssetPath}
              >
                Ustaw domyślną ścieżkę
              </button>

              <div
                style={{
                  fontSize: 12,
                  opacity: 0.8,
                  display: "flex",
                  alignItems: "center"
                }}
              >
                {textureType === "image"
                  ? `np. ${DEFAULT_IMAGE_PATH}`
                  : `np. ${DEFAULT_VIDEO_PATH}`}
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <div style={ui.label}>Z-index</div>
        <input
          style={ui.input}
          type="number"
          value={zIndex}
          onChange={(e) => setZIndex(parseInt(e.target.value || "0", 10))}
        />
      </div>

      <div>
        <div style={ui.label}>Editor mode</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={mode === "draw" ? ui.buttonPrimary : ui.button}
            onClick={() => setMode("draw")}
            type="button"
          >
            Draw
          </button>

          <button
            style={mode === "edit" ? ui.buttonPrimary : ui.button}
            onClick={() => setMode("edit")}
            type="button"
          >
            Edit
          </button>
        </div>
      </div>

      <div>
        <div style={ui.label}>Opacity: {opacity.toFixed(2)}</div>
        <input
          style={{ width: "100%" }}
          type="range"
          min="0.05"
          max="1"
          step="0.05"
          value={opacity}
          onChange={(e) => setOpacity(parseFloat(e.target.value))}
        />
      </div>

      <div>
        <div style={ui.label}>Helpers</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            style={showGrid ? ui.buttonPrimary : ui.button}
            onClick={() => setShowGrid(!showGrid)}
            type="button"
          >
            Test Grid: {showGrid ? "ON" : "OFF"}
          </button>

          <button
            style={showPinkBackground ? ui.buttonPrimary : ui.button}
            onClick={() => setShowPinkBackground(!showPinkBackground)}
            type="button"
          >
            Pink BG: {showPinkBackground ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      <div>
        <div style={ui.label}>Layer state</div>
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

        <button
          style={ui.button}
          onClick={onExportJson}
          type="button"
        >
          Export JSON
        </button>

        <button
          style={ui.buttonDanger}
          onClick={onReset}
          type="button"
        >
          Reset
        </button>
      </div>
    </div>
  );
}