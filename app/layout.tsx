import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SolanaProvider } from "@/components/solana-provider";
import { SessionProvider } from "@/components/session-provider";
import { WalletSessionGuard } from "@/components/wallet-session-guard";
import { NavBar } from "@/components/nav-bar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "CHIMP Arena",
  description:
    "Missions, rivalry and crew competition for the $CHIMP community. Adoption first.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SolanaProvider>
          <SessionProvider>
            <WalletSessionGuard />
            <NavBar />
            <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
              {children}
            </main>
          </SessionProvider>
        </SolanaProvider>
      </body>
    </html>
  );
}
