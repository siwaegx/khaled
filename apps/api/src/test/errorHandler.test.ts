import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { errorHandler, AppError } from "../middleware/errorHandler";

function makeApp(handler: express.RequestHandler) {
  const app = express();
  app.get("/test", handler);
  app.use(errorHandler);
  return app;
}

describe("errorHandler", () => {
  it("returns AppError status + message", async () => {
    const app = makeApp((_req, _res, next) => next(new AppError(422, "Unprocessable")));
    const res = await request(app).get("/test");
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("Unprocessable");
  });

  it("returns 500 for generic errors", async () => {
    const app = makeApp((_req, _res, next) => next(new Error("crash")));
    const res = await request(app).get("/test");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal server error");
  });

  it("AppError has correct statusCode", () => {
    const err = new AppError(404, "Not found");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Not found");
    expect(err.name).toBe("AppError");
  });
});
