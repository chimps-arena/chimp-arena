import type { Metadata } from "next";
import { Sora, Space_Mono, Unbounded } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/session-provider";
import { WalletSessionGuard } from "@/components/wallet-session-guard";
import { AppScene } from "@/components/app-scene";
import { NavBar } from "@/components/nav-bar";

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

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: "CHIMP Arena",
  description:
    "Missions, rivalry and crew competition for the $CHIMP community. Adoption first.",
  openGraph: {
    title: "CHIMP Arena",
    description:
      "Missions, rivalry and crew competition for the $CHIMP community.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${monoFont.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppScene />
        <SessionProvider>
          <WalletSessionGuard />
          <NavBar />
          <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </main>
        </SessionProvider>
      </body>
    </html>
  );
}
