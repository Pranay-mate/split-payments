"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2, X } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import {
  CURRENCY_OPTIONS,
  TIMEZONE_OPTIONS,
  timezoneForCurrency,
} from "@/lib/preferences";
import {
  ActiveMutesList,
  NotificationSettings,
} from "@/components/notification-settings";
import { EmbedCodeBlock } from "@/components/embed-code-block";

type Theme = "system" | "light" | "dark";

/**
 * Profile editor modal — opens from UserMenu. Edits user-level
 * preferences (display name, DOB, currency, timezone, theme,
 * notifications). Group-level admin lives in GroupSettings.
 *
 * Currency and timezone are coupled: picking a currency pre-fills the
 * timezone, but only if the user hasn't manually edited the timezone
 * since opening the modal — we don't clobber a deliberate choice.
 */
export function EditProfileModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const router = useRouter();
  const meQuery = trpc.profiles.me.useQuery();
  const me = meQuery.data;
  const { setTheme } = useTheme();

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [theme, setThemeLocal] = useState<Theme>("system");
  const [currency, setCurrency] = useState("INR");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [tzManuallySet, setTzManuallySet] = useState(false);

  // Sync form state with server data when the modal *opens* (not on
  // every me refetch). Resyncing on background refetches was clobbering
  // the user's in-flight selections — e.g. clicking a theme button got
  // reverted the moment React Query revalidated profiles.me.
  // queueMicrotask defers set-state past the current render commit
  // (avoids React-19 cascading-renders warning).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (!me) return;
    // Sync on transition from closed → open only.
    if (open && !wasOpenRef.current) {
      wasOpenRef.current = true;
      queueMicrotask(() => {
        setName(me.displayName ?? "");
        setDob((me as { dob?: string | null }).dob ?? "");
        setThemeLocal(((me as { theme?: string }).theme as Theme) ?? "system");
        setCurrency(
          (me as { defaultCurrency?: string }).defaultCurrency ?? "INR",
        );
        setTimezone((me as { timezone?: string }).timezone ?? "Asia/Kolkata");
        setTzManuallySet(false);
      });
    } else if (!open) {
      wasOpenRef.current = false;
    }
  }, [me, open]);

  const updateMutation = trpc.profiles.update.useMutation({
    onSuccess: (row) => {
      utils.profiles.me.invalidate();
      // Apply the chosen theme via next-themes immediately so the user
      // sees the change before the page refreshes anything.
      if (row && "theme" in row && typeof row.theme === "string") {
        setTheme(row.theme);
      }
      toast.success("Profile saved");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.auth.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Account deleted");
      onClose();
      router.push("/");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  /**
   * Two-step confirmation for account deletion. First click sets state
   * to a "really?" red button; second click calls the mutation. Plus a
   * native confirm() before that for the typed-confirmation cohort.
   * Combined: hard to trigger by mistake, easy if you mean it.
   */
  const [armDelete, setArmDelete] = useState(false);
  const onDelete = () => {
    if (!armDelete) {
      setArmDelete(true);
      return;
    }
    if (
      !confirm(
        "Delete your account? You'll lose access to all your groups. Your historical expenses remain visible to other group members but anonymised. This cannot be undone.",
      )
    ) {
      setArmDelete(false);
      return;
    }
    deleteMutation.mutate();
  };

  if (!open) return null;
  if (meQuery.isLoading || !me) {
    return (
      <Backdrop onClose={onClose}>
        <div className="flex items-center justify-center px-6 py-12">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </div>
      </Backdrop>
    );
  }

  const handleCurrencyChange = (code: string) => {
    setCurrency(code);
    // Only auto-update timezone if the user hasn't deliberately picked
    // one in this session — respects manual overrides.
    if (!tzManuallySet) {
      setTimezone(timezoneForCurrency(code));
    }
  };

  const handleTimezoneChange = (tz: string) => {
    setTimezone(tz);
    setTzManuallySet(true);
  };

  const onSave = () => {
    if (!name.trim()) {
      toast.error("Name can't be empty");
      return;
    }
    updateMutation.mutate({
      displayName: name.trim(),
      dob,
      theme,
      timezone,
      defaultCurrency: currency,
    });
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
        <h2 className="text-base font-semibold tracking-tight">Edit profile</h2>
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Close"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {/* About you */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            About you
          </p>
          <label className="mt-2 block">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Display name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="mt-3 block">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Date of birth (optional)
            </span>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
        </section>

        {/* Defaults */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Defaults
          </p>
          <label className="mt-2 block">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Default currency
            </span>
            <select
              value={currency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10.5px] text-slate-400">
              Picking a currency suggests its home time zone below — you can
              still override.
            </span>
          </label>
          <label className="mt-3 block">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Time zone
            </span>
            <select
              value={timezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>
        </section>

        {/* Appearance */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Appearance
          </p>
          <div
            className="mt-2 inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900"
            role="tablist"
            aria-label="Theme"
          >
            {(["system", "light", "dark"] as Theme[]).map((opt) => (
              <button
                key={opt}
                type="button"
                role="tab"
                aria-selected={theme === opt}
                onClick={() => {
                  setThemeLocal(opt);
                  setTheme(opt); // apply immediately for live preview
                }}
                className={`rounded-md px-3 py-1 capitalize transition ${
                  theme === opt
                    ? "bg-indigo-500 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </section>

        {/* Notifications */}
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
          <NotificationSettings />
          <ActiveMutesList />
        </section>

        {/* Embed code — only renders when profile has a complete score */}
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
          <EmbedCodeBlock />
        </section>

        {/* Danger zone — deliberately last and visually quiet by default;
            two-click arm pattern prevents accidental deletion. */}
        <section className="rounded-lg border border-rose-200 bg-rose-50/40 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
            Danger zone
          </p>
          <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
            Deleting your account removes you from all groups. Historical
            expenses stay visible to remaining members but with your name
            anonymised. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleteMutation.isPending}
            className={`mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
              armDelete
                ? "border-rose-600 bg-rose-600 text-white hover:bg-rose-500"
                : "border-rose-300 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50"
            }`}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            )}
            {armDelete ? "Click again to confirm" : "Delete account"}
          </button>
        </section>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={updateMutation.isPending || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:bg-slate-300 disabled:dark:bg-slate-700"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          Save
        </button>
      </div>
    </Backdrop>
  );
}

function Backdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-900/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="fixed inset-x-3 top-12 z-50 mx-auto flex max-h-[calc(100vh-6rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:top-20 sm:max-h-[calc(100vh-10rem)]"
      >
        {children}
      </div>
    </>
  );
}
