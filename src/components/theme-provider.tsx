"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * App-wide theme provider. Wraps next-themes with our defaults:
 *   - "system" theme follows OS preference (default for new users)
 *   - "class" attribute strategy so Tailwind's `dark:` variants work
 *   - disable transition flicker on theme switch
 *
 * The user's stored preference (profiles.theme) is applied via the
 * useApplyServerTheme hook on first load — see UserMenu / EditProfileModal.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
