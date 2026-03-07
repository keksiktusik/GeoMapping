import { ui } from "../styles/ui";

export default function MaskList({
  masks,
  selectedMaskId,
  onSelect,
  onDelete,
}) {
  if (masks.length === 0) {
    return <div style={ui.small}>Brak zapisanych masek</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {masks.map((m) => {
        const active = m.id === selectedMaskId;

        return (
          <div
            key={m.id}
            onClick={() => onSelect(m.id)}
            style={{
              padding: 12,
              borderRadius: 12,
              border: active ? "1px solid #38bdf8" : "1px solid #243041",
              background: active ? "#0b1220" : "#111827",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "start",
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>{m.name}</div>
                <div style={ui.small}>
                  type: {m.type} • points: {m.points?.length || 0}
                </div>
                <div style={ui.small}>
                  opacity: {typeof m.opacity === "number" ? m.opacity.toFixed(2) : "1.00"}
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