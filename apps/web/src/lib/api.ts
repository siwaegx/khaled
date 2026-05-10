const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function parseResponse(res: Response): Promise<unknown> {
  try { return await res.json(); } catch { return null; }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await parseResponse(res);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Request failed");
  return data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { credentials: "include" });
  const data = await parseResponse(res);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Request failed");
  return data as T;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await parseResponse(res);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Request failed");
  return data as T;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await parseResponse(res);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Request failed");
  return data as T;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = await parseResponse(res);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Request failed");
  return data as T;
}
