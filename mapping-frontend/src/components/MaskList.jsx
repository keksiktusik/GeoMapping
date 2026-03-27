import { ui } from "../styles/ui";

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

function materialLabel(type) {
  if (type === "video") return "video";
  if (type === "image") return "image";
  return "color";
}

export default function MaskList({
  masks,
  selectedMaskId,
  onSelect,
  onDelete
}) {
  if (masks.length === 0) {
    return <div style={ui.small}>Brak zapisanych masek</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {masks.map((m) => {
        const active = m.id === selectedMaskId;
        const meta = parseLayerMeta(m.layerName);

        return (
          <div
            key={m.id}
            onClick={() => onSelect(m.id)}
            style={{
              padding: 12,
              borderRadius: 12,
              border: active ? "1px solid #38bdf8" : "1px solid #243041",
              background: active ? "#0b1220" : "#111827",
              cursor: "pointer"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "start"
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{m.name}</div>

                <div style={ui.small}>
                  type: {m.type} • mat: {materialLabel(m.textureType)} • op:{" "}
                  {m.operation || "add"} • z: {m.zIndex ?? 0}
                </div>

                <div style={ui.small}>
                  layer: {meta.baseName || "default"} • blend:{" "}
                  {meta.blend === "source-over" ? "normal" : meta.blend} • feather:{" "}
                  {meta.feather}px
                </div>

                <div style={ui.small}>
                  points: {m.points?.length || 0} • opacity:{" "}
                  {typeof m.opacity === "number" ? m.opacity.toFixed(2) : "1.00"} •
                  visible: {m.visible === false ? " no" : " yes"} • locked:{" "}
                  {m.locked ? "yes" : "no"}
                </div>
              </div>

              <button
                style={ui.buttonDanger}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(m.id);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}