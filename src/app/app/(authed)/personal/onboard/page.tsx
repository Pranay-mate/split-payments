import type { Metadata } from "next";
import { OnboardWizard } from "./_components/onboard-wizard";

export const metadata: Metadata = {
  title: "Score onboarding",
  description: "Five quick questions to compute your Financial Health Score.",
  robots: { index: false, follow: false },
};

export default function OnboardPage() {
  return <OnboardWizard />;
}
