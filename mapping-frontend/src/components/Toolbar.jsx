import { ui } from "../styles/ui";

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
  canSaveNew,
  canUpdate,
  onSaveNew,
  onUpdate,
  onReset,
  onExportJson
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
        <div style={ui.label}>Operation</div>
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
        <div style={ui.label}>Layer name</div>
        <input
          style={ui.input}
          value={layerName}
          onChange={(e) => setLayerName(e.target.value)}
          placeholder="np. facade-base"
        />
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