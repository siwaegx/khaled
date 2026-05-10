"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, Eye, EyeOff } from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function SAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [checking, setChecking] = useState(true);

  // If already logged in as admin, skip login
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/auth/me`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json() as { isAdmin?: boolean };
          if (data.isAdmin) { router.replace("/sadmin"); return; }
        }
      } catch { /* not logged in */ }
      setChecking(false);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { error?: string; isAdmin?: boolean; user?: { isAdmin?: boolean } };
      if (!res.ok) { setError(data.error ?? "Login failed"); return; }

      // Verify admin access
      const me = await fetch(`${BASE_URL}/api/auth/me`, { credentials: "include" });
      const meData = await me.json() as { isAdmin?: boolean };
      if (!meData.isAdmin) {
        // Log back out — wrong account
        await fetch(`${BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
        setError("This account does not have platform admin access.");
        return;
      }
      router.replace("/sadmin");
    } catch {
      setError("Connection error. Is the API server running?");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 mb-4">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">Business360</h1>
          <p className="text-xs text-cyan-400 font-semibold tracking-widest uppercase mt-0.5">Platform Admin</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur">
          <h2 className="text-sm font-semibold text-slate-200 mb-1">Admin sign in</h2>
          <p className="text-xs text-slate-500 mb-5">Platform control center access only</p>

          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full h-9 px-3 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
                placeholder="admin@business360.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full h-9 px-3 pr-9 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-sm font-semibold transition-colors"
            >
              {loading ? "Signing in…" : "Sign in to Admin"}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-slate-700 mt-4">
          Not an admin? <a href="/login" className="text-slate-500 hover:text-slate-400 underline">Go to tenant login</a>
        </p>
      </div>
    </div>
  );
}
