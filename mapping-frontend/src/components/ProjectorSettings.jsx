import { ui } from "../styles/ui";

export default function ProjectorSettings({ projector, setProjector }) {
  const update = (key, value) => {
    setProjector((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Field
        label="Distance"
        value={projector.distance}
        onChange={(v) => update("distance", v)}
      />

      <Field
        label="Offset X"
        value={projector.offsetX}
        onChange={(v) => update("offsetX", v)}
      />

      <Field
        label="Offset Y"
        value={projector.offsetY}
        onChange={(v) => update("offsetY", v)}
      />

      <Field
        label="Angle X"
        value={projector.angleX}
        onChange={(v) => update("angleX", v)}
      />

      <Field
        label="Angle Y"
        value={projector.angleY}
        onChange={(v) => update("angleY", v)}
      />

      <Field
        label="Angle Z"
        value={projector.angleZ}
        onChange={(v) => update("angleZ", v)}
      />
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <div style={ui.label}>{label}</div>
      <input
        style={ui.input}
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value || 0))}
      />
    </div>
  );
}