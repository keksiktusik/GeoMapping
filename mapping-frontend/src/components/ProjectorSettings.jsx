import { ui } from "../styles/ui";

const MIN_DISTANCE = 0.5;

const DEFAULT_PROJECTOR = {
  distance: 5,
  offsetX: 0,
  offsetY: 0,
  angleX: 0,
  angleY: 0,
  angleZ: 0,
  fov: 45
};

const DEFAULT_CALIBRATION = {
  showOverlay: true,
  showGrid: true,
  showCrosshair: true,
  nudgeStep: 0.05,
  angleStep: 1,
  showInfo: true,
  pattern: "none",
  patternOpacity: 0.8,
  maskOutlineMode: "off",
  maskOutlineColor: "#ffffff",
  maskOutlineWidth: 2,
  selectedMaskFlashMode: "off",
  selectedMaskFlashColor: "#ffea00",
  selectedMaskFlashSpeed: 1.6,
  selectedMaskSoloInOutput: false,
  outputBlackoutMode: false,
  selectedMaskOutlineBoost: true
};

const PATTERN_OPTIONS = [
  { value: "none", label: "Brak" },
  { value: "frame", label: "Ramka" },
  { value: "checkerboard", label: "Szachownica" },
  { value: "windows", label: "Test okien" },
  { value: "bands", label: "Pasy" },
  { value: "cross", label: "Krzyż + środek" }
];

const OUTLINE_MODE_OPTIONS = [
  { value: "off", label: "Brak" },
  { value: "overlay", label: "Kontury na treści" },
  { value: "only", label: "Same kontury" }
];

const FLASH_MODE_OPTIONS = [
  { value: "off", label: "Brak" },
  { value: "fill", label: "Pulsujący fill" },
  { value: "outline", label: "Pulsujący kontur" },
  { value: "both", label: "Fill + kontur" }
];

function clampNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampProjectorField(key, value) {
  const n = clampNumber(value, DEFAULT_PROJECTOR[key] ?? 0);

  if (key === "distance") return Math.max(MIN_DISTANCE, n);
  if (key === "fov") return Math.max(10, Math.min(150, n));

  return n;
}

function isHexColor(value) {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

function normalizeCalibration(value = {}) {
  const pattern = PATTERN_OPTIONS.some((item) => item.value === value?.pattern)
    ? value.pattern
    : DEFAULT_CALIBRATION.pattern;

  const maskOutlineMode = OUTLINE_MODE_OPTIONS.some(
    (item) => item.value === value?.maskOutlineMode
  )
    ? value.maskOutlineMode
    : DEFAULT_CALIBRATION.maskOutlineMode;

  const selectedMaskFlashMode = FLASH_MODE_OPTIONS.some(
    (item) => item.value === value?.selectedMaskFlashMode
  )
    ? value.selectedMaskFlashMode
    : DEFAULT_CALIBRATION.selectedMaskFlashMode;

  return {
    showOverlay: value?.showOverlay !== false,
    showGrid: value?.showGrid !== false,
    showCrosshair: value?.showCrosshair !== false,
    nudgeStep: [0.01, 0.02, 0.05, 0.1, 0.25].includes(Number(value?.nudgeStep))
      ? Number(value.nudgeStep)
      : DEFAULT_CALIBRATION.nudgeStep,
    angleStep: [0.5, 1, 2, 5].includes(Number(value?.angleStep))
      ? Number(value.angleStep)
      : DEFAULT_CALIBRATION.angleStep,
    showInfo: value?.showInfo !== false,
    pattern,
    patternOpacity: Math.max(
      0.1,
      Math.min(1, Number(value?.patternOpacity ?? DEFAULT_CALIBRATION.patternOpacity))
    ),
    maskOutlineMode,
    maskOutlineColor: isHexColor(value?.maskOutlineColor)
      ? value.maskOutlineColor
      : DEFAULT_CALIBRATION.maskOutlineColor,
    maskOutlineWidth: Math.max(
      1,
      Math.min(12, Number(value?.maskOutlineWidth ?? DEFAULT_CALIBRATION.maskOutlineWidth))
    ),
    selectedMaskFlashMode,
    selectedMaskFlashColor: isHexColor(value?.selectedMaskFlashColor)
      ? value.selectedMaskFlashColor
      : DEFAULT_CALIBRATION.selectedMaskFlashColor,
    selectedMaskFlashSpeed: Math.max(
      0.2,
      Math.min(6, Number(value?.selectedMaskFlashSpeed ?? DEFAULT_CALIBRATION.selectedMaskFlashSpeed))
    ),
    selectedMaskSoloInOutput: Boolean(value?.selectedMaskSoloInOutput),
    outputBlackoutMode: Boolean(value?.outputBlackoutMode),
    selectedMaskOutlineBoost: value?.selectedMaskOutlineBoost !== false
  };
}

export default function ProjectorSettings({
  projector,
  setProjector,
  calibration,
  setCalibration
}) {
  const safeCalibration = normalizeCalibration(calibration);

  const update = (key, value) => {
    setProjector((prev) => ({
      ...prev,
      [key]: clampProjectorField(key, value)
    }));
  };

  const nudge = (key, delta) => {
    setProjector((prev) => ({
      ...prev,
      [key]: clampProjectorField(key, Number(prev?.[key] || 0) + delta)
    }));
  };

  const resetField = (key) => {
    setProjector((prev) => ({
      ...prev,
      [key]: DEFAULT_PROJECTOR[key]
    }));
  };

  const resetAll = () => {
    setProjector({ ...DEFAULT_PROJECTOR });
  };

  const updateCalibration = (key, value) => {
    setCalibration((prev) => ({
      ...normalizeCalibration(prev),
      [key]: value
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          padding: 12,
          border: "1px solid #2b3647",
          borderRadius: 12,
          background: "#121821"
        }}
      >
        <div style={{ ...ui.label, marginBottom: 10 }}>Kalibracja outputu</div>

        <div style={{ display: "grid", gap: 8 }}>
          <ToggleRow
            label="Pokaż overlay"
            checked={safeCalibration.showOverlay}
            onChange={(v) => updateCalibration("showOverlay", v)}
          />

          <ToggleRow
            label="Siatka pomocnicza"
            checked={safeCalibration.showGrid}
            onChange={(v) => updateCalibration("showGrid", v)}
          />

          <ToggleRow
            label="Krzyż centralny"
            checked={safeCalibration.showCrosshair}
            onChange={(v) => updateCalibration("showCrosshair", v)}
          />

          <ToggleRow
            label="Panel informacji"
            checked={safeCalibration.showInfo}
            onChange={(v) => updateCalibration("showInfo", v)}
          />

          <ToggleRow
            label="Solo wybranej maski w output"
            checked={safeCalibration.selectedMaskSoloInOutput}
            onChange={(v) => updateCalibration("selectedMaskSoloInOutput", v)}
          />

          <ToggleRow
            label="Blackout output"
            checked={safeCalibration.outputBlackoutMode}
            onChange={(v) => updateCalibration("outputBlackoutMode", v)}
          />

          <ToggleRow
            label="Mocny obrys wybranej"
            checked={safeCalibration.selectedMaskOutlineBoost}
            onChange={(v) => updateCalibration("selectedMaskOutlineBoost", v)}
          />

          <SelectRow
            label="Krok przesunięcia"
            value={safeCalibration.nudgeStep}
            options={[0.01, 0.02, 0.05, 0.1, 0.25]}
            onChange={(v) => updateCalibration("nudgeStep", Number(v))}
          />

          <SelectRow
            label="Krok obrotu"
            value={safeCalibration.angleStep}
            options={[0.5, 1, 2, 5]}
            onChange={(v) => updateCalibration("angleStep", Number(v))}
          />

          <SelectRow
            label="Plansza testowa"
            value={safeCalibration.pattern}
            options={PATTERN_OPTIONS.map((item) => item.value)}
            labels={Object.fromEntries(PATTERN_OPTIONS.map((item) => [item.value, item.label]))}
            onChange={(v) => updateCalibration("pattern", v)}
          />

          <RangeRow
            label="Przezroczystość planszy"
            value={safeCalibration.patternOpacity}
            min={0.1}
            max={1}
            step={0.05}
            onChange={(v) => updateCalibration("patternOpacity", Number(v))}
          />

          <SelectRow
            label="Tryb konturów masek"
            value={safeCalibration.maskOutlineMode}
            options={OUTLINE_MODE_OPTIONS.map((item) => item.value)}
            labels={Object.fromEntries(OUTLINE_MODE_OPTIONS.map((item) => [item.value, item.label]))}
            onChange={(v) => updateCalibration("maskOutlineMode", v)}
          />

          <ColorRow
            label="Kolor konturu"
            value={safeCalibration.maskOutlineColor}
            onChange={(v) => updateCalibration("maskOutlineColor", v)}
          />

          <RangeRow
            label="Grubość konturu"
            value={safeCalibration.maskOutlineWidth}
            min={1}
            max={12}
            step={1}
            onChange={(v) => updateCalibration("maskOutlineWidth", Number(v))}
          />

          <SelectRow
            label="Podświetlenie wybranej maski"
            value={safeCalibration.selectedMaskFlashMode}
            options={FLASH_MODE_OPTIONS.map((item) => item.value)}
            labels={Object.fromEntries(FLASH_MODE_OPTIONS.map((item) => [item.value, item.label]))}
            onChange={(v) => updateCalibration("selectedMaskFlashMode", v)}
          />

          <ColorRow
            label="Kolor podświetlenia"
            value={safeCalibration.selectedMaskFlashColor}
            onChange={(v) => updateCalibration("selectedMaskFlashColor", v)}
          />

          <RangeRow
            label="Szybkość pulsowania"
            value={safeCalibration.selectedMaskFlashSpeed}
            min={0.2}
            max={6}
            step={0.1}
            onChange={(v) => updateCalibration("selectedMaskFlashSpeed", Number(v))}
          />
        </div>
      </div>

      <Field
        label="Distance"
        value={projector.distance}
        step={0.1}
        min={MIN_DISTANCE}
        defaultValue={DEFAULT_PROJECTOR.distance}
        onChange={(v) => update("distance", v)}
        onReset={() => resetField("distance")}
        onNudgeMinus={() => nudge("distance", -safeCalibration.nudgeStep)}
        onNudgePlus={() => nudge("distance", safeCalibration.nudgeStep)}
      />

      <Field
        label="Offset X"
        value={projector.offsetX}
        step={0.01}
        defaultValue={DEFAULT_PROJECTOR.offsetX}
        onChange={(v) => update("offsetX", v)}
        onReset={() => resetField("offsetX")}
        onNudgeMinus={() => nudge("offsetX", -safeCalibration.nudgeStep)}
        onNudgePlus={() => nudge("offsetX", safeCalibration.nudgeStep)}
      />

      <Field
        label="Offset Y"
        value={projector.offsetY}
        step={0.01}
        defaultValue={DEFAULT_PROJECTOR.offsetY}
        onChange={(v) => update("offsetY", v)}
        onReset={() => resetField("offsetY")}
        onNudgeMinus={() => nudge("offsetY", -safeCalibration.nudgeStep)}
        onNudgePlus={() => nudge("offsetY", safeCalibration.nudgeStep)}
      />

      <Field
        label="Angle X"
        value={projector.angleX}
        step={0.5}
        defaultValue={DEFAULT_PROJECTOR.angleX}
        onChange={(v) => update("angleX", v)}
        onReset={() => resetField("angleX")}
        onNudgeMinus={() => nudge("angleX", -safeCalibration.angleStep)}
        onNudgePlus={() => nudge("angleX", safeCalibration.angleStep)}
      />

      <Field
        label="Angle Y"
        value={projector.angleY}
        step={0.5}
        defaultValue={DEFAULT_PROJECTOR.angleY}
        onChange={(v) => update("angleY", v)}
        onReset={() => resetField("angleY")}
        onNudgeMinus={() => nudge("angleY", -safeCalibration.angleStep)}
        onNudgePlus={() => nudge("angleY", safeCalibration.angleStep)}
      />

      <Field
        label="Angle Z"
        value={projector.angleZ}
        step={0.5}
        defaultValue={DEFAULT_PROJECTOR.angleZ}
        onChange={(v) => update("angleZ", v)}
        onReset={() => resetField("angleZ")}
        onNudgeMinus={() => nudge("angleZ", -safeCalibration.angleStep)}
        onNudgePlus={() => nudge("angleZ", safeCalibration.angleStep)}
      />

      <Field
        label="FOV"
        value={projector.fov ?? 45}
        step={1}
        min={10}
        max={150}
        defaultValue={DEFAULT_PROJECTOR.fov}
        onChange={(v) => update("fov", v)}
        onReset={() => resetField("fov")}
        onNudgeMinus={() => nudge("fov", -1)}
        onNudgePlus={() => nudge("fov", 1)}
      />

      <button
        type="button"
        onClick={resetAll}
        style={{
          ...ui.button,
          background: "#1e1e1e",
          border: "1px solid #4b5563",
          color: "#fff"
        }}
      >
        Reset całego projektora
      </button>

      <div
        style={{
          fontSize: 12,
          opacity: 0.72,
          lineHeight: 1.45,
          padding: 10,
          borderRadius: 10,
          background: "#121821",
          border: "1px solid #2b3647"
        }}
      >
        Open Output:
        <br />
        strzałki = projektor offset
        <br />
        Q / E = angle Z
        <br />
        W / S = angle X
        <br />
        A / D = angle Y
        <br />
        R / F = distance
        <br />
        + / - = FOV
        <br />
        Alt + Shift + strzałki = przesuń wybraną maskę
        <br />
        Alt + [ / ] = zmień zIndex wybranej maski
        <br />
        Alt + S = solo wybranej maski
        <br />
        Alt + B = blackout mode
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        fontSize: 13
      }}
    >
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function SelectRow({ label, value, options, labels = {}, onChange }) {
  return (
    <label
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        fontSize: 13
      }}
    >
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...ui.input,
          width: 190,
          padding: "6px 8px"
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option] || option}
          </option>
        ))}
      </select>
    </label>
  );
}

function RangeRow({ label, value, min, max, step, onChange }) {
  return (
    <label
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 110px 52px",
        alignItems: "center",
        gap: 10,
        fontSize: 13
      }}
    >
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span style={{ textAlign: "right" }}>{Number(value).toFixed(1)}</span>
    </label>
  );
}

function ColorRow({ label, value, onChange }) {
  return (
    <label
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 70px 88px",
        alignItems: "center",
        gap: 10,
        fontSize: 13
      }}
    >
      <span>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 56,
          height: 32,
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer"
        }}
      />
      <span style={{ textAlign: "right" }}>{value}</span>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  onReset,
  onNudgeMinus,
  onNudgePlus,
  defaultValue,
  step = 0.1,
  min,
  max
}) {
  return (
    <div
      style={{
        padding: 12,
        border: "1px solid #2b3647",
        borderRadius: 12,
        background: "#121821"
      }}
    >
      <div
        style={{
          ...ui.label,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8
        }}
      >
        <span>
          {label}: {Number(value ?? 0).toFixed(2)}
        </span>

        <button
          type="button"
          onClick={onReset}
          style={{
            padding: "4px 8px",
            border: "1px solid #555",
            borderRadius: 6,
            background: "#1e1e1e",
            color: "#fff",
            cursor: "pointer",
            fontSize: 12
          }}
        >
          Reset
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 40px", gap: 8 }}>
        <button type="button" onClick={onNudgeMinus} style={smallButtonStyle}>
          -
        </button>

        <input
          style={ui.input}
          type="number"
          step={step}
          min={min}
          max={max}
          value={value ?? 0}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />

        <button type="button" onClick={onNudgePlus} style={smallButtonStyle}>
          +
        </button>
      </div>

      <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
        Domyślnie: {defaultValue}
      </div>
    </div>
  );
}

const smallButtonStyle = {
  border: "1px solid #4b5563",
  borderRadius: 8,
  background: "#1e1e1e",
  color: "#fff",
  cursor: "pointer"
};