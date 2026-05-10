"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Building2, CheckCircle2, XCircle, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { apiGet, apiPost } from "@/lib/api";

type InviteDetails = {
  email: string;
  role: string;
  orgName: string;
  inviterName: string;
  expiresAt: string;
};

function InviteContent() {
  const params  = useSearchParams();
  const router  = useRouter();
  const { user, loading: authLoading, refresh } = useAuth();
  const token   = params.get("token") ?? "";

  const [details, setDetails]   = useState<InviteDetails | null>(null);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted]   = useState(false);
  const [acceptErr, setAcceptErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setFetchErr("No invite token found in this link."); return; }
    apiGet<InviteDetails>(`/api/org/invites/verify?token=${encodeURIComponent(token)}`)
      .then(setDetails)
      .catch((err) => setFetchErr(err instanceof Error ? err.message : "Invalid or expired invite link."));
  }, [token]);

  async function accept() {
    setAccepting(true);
    setAcceptErr(null);
    try {
      const { orgId } = await apiPost<{ success: boolean; orgId: string }>("/api/org/invites/accept", { token });
      // Switch active org to the newly joined one
      await apiPost("/api/auth/switch-org", { orgId });
      await refresh();
      setAccepted(true);
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err) {
      setAcceptErr(err instanceof Error ? err.message : "Failed to accept invite");
    } finally {
      setAccepting(false);
    }
  }

  // ── Loading states ──────────────────────────────────────────────────────────
  if (!token || fetchErr) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
          <XCircle className="w-12 h-12 text-destructive" />
          <div>
            <p className="font-semibold text-base">Invalid invite link</p>
            <p className="text-sm text-muted-foreground mt-1">{fetchErr ?? "No token provided."}</p>
          </div>
          <Link href="/login">
            <Button variant="outline" size="sm">Go to Login</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!details) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Verifying invite…</p>
        </CardContent>
      </Card>
    );
  }

  if (accepted) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          <div>
            <p className="font-semibold text-base">You&apos;ve joined {details.orgName}!</p>
            <p className="text-sm text-muted-foreground mt-1">Redirecting to your dashboard…</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const inviteUrl = `/invite?token=${encodeURIComponent(token)}`;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-xl">You&apos;re invited!</CardTitle>
        <CardDescription className="text-sm mt-1">
          <span className="font-medium text-foreground">{details.inviterName}</span> has invited you to join{" "}
          <span className="font-medium text-foreground">{details.orgName}</span> as a{" "}
          <span className="font-medium text-foreground capitalize">{details.role}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-1">
          <p><span className="text-muted-foreground">Organization:</span> <span className="font-medium">{details.orgName}</span></p>
          <p><span className="text-muted-foreground">Role:</span> <span className="font-medium capitalize">{details.role}</span></p>
          <p><span className="text-muted-foreground">Invited by:</span> <span className="font-medium">{details.inviterName}</span></p>
          <p><span className="text-muted-foreground">Expires:</span> <span className="font-medium">{new Date(details.expiresAt).toLocaleDateString()}</span></p>
        </div>

        {authLoading ? (
          <div className="flex justify-center py-2">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : user ? (
          // Logged in — show accept button
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              Accepting as <span className="font-medium">{user.email}</span>
            </p>
            {acceptErr && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
                {acceptErr}
              </p>
            )}
            <Button className="w-full" onClick={() => void accept()} disabled={accepting}>
              {accepting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Accepting…</>
              ) : (
                <><UserPlus className="w-4 h-4 mr-2" />Accept Invitation</>
              )}
            </Button>
          </div>
        ) : (
          // Not logged in — prompt to sign in or register
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              Please sign in or create an account to accept this invitation.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/login?next=${encodeURIComponent(inviteUrl)}`} className="w-full">
                <Button variant="outline" className="w-full">Sign In</Button>
              </Link>
              <Link href={`/register?next=${encodeURIComponent(inviteUrl)}`} className="w-full">
                <Button className="w-full">Create Account</Button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function InvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Suspense fallback={
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      }>
        <InviteContent />
      </Suspense>
    </div>
  );
}
