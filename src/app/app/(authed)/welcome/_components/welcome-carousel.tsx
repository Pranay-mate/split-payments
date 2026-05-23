"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Lock,
  Sparkles,
  Users,
  Wallet,
  Wifi,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";

/**
 * One-time post-signup welcome flow. Five swipeable cards that frame
 * the dual-product (Groups + Personal finance) value prop, the
 * privacy stance, and the offline-first PWA. Last card has a single
 * "Get started" CTA; every card has a top-right "Skip" — both end
 * the same way (markOnboarded + redirect to /app/groups).
 *
 * Surfaced exactly once via the OnboardingGate in the (authed)
 * layout, which checks profiles.me.onboardedAt and redirects here if
 * null. Existing users (pre-0005 migration) were backfilled to NOW(),
 * so this only fires for true first-timers.
 *
 * Touch behaviour: native horizontal scroll with snap points. No
 * swipe library — overflow-x-auto + snap-x + scroll-smooth covers
 * mobile gesture, keyboard arrows, and trackpad scroll without 8 KB
 * of swiper.js. The dot indicators + Next button drive desktop
 * users who don't naturally scroll horizontally.
 */
const CARDS = [
  {
    icon: Sparkles,
    accent: "from-indigo-500 to-violet-500",
    eyebrow: "Welcome",
    title: "Hey, glad you're here.",
    body: "EasySplits is two apps in one — split bills with friends, and track your own money + financial health. Pick either path or both.",
  },
  {
    icon: Users,
    accent: "from-indigo-500 to-sky-500",
    eyebrow: "1 · SPLIT BILLS",
    title: "Without the math.",
    body: "Groups, simplified payments, multi-currency for trips, voice input for quick adds. Invite friends by name — they claim later via a magic link.",
  },
  {
    icon: Wallet,
    accent: "from-emerald-500 to-teal-500",
    eyebrow: "2 · TRACK YOUR MONEY",
    title: "Score your financial health.",
    body: "5-pillar Financial Health Scorecard tuned for India. Net worth, EMI/debt projections, bank-statement import. Goals, streaks, peer benchmarks.",
  },
  {
    icon: Lock,
    accent: "from-amber-500 to-rose-500",
    eyebrow: "PRIVACY",
    title: "Your salary is your secret.",
    body: "We encrypt every amount before storing — our database only ever sees scrambled text, not your numbers. AES-256-GCM at the application layer.",
  },
  {
    icon: Wifi,
    accent: "from-fuchsia-500 to-emerald-500",
    eyebrow: "READY",
    title: "Works offline, free forever.",
    body: "PWA install, offline-first queue, no ads, no tracking. Use either side — or both. Welcome.",
  },
];

export function WelcomeCarousel() {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const markOnboarded = trpc.profiles.markOnboarded.useMutation();
  const utils = trpc.useUtils();

  const finish = useCallback(() => {
    // Fire-and-forget — server is idempotent and the redirect doesn't
    // wait. Invalidate so the OnboardingGate's next profiles.me read
    // sees onboardedAt non-null and stops redirecting.
    markOnboarded.mutate(undefined, {
      onSettled: () => {
        utils.profiles.me.invalidate();
      },
    });
    router.replace("/app/groups");
  }, [markOnboarded, router, utils]);

  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(CARDS.length - 1, index));
    setActive(clamped);
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const card = scroller.children[clamped] as HTMLElement | undefined;
    if (card) {
      scroller.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
    }
  }, []);

  // Native horizontal scroll → keep the active dot in sync. Throttled
  // via rAF so we don't fire setState on every pixel.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = scroller.clientWidth;
        if (width === 0) return;
        const idx = Math.round(scroller.scrollLeft / width);
        setActive(Math.max(0, Math.min(CARDS.length - 1, idx)));
      });
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", onScroll);
    };
  }, []);

  const isLast = active === CARDS.length - 1;

  return (
    <main className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-indigo-50 via-white to-emerald-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Top bar — skip is always available, even on the last card. */}
      <div className="flex items-center justify-between px-5 pt-4 sm:px-8 sm:pt-6">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-700 dark:text-slate-200">
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 text-xs font-bold text-white"
          >
            ₹
          </span>
          EasySplits
        </span>
        <button
          type="button"
          onClick={finish}
          className="text-[12px] font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Skip
        </button>
      </div>

      {/* Cards — horizontal snap-scroller, full-viewport each. */}
      <div
        ref={scrollerRef}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="region"
        aria-label="Welcome tour"
      >
        {CARDS.map((card, i) => {
          const Icon = card.icon;
          return (
            <section
              key={card.title}
              className="flex min-w-full snap-start items-center justify-center px-6 py-8 sm:px-10"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${CARDS.length}`}
            >
              <div className="flex w-full max-w-md flex-col items-center text-center">
                <span
                  aria-hidden
                  className={`mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${card.accent}`}
                >
                  <Icon className="h-7 w-7" aria-hidden />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {card.eyebrow}
                </p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
                  {card.title}
                </h1>
                <p className="mt-4 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {card.body}
                </p>
              </div>
            </section>
          );
        })}
      </div>

      {/* Bottom bar — dots + primary action. */}
      <div className="flex flex-col items-center gap-4 px-5 pb-8 sm:px-8">
        <div className="flex items-center gap-1.5" role="tablist">
          {CARDS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              role="tab"
              aria-selected={i === active}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === active
                  ? "w-6 bg-indigo-500"
                  : "w-1.5 bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => (isLast ? finish() : goTo(active + 1))}
          disabled={markOnboarded.isPending}
          className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-70"
        >
          {isLast ? "Get started" : "Next"}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </main>
  );
}
