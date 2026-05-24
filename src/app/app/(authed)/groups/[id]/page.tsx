import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerCaller } from "@/server/server-caller";
import { GroupDetail } from "./_components/group-detail";

type Params = Promise<{ id: string }>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Dynamic per-group tab title so users with multiple group tabs open
// can tell them apart from the browser strip alone. Falls back to the
// generic "Group" if the fetch fails (e.g. user lacks access — the
// page itself will redirect/404 from inside <GroupDetail />).
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return { title: "Group", robots: { index: false, follow: false } };
  }
  try {
    const caller = await getServerCaller();
    const group = await caller.groups.byId({ id });
    // Root layout title.template appends " · EasySplits" — we only
    // contribute the group name, otherwise tabs read "Goa trip ·
    // EasySplits · EasySplits".
    return {
      title: group?.name ?? "Group",
      robots: { index: false, follow: false },
    };
  } catch {
    return { title: "Group", robots: { index: false, follow: false } };
  }
}

export default async function GroupPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  return <GroupDetail groupId={id} />;
}
