'use client';

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputId = useId();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <form onSubmit={handleSearch} role="search" className="flex gap-2">
      <label htmlFor={inputId} className="sr-only">
        Search think tanks, donors, legislation and policy papers
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 min-w-0 px-3 py-2 text-sm bg-surface border border-border-strong rounded-sm placeholder:text-muted focus:outline-none focus:border-accent"
        placeholder="Search organizations, donors, bills…"
      />
      <button
        type="submit"
        className="px-3.5 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-white rounded-sm shrink-0"
      >
        Search
      </button>
    </form>
  );
}
