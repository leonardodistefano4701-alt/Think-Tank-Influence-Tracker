import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Activity } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://think-tank-influence-tracker.vercel.app"),
  title: {
    default: "Think Tank Influence Tracker | TTIT",
    template: "%s | TTIT",
  },
  description:
    "A student research prototype tracing think tank funding, policy output and legislation. Contains demonstration and AI-generated data — see the methodology page.",
};

const NAV = [
  { href: "/think-tanks", label: "Think Tanks" },
  { href: "/donors", label: "Donors" },
  { href: "/explore", label: "Explore" },
  { href: "/compare", label: "Compare" },
  { href: "/analysis", label: "Analysis" },
  { href: "/grants", label: "Grants" },
  { href: "/methodology", label: "Methodology" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen flex flex-col bg-background text-foreground`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:m-3 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-black focus:font-semibold"
        >
          Skip to content
        </a>
        <nav
          aria-label="Primary"
          className="border-b border-card-border bg-card/80 backdrop-blur-md sticky top-0 z-50"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4 h-16">
              <Link
                href="/"
                className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight shrink-0"
              >
                <Activity className="h-6 w-6" aria-hidden="true" />
                TTIT
              </Link>
              {/* Horizontally scrollable rather than overflowing: six links plus
                  the logo do not fit on a 375px viewport. */}
              <div className="flex gap-4 overflow-x-auto whitespace-nowrap py-2 -my-2">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-sm text-muted hover:text-white transition-colors shrink-0"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </nav>
        <main id="main" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-card-border mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-xs text-muted leading-relaxed">
            <p>
              <strong className="text-white/80">Research prototype.</strong> Parts of this site are
              demonstration data or unverified language-model output, labelled in place. Nothing
              here is a finding of fact about any named organization or person.{" "}
              <Link href="/methodology" className="text-primary underline">
                Read the methodology
              </Link>
              .
            </p>
            <p className="mt-2">
              Nonprofit financials via ProPublica Nonprofit Explorer · campaign finance via the FEC
              · legislative data via GovInfo.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
