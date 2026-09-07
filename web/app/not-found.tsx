import Link from "next/link";
import { SearchX } from "lucide-react";

export const metadata = {
  title: "Not found",
};

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 gap-4">
      <SearchX className="w-12 h-12 text-muted" aria-hidden="true" />
      <h1 className="text-3xl font-extrabold tracking-tight">Nothing tracked here</h1>
      <p className="text-muted max-w-md">
        That organization, donor or bill isn&apos;t in the database. It may never have been
        tracked, or the link may be out of date.
      </p>
      <div className="flex gap-4 mt-2">
        <Link href="/" className="text-primary font-semibold hover:underline">
          Back to overview
        </Link>
        <Link href="/search" className="text-primary font-semibold hover:underline">
          Search the database
        </Link>
      </div>
    </div>
  );
}
