import { memo, useMemo, useState } from "react";
import { ui } from "../styles/ui";

function formatDepth(value) {
  const num = Number(value || 0);
  return num > 0 ? `+${num}` : `${num}`;
}

const MaskRow = memo(function MaskRow({
  mask,
  isSelected,
  onSelect,
  onDelete,
  onToggleVisible,
  onToggleLocked,
  onMoveUp,
  onMoveDown,
  onDepthChange,
  onDuplicate,
  onSolo
}) {
  const [depthDraft, setDepthDraft] = useState(Number(mask?.zIndex || 0));

  const safeDepth = Number.isFinite(depthDraft) ? depthDraft : 0;

  return (
    <div
      style={{
        border: isSelected
          ? "1px solid rgba(56,189,248,0.85)"
          : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        padding: 10,
        background: isSelected
          ? "rgba(56,189,248,0.08)"
          : "rgba(255,255,255,0.02)",
        display: "grid",
        gap: 8
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          gap: 10
        }}
      >
        <button
          type="button"
          onClick={() => onSelect(mask.id)}
          style={{
            background: "transparent",
            border: "none",
            color: "inherit",
            textAlign: "left",
            padding: 0,
            cursor: "pointer",
            flex: 1
          }}
        >
          <div style={{ fontWeight: 700 }}>
            {mask.name || `Maska ${mask.id}`}
          </div>
          <div style={{ fontSize: 12, opacity: 0.72, marginTop: 2 }}>
            typ: {mask.type || "window"} • zIndex: {formatDepth(mask.zIndex)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
            {mask.textureType || "color"} • {mask.visible !== false ? "widoczna" : "ukryta"} •{" "}
            {mask.locked ? "zablokowana" : "odblokowana"}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onDelete(mask.id)}
          style={ui.buttonDanger}
        >
          Usuń
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <button type="button" style={ui.button} onClick={() => onToggleVisible(mask.id)}>
          {mask.visible !== false ? "Ukryj" : "Pokaż"}
        </button>

        <button type="button" style={ui.button} onClick={() => onToggleLocked(mask.id)}>
          {mask.locked ? "Odblokuj" : "Zablokuj"}
        </button>

        <button type="button" style={ui.button} onClick={() => onSolo(mask.id)}>
          Solo
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button type="button" style={ui.button} onClick={() => onMoveDown(mask.id)}>
          Głębiej
        </button>

        <button type="button" style={ui.button} onClick={() => onMoveUp(mask.id)}>
          Wyżej
        </button>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={ui.label}>Zmień głębokość</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 88px", gap: 8 }}>
          <input
            style={ui.input}
            type="number"
            value={safeDepth}
            onChange={(e) => setDepthDraft(Number(e.target.value || 0))}
          />
          <button
            type="button"
            style={ui.button}
            onClick={() => onDepthChange(mask.id, Number(safeDepth || 0))}
          >
            Zapisz
          </button>
        </div>
      </div>

      <button type="button" style={ui.button} onClick={() => onDuplicate(mask.id)}>
        Duplikuj
      </button>
    </div>
  );
});

export default function MaskList({
  masks = [],
  selectedMaskId,
  onSelect,
  onDelete,
  onToggleVisible,
  onToggleLocked,
  onMoveUp,
  onMoveDown,
  onDepthChange,
  onDuplicate,
  onSolo
}) {
  const [query, setQuery] = useState("");

  const filteredMasks = useMemo(() => {
    const q = query.trim().toLowerCase();

    const sorted = [...masks].sort(
      (a, b) => Number(b?.zIndex || 0) - Number(a?.zIndex || 0)
    );

    if (!q) return sorted;

    return sorted.filter((mask) => {
      const haystack = [
        mask?.name || "",
        mask?.type || "",
        mask?.layerName || "",
        mask?.textureType || "",
        String(mask?.id || "")
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [masks, query]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          background: "#0f1722",
          paddingBottom: 8
        }}
      >
        <input
          style={ui.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj maski po nazwie, typie, id..."
        />
        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
          {filteredMasks.length} / {masks.length} masek
        </div>
      </div>

      <div
        style={{
          maxHeight: 520,
          overflowY: "auto",
          paddingRight: 4,
          display: "grid",
          gap: 8
        }}
      >
        {filteredMasks.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Brak masek do wyświetlenia.
          </div>
        ) : (
          filteredMasks.map((mask) => (
            <MaskRow
              key={mask.id}
              mask={mask}
              isSelected={String(mask.id) === String(selectedMaskId)}
              onSelect={onSelect}
              onDelete={onDelete}
              onToggleVisible={onToggleVisible}
              onToggleLocked={onToggleLocked}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onDepthChange={onDepthChange}
              onDuplicate={onDuplicate}
              onSolo={onSolo}
            />
          ))
        )}
      </div>
    </div>
  );
}