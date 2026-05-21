import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { JoinClient } from "./join-client";

type Params = Promise<{ token: string }>;
type SearchParams = Promise<{ from?: string }>;

export const metadata = {
  title: "Join group",
  robots: { index: false, follow: false },
};

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { token } = await params;
  const { from } = await searchParams;
  if (!token || token.length < 20) redirect("/app/groups");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in → bounce to login carrying the join URL as `next`.
  // Preserve `?from=<inviter>` through the redirect so attribution
  // survives the Supabase OAuth bounce-back (the next URL is what the
  // auth callback redirects to after sign-in completes).
  if (!user) {
    const joinPath = from
      ? `/app/join/${token}?from=${encodeURIComponent(from)}`
      : `/app/join/${token}`;
    redirect(`/app/login?next=${encodeURIComponent(joinPath)}`);
  }

  return <JoinClient token={token} />;
}
