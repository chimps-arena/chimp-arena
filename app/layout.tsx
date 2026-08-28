import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/session-provider";
import { NavBar } from "@/components/nav-bar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <NavBar />
          <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </main>
          <footer className="border-t border-border/60 py-6 text-center text-xs text-muted">
            CHIMP Arena — community MVP. Not financial advice. XP has no monetary
            value.
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
