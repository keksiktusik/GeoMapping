const USE_MOCK = true; // <- jak backend będzie gotowy, zmienisz na false
const BASE_URL = "http://localhost:3001"; // backend (np. osoba 2)

let mockDb = {
  masksByModel: {
    1: []
  }
};

export async function getMasks(modelId = 1) {
  if (USE_MOCK) {
    // symulacja opóźnienia jak w sieci
    await new Promise((r) => setTimeout(r, 200));
    return mockDb.masksByModel[modelId] || [];
  }

  const res = await fetch(`${BASE_URL}/masks?modelId=${modelId}`);
  if (!res.ok) throw new Error("GET /masks failed");
  return await res.json();
}

export async function createMask(modelId = 1, mask) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 200));
    const newMask = { ...mask, id: Date.now(), modelId };
    mockDb.masksByModel[modelId] = [newMask, ...(mockDb.masksByModel[modelId] || [])];
    return newMask;
  }

  const res = await fetch(`${BASE_URL}/masks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelId, ...mask })
  });

  if (!res.ok) throw new Error("POST /masks failed");
  return await res.json();
}

export async function deleteMask(id) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 150));
    Object.keys(mockDb.masksByModel).forEach((mid) => {
      mockDb.masksByModel[mid] = (mockDb.masksByModel[mid] || []).filter((m) => m.id !== id);
    });
    return true;
  }

  const res = await fetch(`${BASE_URL}/masks/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("DELETE /masks/:id failed");
  return true;
}