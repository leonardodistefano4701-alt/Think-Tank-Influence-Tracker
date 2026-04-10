import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Activity } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Think Tank Influence Tracker | TTIT",
  description: "Follow the money. Trace the policy. Expose the pipeline.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen flex flex-col bg-background text-foreground`}>
        <nav className="border-b border-card-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
                <Activity className="h-6 w-6" />
                TTIT
              </Link>
              <div className="flex gap-4">
                <Link href="/think-tanks" className="text-sm text-muted hover:text-white transition-colors">Think Tanks</Link>
                <Link href="/donors" className="text-sm text-muted hover:text-white transition-colors">Donors</Link>
                <Link href="/explore" className="text-sm text-muted hover:text-white transition-colors">Explore</Link>
                <Link href="/compare" className="text-sm text-muted hover:text-white transition-colors">Compare</Link>
                <Link href="/analysis" className="text-sm text-muted hover:text-white transition-colors font-semibold text-primary">Analysis</Link>
                <Link href="/campaign-finance" className="text-sm text-muted hover:text-white transition-colors">FEC</Link>
              </div>
            </div>
          </div>
        </nav>
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
