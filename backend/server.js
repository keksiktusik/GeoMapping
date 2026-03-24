import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import mysql from "mysql2/promise";
import { z } from "zod";

const PORT = Number(process.env.PORT || 3001);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "db",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "",
  waitForConnections: true,
  connectionLimit: 10
});

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: FRONTEND_ORIGIN
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 200
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
  name: z.string().min(1).max(255),
  type: z.string().min(1).max(100).default("polygon"),
  operation: z.string().min(1).max(20).default("add"),
  zIndex: z.number().int().default(0),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  layerName: z.string().min(1).max(100).default("default"),
  textureType: z.string().min(1).max(20).default("color"),
  textureValue: z.string().min(1).max(255).default("#ffffff"),
  opacity: z.number().min(0).max(1).default(1),
  points: z.array(pointSchema).min(3),
  localWarp: localWarpSchema.nullish()
});

const createMaskSchema = maskBaseSchema;

const updateMaskSchema = maskBaseSchema.partial();

function mapMaskRow(row) {
  return {
    id: row.id,
    modelId: row.modelId,
    name: row.name,
    type: row.type,
    operation: row.operation,
    zIndex: row.z_index,
    visible: Boolean(row.visible),
    locked: Boolean(row.locked),
    layerName: row.layer_name,
    textureType: row.texture_type,
    textureValue: row.texture_value,
    opacity: Number(row.opacity),
    points: safeParseJson(row.points_json, []),
    localWarp: safeParseJson(row.local_warp_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function safeParseJson(value, fallback) {
  try {
    if (value === null || value === undefined) return fallback;
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false });
  }
});

app.get("/masks", async (req, res) => {
  try {
    const modelId = Number(req.query.modelId || 1);

    const [rows] = await pool.query(
      `
      SELECT
        id,
        modelId,
        name,
        type,
        operation,
        z_index,
        visible,
        locked,
        layer_name,
        texture_type,
        texture_value,
        opacity,
        points_json,
        local_warp_json,
        created_at,
        updated_at
      FROM masks
      WHERE modelId = ?
      ORDER BY z_index ASC, id ASC
      `,
      [modelId]
    );

    res.json(rows.map(mapMaskRow));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Nie udało się pobrać masek." });
  }
});

app.post("/masks", async (req, res) => {
  try {
    const modelId = Number(req.query.modelId || req.body.modelId || 1);
    const parsed = createMaskSchema.parse(req.body);

    const [result] = await pool.query(
      `
      INSERT INTO masks (
        modelId,
        name,
        type,
        operation,
        z_index,
        visible,
        locked,
        layer_name,
        texture_type,
        texture_value,
        opacity,
        points_json,
        local_warp_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        modelId,
        parsed.name,
        parsed.type,
        parsed.operation,
        parsed.zIndex,
        parsed.visible ? 1 : 0,
        parsed.locked ? 1 : 0,
        parsed.layerName,
        parsed.textureType,
        parsed.textureValue,
        parsed.opacity,
        JSON.stringify(parsed.points),
        parsed.localWarp ? JSON.stringify(parsed.localWarp) : null
      ]
    );

    const [rows] = await pool.query(
      `
      SELECT
        id,
        modelId,
        name,
        type,
        operation,
        z_index,
        visible,
        locked,
        layer_name,
        texture_type,
        texture_value,
        opacity,
        points_json,
        local_warp_json,
        created_at,
        updated_at
      FROM masks
      WHERE id = ?
      LIMIT 1
      `,
      [result.insertId]
    );

    res.status(201).json(mapMaskRow(rows[0]));
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

    const fields = [];
    const values = [];

    if (parsed.name !== undefined) {
      fields.push("name = ?");
      values.push(parsed.name);
    }
    if (parsed.type !== undefined) {
      fields.push("type = ?");
      values.push(parsed.type);
    }
    if (parsed.operation !== undefined) {
      fields.push("operation = ?");
      values.push(parsed.operation);
    }
    if (parsed.zIndex !== undefined) {
      fields.push("z_index = ?");
      values.push(parsed.zIndex);
    }
    if (parsed.visible !== undefined) {
      fields.push("visible = ?");
      values.push(parsed.visible ? 1 : 0);
    }
    if (parsed.locked !== undefined) {
      fields.push("locked = ?");
      values.push(parsed.locked ? 1 : 0);
    }
    if (parsed.layerName !== undefined) {
      fields.push("layer_name = ?");
      values.push(parsed.layerName);
    }
    if (parsed.textureType !== undefined) {
      fields.push("texture_type = ?");
      values.push(parsed.textureType);
    }
    if (parsed.textureValue !== undefined) {
      fields.push("texture_value = ?");
      values.push(parsed.textureValue);
    }
    if (parsed.opacity !== undefined) {
      fields.push("opacity = ?");
      values.push(parsed.opacity);
    }
    if (parsed.points !== undefined) {
      fields.push("points_json = ?");
      values.push(JSON.stringify(parsed.points));
    }
    if (parsed.localWarp !== undefined) {
      fields.push("local_warp_json = ?");
      values.push(parsed.localWarp ? JSON.stringify(parsed.localWarp) : null);
    }

    if (!fields.length) {
      const [rows] = await pool.query(
        `
        SELECT
          id,
          modelId,
          name,
          type,
          operation,
          z_index,
          visible,
          locked,
          layer_name,
          texture_type,
          texture_value,
          opacity,
          points_json,
          local_warp_json,
          created_at,
          updated_at
        FROM masks
        WHERE id = ?
        LIMIT 1
        `,
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({ error: "Maska nie istnieje." });
      }

      return res.json(mapMaskRow(rows[0]));
    }

    values.push(id);

    await pool.query(
      `
      UPDATE masks
      SET ${fields.join(", ")}
      WHERE id = ?
      `,
      values
    );

    const [rows] = await pool.query(
      `
      SELECT
        id,
        modelId,
        name,
        type,
        operation,
        z_index,
        visible,
        locked,
        layer_name,
        texture_type,
        texture_value,
        opacity,
        points_json,
        local_warp_json,
        created_at,
        updated_at
      FROM masks
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Maska nie istnieje." });
    }

    res.json(mapMaskRow(rows[0]));
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

    await pool.query(`DELETE FROM masks WHERE id = ?`, [id]);

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Nie udało się usunąć maski." });
  }
});

app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`);
});