'use client';

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputId = useId();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      // router.push, not window.location.href: a full document reload discards
      // the router cache and all client state.
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <form onSubmit={handleSearch} role="search" className="relative group">
      <label htmlFor={inputId} className="sr-only">
        Search think tanks, donors, legislation and policy papers
      </label>
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search aria-hidden="true" className="h-5 w-5 text-muted group-focus-within:text-primary transition-colors" />
      </div>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="block w-full pl-11 pr-4 py-4 bg-card border border-card-border rounded-2xl text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-lg"
        placeholder="Search think tanks, politicians, or donors..."
      />
      <button 
        type="submit"
        className="absolute inset-y-2 right-2 px-4 bg-primary hover:bg-primary-hover text-black font-semibold rounded-xl transition-colors"
      >
        Search
      </button>
    </form>
  );
}
