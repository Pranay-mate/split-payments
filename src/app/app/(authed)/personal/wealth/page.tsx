import type { Metadata } from "next";
import { WealthView } from "./_components/wealth-view";

export const metadata: Metadata = {
  title: "Net worth · EasySplits",
  description:
    "Track your investment holdings (MF, FD, stocks, gold) plus liquid savings — net worth at a glance.",
  robots: { index: false, follow: false },
};

export default function WealthPage() {
  return <WealthView />;
}
