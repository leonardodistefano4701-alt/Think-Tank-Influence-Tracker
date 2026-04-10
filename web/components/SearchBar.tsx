'use client';

import { Search } from "lucide-react";
import { useState } from "react";

export default function SearchBar() {
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if(query.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(query)}`;
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-muted group-focus-within:text-primary transition-colors" />
      </div>
      <input
        type="text"
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
