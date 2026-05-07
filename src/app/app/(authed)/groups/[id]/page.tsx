import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GroupDetail } from "./_components/group-detail";

export const metadata: Metadata = {
  title: "Group",
  robots: { index: false, follow: false },
};

type Params = Promise<{ id: string }>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GroupPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  return <GroupDetail groupId={id} />;
}
