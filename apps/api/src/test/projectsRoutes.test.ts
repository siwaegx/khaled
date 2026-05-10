import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeApp } from "./helpers";
import type { MockTenantDb } from "./helpers";
import { router } from "../../../../modules/projects/backend/router";

const ISO = "2026-06-01T00:00:00.000Z";

function makeDb() {
  return {
    project: {
      count:   vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      create:  vi.fn(),
      update:  vi.fn(),
      delete:  vi.fn(),
    },
    task: {
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

const PROJECT = {
  id: "proj1", name: "Website Redesign", description: "Full redesign",
  status: "active", startDate: ISO, endDate: null,
  createdAt: ISO, updatedAt: ISO, _count: { tasks: 3 },
};

const TASK = {
  id: "task1", projectId: "proj1", title: "Design mockups",
  description: null, status: "todo", priority: "high",
  assignedTo: "Alice", dueDate: ISO,
  createdAt: ISO, updatedAt: ISO,
  project: { id: "proj1", name: "Website Redesign" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /stats
// ═══════════════════════════════════════════════════════════════════════════════

describe("Projects — GET /stats", () => {
  let db: Db;
  beforeEach(() => { db = makeDb(); });

  it("returns all KPIs", async () => {
    db.project.count.mockResolvedValue(5);
    db.task.count.mockResolvedValue(20);
    db.project.groupBy.mockResolvedValue([
      { status: "active", _count: { id: 3 } },
    ]);
    db.task.groupBy.mockResolvedValue([
      { status: "todo", _count: { id: 10 } },
      { status: "done", _count: { id: 8  } },
    ]);

    const res = await request(app(db)).get("/stats");
    expect(res.status).toBe(200);
    expect(res.body.totalProjects).toBe(5);
    expect(res.body.totalTasks).toBe(20);
    expect(Array.isArray(res.body.projectsByStatus)).toBe(true);
    expect(Array.isArray(res.body.tasksByStatus)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Projects
// ═══════════════════════════════════════════════════════════════════════════════

describe("Projects CRUD", () => {
  let db: Db;
  beforeEach(() => { db = makeDb(); });

  it("GET /projects returns paginated list", async () => {
    db.project.findMany.mockResolvedValue([PROJECT]);
    db.project.count.mockResolvedValue(1);

    const res = await request(app(db)).get("/projects");
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].name).toBe("Website Redesign");
  });

  it("GET /projects filters by status", async () => {
    db.project.findMany.mockResolvedValue([]);
    db.project.count.mockResolvedValue(0);

    const res = await request(app(db)).get("/projects?status=active");
    expect(res.status).toBe(200);
    expect(db.project.findMany).toHaveBeenCalledOnce();
  });

  it("POST /projects creates a project", async () => {
    db.project.create.mockResolvedValue(PROJECT);

    const res = await request(app(db)).post("/projects").send({ name: "Website Redesign" });
    expect(res.status).toBe(201);
    expect(res.body.project.name).toBe("Website Redesign");
  });

  it("POST /projects rejects missing name", async () => {
    const res = await request(app(db)).post("/projects").send({ status: "active" });
    expect(res.status).toBe(400);
  });

  it("POST /projects rejects invalid status", async () => {
    const res = await request(app(db)).post("/projects")
      .send({ name: "Proj", status: "not_a_status" });
    expect(res.status).toBe(400);
  });

  it("POST /projects accepts valid datetime fields", async () => {
    db.project.create.mockResolvedValue(PROJECT);

    const res = await request(app(db)).post("/projects")
      .send({ name: "Proj", startDate: ISO, endDate: ISO });
    expect(res.status).toBe(201);
  });

  it("PATCH /projects/:id updates status", async () => {
    db.project.update.mockResolvedValue({ ...PROJECT, status: "completed" });

    const res = await request(app(db)).patch("/projects/proj1").send({ status: "completed" });
    expect(res.status).toBe(200);
    expect(res.body.project.status).toBe("completed");
  });

  it("DELETE /projects/:id deletes project", async () => {
    db.project.delete.mockResolvedValue({});

    const res = await request(app(db)).delete("/projects/proj1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tasks
// ═══════════════════════════════════════════════════════════════════════════════

describe("Projects Tasks", () => {
  let db: Db;
  beforeEach(() => { db = makeDb(); });

  it("GET /tasks returns paginated list", async () => {
    db.task.findMany.mockResolvedValue([TASK]);
    db.task.count.mockResolvedValue(1);

    const res = await request(app(db)).get("/tasks");
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].title).toBe("Design mockups");
  });

  it("GET /tasks filters by projectId, status, and priority", async () => {
    db.task.findMany.mockResolvedValue([]);
    db.task.count.mockResolvedValue(0);

    const res = await request(app(db)).get("/tasks?projectId=proj1&status=todo&priority=high");
    expect(res.status).toBe(200);
    expect(db.task.findMany).toHaveBeenCalledOnce();
  });

  it("POST /tasks creates a task", async () => {
    db.task.create.mockResolvedValue(TASK);

    const res = await request(app(db)).post("/tasks").send({ title: "Design mockups" });
    expect(res.status).toBe(201);
    expect(res.body.task.title).toBe("Design mockups");
  });

  it("POST /tasks rejects missing title", async () => {
    const res = await request(app(db)).post("/tasks").send({ status: "todo" });
    expect(res.status).toBe(400);
  });

  it("POST /tasks rejects invalid status", async () => {
    const res = await request(app(db)).post("/tasks")
      .send({ title: "Task", status: "working" });
    expect(res.status).toBe(400);
  });

  it("POST /tasks rejects invalid priority", async () => {
    const res = await request(app(db)).post("/tasks")
      .send({ title: "Task", priority: "critical" });
    expect(res.status).toBe(400);
  });

  it("PATCH /tasks/:id updates status", async () => {
    db.task.update.mockResolvedValue({ ...TASK, status: "done" });

    const res = await request(app(db)).patch("/tasks/task1").send({ status: "done" });
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe("done");
  });

  it("PATCH /tasks/:id updates priority", async () => {
    db.task.update.mockResolvedValue({ ...TASK, priority: "urgent" });

    const res = await request(app(db)).patch("/tasks/task1").send({ priority: "urgent" });
    expect(res.status).toBe(200);
    expect(res.body.task.priority).toBe("urgent");
  });

  it("DELETE /tasks/:id deletes task", async () => {
    db.task.delete.mockResolvedValue({});

    const res = await request(app(db)).delete("/tasks/task1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
