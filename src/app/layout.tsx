import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import { SITE } from "@/lib/site";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { SwUpdateBanner } from "@/components/sw-update-banner";
import { JustUpdatedToast } from "@/components/just-updated-toast";
import { SiteHeader } from "@/components/site-header";
import { InstallPrompt } from "@/components/install-prompt";
import { OfflineIndicator } from "@/components/offline-indicator";
import { TrpcProvider } from "@/lib/trpc/client";
import { OfflineProvider } from "@/lib/offline/use-offline";
import { ThemeProvider } from "@/components/theme-provider";
import { ConfirmProvider } from "@/components/confirm-dialog";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    "expense splitting app",
    "splitwise alternative",
    "split bills with friends",
    "split rent calculator",
    "trip expense splitter",
    "group expense tracker india",
    "split payments app",
  ],
  openGraph: {
    type: "website",
    locale: SITE.ogLocale,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: SITE.url,
    siteName: SITE.name,
    // Default unfurl card for WhatsApp / iMessage / Twitter / LinkedIn.
    // The friend-invite path (?from=…) overrides this with a personalised
    // version in src/app/page.tsx generateMetadata().
    images: [
      {
        url: "/api/og/milestone?type=invite",
        width: 1200,
        height: 630,
        alt: `${SITE.name} — ${SITE.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: ["/api/og/milestone?type=invite"],
  },
  // GSC ownership verification — originally added for easy-split-payments.vercel.app;
  // still valid once we add easysplits.in to GSC since this meta-tag-based
  // verification is per-property, but we'll need a new TXT verification on
  // the apex easysplits.in Domain Property in GSC.
  // Next renders this as <meta name="google-site-verification"…>. Don't
  // remove — Google rechecks periodically and revoking the meta tag
  // unverifies the property (losing accumulated indexing history).
  verification: {
    google: "piqFkbWW4n4RAVn3kyzNkLSkTdqzA9iAAC1afe-lJZQ",
  },
  formatDetection: { email: false, address: false, telephone: false },
  appleWebApp: {
    capable: true,
    title: SITE.name,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <ThemeProvider>
          <TrpcProvider>
            <OfflineProvider>
              <ConfirmProvider>
                <SiteHeader />
                {children}
                <SwUpdateBanner />
                <JustUpdatedToast />
                <OfflineIndicator />
                <InstallPrompt />
                <Toaster
                  position="bottom-center"
                  richColors
                  closeButton
                  toastOptions={{ classNames: { toast: "rounded-xl" } }}
                />
              </ConfirmProvider>
            </OfflineProvider>
          </TrpcProvider>
        </ThemeProvider>
        <ServiceWorkerRegister />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
