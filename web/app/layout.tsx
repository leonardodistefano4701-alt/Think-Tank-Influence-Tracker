import type { Metadata } from "next";
import { Source_Serif_4, Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://think-tank-influence-tracker-iota.vercel.app"),
  title: {
    default: "Think Tank Influence Tracker",
    template: "%s · Think Tank Influence Tracker",
  },
  description:
    "A student research prototype tracing think tank funding, policy output and legislation. Contains demonstration and AI-generated data — see the methodology page.",
};

const NAV = [
  { href: "/think-tanks", label: "Think tanks" },
  { href: "/donors", label: "Donors" },
  { href: "/explore", label: "Explore" },
  { href: "/compare", label: "Compare" },
  { href: "/analysis", label: "Analysis" },
  { href: "/grants", label: "Grants" },
  { href: "/methodology", label: "Methodology" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`}>
      <body className="min-h-screen flex flex-col bg-background text-foreground font-[family-name:var(--font-sans)]">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-sm focus:bg-accent focus:px-3 focus:py-2 focus:text-white focus:font-medium"
        >
          Skip to content
        </a>

        <header className="border-b border-border bg-surface">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-baseline justify-between gap-6 h-14">
              <Link
                href="/"
                className="font-[family-name:var(--font-serif)] text-lg font-semibold tracking-tight shrink-0 hover:text-accent"
              >
                {/* The full name crowds the nav below ~640px. */}
                <span className="hidden sm:inline">Think Tank Influence Tracker</span>
                <span className="sm:hidden">TTIT</span>
              </Link>
              <nav aria-label="Primary" className="flex gap-5 overflow-x-auto whitespace-nowrap">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-sm text-muted hover:text-foreground shrink-0"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </header>

        <main id="main" className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
          {children}
        </main>

        <footer className="border-t border-border mt-12 bg-surface">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-xs text-muted leading-relaxed space-y-2">
            <p>
              <strong className="font-semibold text-foreground">Research prototype.</strong> Parts
              of this site are demonstration data or unverified language-model output, labelled in
              place. Nothing here is a finding of fact about any named organization or person.{" "}
              <Link href="/methodology" className="text-accent underline underline-offset-2">
                Read the methodology
              </Link>
              .
            </p>
            <p>
              Nonprofit financials via ProPublica Nonprofit Explorer · campaign finance via the FEC ·
              legislative data via GovInfo.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
