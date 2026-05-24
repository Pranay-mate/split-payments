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
      <div className="mx-auto max-w-3xl px-4 pt-8 pb-32 sm:px-6 sm:pt-12 sm:pb-16">
        <header className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Your groups
          </h1>
        </header>

        <GroupsView initialGroups={initialGroups} />
      </div>
    </main>
  );
}
