/**
 * Service Layer client + mock server (Batch 2 guide, sections 8 and 14).
 * Each test starts its own mock on a free port so page size and session timeout can be small.
 */
const { start } = require("../mock-service-layer/server");
const sl = require("../connectors/serviceLayerClient");

const servers = [];
async function mock(options) {
  const srv = await start(0, options);
  servers.push(srv);
  return { host: "localhost", port: srv.address().port, database: "SBODemoIN", username: "manager", password: "Password123!" };
}
afterAll(async () => {
  for (const srv of servers) {
    srv.closeAllConnections();
    await new Promise((resolve) => srv.close(resolve));
  }
});
afterEach(() => jest.restoreAllMocks());

const loginCalls = () => global.fetch.mock.calls.filter(([url]) => String(url).endsWith("/Login")).length;

describe("Service Layer test connection", () => {
  test("correct details: success", async () => {
    const result = await sl.testConnection(await mock());
    expect(result).toEqual({ ok: true, message: expect.stringContaining("successful") });
  });

  test("wrong password: clear error, no crash", async () => {
    const result = await sl.testConnection({ ...(await mock()), password: "wrong" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/login failed.*username and password/i);
    expect(result.message).not.toContain("wrong"); // never echo the password
  });

  test("server cannot be reached: clear error", async () => {
    const result = await sl.testConnection({ ...(await mock()), port: 1 });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Cannot reach the Service Layer/);
  });
});

describe("Service Layer queries", () => {
  test("$filter and $select return only the matching rows and columns", async () => {
    const conn = await mock();
    const result = await sl.executeQuery(conn, { entity: "PurchaseOrders", filter: "Status eq 'Open'", select: "PONumber,Status" });
    expect(result.columns).toEqual(["PONumber", "Status"]);
    expect(result.rows.length).toBe(6);
    expect(result.rows.every(([, status]) => status === "Open")).toBe(true);
  });

  test("$filter with 'and' applies every condition", async () => {
    const conn = await mock();
    const all = await sl.executeQuery(conn, { entity: "Items", select: "ItemCode,QtyAvailable" });
    const result = await sl.executeQuery(conn, { entity: "Items", filter: "QtyAvailable ge 5 and QtyAvailable le 10", select: "ItemCode,QtyAvailable" });
    const expected = all.rows.filter(([, qty]) => qty >= 5 && qty <= 10);
    expect(result.rows).toEqual(expected);
    expect(result.rows.length).toBeLessThan(all.rows.length);
  });

  test("a filter on an unknown column is an error, not 'all rows'", async () => {
    const conn = await mock();
    await expect(sl.executeQuery(conn, { entity: "PurchaseOrders", filter: "Statuss eq 'Open'" }))
      .rejects.toThrow(/Property 'Statuss' is invalid/);
  });

  test("many records: paging follows every next page", async () => {
    const conn = await mock({ pageSize: 4 });
    jest.spyOn(global, "fetch");
    const result = await sl.executeQuery(conn, { entity: "PurchaseOrders" });
    expect(result.rows.length).toBe(15);
    const pageRequests = global.fetch.mock.calls.filter(([url]) => String(url).includes("/PurchaseOrders"));
    expect(pageRequests.length).toBe(4); // 4 + 4 + 4 + 3
  });

  test("paging stops at the row limit", async () => {
    const conn = await mock({ pageSize: 4 });
    const result = await sl.executeQuery(conn, { entity: "PurchaseOrders" }, {}, { limit: 10 });
    expect(result.rows.length).toBe(10);
  });

  test("session expires: the client logs in again and continues", async () => {
    const conn = await mock({ sessionTimeoutMs: 50 });
    jest.spyOn(global, "fetch");
    await sl.executeQuery(conn, { entity: "Items" });
    await new Promise((r) => setTimeout(r, 120));
    const result = await sl.executeQuery(conn, { entity: "Items" });
    expect(result.rows.length).toBeGreaterThan(0);
    expect(loginCalls()).toBe(2); // first login + one re-login after expiry
  });

  test("the mock is read only: writes are refused even with a valid session", async () => {
    const conn = await mock();
    const base = `http://localhost:${conn.port}/b1s/v1`;
    const login = await fetch(`${base}/Login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ CompanyDB: conn.database, UserName: conn.username, Password: conn.password }),
    });
    const cookie = login.headers.getSetCookie()[0].split(";")[0];
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const res = await fetch(`${base}/Invoices`, { method, headers: { Cookie: cookie } });
      expect(res.status).toBe(405);
    }
  });
});
