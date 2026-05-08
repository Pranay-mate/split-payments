import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { getServerCaller } from "@/server/server-caller";
import { GroupsView } from "./_components/groups-view";

export const metadata: Metadata = buildMetadata({
  title: "Your groups",
  description: "View and manage your expense groups.",
  path: "/app/groups",
  noIndex: true,
});

export default async function GroupsPage() {
  // Server-prefetch the groups list so the client hydrates with data
  // already available — saves one round-trip after the SSR pass.
  const caller = await getServerCaller();
  const initialGroups = await caller.groups.list().catch(() => []);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Your groups</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Each group has its own expenses, members, and balances. Create one for every trip, household, or hangout.
          </p>
        </header>

        <GroupsView initialGroups={initialGroups} />
      </div>
    </main>
  );
}
