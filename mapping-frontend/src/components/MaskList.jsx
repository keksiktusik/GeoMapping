export default function MaskList({ masks, selectedMaskId, onSelect, onDelete }) {
  return (
    <div style={styles.box}>
      <div style={styles.header}>Saved masks</div>

      {masks.length === 0 ? (
        <div style={styles.empty}>Brak zapisanych masek</div>
      ) : (
        <ul style={styles.list}>
          {masks.map((m) => {
            const active = m.id === selectedMaskId;
            return (
              <li
                key={m.id}
                style={{ ...styles.item, ...(active ? styles.active : {}) }}
                onClick={() => onSelect(m.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: "#555" }}>
                      {m.type} • points: {m.points.length} • opacity: {m.opacity.toFixed(2)}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(m.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const styles = {
  box: {
    width: 340,
    border: "1px solid #ddd",
    borderRadius: 8,
    background: "#fff",
    overflow: "hidden"
  },
  header: {
    padding: 12,
    fontWeight: 800,
    borderBottom: "1px solid #eee",
    background: "#fafafa"
  },
  empty: { padding: 12, color: "#666" },
  list: { listStyle: "none", margin: 0, padding: 0 },
  item: {
    padding: 12,
    borderBottom: "1px solid #eee",
    cursor: "pointer"
  },
  active: {
    background: "#eef5ff"
  }
};