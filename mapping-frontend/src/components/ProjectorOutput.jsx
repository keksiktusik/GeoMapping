import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import ProjectionTexture from "./ProjectionTexture";
import ProjectedSimpleScene from "./ProjectedSimpleScene";

const STORAGE_KEY = "mapping_output_state_v1";

function getDepthSource(mask = {}) {
  return `${mask?.name || ""} ${mask?.layerName || ""}`.toLowerCase();
}

function parseLegacyDepthDirective(mask = {}) {
  const text = getDepthSource(mask);

  if (text.includes("[depth:front]")) return "front";
  if (text.includes("[depth:back]")) return "back";
  return null;
}

function normalizeZIndex(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num) : 0;
}

function getDepthBucket(mask = {}) {
  const z = normalizeZIndex(mask?.zIndex);

  // nowe sterowanie suwakiem
  if (z > 0) return "front";
  if (z < 0) return "back";

  // fallback dla starych masek z dyrektywami w nazwie
  return parseLegacyDepthDirective(mask) || "middle";
}

function filterMasksByDepth(masks = [], depth = "middle") {
  return (masks || []).filter((mask) => getDepthBucket(mask) === depth);
}

function getDraftDepth(draft) {
  if (!draft) return "middle";
  return getDepthBucket(draft);
}

export default function ProjectorOutput() {
  const [state, setState] = useState({});
  const [frontTexture, setFrontTexture] = useState(null);
  const [middleTexture, setMiddleTexture] = useState(null);
  const [backTexture, setBackTexture] = useState(null);

  const lastRawRef = useRef(null);

  useEffect(() => {
    const load = () => {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw || raw === lastRawRef.current) return;

      lastRawRef.current = raw;

      try {
        setState(JSON.parse(raw));
      } catch {
        //
      }
    };

    load();
    window.addEventListener("storage", load);

    const i = setInterval(load, 200);

    return () => {
      window.removeEventListener("storage", load);
      clearInterval(i);
    };
  }, []);

  const masks = state?.masks || [];
  const draft = state?.draft || null;

  const frontMasks = useMemo(() => filterMasksByDepth(masks, "front"), [masks]);
  const middleMasks = useMemo(() => filterMasksByDepth(masks, "middle"), [masks]);
  const backMasks = useMemo(() => filterMasksByDepth(masks, "back"), [masks]);

  const frontDraft = useMemo(() => {
    if (!draft) return null;
    return getDraftDepth(draft) === "front" ? draft : null;
  }, [draft]);

  const middleDraft = useMemo(() => {
    if (!draft) return null;
    return getDraftDepth(draft) === "middle" ? draft : null;
  }, [draft]);

  const backDraft = useMemo(() => {
    if (!draft) return null;
    return getDraftDepth(draft) === "back" ? draft : null;
  }, [draft]);

  const mode =
    state?.outputSurfaceMode === "glb" ||
    state?.outputSurfaceMode === "lightGlb"
      ? "glb"
      : "plane";

  return (
    <div style={{ width: "100vw", height: "100vh", background: "black" }}>
      <ProjectionTexture
        wallW={800}
        wallH={500}
        showGrid={false}
        showPinkBackground={false}
        masks={frontMasks}
        activeDraft={frontDraft}
        onTexture={setFrontTexture}
      />

      <ProjectionTexture
        wallW={800}
        wallH={500}
        showGrid={false}
        showPinkBackground={false}
        masks={middleMasks}
        activeDraft={middleDraft}
        onTexture={setMiddleTexture}
      />

      <ProjectionTexture
        wallW={800}
        wallH={500}
        showGrid={false}
        showPinkBackground={false}
        masks={backMasks}
        activeDraft={backDraft}
        onTexture={setBackTexture}
      />

      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <ProjectedSimpleScene
          mode={mode}
          modelUrl={state?.outputModelUrl || "/models/fasada.glb"}
          textures={{
            front: frontTexture,
            middle: middleTexture,
            back: backTexture
          }}
          projector={state?.projector}
          depthOffsets={{
            front: 0.06,
            middle: 0,
            back: -0.06
          }}
        />
      </Canvas>
    </div>
  );
}