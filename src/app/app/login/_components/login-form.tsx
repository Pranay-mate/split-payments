"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Login form.
 *
 * Magic-link / email sign-in is temporarily removed (2026-05-17) until
 * we wire up a verified sending domain in Resend. Until then the
 * sandbox sender only delivers to the developer's own inbox, which
 * meant real users could request a link, see "check your email", and
 * never receive anything. Better to hide the option than leave it
 * silently broken. The code lived at commits prior to this; bring it
 * back when the Resend domain is verified.
 */
export function LoginForm({
  initialError,
  next,
}: {
  initialError?: string;
  next?: string;
}) {
  const [busyGoogle, setBusyGoogle] = useState(false);

  useEffect(() => {
    if (initialError) toast.error(initialError);
  }, [initialError]);

  const supabase = createSupabaseBrowserClient();
  const callbackUrl = (() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams();
    if (next) params.set("next", next);
    const qs = params.toString();
    return `${window.location.origin}/auth/callback${qs ? `?${qs}` : ""}`;
  })();

  const signInWithGoogle = async () => {
    setBusyGoogle(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
    if (error) {
      toast.error(error.message);
      setBusyGoogle(false);
    }
    // On success, browser navigates away to Google.
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busyGoogle}
        className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        {busyGoogle ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <GoogleLogo className="h-4 w-4" />
        )}
        Continue with Google
      </button>

      <p className="text-center text-[11.5px] text-slate-500 dark:text-slate-400">
        We use Google sign-in for now. Email sign-in is coming back soon.
      </p>
    </div>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
