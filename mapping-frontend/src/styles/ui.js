export const ui = {
  page: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#e8ecf3",
    display: "flex",
    flexDirection: "column",
  },

  topbar: {
    height: 64,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
    borderBottom: "1px solid #243041",
    background: "#111827",
  },

  topbarLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  topbarRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  title: {
    fontSize: 20,
    fontWeight: 800,
  },

  badge: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #243041",
    background: "#0b1220",
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 700,
  },

  shell: {
    display: "grid",
    gridTemplateColumns: "280px minmax(0, 1fr) 300px",
    gap: 16,
    padding: 16,
    flex: 1,
    minHeight: 0,
  },

 sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minHeight: 0,
    minWidth: 0,
  },

  center: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minHeight: 0,
    minWidth: 0,
  },

  panel: {
    background: "#111827",
    border: "1px solid #243041",
    borderRadius: 16,
    padding: 16,
  },

  panelTitle: {
    fontSize: 15,
    fontWeight: 800,
    marginBottom: 12,
  },

  row: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  column: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#0b1220",
    color: "#e8ecf3",
  },

  button: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#1f2937",
    color: "#e8ecf3",
    fontWeight: 700,
  },

  buttonPrimary: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #0ea5e9",
    background: "#0ea5e9",
    color: "#ffffff",
    fontWeight: 800,
  },

  buttonDanger: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #ef4444",
    background: "#ef4444",
    color: "#ffffff",
    fontWeight: 800,
  },

  statusBar: {
    height: 48,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "0 16px",
    borderTop: "1px solid #243041",
    background: "#111827",
    color: "#94a3b8",
    fontSize: 13,
  },

  stat: {
    padding: "6px 10px",
    borderRadius: 10,
    background: "#0b1220",
    border: "1px solid #243041",
  },

  label: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 6,
    fontWeight: 700,
  },

  small: {
    fontSize: 12,
    color: "#94a3b8",
  },
};