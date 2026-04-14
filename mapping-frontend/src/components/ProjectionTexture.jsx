import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createProjectionTextureAsset,
  safePlay
} from "../lib/projectionComposer";

export default function ProjectionTexture({
  wallW = 800,
  wallH = 500,
  showGrid = false,
  showPinkBackground = true,
  masks = [],
  activeDraft = null,
  finalWarp = null,
  onTexture,
  outlineMode = "off",
  outlineColor = "#ffffff",
  outlineWidth = 2,
  selectedMaskId = null,
  selectedMaskFlashMode = "off",
  selectedMaskFlashColor = "#ffea00",
  selectedMaskFlashSpeed = 1.6
}) {
  const imageCache = useRef(new Map());
  const videoCache = useRef(new Map());
  const [refreshValue, setRefreshValue] = useState(0);

  const requestRefresh = useCallback(() => {
    setRefreshValue((v) => v + 1);
  }, []);

  const asset = useMemo(
    () =>
      createProjectionTextureAsset({
        wallW,
        wallH,
        showGrid,
        showPinkBackground,
        masks,
        activeDraft,
        finalWarp,
        imageCache,
        videoCache,
        onAssetReady: requestRefresh,
        outlineMode,
        outlineColor,
        outlineWidth,
        selectedMaskId,
        selectedMaskFlashMode,
        selectedMaskFlashColor,
        selectedMaskFlashSpeed
      }),
    [
      wallW,
      wallH,
      showGrid,
      showPinkBackground,
      masks,
      activeDraft,
      finalWarp,
      requestRefresh,
      refreshValue,
      outlineMode,
      outlineColor,
      outlineWidth,
      selectedMaskId,
      selectedMaskFlashMode,
      selectedMaskFlashColor,
      selectedMaskFlashSpeed
    ]
  );

  useEffect(() => {
    if (!asset?.texture) return;

    onTexture?.(asset.texture);

    let raf = 0;

    const loop = () => {
      videoCache.current.forEach((entry) => {
        if (entry?.video && !entry?.runtimeSettings?.paused) {
          safePlay(entry.video);
        }
      });

      asset.redraw();
      asset.texture.needsUpdate = true;
      raf = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(raf);
      asset.texture.dispose();
      onTexture?.(null);
    };
  }, [asset, onTexture]);

  useEffect(() => {
    const reviveVideos = () => {
      videoCache.current.forEach((entry) => {
        if (entry?.video && !entry?.runtimeSettings?.paused) {
          safePlay(entry.video);
        }
      });
    };

    document.addEventListener("visibilitychange", reviveVideos);
    window.addEventListener("focus", reviveVideos);
    window.addEventListener("pageshow", reviveVideos);

    return () => {
      document.removeEventListener("visibilitychange", reviveVideos);
      window.removeEventListener("focus", reviveVideos);
      window.removeEventListener("pageshow", reviveVideos);
    };
  }, []);

  useEffect(() => {
    return () => {
      videoCache.current.forEach((entry) => {
        if (entry?.video) {
          entry.video.pause();
          entry.video.src = "";
          entry.video.load?.();
        }
      });
    };
  }, []);

  return null;
}