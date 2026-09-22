"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Bookmark,
  Calendar,
  Layers,
  GraduationCap,
} from "lucide-react";
import { searchCatalog, type CatalogBook } from "@/app/actions/publicActions";

export default function PublicCatalogPage() {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Perform search
  const handleSearch = useCallback(
    async (searchQuery: string = query) => {
      setIsSearching(true);
      const results = await searchCatalog(searchQuery);
      setBooks(results);
      setIsSearching(false);
    },
    [query]
  );

  // Load initial 10 most recent books on mount
  useEffect(() => {
    handleSearch("");
  }, [handleSearch]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleQuickCategory = (cat: string) => {
    setQuery(cat);
    handleSearch(cat);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-white shadow-sm ring-2 ring-blue-600/20 group-hover:ring-blue-600/40 transition shrink-0">
              <Image
                src="/logo.png"
                alt="Washington School Philippines Logo"
                width={40}
                height={40}
                className="w-full h-full object-contain p-0.5"
                priority
              />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight block leading-none">
                Washington School
              </span>
              <span className="text-[10px] text-slate-500 tracking-wider uppercase font-medium">
                Philippines • Library (OPAC)
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/student"
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition border border-blue-200 shadow-sm"
            >
              <GraduationCap className="h-4 w-4 text-blue-600" />
              <span>Student Portal</span>
            </Link>

            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-3 py-2 rounded-lg transition border border-slate-200"
            >
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <span>Librarian Login</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-950 via-slate-900 to-slate-900 text-white py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-white p-1.5 shadow-2xl ring-4 ring-white/20 mb-4 transition-transform hover:scale-105">
              <Image
                src="/logo.png"
                alt="Washington School Philippines Official Seal"
                width={128}
                height={128}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-medium">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Online Public Access Catalog</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Washington School Learning Resource Center
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto">
            Welcome to the Library Management System. Discover books, explore author collections, view physical shelf availability, and find your next great read.
          </p>

          {/* Prominent Search Bar */}
          <form
            onSubmit={onSubmit}
            className="pt-4 max-w-2xl mx-auto flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <Search className="h-5 w-5 absolute left-4 top-3.5 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, author, category, or ISBN..."
                className="w-full pl-12 pr-4 py-3.5 text-sm sm:text-base rounded-xl text-slate-900 bg-white placeholder-slate-400 border border-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-500/30 shadow-lg"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="bg-blue-600 hover:bg-blue-500 text-white px-7 py-3.5 rounded-xl font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition shadow-lg disabled:opacity-60"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-5 w-5" />
                  Search
                </>
              )}
            </button>
          </form>

          {/* Quick Category Suggestions */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs text-slate-300">
            <span className="text-slate-400">Quick explore:</span>
            {["Fiction", "Fantasy", "Science", "History", "Rowling"].map((keyword) => (
              <button
                key={keyword}
                type="button"
                onClick={() => handleQuickCategory(keyword)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-full transition"
              >
                {keyword}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Catalog Results Grid */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              {query.trim()
                ? `Search Results for "${query.trim()}"`
                : "Recently Added Titles"}
            </h2>
            <p className="text-xs text-slate-500">
              Showing {books.length} book title{books.length === 1 ? "" : "s"}
            </p>
          </div>

          {query.trim() && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                handleSearch("");
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium self-start sm:self-auto"
            >
              Clear search filter
            </button>
          )}
        </div>

        {/* Loading Skeleton / Spinner */}
        {isSearching ? (
          <div className="py-20 text-center text-slate-400 space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
            <p className="text-sm font-medium">Searching the library catalog...</p>
          </div>
        ) : books.length === 0 ? (
          /* Empty State */
          <div className="py-20 text-center max-w-md mx-auto space-y-4">
            <div className="p-4 bg-slate-100 rounded-full w-16 h-16 mx-auto flex items-center justify-center text-slate-400">
              <BookOpen className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No books found</h3>
            <p className="text-xs text-slate-500">
              We couldn&apos;t find any books matching &quot;{query}&quot;. Try searching with different keywords, or check the spelling.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                handleSearch("");
              }}
              className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition shadow-sm"
            >
              Browse Recent Books
            </button>
          </div>
        ) : (
          /* Book Results Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {books.map((book) => {
              const isAvailable = book.available_copies > 0;

              return (
                <article
                  key={book.isbn}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition duration-200 flex flex-col group"
                >
                  {/* Book Cover Container */}
                  <div className="relative w-full h-72 bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100">
                    {book.cover_url ? (
                      <Image
                        src={book.cover_url}
                        alt={`Cover of ${book.title}`}
                        fill
                        unoptimized
                        className="object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      /* Placeholder cover when cover_url is null */
                      <div className="w-full h-full p-6 flex flex-col items-center justify-center text-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
                        <BookOpen className="h-12 w-12 text-slate-300 mb-2" />
                        <span className="text-xs font-bold text-slate-700 line-clamp-2">
                          {book.title}
                        </span>
                        <span className="text-[11px] text-slate-500 mt-1">
                          {book.author}
                        </span>
                      </div>
                    )}

                    {/* Availability Badge */}
                    <div className="absolute top-3 right-3">
                      {isAvailable ? (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-md">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>
                            {book.available_copies}{" "}
                            {book.available_copies === 1 ? "Copy" : "Copies"} Available
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-slate-700 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-md">
                          <XCircle className="h-3.5 w-3.5 text-rose-400" />
                          <span>Currently Checked Out</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Details */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <h3
                        className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition line-clamp-2 leading-snug"
                        title={book.title}
                      >
                        {book.title}
                      </h3>
                      <p className="text-xs font-medium text-slate-600 line-clamp-1">
                        {book.author || "Unknown Author"}
                      </p>
                    </div>

                    {/* Metadata tags */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {book.category && (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                            <Bookmark className="h-3 w-3 text-slate-400" />
                            {book.category}
                          </span>
                        )}
                        {book.published_year && (
                          <span className="text-slate-500 flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {book.published_year}
                          </span>
                        )}
                      </div>

                      {/* Shelf Call Number */}
                      {book.call_number && (
                        <div className="text-[11px] text-slate-700 flex items-center justify-between bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md">
                          <span className="text-slate-500 font-medium">Shelf Location:</span>
                          <span className="font-mono font-bold text-blue-700">
                            {book.call_number}
                          </span>
                        </div>
                      )}

                      <div className="text-[10px] text-slate-400 font-mono pt-1">
                        ISBN: {book.isbn}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 px-4 sm:px-6 lg:px-8 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2.5">
            <div className="relative w-6 h-6 rounded-full overflow-hidden bg-white shadow-xs shrink-0 ring-1 ring-slate-200">
              <Image
                src="/logo.png"
                alt="Washington School Philippines"
                width={24}
                height={24}
                className="w-full h-full object-contain"
              />
            </div>
            <span>
              &copy; {new Date().getFullYear()} Washington School Philippines. All rights reserved.
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-slate-600 hover:text-blue-600 font-semibold flex items-center gap-1 transition"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Librarian Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
