import { ui } from "../../styles/ui";

export default function TopBar({
  renderMode,
  masksCount,
  backendStatus = "online",
  onOpenOutput,
}) {
  return (
    <header style={ui.topbar}>
      <div style={ui.topbarLeft}>
        <div style={ui.title}>Facade Projection Mapping</div>
        <div style={ui.badge}>React + Three.js</div>
        <div style={ui.badge}>Mode: {renderMode.toUpperCase()}</div>
      </div>

      <div style={ui.topbarRight}>
        <div style={ui.badge}>Masks: {masksCount}</div>
        <div style={ui.badge}>Backend: {backendStatus}</div>
        <button style={ui.buttonPrimary} onClick={onOpenOutput} type="button">
          Open Output
        </button>
      </div>
    </header>
  );
}