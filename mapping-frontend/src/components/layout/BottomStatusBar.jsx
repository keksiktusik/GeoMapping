import { ui } from "../../styles/ui";

export default function BottomStatusBar({
  selectedMaskId,
  pointsCount,
  isClosed,
  showGrid,
  mode,
}) {
  return (
    <footer style={ui.statusBar}>
      <div style={ui.stat}>Mode: {mode}</div>
      <div style={ui.stat}>Points: {pointsCount}</div>
      <div style={ui.stat}>Polygon: {isClosed ? "closed" : "open"}</div>
      <div style={ui.stat}>Grid: {showGrid ? "on" : "off"}</div>
      <div style={ui.stat}>
        Active mask: {selectedMaskId !== null ? selectedMaskId : "none"}
      </div>
    </footer>
  );
}