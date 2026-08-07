type D1Result = { meta?: { changes?: number | null } };
type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<D1Result>;
};
type SyncDatabase = { prepare(query: string): D1Statement };
type StoredRow = { email: string; payload: string; revision: number; updated_at: string };

const MAX_PAYLOAD_BYTES = 2_000_000;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function unauthorized() {
  return json({
    error: "Entre com o ChatGPT para sincronizar.",
    signInPath: "/signin-with-chatgpt?return_to=%2F",
  }, 401);
}

function parseStoredData(payload: string) {
  try { return JSON.parse(payload) as unknown; }
  catch { return null; }
}

function isAppData(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return Array.isArray(data.ingredients)
    && Array.isArray(data.bases)
    && Array.isArray(data.products)
    && Array.isArray(data.sales)
    && Array.isArray(data.expenses)
    && Boolean(data.settings && typeof data.settings === "object");
}

async function currentRow(db: SyncDatabase, userId: string) {
  return db.prepare("SELECT email, payload, revision, updated_at FROM user_app_data WHERE user_id = ? LIMIT 1")
    .bind(userId)
    .first<StoredRow>();
}

function cloudSnapshot(row: StoredRow | null, email?: string) {
  return {
    email: email ?? row?.email ?? "",
    data: row ? parseStoredData(row.payload) : null,
    revision: row?.revision ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

export async function handleSyncRequest(request: Request, db: SyncDatabase) {
  const userId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  if (!userId || !email) return unauthorized();

  if (request.method === "GET") {
    return json(cloudSnapshot(await currentRow(db, userId), email));
  }

  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  let body: { data?: unknown; expectedRevision?: number | null };
  try { body = await request.json() as { data?: unknown; expectedRevision?: number | null }; }
  catch { return json({ error: "Dados inválidos." }, 400); }

  if (!isAppData(body.data)) return json({ error: "Estrutura de dados inválida." }, 400);
  const payload = JSON.stringify(body.data);
  if (new TextEncoder().encode(payload).byteLength > MAX_PAYLOAD_BYTES) {
    return json({ error: "O conjunto de dados excede o limite de sincronização." }, 413);
  }

  const existing = await currentRow(db, userId);
  if (!existing) {
    if (body.expectedRevision !== null && body.expectedRevision !== undefined) {
      return json({ error: "A cópia da nuvem mudou. Atualize os dados antes de salvar." }, 409);
    }
    const result = await db.prepare("INSERT OR IGNORE INTO user_app_data (user_id, email, payload, revision, updated_at) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)")
      .bind(userId, email, payload)
      .run();
    if ((result.meta?.changes ?? 0) < 1) return json(cloudSnapshot(await currentRow(db, userId), email), 409);
    return json(cloudSnapshot(await currentRow(db, userId), email));
  }

  if (body.expectedRevision !== existing.revision) {
    return json({ error: "Os dados foram alterados em outro aparelho.", ...cloudSnapshot(existing, email) }, 409);
  }

  const nextRevision = existing.revision + 1;
  const result = await db.prepare("UPDATE user_app_data SET email = ?, payload = ?, revision = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revision = ?")
    .bind(email, payload, nextRevision, userId, existing.revision)
    .run();
  if ((result.meta?.changes ?? 0) < 1) {
    return json({ error: "Os dados foram alterados em outro aparelho.", ...cloudSnapshot(await currentRow(db, userId), email) }, 409);
  }
  return json(cloudSnapshot(await currentRow(db, userId), email));
}
