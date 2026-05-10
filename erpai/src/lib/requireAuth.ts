import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "secret"
);

export interface AuthPayload {
  userId: string;
  email?: string;
  orgId?: string;
  role?: string;
  isAdmin?: boolean;
}

export async function verifyAuth(req: NextRequest): Promise<AuthPayload | null> {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AuthPayload;
  } catch {
    return null;
  }
}

export async function requireAuth(
  req: NextRequest
): Promise<{ user: AuthPayload } | NextResponse> {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { user };
}
