import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Sora, Space_Mono, Unbounded } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/session-provider";
import { WalletSessionGuard } from "@/components/wallet-session-guard";
import { TxTrackerProvider } from "@/components/tx-tracker";
import { AppScene } from "@/components/app-scene";
import { NavBar } from "@/components/nav-bar";
import { CopyContractAddress, SocialLinks } from "@/components/social-links";
import { BUY_CHIMP_URL, CHART_URL, SOLSCAN_TOKEN_URL } from "@/lib/links";

// Body: clean, warm geometric sans.
const bodyFont = Sora({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});
// Stat / wallet / XP readouts: arcade-terminal mono.
const monoFont = Space_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});
// Headings, logo, CTAs: expanded, electric display.
const displayFont = Unbounded({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

// HUD theme headings and console labels (globals.css "HUD theme") -
// squared-off, engineered.
const hudFont = Chakra_Petch({
  variable: "--font-hud",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: "CHIMP Arena",
  description:
    "Missions, rivalry and crew competition for the $CHIMP community. Adoption first.",
  openGraph: {
    title: "CHIMP Arena · Astrochimpz",
    description:
      "Missions, rivalry and crew competition for the $CHIMP community. Fortune lies in the unknown.",
    siteName: "Astrochimpz",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Astrochimpz - Fortune lies in the unknown" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@Astrochimpz",
    title: "CHIMP Arena · Astrochimpz",
    description:
      "Missions, rivalry and crew competition for the $CHIMP community. Fortune lies in the unknown.",
    images: ["/og.jpg"],
  },
};

// Without this, mobile browsers have no idea this is a responsive site and
// render it at a fake desktop width (~980px), forcing a zoomed-out view on
// load - exactly the "have to zoom out to see everything" symptom. This was
// missing entirely; Next doesn't add a default.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${monoFont.variable} ${displayFont.variable} ${hudFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppScene />
        <SessionProvider>
          <TxTrackerProvider>
            <WalletSessionGuard />
            <NavBar />
            <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
              {children}
            </main>
            <footer
              className="mt-10 w-full border-t"
              style={{ borderColor: "var(--hud-edge)", background: "color-mix(in srgb, var(--background) 70%, transparent)" }}
            >
              <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <a href={BUY_CHIMP_URL} target="_blank" rel="noopener noreferrer" className="hud-btn">
                      Buy $CHIMP ▸
                    </a>
                    <CopyContractAddress full />
                  </div>
                  <SocialLinks />
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
                  <span>© {new Date().getFullYear()} Astrochimpz</span>
                  <a href={CHART_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Chart</a>
                  <a href={SOLSCAN_TOKEN_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Solscan</a>
                  <a href="/whitepaper" className="hover:text-foreground">Whitepaper</a>
                  <a href="/legal" className="hover:text-foreground">Legal</a>
                </div>
              </div>
            </footer>
          </TxTrackerProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
