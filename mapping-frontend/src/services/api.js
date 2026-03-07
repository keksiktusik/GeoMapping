const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export async function getMasks(modelId = 1) {
  const res = await fetch(`${BASE_URL}/masks?modelId=${modelId}`);
  if (!res.ok) throw new Error("GET /masks failed");
  return await res.json();
}

export async function createMask(modelId = 1, mask) {
  const res = await fetch(`${BASE_URL}/masks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelId, ...mask })
  });

  if (!res.ok) throw new Error("POST /masks failed");
  return await res.json();
}

export async function deleteMask(id) {
  const res = await fetch(`${BASE_URL}/masks/${id}`, {
    method: "DELETE"
  });

  if (!res.ok) throw new Error("DELETE /masks/:id failed");
  return await res.json();
}

export async function updateMask(id, patch) {
  const res = await fetch(`${BASE_URL}/masks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });

  if (!res.ok) throw new Error("PATCH /masks/:id failed");
  return await res.json();
}