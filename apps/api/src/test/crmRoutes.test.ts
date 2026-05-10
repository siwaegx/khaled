import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeApp, makeTenantDb } from "./helpers";
import { router } from "../../../../modules/crm/backend/router";

describe("CRM — GET /stats", () => {
  let db: ReturnType<typeof makeTenantDb>;

  beforeEach(() => {
    db = makeTenantDb();
  });

  it("returns all stats", async () => {
    db.lead.groupBy = vi.fn().mockResolvedValue([{ status: "new", _count: { id: 2 } }]);
    db.deal.count = vi.fn().mockResolvedValue(5);
    db.deal.groupBy = vi.fn().mockResolvedValue([
      { status: "won", _count: { id: 1 }, _sum: { value: 5000 } },
    ]);
    db.lead.count = vi.fn().mockResolvedValue(10);
    db.customer.count = vi.fn().mockResolvedValue(3);
    db.crmCompany.count = vi.fn().mockResolvedValue(2);
    db.crmContact.count = vi.fn().mockResolvedValue(7);

    const res = await request(makeApp(router, undefined, db)).get("/stats");
    expect(res.status).toBe(200);
    expect(res.body.totalLeads).toBe(10);
    expect(res.body.totalCustomers).toBe(3);
    expect(res.body.totalDeals).toBe(5);
    expect(res.body.totalCompanies).toBe(2);
    expect(res.body.totalContacts).toBe(7);
    expect(res.body.leadsByStatus).toEqual([{ status: "new", _count: { id: 2 } }]);
    expect(res.body.dealsByStatus[0].status).toBe("won");
  });
});

// ─── Leads ───────────────────────────────────────────────────────────────────

describe("CRM Leads", () => {
  let db: ReturnType<typeof makeTenantDb>;

  beforeEach(() => {
    db = makeTenantDb();
  });

  const LEAD = {
    id: "lead1", name: "Alice", email: "a@b.com", phone: null,
    company: "Acme", status: "new", source: null, notes: null,
    assignedTo: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };

  it("GET /leads returns lead list", async () => {
    db.lead.findMany = vi.fn().mockResolvedValue([LEAD]);
    const res = await request(makeApp(router, undefined, db)).get("/leads");
    expect(res.status).toBe(200);
    expect(res.body.leads).toHaveLength(1);
    expect(res.body.leads[0].name).toBe("Alice");
  });

  it("POST /leads creates a lead", async () => {
    db.lead.create = vi.fn().mockResolvedValue(LEAD);
    const res = await request(makeApp(router, undefined, db))
      .post("/leads")
      .send({ name: "Alice", email: "a@b.com", company: "Acme" });
    expect(res.status).toBe(201);
    expect(res.body.lead.name).toBe("Alice");
  });

  it("POST /leads returns 400 for missing name", async () => {
    const res = await request(makeApp(router, undefined, db))
      .post("/leads")
      .send({ email: "a@b.com" });
    expect(res.status).toBe(400);
  });

  it("POST /leads returns 400 for invalid email", async () => {
    const res = await request(makeApp(router, undefined, db))
      .post("/leads")
      .send({ name: "Alice", email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("PATCH /leads/:id updates a lead", async () => {
    db.lead.update = vi.fn().mockResolvedValue({ ...LEAD, status: "contacted" });
    const res = await request(makeApp(router, undefined, db))
      .patch("/leads/lead1")
      .send({ status: "contacted" });
    expect(res.status).toBe(200);
    expect(res.body.lead.status).toBe("contacted");
  });

  it("PATCH /leads/:id with invalid status returns 400", async () => {
    const res = await request(makeApp(router, undefined, db))
      .patch("/leads/lead1")
      .send({ status: "invalid-status" });
    expect(res.status).toBe(400);
  });

  it("DELETE /leads/:id deletes lead", async () => {
    db.lead.delete = vi.fn().mockResolvedValue({});
    const res = await request(makeApp(router, undefined, db)).delete("/leads/lead1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── Customers ────────────────────────────────────────────────────────────────

describe("CRM Customers", () => {
  let db: ReturnType<typeof makeTenantDb>;

  beforeEach(() => { db = makeTenantDb(); });

  const CUSTOMER = {
    id: "c1", name: "Bob Corp", email: "bob@corp.com", phone: "555-1234",
    company: "Corp", address: null, notes: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    deals: [],
  };

  it("GET /customers returns list", async () => {
    db.customer.findMany = vi.fn().mockResolvedValue([CUSTOMER]);
    const res = await request(makeApp(router, undefined, db)).get("/customers");
    expect(res.status).toBe(200);
    expect(res.body.customers[0].name).toBe("Bob Corp");
  });

  it("POST /customers creates customer", async () => {
    db.customer.create = vi.fn().mockResolvedValue(CUSTOMER);
    const res = await request(makeApp(router, undefined, db))
      .post("/customers")
      .send({ name: "Bob Corp", email: "bob@corp.com" });
    expect(res.status).toBe(201);
    expect(res.body.customer.name).toBe("Bob Corp");
  });

  it("POST /customers returns 400 for missing name", async () => {
    const res = await request(makeApp(router, undefined, db))
      .post("/customers")
      .send({ email: "a@b.com" });
    expect(res.status).toBe(400);
  });

  it("POST /customers returns 400 for invalid email", async () => {
    const res = await request(makeApp(router, undefined, db))
      .post("/customers")
      .send({ name: "Corp", email: "bad-email" });
    expect(res.status).toBe(400);
  });

  it("PATCH /customers/:id updates customer", async () => {
    db.customer.update = vi.fn().mockResolvedValue({ ...CUSTOMER, phone: "999-0000" });
    const res = await request(makeApp(router, undefined, db))
      .patch("/customers/c1")
      .send({ phone: "999-0000" });
    expect(res.status).toBe(200);
    expect(res.body.customer.phone).toBe("999-0000");
  });

  it("DELETE /customers/:id deletes customer", async () => {
    db.customer.delete = vi.fn().mockResolvedValue({});
    const res = await request(makeApp(router, undefined, db)).delete("/customers/c1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── Deals ────────────────────────────────────────────────────────────────────

describe("CRM Deals", () => {
  let db: ReturnType<typeof makeTenantDb>;

  beforeEach(() => { db = makeTenantDb(); });

  const DEAL = {
    id: "d1", title: "Big Deal", value: 10000, currency: "USD",
    status: "prospect", customerId: null, customer: null,
    assignedTo: null, closeDate: null, notes: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };

  it("GET /deals returns list", async () => {
    db.deal.findMany = vi.fn().mockResolvedValue([DEAL]);
    const res = await request(makeApp(router, undefined, db)).get("/deals");
    expect(res.status).toBe(200);
    expect(res.body.deals[0].title).toBe("Big Deal");
  });

  it("POST /deals creates deal", async () => {
    db.deal.create = vi.fn().mockResolvedValue(DEAL);
    const res = await request(makeApp(router, undefined, db))
      .post("/deals")
      .send({ title: "Big Deal", value: 10000 });
    expect(res.status).toBe(201);
    expect(res.body.deal.title).toBe("Big Deal");
  });

  it("POST /deals returns 400 for missing title", async () => {
    const res = await request(makeApp(router, undefined, db))
      .post("/deals")
      .send({ value: 1000 });
    expect(res.status).toBe(400);
  });

  it("POST /deals returns 400 for negative value", async () => {
    const res = await request(makeApp(router, undefined, db))
      .post("/deals")
      .send({ title: "Deal", value: -100 });
    expect(res.status).toBe(400);
  });

  it("POST /deals returns 400 for invalid status", async () => {
    const res = await request(makeApp(router, undefined, db))
      .post("/deals")
      .send({ title: "Deal", status: "FAKE_STATUS" });
    expect(res.status).toBe(400);
  });

  it("PATCH /deals/:id updates status", async () => {
    db.deal.update = vi.fn().mockResolvedValue({ ...DEAL, status: "won" });
    const res = await request(makeApp(router, undefined, db))
      .patch("/deals/d1")
      .send({ status: "won" });
    expect(res.status).toBe(200);
    expect(res.body.deal.status).toBe("won");
  });

  it("PATCH /deals/:id with invalid closeDate returns 400", async () => {
    const res = await request(makeApp(router, undefined, db))
      .patch("/deals/d1")
      .send({ closeDate: "not-a-date" });
    expect(res.status).toBe(400);
  });

  it("DELETE /deals/:id deletes deal", async () => {
    db.deal.delete = vi.fn().mockResolvedValue({});
    const res = await request(makeApp(router, undefined, db)).delete("/deals/d1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

