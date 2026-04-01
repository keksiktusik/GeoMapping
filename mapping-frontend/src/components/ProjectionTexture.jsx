import { useEffect, useMemo, useRef, useState } from "react";
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
  onTexture
}) {
  const imageCache = useRef(new Map());
  const videoCache = useRef(new Map());
  const [forceVersion, setForceVersion] = useState(0);

  const asset = useMemo(
    () =>
      createProjectionTextureAsset({
        wallW,
        wallH,
        showGrid,
        showPinkBackground,
        masks,
        activeDraft,
        imageCache,
        videoCache,
        onAssetReady: () => {
          setForceVersion((v) => v + 1);
        }
      }),
    [
      wallW,
      wallH,
      showGrid,
      showPinkBackground,
      masks,
      activeDraft,
      forceVersion
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

    const handleVisibility = () => {
      reviveVideos();
    };

    const handleFocus = () => {
      reviveVideos();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handleFocus);
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