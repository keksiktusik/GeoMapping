import { ui } from "../styles/ui";

export default function ProjectorSettings({ projector, setProjector }) {
  const update = (key, value) => {
    setProjector((prev) => ({
      ...prev,
      [key]: Number.isNaN(value) ? 0 : value
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Field
        label="Distance"
        value={projector.distance}
        step={0.1}
        onChange={(v) => update("distance", v)}
      />

      <Field
        label="Offset X"
        value={projector.offsetX}
        step={0.1}
        onChange={(v) => update("offsetX", v)}
      />

      <Field
        label="Offset Y"
        value={projector.offsetY}
        step={0.1}
        onChange={(v) => update("offsetY", v)}
      />

      <Field
        label="Angle X"
        value={projector.angleX}
        step={1}
        onChange={(v) => update("angleX", v)}
      />

      <Field
        label="Angle Y"
        value={projector.angleY}
        step={1}
        onChange={(v) => update("angleY", v)}
      />

      <Field
        label="Angle Z"
        value={projector.angleZ}
        step={1}
        onChange={(v) => update("angleZ", v)}
      />

      <Field
        label="FOV"
        value={projector.fov ?? 45}
        step={1}
        min={10}
        max={150}
        onChange={(v) => update("fov", v)}
      />
    </div>
  );
}

function Field({ label, value, onChange, step = 0.1, min, max }) {
  return (
    <div>
      <div style={ui.label}>{label}</div>

      <input
        style={ui.input}
        type="number"
        step={step}
        min={min}
        max={max}
        value={value ?? 0}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}