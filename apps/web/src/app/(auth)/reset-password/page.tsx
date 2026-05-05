import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import ResetPasswordForm from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
