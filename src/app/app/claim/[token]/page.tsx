import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ClaimClient } from "./claim-client";

type Params = Promise<{ token: string }>;

export const metadata = {
  title: "Claim guest profile",
  robots: { index: false, follow: false },
};

export default async function ClaimPage({ params }: { params: Params }) {
  const { token } = await params;
  if (!token || token.length < 20) redirect("/app/groups");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/app/login?next=${encodeURIComponent(`/app/claim/${token}`)}`);
  }

  return <ClaimClient token={token} />;
}
