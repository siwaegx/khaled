"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Shield } from "lucide-react";

export default function AdminRedirectPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (isAdmin) {
      router.replace("/sadmin");
    } else {
      router.replace("/dashboard");
    }
  }, [isAdmin, loading, router]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <Shield className="w-10 h-10 opacity-30" />
      <p className="text-sm">Redirecting…</p>
    </div>
  );
}
