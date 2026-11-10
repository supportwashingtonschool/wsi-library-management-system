"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  Newspaper,
  BookOpen,
  Search,
  ShieldCheck,
  GraduationCap,
  Download,
  Calendar,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  X,
  FileText,
  Layers,
  ArrowUp,
} from "lucide-react";
import { getNewsletters, type Newsletter } from "@/app/actions/newsletterActions";
import NewsletterFlipbook from "@/components/NewsletterFlipbook";

function NewslettersContent() {
  const searchParams = useSearchParams();
  const issueParam = searchParams.get("issue");

  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [activeNewsletter, setActiveNewsletter] = useState<Newsletter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Load newsletters on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const res = await getNewsletters();
      setIsLoading(false);

      if (res.success && res.newsletters.length > 0) {
        setNewsletters(res.newsletters);

        // If ?issue=<id> matches a newsletter, activate it; otherwise activate featured / first
        if (issueParam) {
          const matched = res.newsletters.find((n) => n.id === issueParam);
          if (matched) {
            setActiveNewsletter(matched);
            return;
          }
        }

        const featured = res.newsletters.find((n) => n.is_featured) || res.newsletters[0];
        setActiveNewsletter(featured || null);
      } else if (!res.success) {
        setErrorNotice(res.error || "Unable to load newsletters.");
      }
    }

    loadData();
  }, [issueParam]);

  // Handle switching active newsletter from the archive shelf
  const handleSelectNewsletter = (item: Newsletter) => {
    setActiveNewsletter(item);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Filter archive issues
  const filteredArchive = useMemo(() => {
    if (!archiveSearch.trim()) return newsletters;
    const q = archiveSearch.toLowerCase();
    return newsletters.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.issue_label.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
    );
  }, [newsletters, archiveSearch]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-white shadow-sm ring-2 ring-blue-500/20 group-hover:ring-blue-500/40 transition shrink-0 p-0.5">
              <Image
                src="/logo.png"
                alt="Washington School Philippines Logo"
                width={40}
                height={40}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <div>
              <span className="font-bold text-white text-base sm:text-lg tracking-tight block leading-none">
                Washington School
              </span>
              <span className="text-[10px] text-blue-400 tracking-wider uppercase font-medium">
                Philippines • Library (OPAC)
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg transition border border-slate-700"
            >
              <BookOpen className="h-4 w-4 text-blue-400" />
              <span className="hidden sm:inline">Book Catalog</span>
            </Link>

            <Link
              href="/newsletters"
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-300 bg-blue-950/80 px-3 py-2 rounded-lg border border-blue-700/60 shadow-xs"
            >
              <Newspaper className="h-4 w-4 text-blue-400" />
              <span>Newsletters</span>
            </Link>

            <Link
              href="/student"
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-200 hover:text-white bg-blue-900/40 hover:bg-blue-900/60 px-3 py-2 rounded-lg transition border border-blue-800/60"
            >
              <GraduationCap className="h-4 w-4 text-blue-400" />
              <span className="hidden sm:inline">Student Portal</span>
            </Link>

            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 px-3 py-2 rounded-lg transition border border-slate-700"
            >
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              <span className="hidden md:inline">Librarian Login</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-12">
        {/* Stage Header */}
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-400 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Interactive 3D 2-Page Book Display</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
            School Newsletters & Publications
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Read our official Washington School library newsletters, announcements, and feature articles just like an authentic physical magazine.
          </p>
        </div>

        {/* Notice Banner */}
        {errorNotice && (
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs sm:text-sm flex items-center justify-between">
            <span>{errorNotice}</span>
            <button
              type="button"
              onClick={() => setErrorNotice(null)}
              className="text-amber-400 hover:text-white p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Stage Section: Interactive 3D Flipbook */}
        {isLoading ? (
          <div className="py-24 text-center text-slate-400 space-y-3 bg-slate-900/50 rounded-3xl border border-slate-800/80">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500" />
            <p className="text-sm font-semibold text-slate-300">Loading newsletter publications...</p>
          </div>
        ) : activeNewsletter ? (
          <div className="space-y-6">
            {/* The 3D 2-Page Flipbook Stage */}
            <NewsletterFlipbook newsletter={activeNewsletter} />

            {/* Active Newsletter Information Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-blue-400 bg-blue-950 px-2.5 py-1 rounded-md border border-blue-800/60">
                    {activeNewsletter.issue_label}
                  </span>
                  {activeNewsletter.is_featured && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded-md border border-amber-800/60">
                      <Sparkles className="h-3 w-3" />
                      Featured Latest Issue
                    </span>
                  )}
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    {new Date(
                      activeNewsletter.published_at || activeNewsletter.created_at
                    ).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-slate-500" />
                    {activeNewsletter.page_count} {activeNewsletter.page_count === 1 ? "Page" : "Pages"}
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-bold text-white leading-snug">
                  {activeNewsletter.title}
                </h2>

                {activeNewsletter.description && (
                  <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
                    {activeNewsletter.description}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                <a
                  href={activeNewsletter.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2.5 rounded-xl transition shadow-xs"
                >
                  <Download className="h-4 w-4 text-blue-400" />
                  <span>Download Original PDF</span>
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* Empty State if No Newsletters Uploaded Yet */
          <div className="py-20 text-center max-w-md mx-auto space-y-4 bg-slate-900/40 border border-slate-800 rounded-3xl p-8">
            <div className="p-4 bg-slate-800/80 rounded-2xl w-16 h-16 mx-auto flex items-center justify-center text-blue-400">
              <Newspaper className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-white">No Newsletters Published Yet</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              The school library hasn&apos;t published any newsletter issues yet. Check back soon for upcoming student stories, book reviews, and LRC updates!
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl transition"
              >
                Browse Book Catalog
              </Link>
              <Link
                href="/admin/newsletters"
                className="text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-xl transition"
              >
                Librarian: Publish Issue
              </Link>
            </div>
          </div>
        )}

        {/* Section 2: Archive & Past Issues Shelf */}
        {newsletters.length > 0 && (
          <section className="space-y-6 pt-4 border-t border-slate-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Newspaper className="h-5 w-5 text-blue-400" />
                  Newsletter Archive & Past Issues
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Explore previous editions, seasonal issues, and special releases.
                </p>
              </div>

              {/* Search Archive */}
              <div className="relative sm:w-72">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  placeholder="Search newsletters by title, issue, or keyword..."
                  className="w-full text-xs pl-9 pr-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Grid of Issues */}
            {filteredArchive.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No newsletters found matching &quot;{archiveSearch}&quot;.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredArchive.map((item) => {
                  const isActive = activeNewsletter?.id === item.id;

                  return (
                    <article
                      key={item.id}
                      className={`rounded-2xl border transition overflow-hidden flex flex-col justify-between bg-slate-900 group ${
                        isActive
                          ? "border-blue-500 ring-2 ring-blue-500/30 shadow-xl"
                          : "border-slate-800 hover:border-slate-700 shadow-sm"
                      }`}
                    >
                      {/* Cover Thumbnail Area */}
                      <div className="relative w-full h-72 bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-800/80">
                        {item.cover_url ? (
                          <Image
                            src={item.cover_url}
                            alt={item.title}
                            fill
                            unoptimized
                            className="object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-4 text-center">
                            <BookOpen className="h-10 w-10 text-slate-700 mb-2" />
                            <span className="text-xs font-semibold text-slate-400">
                              {item.title}
                            </span>
                          </div>
                        )}

                        {/* Top Badges */}
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-white bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded-full border border-slate-700 shadow-sm">
                            {item.issue_label}
                          </span>

                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-200 bg-blue-600 px-2.5 py-1 rounded-full shadow-md">
                              <CheckCircle2 className="h-3 w-3" />
                              Currently Reading
                            </span>
                          ) : item.is_featured ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-800/80 px-2.5 py-1 rounded-full shadow-md">
                              <Sparkles className="h-2.5 w-2.5" />
                              Featured
                            </span>
                          ) : null}
                        </div>

                        {/* Bottom page count tag */}
                        <div className="absolute bottom-2 right-2">
                          <span className="text-[10px] font-medium text-slate-300 bg-slate-950/80 backdrop-blur px-2 py-0.5 rounded border border-slate-800">
                            {item.page_count} {item.page_count === 1 ? "page" : "pages"}
                          </span>
                        </div>
                      </div>

                      {/* Issue Details & Actions */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <h3
                            className="text-sm font-bold text-white group-hover:text-blue-400 transition line-clamp-2 leading-snug"
                            title={item.title}
                          >
                            {item.title}
                          </h3>
                          {item.description && (
                            <p className="text-xs text-slate-400 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-800/80">
                          <div className="text-[10px] text-slate-500">
                            Published:{" "}
                            {new Date(
                              item.published_at || item.created_at
                            ).toLocaleDateString()}
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            {isActive ? (
                              <button
                                type="button"
                                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                                className="flex-1 bg-blue-600/30 text-blue-300 border border-blue-500/50 hover:bg-blue-600/40 text-xs font-semibold py-2 rounded-xl transition flex items-center justify-center gap-1.5"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                                <span>Reading Now</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSelectNewsletter(item)}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                              >
                                <BookOpen className="h-3.5 w-3.5" />
                                <span>Read in Flipbook</span>
                              </button>
                            )}

                            <a
                              href={item.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Download PDF"
                              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition border border-slate-700 shrink-0"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-8 px-4 sm:px-6 lg:px-8 mt-16">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2.5">
            <div className="relative w-6 h-6 rounded-full overflow-hidden bg-white shadow-xs shrink-0 ring-1 ring-slate-700 p-0.5">
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
              href="/admin/newsletters"
              className="text-slate-400 hover:text-blue-400 font-semibold flex items-center gap-1 transition"
            >
              <FileText className="h-3.5 w-3.5" />
              Librarian Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function NewslettersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 space-y-2">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <NewslettersContent />
    </Suspense>
  );
}
