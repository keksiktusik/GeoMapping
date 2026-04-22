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
    let lastFrameTime = 0;
    const FPS = 30;
    const FRAME_MS = 1000 / FPS;

    const hasVideo = () => {
      const allMasks = [...(masks || [])];
      if (activeDraft?.textureType === "video") {
        allMasks.push(activeDraft);
      }

      return allMasks.some(
        (m) =>
          m?.visible !== false &&
          m?.textureType === "video" &&
          Array.isArray(m?.points) &&
          m.points.length >= 3
      );
    };

    const loop = (now) => {
      const containsVideo = hasVideo();

      if (containsVideo && now - lastFrameTime >= FRAME_MS) {
        videoCache.current.forEach((entry) => {
          if (entry?.video && !entry?.runtimeSettings?.paused) {
            safePlay(entry.video);
          }
        });

        asset.redraw();
        asset.texture.needsUpdate = true;
        lastFrameTime = now;
      }

      if (containsVideo) {
        raf = requestAnimationFrame(loop);
      }
    };

    asset.redraw();
    asset.texture.needsUpdate = true;

    if (hasVideo()) {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      asset.texture.dispose();
      onTexture?.(null);
    };
  }, [asset, onTexture, masks, activeDraft]);

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