"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  BookOpen,
  FileText,
  Printer,
  Download,
  LayoutGrid,
  RefreshCw,
  Sparkles,
  Layers,
} from "lucide-react";
import { type Newsletter } from "@/app/actions/newsletterActions";
import { renderPdfPagesToDataUrls } from "@/lib/pdfUtils";

export interface NewsletterFlipbookProps {
  newsletter: Newsletter;
}

interface AnimationState {
  direction: "next" | "prev";
  targetSpread: number;
  phase: "start" | "turning";
}

export default function NewsletterFlipbook({ newsletter }: NewsletterFlipbookProps) {
  // Page rendering state
  const [pages, setPages] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<number>(0.75); // width / height of page
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadProgress, setLoadProgress] = useState<{ current: number; total: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Viewer modes & index
  const [viewMode, setViewMode] = useState<"two-page" | "single">("two-page");
  const [spreadIndex, setSpreadIndex] = useState<number>(0);
  const [singlePageIndex, setSinglePageIndex] = useState<number>(0);
  const [animState, setAnimState] = useState<AnimationState | null>(null);

  // Zoom & UI state
  const [zoom, setZoom] = useState<number>(1);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);

  // Auto-detect mobile screen on mount to default to 1-page view
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setViewMode("single");
    }
  }, []);

  // Load and render PDF pages whenever newsletter changes
  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      setIsLoading(true);
      setLoadError(null);
      setPages([]);
      setSpreadIndex(0);
      setSinglePageIndex(0);
      setZoom(1);
      setLoadProgress({ current: 0, total: newsletter.page_count || 1 });

      try {
        const result = await renderPdfPagesToDataUrls(
          newsletter.pdf_url,
          1.8,
          (current, total) => {
            if (!isCancelled) {
              setLoadProgress({ current, total });
            }
          }
        );

        if (!isCancelled) {
          setPages(result.pages);
          if (result.aspectRatio && result.aspectRatio > 0.4 && result.aspectRatio < 2.5) {
            setAspectRatio(result.aspectRatio);
          }
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error("Flipbook render error:", err);
          const msg = err instanceof Error ? err.message : "Failed to load PDF pages.";
          setLoadError(msg);
          setIsLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [newsletter.id, newsletter.pdf_url, newsletter.page_count]);

  // Total 2-page spreads
  // Spread 0: Cover (Right: Page 1)
  // Spread 1..: Pages [2, 3], [4, 5], etc.
  const totalSpreads = useMemo(() => {
    if (pages.length <= 1) return 1;
    return 1 + Math.ceil((pages.length - 1) / 2);
  }, [pages.length]);

  // Helper to get 0-based page indices for spread s
  const getSpreadPages = useCallback(
    (s: number): { left: number | null; right: number | null } => {
      if (s === 0) {
        return { left: null, right: 0 };
      }
      const leftIdx = 2 * s - 1;
      const rightIdx = 2 * s;
      return {
        left: leftIdx < pages.length ? leftIdx : null,
        right: rightIdx < pages.length ? rightIdx : null,
      };
    },
    [pages.length]
  );

  // Flip Forward (Next)
  const goNext = useCallback(() => {
    if (viewMode === "single") {
      if (singlePageIndex < pages.length - 1) {
        setSinglePageIndex((prev) => prev + 1);
      }
      return;
    }

    if (spreadIndex >= totalSpreads - 1 || animState) return;

    const target = spreadIndex + 1;
    setAnimState({ direction: "next", targetSpread: target, phase: "start" });

    // Transition to turning phase on next tick for CSS 3D animation
    requestAnimationFrame(() => {
      setTimeout(() => {
        setAnimState({ direction: "next", targetSpread: target, phase: "turning" });
      }, 20);
    });

    // Complete animation after duration
    setTimeout(() => {
      setSpreadIndex(target);
      setAnimState(null);
    }, 620);
  }, [viewMode, singlePageIndex, pages.length, spreadIndex, totalSpreads, animState]);

  // Flip Backward (Previous)
  const goPrev = useCallback(() => {
    if (viewMode === "single") {
      if (singlePageIndex > 0) {
        setSinglePageIndex((prev) => prev - 1);
      }
      return;
    }

    if (spreadIndex <= 0 || animState) return;

    const target = spreadIndex - 1;
    setAnimState({ direction: "prev", targetSpread: target, phase: "start" });

    requestAnimationFrame(() => {
      setTimeout(() => {
        setAnimState({ direction: "prev", targetSpread: target, phase: "turning" });
      }, 20);
    });

    setTimeout(() => {
      setSpreadIndex(target);
      setAnimState(null);
    }, 620);
  }, [viewMode, singlePageIndex, spreadIndex, animState]);

  const goToFirst = useCallback(() => {
    if (animState) return;
    if (viewMode === "single") {
      setSinglePageIndex(0);
    } else {
      setSpreadIndex(0);
    }
  }, [animState, viewMode]);

  const goToLast = useCallback(() => {
    if (animState) return;
    if (viewMode === "single") {
      setSinglePageIndex(pages.length - 1);
    } else {
      setSpreadIndex(totalSpreads - 1);
    }
  }, [animState, viewMode, pages.length, totalSpreads]);

  // Jump to specific page index
  const jumpToPage = useCallback(
    (pageIdx: number) => {
      if (animState) return;
      if (viewMode === "single") {
        setSinglePageIndex(pageIdx);
      } else {
        if (pageIdx === 0) {
          setSpreadIndex(0);
        } else {
          setSpreadIndex(Math.floor((pageIdx - 1) / 2) + 1);
        }
      }
    },
    [animState, viewMode]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Home") {
        e.preventDefault();
        goToFirst();
      } else if (e.key === "End") {
        e.preventDefault();
        goToLast();
      } else if (e.key === "Escape" && isFullscreen) {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, goToFirst, goToLast, isFullscreen]);

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        goNext();
      } else {
        goPrev();
      }
    }
    touchStartXRef.current = null;
  };

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn("Fullscreen toggle notice:", err);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Zoom handlers
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(2.25, parseFloat((prev + 0.25).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(1, parseFloat((prev - 0.25).toFixed(2))));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  // Print PDF
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.open(newsletter.pdf_url, "_blank");
    }
  };

  // Current page status label
  const pageStatusLabel = useMemo(() => {
    if (pages.length === 0) return "Loading...";
    if (viewMode === "single") {
      return singlePageIndex === 0
        ? `Cover • Page 1 of ${pages.length}`
        : `Page ${singlePageIndex + 1} of ${pages.length}`;
    }
    if (spreadIndex === 0) {
      return `Cover • Page 1 of ${pages.length}`;
    }
    const leftNum = 2 * spreadIndex;
    const rightNum = Math.min(2 * spreadIndex + 1, pages.length);
    if (leftNum === rightNum) {
      return `Page ${leftNum} of ${pages.length}`;
    }
    return `Pages ${leftNum}–${rightNum} of ${pages.length}`;
  }, [pages.length, viewMode, singlePageIndex, spreadIndex]);

  // Determine pages for current spread in 2-page view
  const currentSpread = useMemo(() => getSpreadPages(spreadIndex), [getSpreadPages, spreadIndex]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-slate-950 text-slate-100 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 transition-all ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none border-none" : "w-full"
      }`}
    >
      {/* Top Header & Quick Metadata Bar */}
      <div className="bg-slate-900/95 border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 backdrop-blur z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl shrink-0">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/60 shrink-0">
                {newsletter.issue_label}
              </span>
              {newsletter.is_featured && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                  <Sparkles className="h-2.5 w-2.5" />
                  Featured Issue
                </span>
              )}
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-white truncate mt-0.5" title={newsletter.title}>
              {newsletter.title}
            </h2>
          </div>
        </div>

        {/* View Mode & Page Pill */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden md:inline-flex items-center gap-1.5 bg-slate-800/90 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-700">
            <Layers className="h-3.5 w-3.5 text-blue-400" />
            <span>{pageStatusLabel}</span>
          </span>

          {/* View Mode Toggle: 2-Page Book vs 1-Page View */}
          <div className="bg-slate-800 p-0.5 rounded-lg border border-slate-700 flex items-center">
            <button
              type="button"
              onClick={() => {
                if (viewMode !== "two-page") {
                  setViewMode("two-page");
                  // Map single page to spread index
                  if (singlePageIndex === 0) setSpreadIndex(0);
                  else setSpreadIndex(Math.floor((singlePageIndex - 1) / 2) + 1);
                }
              }}
              title="2-Page Book Spread"
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1 ${
                viewMode === "two-page"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">2-Page Book</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (viewMode !== "single") {
                  setViewMode("single");
                  // Map spread index to single page
                  if (spreadIndex === 0) setSinglePageIndex(0);
                  else setSinglePageIndex(2 * spreadIndex - 1);
                }
              }}
              title="1-Page Single View"
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1 ${
                viewMode === "single"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">1-Page View</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Flipbook Stage */}
      <div
        className="relative flex-1 min-h-[460px] sm:min-h-[580px] lg:min-h-[660px] bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 flex items-center justify-center p-3 sm:p-6 overflow-hidden select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Loading Spinner / Progress Screen */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center text-center space-y-4 max-w-sm px-4 py-12">
            <div className="relative w-28 h-36 rounded-xl overflow-hidden border-2 border-blue-500/30 shadow-2xl bg-slate-900">
              {newsletter.cover_url ? (
                <Image
                  src={newsletter.cover_url}
                  alt={newsletter.title}
                  fill
                  unoptimized
                  className="object-cover opacity-60 filter blur-xs"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-700">
                  <BookOpen className="h-10 w-10" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40">
                <RefreshCw className="h-8 w-8 text-blue-400 animate-spin" />
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-bold text-white">Opening Newsletter Flipbook</p>
              <p className="text-xs text-slate-400">
                {loadProgress && loadProgress.total > 0
                  ? `Rendering page ${loadProgress.current} of ${loadProgress.total}...`
                  : "Preparing high-resolution pages..."}
              </p>
            </div>

            {/* Progress bar */}
            {loadProgress && loadProgress.total > 0 && (
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                <div
                  className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((loadProgress.current / loadProgress.total) * 100)
                    )}%`,
                  }}
                />
              </div>
            )}
          </div>
        ) : loadError ? (
          /* Error State */
          <div className="text-center max-w-md p-6 bg-rose-950/40 border border-rose-800/60 rounded-2xl space-y-3">
            <p className="text-sm font-bold text-rose-300">Unable to Display Flipbook</p>
            <p className="text-xs text-rose-400/80">{loadError}</p>
            <a
              href={newsletter.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition"
            >
              <Download className="h-4 w-4" />
              Download & View PDF
            </a>
          </div>
        ) : (
          /* Book Container */
          <div
            className={`w-full h-full flex items-center justify-center transition-transform duration-200 ${
              zoom > 1 ? "overflow-auto cursor-grab active:cursor-grabbing" : ""
            }`}
          >
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center center",
                perspective: "2600px",
              }}
              className="relative transition-transform duration-200 flex items-center justify-center max-w-full"
            >
              {/* ============================================================ */}
              {/* VIEW MODE 1: SINGLE PAGE VIEW                               */}
              {/* ============================================================ */}
              {viewMode === "single" ? (
                <div
                  style={{
                    aspectRatio: `${aspectRatio}`,
                    maxHeight: isFullscreen ? "82vh" : "68vh",
                  }}
                  className="relative rounded-xl overflow-hidden shadow-2xl bg-white border border-slate-700 flex items-center justify-center"
                >
                  {/* Page Image */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pages[singlePageIndex]}
                    alt={`Page ${singlePageIndex + 1}`}
                    className="w-full h-full object-contain"
                  />

                  {/* Left edge click for prev */}
                  {singlePageIndex > 0 && (
                    <button
                      type="button"
                      onClick={goPrev}
                      className="absolute inset-y-0 left-0 w-1/4 hover:bg-gradient-to-r hover:from-black/10 hover:to-transparent transition group flex items-center justify-start pl-3"
                      title="Previous Page"
                    >
                      <span className="p-2 rounded-full bg-slate-900/70 text-white opacity-0 group-hover:opacity-100 transition shadow-lg">
                        <ChevronLeft className="h-5 w-5" />
                      </span>
                    </button>
                  )}

                  {/* Right edge click for next */}
                  {singlePageIndex < pages.length - 1 && (
                    <button
                      type="button"
                      onClick={goNext}
                      className="absolute inset-y-0 right-0 w-1/4 hover:bg-gradient-to-l hover:from-black/10 hover:to-transparent transition group flex items-center justify-end pr-3"
                      title="Next Page"
                    >
                      <span className="p-2 rounded-full bg-slate-900/70 text-white opacity-0 group-hover:opacity-100 transition shadow-lg">
                        <ChevronRight className="h-5 w-5" />
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                /* ============================================================ */
                /* VIEW MODE 2: 2-PAGE SPREAD WITH 3D FLIP ANIMATION             */
                /* ============================================================ */
                <div
                  style={{
                    // In 2-page mode, spread aspect ratio is 2 * single aspect ratio
                    aspectRatio: `${aspectRatio * 2}`,
                    maxHeight: isFullscreen ? "82vh" : "68vh",
                    width: "auto",
                  }}
                  className="relative flex items-center justify-center rounded-2xl shadow-2xl bg-slate-950/60 p-1 sm:p-2 border border-slate-800"
                >
                  {/* Underneath Paper Stack Border (Simulating 3D page edges) */}
                  <div className="absolute inset-0 rounded-2xl bg-slate-800 -rotate-0.5 scale-x-[1.01] scale-y-[1.005] opacity-40 pointer-events-none" />
                  <div className="absolute inset-0 rounded-2xl bg-slate-700 rotate-0.5 scale-x-[1.005] scale-y-[1.01] opacity-30 pointer-events-none" />

                  {/* Static Book Spread Underneath */}
                  <div className="relative w-full h-full flex rounded-xl overflow-hidden bg-slate-900 shadow-2xl">
                    {/* LEFT PAGE */}
                    <div className="w-1/2 h-full relative overflow-hidden bg-white border-r border-slate-200">
                      {spreadIndex === 0 ? (
                        /* Closed cover back/inside binding */
                        <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 text-center text-slate-500 border-r border-slate-950">
                          <BookOpen className="h-10 w-10 text-slate-700 mb-2 opacity-50" />
                          <p className="text-[11px] font-semibold text-slate-400">
                            Washington School LRC
                          </p>
                          <p className="text-[9px] text-slate-600 mt-1 uppercase tracking-wider">
                            Interactive Flipbook
                          </p>
                        </div>
                      ) : currentSpread.left !== null ? (
                        /* Render Left Page Image */
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={pages[currentSpread.left]}
                          alt={`Page ${currentSpread.left + 1}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300">
                          <BookOpen className="h-8 w-8" />
                        </div>
                      )}

                      {/* Clickable Left Half for Prev */}
                      {spreadIndex > 0 && !animState && (
                        <button
                          type="button"
                          onClick={goPrev}
                          className="absolute inset-0 hover:bg-gradient-to-r hover:from-black/10 hover:to-transparent transition group flex items-center justify-start pl-4 cursor-pointer"
                          title="Click to flip previous page"
                        >
                          <span className="p-2.5 rounded-full bg-slate-900/80 text-white opacity-0 group-hover:opacity-100 transition shadow-xl transform -translate-x-2 group-hover:translate-x-0">
                            <ChevronLeft className="h-5 w-5" />
                          </span>
                        </button>
                      )}
                    </div>

                    {/* RIGHT PAGE */}
                    <div className="w-1/2 h-full relative overflow-hidden bg-white border-l border-slate-200">
                      {currentSpread.right !== null ? (
                        /* Render Right Page Image */
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={pages[currentSpread.right]}
                          alt={`Page ${currentSpread.right + 1}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        /* Blank Back Cover if last spread has no right page */
                        <div className="w-full h-full bg-gradient-to-bl from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 text-center text-slate-500">
                          <BookOpen className="h-10 w-10 text-slate-700 mb-2 opacity-50" />
                          <p className="text-[11px] font-semibold text-slate-400">Back Cover</p>
                          <p className="text-[9px] text-slate-600 mt-1 uppercase tracking-wider">
                            End of Issue
                          </p>
                        </div>
                      )}

                      {/* Clickable Right Half for Next */}
                      {spreadIndex < totalSpreads - 1 && !animState && (
                        <button
                          type="button"
                          onClick={goNext}
                          className="absolute inset-0 hover:bg-gradient-to-l hover:from-black/10 hover:to-transparent transition group flex items-center justify-end pr-4 cursor-pointer"
                          title="Click to flip next page"
                        >
                          {/* Corner curl visual hint */}
                          <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-slate-400/40 via-transparent to-transparent pointer-events-none group-hover:from-blue-500/50 transition" />
                          <span className="p-2.5 rounded-full bg-slate-900/80 text-white opacity-0 group-hover:opacity-100 transition shadow-xl transform translate-x-2 group-hover:translate-x-0">
                            <ChevronRight className="h-5 w-5" />
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Center Spine Crease & Shadow */}
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-8 pointer-events-none z-10 bg-gradient-to-r from-black/25 via-black/5 to-black/25 shadow-inner" />
                  </div>

                  {/* ============================================================ */}
                  {/* 3D TURNING PAGE LEAF ANIMATION                               */}
                  {/* ============================================================ */}
                  {animState && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        // If flipping next: leaf starts on right half (left: 50%) and turns left (-180deg)
                        // If flipping prev: leaf starts on left half (left: 0) and turns right (+180deg)
                        left: animState.direction === "next" ? "50%" : "0%",
                        width: "50%",
                        transformOrigin:
                          animState.direction === "next" ? "left center" : "right center",
                        transformStyle: "preserve-3d",
                        transform:
                          animState.phase === "turning"
                            ? animState.direction === "next"
                              ? "rotateY(-180deg)"
                              : "rotateY(180deg)"
                            : "rotateY(0deg)",
                        transition: "transform 600ms cubic-bezier(0.645, 0.045, 0.355, 1.000)",
                        zIndex: 30,
                      }}
                      className="pointer-events-none shadow-2xl rounded-r-xl"
                    >
                      {/* FRONT FACE OF TURNING LEAF */}
                      <div
                        style={{
                          backfaceVisibility: "hidden",
                          WebkitBackfaceVisibility: "hidden",
                        }}
                        className="absolute inset-0 w-full h-full bg-white overflow-hidden rounded-r-xl border border-slate-200"
                      >
                        {animState.direction === "next" ? (
                          currentSpread.right !== null ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={pages[currentSpread.right]}
                              alt="Turning page"
                              className="w-full h-full object-contain"
                            />
                          ) : null
                        ) : currentSpread.left !== null ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={pages[currentSpread.left]}
                            alt="Turning page"
                            className="w-full h-full object-contain"
                          />
                        ) : null}

                        {/* Shadow that darkens as the page lifts */}
                        <div
                          className={`absolute inset-0 bg-black transition-opacity duration-500 ${
                            animState.phase === "turning" ? "opacity-30" : "opacity-0"
                          }`}
                        />
                      </div>

                      {/* BACK FACE OF TURNING LEAF (Reveals the incoming page) */}
                      <div
                        style={{
                          backfaceVisibility: "hidden",
                          WebkitBackfaceVisibility: "hidden",
                          transform: "rotateY(180deg)",
                        }}
                        className="absolute inset-0 w-full h-full bg-white overflow-hidden rounded-l-xl border border-slate-200"
                      >
                        {animState.direction === "next" ? (
                          getSpreadPages(animState.targetSpread).left !== null ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={pages[getSpreadPages(animState.targetSpread).left!]}
                              alt="Turning page back"
                              className="w-full h-full object-contain"
                            />
                          ) : null
                        ) : getSpreadPages(animState.targetSpread).right !== null ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={pages[getSpreadPages(animState.targetSpread).right!]}
                            alt="Turning page back"
                            className="w-full h-full object-contain"
                          />
                        ) : null}

                        {/* Highlight that lightens as the page lands */}
                        <div
                          className={`absolute inset-0 bg-black transition-opacity duration-500 ${
                            animState.phase === "turning" ? "opacity-0" : "opacity-30"
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Bottom Control Toolbar */}
      <div className="bg-slate-900/95 border-t border-slate-800 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 backdrop-blur z-20">
        {/* Navigation buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={goToFirst}
            disabled={
              (viewMode === "two-page" ? spreadIndex === 0 : singlePageIndex === 0) ||
              isLoading ||
              Boolean(animState)
            }
            title="First Page"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 hover:text-white transition"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goPrev}
            disabled={
              (viewMode === "two-page" ? spreadIndex === 0 : singlePageIndex === 0) ||
              isLoading ||
              Boolean(animState)
            }
            title="Previous"
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs font-semibold"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          {/* Current Page Indicator on Mobile */}
          <span className="md:hidden text-xs font-semibold px-2 text-slate-300">
            {pageStatusLabel}
          </span>

          <button
            type="button"
            onClick={goNext}
            disabled={
              (viewMode === "two-page"
                ? spreadIndex >= totalSpreads - 1
                : singlePageIndex >= pages.length - 1) ||
              isLoading ||
              Boolean(animState)
            }
            title="Next"
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs font-semibold"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToLast}
            disabled={
              (viewMode === "two-page"
                ? spreadIndex >= totalSpreads - 1
                : singlePageIndex >= pages.length - 1) ||
              isLoading ||
              Boolean(animState)
            }
            title="Last Page"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 hover:text-white transition"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>

        {/* Center / Right Ergonomics: Zoom, Thumbnails, Print, Fullscreen */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 1 || isLoading}
              title="Zoom Out"
              className="p-1.5 rounded-md hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white transition"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              title="Reset Zoom"
              className="px-2 py-1 text-[11px] font-mono font-semibold text-slate-300 hover:text-white transition"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 2.25 || isLoading}
              title="Zoom In"
              className="p-1.5 rounded-md hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white transition"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Thumbnails filmstrip toggle */}
          <button
            type="button"
            onClick={() => setShowThumbnails((prev) => !prev)}
            title="Page Thumbnails"
            className={`p-2 rounded-lg transition border text-xs font-semibold flex items-center gap-1.5 ${
              showThumbnails
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Pages</span>
          </button>

          {/* Print button */}
          <button
            type="button"
            onClick={handlePrint}
            title="Print PDF"
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition"
          >
            <Printer className="h-4 w-4" />
          </button>

          {/* Download link */}
          <a
            href={newsletter.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            title="Download PDF"
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition flex items-center gap-1 text-xs"
          >
            <Download className="h-4 w-4" />
            <span className="hidden md:inline">Download</span>
          </a>

          {/* Fullscreen toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Collapsible Page Thumbnail Filmstrip */}
      {showThumbnails && pages.length > 0 && (
        <div className="bg-slate-900 border-t border-slate-800 p-3 overflow-x-auto z-20">
          <div className="flex items-center gap-3 min-w-max mx-auto px-2">
            {pages.map((imgSrc, idx) => {
              const isSelected =
                viewMode === "single"
                  ? singlePageIndex === idx
                  : spreadIndex === 0
                  ? idx === 0
                  : idx === 2 * spreadIndex - 1 || idx === 2 * spreadIndex;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => jumpToPage(idx)}
                  className={`group relative rounded-md overflow-hidden border-2 transition p-0.5 shrink-0 bg-white ${
                    isSelected
                      ? "border-blue-500 ring-2 ring-blue-500/30 scale-105"
                      : "border-slate-700 hover:border-slate-500 opacity-70 hover:opacity-100"
                  }`}
                  style={{
                    width: "56px",
                    height: `${Math.round(56 / aspectRatio)}px`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgSrc} alt={`Thumbnail page ${idx + 1}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 right-1 bg-slate-950/80 text-[9px] font-bold text-white px-1 py-0.2 rounded">
                    {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
