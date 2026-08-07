import assert from "node:assert/strict";
import test from "node:test";

function fakeDatabase() {
  const rows = new Map();
  return {
    prepare(query) {
      let values = [];
      return {
        bind(...nextValues) { values = nextValues; return this; },
        async first() {
          const row = rows.get(values[0]);
          return row ? { email: row.email, payload: row.payload, revision: row.revision, updated_at: row.updated_at } : null;
        },
        async run() {
          if (query.startsWith("INSERT OR IGNORE")) {
            const [userId, email, payload] = values;
            if (rows.has(userId)) return { meta: { changes: 0 } };
            rows.set(userId, { email, payload, revision: 1, updated_at: "2026-08-07 12:00:00" });
            return { meta: { changes: 1 } };
          }
          if (query.startsWith("UPDATE user_app_data")) {
            const [email, payload, nextRevision, userId, expectedRevision] = values;
            const row = rows.get(userId);
            if (!row || row.revision !== expectedRevision) return { meta: { changes: 0 } };
            rows.set(userId, { email, payload, revision: nextRevision, updated_at: "2026-08-07 12:01:00" });
            return { meta: { changes: 1 } };
          }
          throw new Error(`Unexpected query: ${query}`);
        },
      };
    },
  };
}

const validData = {
  ingredients: [], bases: [], products: [], sales: [], expenses: [],
  settings: { businessName: "Doce Custo" },
};

test("sync requires login and protects revisions", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("sync-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const DB = fakeDatabase();
  const ctx = { waitUntil() {}, passThroughOnException() {} };

  const anonymous = await worker.fetch(new Request("http://localhost/api/sync"), { DB }, ctx);
  assert.equal(anonymous.status, 401);

  const headers = {
    "oai-authenticated-user-id": "user-1",
    "oai-authenticated-user-email": "ana@example.com",
  };
  const empty = await worker.fetch(new Request("http://localhost/api/sync", { headers }), { DB }, ctx);
  assert.deepEqual(await empty.json(), { email: "ana@example.com", data: null, revision: null, updatedAt: null });

  const created = await worker.fetch(new Request("http://localhost/api/sync", {
    method: "POST", headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ data: validData, expectedRevision: null }),
  }), { DB }, ctx);
  assert.equal(created.status, 200);
  assert.equal((await created.json()).revision, 1);

  const changedData = { ...validData, settings: { businessName: "Confeitaria da Ana" } };
  const updated = await worker.fetch(new Request("http://localhost/api/sync", {
    method: "POST", headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ data: changedData, expectedRevision: 1 }),
  }), { DB }, ctx);
  assert.equal((await updated.json()).revision, 2);

  const stale = await worker.fetch(new Request("http://localhost/api/sync", {
    method: "POST", headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ data: validData, expectedRevision: 1 }),
  }), { DB }, ctx);
  assert.equal(stale.status, 409);
  const conflict = await stale.json();
  assert.equal(conflict.revision, 2);
  assert.equal(conflict.data.settings.businessName, "Confeitaria da Ana");
});
