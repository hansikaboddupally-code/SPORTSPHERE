import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import app from "../app.js";

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("health endpoint reports the API as available", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", service: "sportsphere-api" });
});

test("development CORS accepts localhost and loopback storefront origins", async () => {
  for (const origin of ["http://localhost:5173", "http://127.0.0.1:5173"]) {
    const response = await fetch(`${baseUrl}/api/health`, { headers: { origin } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  }
});

test("private cart and admin routes reject anonymous requests", async () => {
  const [cart, admin] = await Promise.all([
    fetch(`${baseUrl}/api/cart`),
    fetch(`${baseUrl}/api/admin/dashboard`),
  ]);
  assert.equal(cart.status, 401);
  assert.equal(admin.status, 401);
});

test("registration validates input before database access", async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "not-an-email", password: "short" }),
  });
  assert.equal(response.status, 400);
});

test("email verification validates token format before database access", async () => {
  const response = await fetch(`${baseUrl}/api/auth/verify-email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "invalid" }),
  });
  assert.equal(response.status, 400);
});

test("recommendation endpoint rejects malformed recently viewed IDs", async () => {
  const response = await fetch(`${baseUrl}/api/products/recommendations?viewed=not-an-id`);
  assert.equal(response.status, 400);
});

test("invoice, shipment and variant inventory management require authentication", async () => {
  const [invoice, tracking, variants] = await Promise.all([
    fetch(`${baseUrl}/api/orders/65a000000000000000000000/invoice`),
    fetch(`${baseUrl}/api/orders/admin/65a000000000000000000000/tracking`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ carrier: "Courier", trackingNumber: "12345" }),
    }),
    fetch(`${baseUrl}/api/admin/products/65a000000000000000000000/variants`, { method: "PUT" }),
  ]);
  assert.equal(invoice.status, 401);
  assert.equal(tracking.status, 401);
  assert.equal(variants.status, 401);
});

test("logout clears the session cookie", async () => {
  const response = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST" });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") ?? "", /sportsphere_token=/);
});
