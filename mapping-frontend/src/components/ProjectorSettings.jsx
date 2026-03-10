import { ui } from "../styles/ui";

const DEFAULT_PROJECTOR = {
  distance: 5,
  offsetX: 0,
  offsetY: 0,
  angleX: 0,
  angleY: 0,
  angleZ: 0,
  fov: 45
};

export default function ProjectorSettings({ projector, setProjector }) {
  const update = (key, value) => {
    setProjector((prev) => ({
      ...prev,
      [key]: Number.isNaN(value) ? 0 : value
    }));
  };

  const resetField = (key) => {
    setProjector((prev) => ({
      ...prev,
      [key]: DEFAULT_PROJECTOR[key]
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Field
        label="Distance"
        value={projector.distance}
        step={0.1}
        defaultValue={DEFAULT_PROJECTOR.distance}
        onChange={(v) => update("distance", v)}
        onReset={() => resetField("distance")}
      />

      <Field
        label="Offset X"
        value={projector.offsetX}
        step={0.1}
        defaultValue={DEFAULT_PROJECTOR.offsetX}
        onChange={(v) => update("offsetX", v)}
        onReset={() => resetField("offsetX")}
      />

      <Field
        label="Offset Y"
        value={projector.offsetY}
        step={0.1}
        defaultValue={DEFAULT_PROJECTOR.offsetY}
        onChange={(v) => update("offsetY", v)}
        onReset={() => resetField("offsetY")}
      />

      <Field
        label="Angle X"
        value={projector.angleX}
        step={1}
        defaultValue={DEFAULT_PROJECTOR.angleX}
        onChange={(v) => update("angleX", v)}
        onReset={() => resetField("angleX")}
      />

      <Field
        label="Angle Y"
        value={projector.angleY}
        step={1}
        defaultValue={DEFAULT_PROJECTOR.angleY}
        onChange={(v) => update("angleY", v)}
        onReset={() => resetField("angleY")}
      />

      <Field
        label="Angle Z"
        value={projector.angleZ}
        step={1}
        defaultValue={DEFAULT_PROJECTOR.angleZ}
        onChange={(v) => update("angleZ", v)}
        onReset={() => resetField("angleZ")}
      />

      <Field
        label="FOV"
        value={projector.fov ?? 45}
        step={1}
        min={10}
        max={150}
        defaultValue={DEFAULT_PROJECTOR.fov}
        onChange={(v) => update("fov", v)}
        onReset={() => resetField("fov")}
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  onReset,
  defaultValue,
  step = 0.1,
  min,
  max
}) {
  return (
    <div>
      <div
        style={{
          ...ui.label,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6
        }}
      >
        <span>
          {label}: {value ?? 0}
        </span>

        <button
          type="button"
          onClick={onReset}
          style={{
            padding: "4px 8px",
            border: "1px solid #555",
            borderRadius: 6,
            background: "#1e1e1e",
            color: "#fff",
            cursor: "pointer",
            fontSize: 12
          }}
        >
          Reset
        </button>
      </div>

      <input
        style={ui.input}
        type="number"
        step={step}
        min={min}
        max={max}
        value={value ?? 0}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />

      <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
        Domyślnie: {defaultValue}
      </div>
    </div>
  );
}