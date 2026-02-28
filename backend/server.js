import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import mysql from "mysql2/promise";
import { z } from "zod";

const app = express();

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"]
  })
);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 200
  })
);

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_USER = process.env.DB_USER || "app";
const DB_PASSWORD = process.env.DB_PASSWORD || "change_me";
const DB_NAME = process.env.DB_NAME || "geomapping";
const PORT = Number(process.env.PORT || 3001);

const maskCreateSchema = z.object({
  modelId: z.number().int().positive().default(1),
  name: z.string().trim().min(1).max(255),
  type: z.string().trim().min(1).max(50).default("polygon"),
  opacity: z.number().min(0).max(1),
  points: z
    .array(z.object({ x: z.number(), y: z.number() }))
    .min(3)
});

const maskUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  opacity: z.number().min(0).max(1),
  points: z.array(z.object({ x: z.number(), y: z.number() })).min(3)
});

let pool;

async function initDb() {
  pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
  });

  // szybki test połączenia
  await pool.query("SELECT 1");
}

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

app.get("/masks", async (req, res, next) => {
  try {
    const modelId = Number(req.query.modelId || 1);
    const [rows] = await pool.query(
      "SELECT id, modelId, name, type, opacity, points_json FROM masks WHERE modelId=? ORDER BY created_at DESC",
      [modelId]
    );

    res.json(
      rows.map((r) => ({
        id: Number(r.id),
        modelId: r.modelId,
        name: r.name,
        type: r.type,
        opacity: Number(r.opacity),
        points: r.points_json
      }))
    );
  } catch (e) {
    next(e);
  }
});

app.post("/masks", async (req, res, next) => {
  try {
    const parsed = maskCreateSchema.safeParse({
      ...req.body,
      modelId: Number(req.body?.modelId ?? 1)
    });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { modelId, name, type, opacity, points } = parsed.data;

    const [result] = await pool.query(
      "INSERT INTO masks (modelId, name, type, opacity, points_json) VALUES (?,?,?,?,?)",
      [modelId, name, type, opacity, JSON.stringify(points)]
    );

    res.status(201).json({
      id: Number(result.insertId),
      modelId,
      name,
      type,
      opacity,
      points
    });
  } catch (e) {
    next(e);
  }
});

app.put("/masks/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const parsed = maskUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { name, opacity, points } = parsed.data;

    const [result] = await pool.query(
      "UPDATE masks SET name=?, opacity=?, points_json=? WHERE id=?",
      [name, opacity, JSON.stringify(points), id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "Not found" });

    res.json({ id, name, opacity, points });
  } catch (e) {
    next(e);
  }
});

app.delete("/masks/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const [result] = await pool.query("DELETE FROM masks WHERE id=?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Not found" });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// error handler (żeby nie wywalało “brzydko”)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

initDb()
  .then(() => app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`)))
  .catch((e) => {
    console.error("DB init error:", e);
    process.exit(1);
  });