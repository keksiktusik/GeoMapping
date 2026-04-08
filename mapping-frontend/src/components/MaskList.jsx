import { ui } from "../styles/ui";

const DEPTH_MIN = -50;
const DEPTH_MAX = 50;

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

function iconButtonStyle(active = false) {
  return {
    ...ui.button,
    minWidth: 34,
    height: 34,
    padding: "0 8px",
    opacity: active ? 1 : 0.9
  };
}

export default function MaskList({
  masks,
  selectedMaskId,
  onSelect,
  onDelete,
  onToggleVisible,
  onToggleLocked,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onSolo,
  onDepthChange
}) {
  if (masks.length === 0) {
    return <div style={ui.small}>Brak zapisanych masek</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {masks.map((m) => {
        const active = m.id === selectedMaskId;
        const meta = parseLayerMeta(m.layerName);
        const currentDepth = Number(m.zIndex ?? 0);

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
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 800 }}>{m.name}</div>

                <div style={ui.small}>
                  type: {m.type} • mat: {materialLabel(m.textureType)} • op:{" "}
                  {m.operation || "add"} • głębokość: {currentDepth}
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

                <div style={{ marginTop: 10 }}>
                  <div style={{ ...ui.small, marginBottom: 6 }}>
                    Głębokość: {currentDepth}
                  </div>
                  <input
                    type="range"
                    min={DEPTH_MIN}
                    max={DEPTH_MAX}
                    step="1"
                    value={currentDepth}
                    style={{ width: "100%" }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onDepthChange?.(m.id, Number(e.target.value || 0))}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 10
              }}
            >
              <button
                type="button"
                style={iconButtonStyle(m.visible !== false)}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisible(m.id);
                }}
                title="Visible"
              >
                {m.visible !== false ? "👁" : "🚫"}
              </button>

              <button
                type="button"
                style={iconButtonStyle(m.locked)}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLocked(m.id);
                }}
                title="Lock"
              >
                {m.locked ? "🔒" : "🔓"}
              </button>

              <button
                type="button"
                style={iconButtonStyle(false)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSolo?.(m.id);
                }}
                title="Solo"
              >
                S
              </button>

              <button
                type="button"
                style={iconButtonStyle(false)}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUp(m.id);
                }}
                title="Move up"
              >
                ↑
              </button>

              <button
                type="button"
                style={iconButtonStyle(false)}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveDown(m.id);
                }}
                title="Move down"
              >
                ↓
              </button>

              <button
                type="button"
                style={iconButtonStyle(false)}
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate?.(m.id);
                }}
                title="Duplicate"
              >
                ⧉
              </button>

              <button
                style={ui.buttonDanger}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(m.id);
                }}
                title="Delete"
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