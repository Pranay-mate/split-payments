import type { Metadata } from "next";
import { PersonalDashboard } from "./_components/personal-dashboard";

export const metadata: Metadata = {
  title: "Personal · EasySplits",
  description: "Track your income, expenses, and investments.",
  robots: { index: false, follow: false },
};

export default function PersonalPage() {
  return <PersonalDashboard />;
}
