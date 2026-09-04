import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "PROHIT Daily Task",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1b2a4a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Browser extensions (Grammarly, password managers, etc.) inject
          attributes into <body> before React hydrates; suppressed here
          rather than fixed since there's nothing in our render to fix. */}
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
        {process.env.NODE_ENV === "production" && (
          <script
            // Registered inline (not a separate client component) so it runs
            // once, without adding a hook to every page that mounts it.
            // Production-only: the SW's cache-first strategy for
            // /_next/static/ assumes hashed, immutable filenames, which is
            // true for a real build but not for next dev — running it in
            // dev serves stale bundles behind live source changes.
            dangerouslySetInnerHTML={{
              __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js')); }`,
            }}
          />
        )}
      </body>
    </html>
  );
}
