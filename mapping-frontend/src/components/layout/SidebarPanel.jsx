import { ui } from "../../styles/ui";

export default function SidebarPanel({ title, children }) {
  return (
    <section style={ui.panel}>
      <div style={ui.panelTitle}>{title}</div>
      {children}
    </section>
  );
}