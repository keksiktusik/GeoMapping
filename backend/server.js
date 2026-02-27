import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";

const app = express();
app.use(cors());
app.use(express.json());

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "root";
const DB_NAME = process.env.DB_NAME || "geomapping";
const PORT = process.env.PORT || 3001;

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS masks (
      id BIGINT PRIMARY KEY,
      modelId INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      opacity DOUBLE NOT NULL,
      points_json JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

app.get("/masks", async (req, res) => {
  const modelId = Number(req.query.modelId || 1);
  const [rows] = await pool.query(
    "SELECT * FROM masks WHERE modelId=? ORDER BY created_at DESC",
    [modelId]
  );

  const mapped = rows.map((r) => ({
    id: Number(r.id),
    modelId: r.modelId,
    name: r.name,
    type: r.type,
    opacity: Number(r.opacity),
    points: r.points_json
  }));

  res.json(mapped);
});

app.post("/masks", async (req, res) => {
  const { modelId = 1, name, type = "polygon", opacity = 0.35, points = [] } = req.body;
  const id = Date.now();

  await pool.query(
    "INSERT INTO masks (id, modelId, name, type, opacity, points_json) VALUES (?,?,?,?,?,?)",
    [id, modelId, name, type, opacity, JSON.stringify(points)]
  );

  res.json({ id, modelId, name, type, opacity, points });
});

app.put("/masks/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, opacity, points } = req.body;

  await pool.query(
    "UPDATE masks SET name=?, opacity=?, points_json=? WHERE id=?",
    [name, opacity, JSON.stringify(points), id]
  );

  res.json({ id, name, opacity, points });
});

app.delete("/masks/:id", async (req, res) => {
  const id = Number(req.params.id);
  await pool.query("DELETE FROM masks WHERE id=?", [id]);
  res.json({ ok: true });
});

app.get("/health", (_req, res) => res.json({ ok: true }));

initDb()
  .then(() => app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`)))
  .catch((e) => {
    console.error("DB init error:", e);
    process.exit(1);
  });