import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { JoinClient } from "./join-client";

type Params = Promise<{ token: string }>;

export const metadata = {
  title: "Join group",
  robots: { index: false, follow: false },
};

export default async function JoinPage({ params }: { params: Params }) {
  const { token } = await params;
  if (!token || token.length < 20) redirect("/app/groups");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in → bounce to login carrying the join URL as `next`.
  if (!user) {
    redirect(`/app/login?next=${encodeURIComponent(`/app/join/${token}`)}`);
  }

  return <JoinClient token={token} />;
}
