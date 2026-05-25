"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Plus, Check } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { BrandMark } from "@/components/brand-mark";

const GROUP_PATH_RE = /^\/app\/groups\/([0-9a-f-]{36})/;

export function GroupSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // The original inline backdrop-button approach didn't work because
  // it lives inside the sticky header's stacking context (z-30 +
  // backdrop-blur). Clicks below the header escape it. A
  // document-level listener catches everything regardless of
  // stacking, including the ESC key.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const el = e.target as Node | null;
      if (el && wrapperRef.current && !wrapperRef.current.contains(el)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      // Trap ArrowUp/ArrowDown inside the open menu so the page
      // doesn't scroll. Move focus to next/prev focusable child of
      // the menu — keeps the dropdown reachable for keyboard users.
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (!wrapperRef.current) return;
      const menu = wrapperRef.current.querySelector('[role="menu"]');
      if (!menu) return;
      const items = Array.from(
        menu.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [role="menuitem"], a[href]',
        ),
      );
      if (items.length === 0) return;
      e.preventDefault();
      const active = document.activeElement as HTMLElement | null;
      const idx = active ? items.indexOf(active) : -1;
      const next =
        e.key === "ArrowDown"
          ? items[Math.min(items.length - 1, idx + 1)] ?? items[0]
          : items[Math.max(0, idx - 1)] ?? items[items.length - 1];
      next.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const groupsQuery = trpc.groups.list.useQuery(undefined, {
    staleTime: 30_000,
  });

  const currentGroupId = useMemo(() => {
    const m = pathname.match(GROUP_PATH_RE);
    return m ? m[1] : null;
  }, [pathname]);

  const groups = groupsQuery.data ?? [];
  const currentGroup = currentGroupId
    ? groups.find((g) => g.id === currentGroupId)
    : null;

  // No group context yet → render the brand wordmark only.
  if (!currentGroupId || !currentGroup) {
    return (
      <Link
        href="/app/groups"
        className="flex items-center gap-2"
        aria-label="EasySplits home"
      >
        <BrandMark className="h-8 w-8 shadow-sm" fontSizeClass="text-[10px]" />
        <span className="text-base font-semibold tracking-tight">
          EasySplits
        </span>
      </Link>
    );
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <span
          className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 text-xs font-semibold text-white"
          aria-hidden
        >
          {currentGroup.name.slice(0, 2).toUpperCase()}
        </span>
        <span className="max-w-[180px] truncate text-sm font-semibold tracking-tight">
          {currentGroup.name}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
      </button>

      {open && (
        <>
          <div
            role="menu"
            className="absolute left-0 top-11 z-40 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900"
          >
            <ul className="max-h-72 overflow-y-auto py-1">
              {groups.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      router.push(`/app/groups/${g.id}`);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gradient-to-br from-indigo-500 to-emerald-500 text-[10px] font-semibold text-white"
                      aria-hidden
                    >
                      {g.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="flex-1 truncate">{g.name}</span>
                    {g.id === currentGroupId && (
                      <Check className="h-4 w-4 text-emerald-500" aria-hidden />
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/app/groups");
              }}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <Plus className="h-4 w-4 text-slate-500" aria-hidden /> All groups
              · new group
            </button>
          </div>
        </>
      )}
    </div>
  );
}
