import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeApp } from "./helpers";
import type { MockTenantDb } from "./helpers";
import { router } from "../../../../modules/hr/backend/router";

const ISO = "2026-06-01T00:00:00.000Z";

function makeDb() {
  return {
    employee: {
      count:   vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      create:  vi.fn(),
      update:  vi.fn(),
      delete:  vi.fn(),
    },
    leaveRequest: {
      count:   vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      create:  vi.fn(),
      update:  vi.fn(),
      delete:  vi.fn(),
    },
  };
}

type Db = ReturnType<typeof makeDb>;

function app(db: Db) {
  return makeApp(router, undefined, db as unknown as MockTenantDb);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMPLOYEE = {
  id: "emp1", name: "Alice Smith", email: "alice@corp.com", phone: null,
  position: "Engineer", department: "Engineering", salary: 90000,
  status: "active", hireDate: ISO, terminationDate: null, notes: null,
  createdAt: ISO, updatedAt: ISO, _count: { leaveRequests: 1 },
};

const LEAVE = {
  id: "lr1", employeeId: "emp1", type: "annual", status: "pending",
  startDate: ISO, endDate: ISO, days: 5, reason: "Holiday", notes: null,
  createdAt: ISO, updatedAt: ISO,
  employee: { id: "emp1", name: "Alice Smith", department: "Engineering" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /stats
// ═══════════════════════════════════════════════════════════════════════════════

describe("HR — GET /stats", () => {
  let db: Db;
  beforeEach(() => { db = makeDb(); });

  it("returns all KPIs", async () => {
    db.employee.count.mockResolvedValue(12);
    db.leaveRequest.count.mockResolvedValue(3);
    db.employee.groupBy.mockResolvedValue([
      { status: "active",   _count: { id: 10 } },
      { status: "inactive", _count: { id: 2  } },
    ]);
    db.leaveRequest.groupBy.mockResolvedValue([
      { type: "annual", _count: { id: 2 }, _sum: { days: 10 } },
    ]);

    const res = await request(app(db)).get("/stats");
    expect(res.status).toBe(200);
    expect(res.body.totalEmployees).toBe(12);
    expect(res.body.totalLeaveRequests).toBe(3);
    expect(res.body.activeCount).toBe(10);
    expect(Array.isArray(res.body.employeesByStatus)).toBe(true);
    expect(Array.isArray(res.body.leaveByType)).toBe(true);
  });

  it("returns 0 activeCount when no active employees", async () => {
    db.employee.count.mockResolvedValue(0);
    db.leaveRequest.count.mockResolvedValue(0);
    db.employee.groupBy.mockResolvedValue([]);
    db.leaveRequest.groupBy.mockResolvedValue([]);

    const res = await request(app(db)).get("/stats");
    expect(res.status).toBe(200);
    expect(res.body.activeCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Employees
// ═══════════════════════════════════════════════════════════════════════════════

describe("HR Employees", () => {
  let db: Db;
  beforeEach(() => { db = makeDb(); });

  it("GET /employees returns paginated list", async () => {
    db.employee.findMany.mockResolvedValue([EMPLOYEE]);
    db.employee.count.mockResolvedValue(1);

    const res = await request(app(db)).get("/employees");
    expect(res.status).toBe(200);
    expect(res.body.employees).toHaveLength(1);
    expect(res.body.employees[0].name).toBe("Alice Smith");
  });

  it("GET /employees filters by status", async () => {
    db.employee.findMany.mockResolvedValue([]);
    db.employee.count.mockResolvedValue(0);

    const res = await request(app(db)).get("/employees?status=active");
    expect(res.status).toBe(200);
    expect(db.employee.findMany).toHaveBeenCalledOnce();
  });

  it("GET /employees filters by department", async () => {
    db.employee.findMany.mockResolvedValue([]);
    db.employee.count.mockResolvedValue(0);

    const res = await request(app(db)).get("/employees?department=Engineering");
    expect(res.status).toBe(200);
    expect(db.employee.findMany).toHaveBeenCalledOnce();
  });

  it("POST /employees creates an employee", async () => {
    db.employee.create.mockResolvedValue(EMPLOYEE);

    const res = await request(app(db)).post("/employees").send({ name: "Alice Smith" });
    expect(res.status).toBe(201);
    expect(res.body.employee.name).toBe("Alice Smith");
  });

  it("POST /employees rejects missing name", async () => {
    const res = await request(app(db)).post("/employees").send({ position: "Engineer" });
    expect(res.status).toBe(400);
  });

  it("POST /employees rejects invalid email", async () => {
    const res = await request(app(db)).post("/employees")
      .send({ name: "Alice", email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("POST /employees rejects invalid status", async () => {
    const res = await request(app(db)).post("/employees")
      .send({ name: "Alice", status: "retired" });
    expect(res.status).toBe(400);
  });

  it("POST /employees rejects negative salary", async () => {
    const res = await request(app(db)).post("/employees")
      .send({ name: "Alice", salary: -1000 });
    expect(res.status).toBe(400);
  });

  it("PATCH /employees/:id updates status", async () => {
    db.employee.update.mockResolvedValue({ ...EMPLOYEE, status: "inactive" });

    const res = await request(app(db)).patch("/employees/emp1").send({ status: "inactive" });
    expect(res.status).toBe(200);
    expect(res.body.employee.status).toBe("inactive");
  });

  it("DELETE /employees/:id deletes employee", async () => {
    db.employee.delete.mockResolvedValue({});

    const res = await request(app(db)).delete("/employees/emp1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Leave Requests
// ═══════════════════════════════════════════════════════════════════════════════

describe("HR Leave Requests", () => {
  let db: Db;
  beforeEach(() => { db = makeDb(); });

  it("GET /leave returns paginated list", async () => {
    db.leaveRequest.findMany.mockResolvedValue([LEAVE]);
    db.leaveRequest.count.mockResolvedValue(1);

    const res = await request(app(db)).get("/leave");
    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(1);
    expect(res.body.requests[0].type).toBe("annual");
  });

  it("GET /leave filters by employeeId", async () => {
    db.leaveRequest.findMany.mockResolvedValue([]);
    db.leaveRequest.count.mockResolvedValue(0);

    const res = await request(app(db)).get("/leave?employeeId=emp1");
    expect(res.status).toBe(200);
    expect(db.leaveRequest.findMany).toHaveBeenCalledOnce();
  });

  it("GET /leave filters by status", async () => {
    db.leaveRequest.findMany.mockResolvedValue([]);
    db.leaveRequest.count.mockResolvedValue(0);

    const res = await request(app(db)).get("/leave?status=pending");
    expect(res.status).toBe(200);
  });

  it("POST /leave creates a leave request", async () => {
    db.leaveRequest.create.mockResolvedValue(LEAVE);

    const res = await request(app(db)).post("/leave")
      .send({ employeeId: "emp1", type: "annual", startDate: ISO, endDate: ISO, days: 5 });
    expect(res.status).toBe(201);
    expect(res.body.request.type).toBe("annual");
  });

  it("POST /leave rejects missing employeeId", async () => {
    const res = await request(app(db)).post("/leave")
      .send({ type: "sick", startDate: ISO, endDate: ISO, days: 1 });
    expect(res.status).toBe(400);
  });

  it("POST /leave rejects invalid type", async () => {
    const res = await request(app(db)).post("/leave")
      .send({ employeeId: "emp1", type: "vacation", startDate: ISO, endDate: ISO, days: 3 });
    expect(res.status).toBe(400);
  });

  it("POST /leave rejects zero days", async () => {
    const res = await request(app(db)).post("/leave")
      .send({ employeeId: "emp1", type: "sick", startDate: ISO, endDate: ISO, days: 0 });
    expect(res.status).toBe(400);
  });

  it("POST /leave rejects missing startDate", async () => {
    const res = await request(app(db)).post("/leave")
      .send({ employeeId: "emp1", type: "annual", endDate: ISO, days: 5 });
    expect(res.status).toBe(400);
  });

  it("PATCH /leave/:id approves a request", async () => {
    db.leaveRequest.update.mockResolvedValue({ ...LEAVE, status: "approved" });

    const res = await request(app(db)).patch("/leave/lr1").send({ status: "approved" });
    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe("approved");
  });

  it("PATCH /leave/:id rejects invalid status", async () => {
    const res = await request(app(db)).patch("/leave/lr1").send({ status: "confirmed" });
    expect(res.status).toBe(400);
  });

  it("DELETE /leave/:id deletes leave request", async () => {
    db.leaveRequest.delete.mockResolvedValue({});

    const res = await request(app(db)).delete("/leave/lr1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
