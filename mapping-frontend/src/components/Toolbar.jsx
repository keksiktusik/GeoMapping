export default function Toolbar({
  mode,
  setMode,
  showGrid,
  setShowGrid,
  opacity,
  setOpacity,
  maskName,
  setMaskName,
  canSaveNew,
  canUpdate,
  onSaveNew,
  onUpdate,
  onReset,
  onExportJson
}) {
  return (
    <div style={styles.bar}>
      <button onClick={() => setMode(mode === "draw" ? "edit" : "draw")}>
        Mode: {mode.toUpperCase()}
      </button>

      <button onClick={() => setShowGrid(!showGrid)}>
        Test Grid: {showGrid ? "ON" : "OFF"}
      </button>

      <label style={styles.label}>
        Opacity
        <input
          type="range"
          min="0.05"
          max="1"
          step="0.05"
          value={opacity}
          onChange={(e) => setOpacity(parseFloat(e.target.value))}
        />
        <span style={{ width: 44, textAlign: "right" }}>{opacity.toFixed(2)}</span>
      </label>

      <label style={styles.label}>
        Nazwa
        <input
          value={maskName}
          onChange={(e) => setMaskName(e.target.value)}
          placeholder="np. Okno lewe"
          style={styles.input}
        />
      </label>

      <button onClick={onSaveNew} disabled={!canSaveNew}>
        Save new
      </button>

      <button onClick={onUpdate} disabled={!canUpdate}>
        Update
      </button>

      <button onClick={onExportJson} disabled={!canSaveNew && !canUpdate}>
        Export JSON
      </button>

      <button onClick={onReset}>Reset</button>
    </div>
  );
}

const styles = {
  bar: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    padding: 12,
    border: "1px solid #ddd",
    borderRadius: 8,
    background: "#fff"
  },
  label: { display: "flex", gap: 8, alignItems: "center" },
  input: { padding: "6px 8px", border: "1px solid #ccc", borderRadius: 6 }
};