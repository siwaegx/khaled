"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiGet, apiPost } from "./api";

export type AuthUser = { id: string; email: string; name: string };

export type OrgModule = { id: string; moduleKey: string; isActive: boolean };

export type OrgMember = {
  id: string;
  role: string;
  joinedAt: string;
  user: { id: string; email: string; name: string };
};

export type AuthOrg = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  userCount: number;
  trialEnds: string;
  members: OrgMember[];
  modules: OrgModule[];
};

type AuthState = {
  user: AuthUser | null;
  org: AuthOrg | null;
  role: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  org: null,
  role: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [org, setOrg] = useState<AuthOrg | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const me = await apiGet<{ user: AuthUser; orgId: string; role: string }>("/api/auth/me");
      setUser(me.user);
      setRole(me.role);

      if (me.orgId) {
        const { organization } = await apiGet<{ organization: AuthOrg | null }>("/api/organizations/current");
        setOrg(organization);
      } else {
        setOrg(null);
      }
    } catch {
      setUser(null);
      setOrg(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  async function logout() {
    await apiPost("/api/auth/logout", {});
    setUser(null);
    setOrg(null);
    setRole(null);
  }

  return (
    <AuthContext.Provider value={{ user, org, role, loading, refresh: load, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
