import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";

const PORT = Number(process.env.PORT || 3001);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

const DATA_DIR = path.join(process.cwd(), "data");
const MASKS_FILE = path.join(DATA_DIR, "masks.json");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: FRONTEND_ORIGIN
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 500
  })
);

const pointSchema = z.object({
  x: z.number(),
  y: z.number()
});

const warpPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  pinned: z.boolean().optional()
});

const localWarpSchema = z.object({
  mode: z.literal("mesh"),
  cols: z.number().int().min(2),
  rows: z.number().int().min(2),
  points: z.array(warpPointSchema).min(4)
});

const maskBaseSchema = z.object({
  modelId: z.number().int().optional(),
  name: z.string().min(1).max(255),
  type: z.string().min(1).max(100).default("polygon"),
  operation: z.string().min(1).max(20).default("add"),
  zIndex: z.number().int().default(0),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  layerName: z.string().min(1).max(100).default("default"),
  textureType: z.string().min(1).max(20).default("color"),
  textureValue: z.string().min(1).max(1000).default("#ffffff"),
  opacity: z.number().min(0).max(1).default(1),
  points: z.array(pointSchema).min(3),
  localWarp: localWarpSchema.nullish()
});

const createMaskSchema = maskBaseSchema;
const updateMaskSchema = maskBaseSchema.partial();

function safeParseJson(value, fallback) {
  try {
    if (value === null || value === undefined) return fallback;
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

async function ensureMasksFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(MASKS_FILE);
  } catch {
    await fs.writeFile(MASKS_FILE, "[]", "utf-8");
  }
}

async function readMasksFile() {
  await ensureMasksFile();

  const raw = await fs.readFile(MASKS_FILE, "utf-8");
  const parsed = safeParseJson(raw, []);

  return Array.isArray(parsed) ? parsed : [];
}

async function writeMasksFile(masks) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(MASKS_FILE, JSON.stringify(masks, null, 2), "utf-8");
}

function normalizeMask(mask) {
  return {
    id: Number(mask.id),
    modelId: Number(mask.modelId || 1),
    name: mask.name || "Maska",
    type: mask.type || "polygon",
    operation: mask.operation || "add",
    zIndex: Number(mask.zIndex ?? mask.z_index ?? 0),
    visible: mask.visible !== false,
    locked: mask.locked === true,
    layerName: mask.layerName ?? mask.layer_name ?? "default",
    textureType: mask.textureType ?? mask.texture_type ?? "color",
    textureValue: mask.textureValue ?? mask.texture_value ?? "#ffffff",
    opacity: Number(mask.opacity ?? 1),
    points: Array.isArray(mask.points)
      ? mask.points
      : safeParseJson(mask.points_json, []),
    localWarp:
      mask.localWarp !== undefined
        ? mask.localWarp
        : safeParseJson(mask.local_warp_json, null),
    createdAt: mask.createdAt ?? mask.created_at ?? new Date().toISOString(),
    updatedAt: mask.updatedAt ?? mask.updated_at ?? new Date().toISOString()
  };
}

function nextMaskId(masks) {
  const maxId = masks.reduce((max, mask) => {
    const id = Number(mask.id || 0);
    return id > max ? id : max;
  }, 0);

  return maxId + 1;
}

app.get("/health", async (_req, res) => {
  try {
    await ensureMasksFile();

    res.json({
      ok: true,
      storage: "json",
      masksFile: MASKS_FILE
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false });
  }
});

app.get("/masks", async (req, res) => {
  try {
    const modelId = Number(req.query.modelId || 1);

    const masks = await readMasksFile();

    const result = masks
      .map(normalizeMask)
      .filter((mask) => Number(mask.modelId || 1) === modelId)
      .sort((a, b) => {
        const zDiff = Number(a.zIndex || 0) - Number(b.zIndex || 0);
        if (zDiff !== 0) return zDiff;
        return Number(a.id || 0) - Number(b.id || 0);
      });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Nie udało się pobrać masek." });
  }
});

app.post("/masks", async (req, res) => {
  try {
    const modelId = Number(req.query.modelId || req.body.modelId || 1);
    const parsed = createMaskSchema.parse({
      ...req.body,
      modelId
    });

    const masks = await readMasksFile();
    const now = new Date().toISOString();

    const newMask = normalizeMask({
      ...parsed,
      id: nextMaskId(masks),
      modelId,
      createdAt: now,
      updatedAt: now
    });

    masks.push(newMask);
    await writeMasksFile(masks.map(normalizeMask));

    res.status(201).json(newMask);
  } catch (error) {
    console.error(error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Nieprawidłowe dane maski.",
        details: error.flatten()
      });
    }

    res.status(500).json({ error: "Nie udało się zapisać maski." });
  }
});

app.patch("/masks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = updateMaskSchema.parse(req.body);

    const masks = await readMasksFile();
    const normalized = masks.map(normalizeMask);

    const index = normalized.findIndex((mask) => Number(mask.id) === id);

    if (index === -1) {
      return res.status(404).json({ error: "Maska nie istnieje." });
    }

    const updatedMask = normalizeMask({
      ...normalized[index],
      ...parsed,
      id,
      updatedAt: new Date().toISOString()
    });

    normalized[index] = updatedMask;

    await writeMasksFile(normalized);

    res.json(updatedMask);
  } catch (error) {
    console.error(error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Nieprawidłowe dane aktualizacji maski.",
        details: error.flatten()
      });
    }

    res.status(500).json({ error: "Nie udało się zaktualizować maski." });
  }
});

app.put("/masks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = updateMaskSchema.parse(req.body);

    const masks = await readMasksFile();
    const normalized = masks.map(normalizeMask);

    const index = normalized.findIndex((mask) => Number(mask.id) === id);

    if (index === -1) {
      return res.status(404).json({ error: "Maska nie istnieje." });
    }

    const updatedMask = normalizeMask({
      ...normalized[index],
      ...parsed,
      id,
      updatedAt: new Date().toISOString()
    });

    normalized[index] = updatedMask;

    await writeMasksFile(normalized);

    res.json(updatedMask);
  } catch (error) {
    console.error(error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Nieprawidłowe dane aktualizacji maski.",
        details: error.flatten()
      });
    }

    res.status(500).json({ error: "Nie udało się zaktualizować maski." });
  }
});

app.delete("/masks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const masks = await readMasksFile();
    const normalized = masks.map(normalizeMask);

    const filtered = normalized.filter((mask) => Number(mask.id) !== id);

    await writeMasksFile(filtered);

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Nie udało się usunąć maski." });
  }
});

app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`);
  console.log(`Masks storage: ${MASKS_FILE}`);
});