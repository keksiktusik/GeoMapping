import { ui } from "../styles/ui";

export default function Toolbar({
  mode,
  setMode,
  showGrid,
  setShowGrid,
  opacity,
  setOpacity,
  maskName,
  setMaskName,
  maskType,
  setMaskType,
  canSaveNew,
  canUpdate,
  onSaveNew,
  onUpdate,
  onReset,
  onExportJson,
}) {
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
        <button
          style={showGrid ? ui.buttonPrimary : ui.button}
          onClick={() => setShowGrid(!showGrid)}
          type="button"
        >
          Test Grid: {showGrid ? "ON" : "OFF"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button style={ui.buttonPrimary} onClick={onSaveNew} disabled={!canSaveNew}>
          Save new
        </button>

        <button style={ui.button} onClick={onUpdate} disabled={!canUpdate}>
          Update
        </button>

        <button style={ui.button} onClick={onExportJson}>
          Export JSON
        </button>

        <button style={ui.buttonDanger} onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  );
}