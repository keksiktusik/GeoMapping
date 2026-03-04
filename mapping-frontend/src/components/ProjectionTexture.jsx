import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

function drawPolygonFill(ctx, pts, alpha) {
  if (!pts || pts.length < 3) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPolygonStroke(ctx, pts) {
  if (!pts || pts.length < 2) return;

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = "rgba(0,0,255,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.restore();
}

export default function ProjectionTexture({
  wallW = 800,
  wallH = 500,
  showGrid = false,
  masks = [],
  activePoints = [],
  opacity = 0.35,
  imageUrl = "/projection.jpg",
  onTexture
}) {
  const canvasRef = useRef(document.createElement("canvas"));

  // Cache obrazka (żeby nie robić Image() w kółko)
  const imgRef = useRef(null);
  const imgLoadedRef = useRef(false);

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvasRef.current);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }, []);

  useEffect(() => {
    // init image cache
    const img = new Image();
    imgRef.current = img;
    imgLoadedRef.current = false;

    const handleLoad = () => {
      imgLoadedRef.current = true;
      // po wczytaniu i tak narysujemy w kolejnym useEffect
      // (trigger nastąpi, bo imageUrl jest w deps)
    };

    const handleError = () => {
      imgLoadedRef.current = false;
      console.warn("ProjectionTexture: nie udało się wczytać imageUrl:", imageUrl);
    };

    img.addEventListener("load", handleLoad);
    img.addEventListener("error", handleError);
    img.src = imageUrl;

    return () => {
      img.removeEventListener("load", handleLoad);
      img.removeEventListener("error", handleError);
    };
  }, [imageUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = wallW;
    canvas.height = wallH;

    const ctx = canvas.getContext("2d");

    // --- 1) tło ---
    ctx.clearRect(0, 0, wallW, wallH);

    const img = imgRef.current;
    const loaded = imgLoadedRef.current;

    if (img && loaded) {
      ctx.drawImage(img, 0, 0, wallW, wallH);
    } else {
      // fallback tło gdy obraz jeszcze się ładuje / nie działa
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(0, 0, wallW, wallH);
    }

    // --- 2) grid (kalibracja) ---
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,0,0,0.35)";
      ctx.lineWidth = 1;
      const step = 50;

      for (let x = 0; x <= wallW; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, wallH);
        ctx.stroke();
      }

      for (let y = 0; y <= wallH; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(wallW, y);
        ctx.stroke();
      }

      ctx.restore();
    }

    // --- 3) zapisane maski (blackout) ---
    for (const m of masks) {
      if (!m?.points || m.points.length < 3) continue;
      const a = typeof m.opacity === "number" ? m.opacity : 0.35;
      drawPolygonFill(ctx, m.points, a);
    }

    // --- 4) aktywna maska (podgląd) ---
    // fill dopiero gdy mamy >=3 punkty
    if (activePoints && activePoints.length >= 3) {
      drawPolygonFill(ctx, activePoints, opacity);
    }
    // kontur pokazujemy już od 2 punktów (żeby w draw było widać co rysujesz)
    if (activePoints && activePoints.length >= 2) {
      drawPolygonStroke(ctx, activePoints);
    }

    // --- update tekstury ---
    texture.needsUpdate = true;
    onTexture?.(texture);
  }, [wallW, wallH, showGrid, masks, activePoints, opacity, texture, onTexture]);

  return null;
}