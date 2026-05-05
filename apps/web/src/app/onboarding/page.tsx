import { Suspense } from "react";
import { OnboardingFlow } from "./OnboardingFlow";

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingFlow />
    </Suspense>
  );
}
