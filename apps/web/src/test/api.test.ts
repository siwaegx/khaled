import { describe, it, expect, vi, afterEach } from "vitest";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api";

const MOCK_BASE = "http://localhost:4000";

function mockFetch(status: number, body: unknown, ok = status < 400) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("apiGet", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns parsed JSON on success", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { data: "hello" }));
    const result = await apiGet<{ data: string }>("/api/test");
    expect(result.data).toBe("hello");
    expect(fetch).toHaveBeenCalledWith(
      `${MOCK_BASE}/api/test`,
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("throws Error with server message on failure", async () => {
    vi.stubGlobal("fetch", mockFetch(404, { error: "Not found" }, false));
    await expect(apiGet("/api/missing")).rejects.toThrow("Not found");
  });

  it("throws generic message when error field missing", async () => {
    vi.stubGlobal("fetch", mockFetch(500, {}, false));
    await expect(apiGet("/api/boom")).rejects.toThrow("Request failed");
  });
});

describe("apiPost", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends JSON body and returns response", async () => {
    vi.stubGlobal("fetch", mockFetch(201, { id: "new1" }));
    const result = await apiPost<{ id: string }>("/api/items", { name: "test" });
    expect(result.id).toBe("new1");
    const call = vi.mocked(fetch).mock.calls[0]!;
    expect(call[1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: "test" }),
    });
  });

  it("throws on error response", async () => {
    vi.stubGlobal("fetch", mockFetch(409, { error: "Already exists" }, false));
    await expect(apiPost("/api/items", {})).rejects.toThrow("Already exists");
  });
});

describe("apiPatch", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends PATCH with body and returns response", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { updated: true }));
    const result = await apiPatch<{ updated: boolean }>("/api/items/1", { name: "updated" });
    expect(result.updated).toBe(true);
    const call = vi.mocked(fetch).mock.calls[0]!;
    expect(call[1]).toMatchObject({ method: "PATCH" });
    expect(call[1]?.body).toBe(JSON.stringify({ name: "updated" }));
  });

  it("throws on error response", async () => {
    vi.stubGlobal("fetch", mockFetch(422, { error: "Validation failed" }, false));
    await expect(apiPatch("/api/items/1", {})).rejects.toThrow("Validation failed");
  });
});

describe("apiDelete", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends DELETE and returns response", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { success: true }));
    const result = await apiDelete<{ success: boolean }>("/api/items/1");
    expect(result.success).toBe(true);
    const call = vi.mocked(fetch).mock.calls[0]!;
    expect(call[1]).toMatchObject({ method: "DELETE", credentials: "include" });
  });

  it("throws on error response", async () => {
    vi.stubGlobal("fetch", mockFetch(404, { error: "Not found" }, false));
    await expect(apiDelete("/api/items/1")).rejects.toThrow("Not found");
  });
});
