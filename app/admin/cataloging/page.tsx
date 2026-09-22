"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  BookPlus,
  Search,
  Barcode as BarcodeIcon,
  Printer,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  Library,
  Sparkles,
} from "lucide-react";
import {
  fetchBookFromGoogle,
  saveBook,
  type BookMetadata,
} from "@/app/actions/bookActions";

// Dynamically import react-barcode to avoid SSR canvas/window mismatches
const Barcode = dynamic(() => import("react-barcode"), { ssr: false });

export default function CatalogingPage() {
  // Section 1: ISBN & Search State
  const [isbn, setIsbn] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchedData, setFetchedData] = useState<BookMetadata | null>(null);

  // Section 2: Review Form State
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publishedYear, setPublishedYear] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [category, setCategory] = useState("");
  const [callNumber, setCallNumber] = useState("");

  // Section 3: Copies & Saving State
  const [copies, setCopies] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Section 4: Success / Barcode Generation State
  const [generatedAccessions, setGeneratedAccessions] = useState<string[] | null>(null);
  const [savedBookInfo, setSavedBookInfo] = useState<{
    title: string;
    author: string;
    callNumber: string;
    isbn: string;
  } | null>(null);

  // Smart Feature: Auto-fill fields and calculate Call Number if Category contains "Fiction"
  useEffect(() => {
    if (fetchedData) {
      setTitle(fetchedData.title || "");
      setAuthor(fetchedData.author || "");
      setPublisher(fetchedData.publisher || "");
      setPublishedYear(fetchedData.published_year || "");
      setCoverUrl(fetchedData.cover_url || "");
      setCategory(fetchedData.category || "");

      // Auto-calculate Call Number: FIC + First 3 letters of Author's last name
      const cat = fetchedData.category || "";
      if (cat.toLowerCase().includes("fiction")) {
        const auth = fetchedData.author || "";
        let lastName = "";
        if (auth.includes(",")) {
          lastName = auth.split(",")[0].trim();
        } else {
          const parts = auth.trim().split(/\s+/);
          lastName = parts[parts.length - 1] || "";
        }
        const authorLetters = lastName.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();
        setCallNumber(authorLetters ? `FIC ${authorLetters}` : "FIC");
      } else {
        setCallNumber("");
      }
    }
  }, [fetchedData]);

  // Smart Feature: Auto-generate Call Number from current Category and Author state
  const handleGenerateCallNumber = () => {
    // 1. Category Code: first 3 letters of category string, trimmed, uppercase (default 'XXX')
    let catCode = "XXX";
    const cleanCat = category.trim();
    if (cleanCat) {
      const sliced = cleanCat.slice(0, 3).trim().toUpperCase();
      if (sliced) {
        catCode = sliced;
      }
    }

    // 2. Author Code: parse author string to find last name
    // - If contains comma, take substring before comma
    // - If no comma, split by spaces and pop last element
    // - Take first 3 letters, remove special characters, uppercase (default 'XXX')
    let authorCode = "XXX";
    const cleanAuth = author.trim();
    if (cleanAuth) {
      let rawLastName = "";
      if (cleanAuth.includes(",")) {
        rawLastName = cleanAuth.split(",")[0].trim();
      } else {
        const parts = cleanAuth.split(/\s+/).filter(Boolean);
        rawLastName = parts.length > 0 ? parts[parts.length - 1] : "";
      }
      const letters = rawLastName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase();
      if (letters) {
        authorCode = letters;
      }
    }

    // 3. Update State: Combine them (e.g. 'FAN ROW')
    setCallNumber(`${catCode} ${authorCode}`);
  };

  // Handle ISBN Metadata Fetching
  const handleFetchMetadata = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanIsbn = isbn.replace(/[-\s]/g, "").trim();
    if (!cleanIsbn) {
      setFetchError("Please enter an ISBN (10 or 13 digits).");
      return;
    }

    setIsFetching(true);
    setFetchError(null);
    setSaveError(null);

    const result = await fetchBookFromGoogle(cleanIsbn);
    setIsFetching(false);

    if (!result) {
      setFetchError("No metadata found for this ISBN. You can enter details manually below.");
      setFetchedData(null);
    } else {
      setFetchedData(result);
    }
  };

  // Handle Saving Book Record
  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isbn.trim()) {
      setSaveError("ISBN is required.");
      return;
    }
    if (!title.trim()) {
      setSaveError("Book title is required.");
      return;
    }
    if (copies < 1) {
      setSaveError("Number of copies must be at least 1.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const result = await saveBook(
      {
        isbn: isbn.trim(),
        title: title.trim(),
        author: author.trim(),
        publisher: publisher.trim(),
        published_year: publishedYear.trim(),
        cover_url: coverUrl.trim(),
        category: category.trim(),
        call_number: callNumber.trim(),
      },
      copies
    );

    setIsSaving(false);

    if (!result.success || !result.accessionNumbers) {
      setSaveError(result.error || "Failed to save book to library.");
    } else {
      setSavedBookInfo({
        title: title.trim(),
        author: author.trim(),
        callNumber: callNumber.trim(),
        isbn: isbn.trim(),
      });
      setGeneratedAccessions(result.accessionNumbers);
    }
  };

  // Reset form for next cataloging entry
  const handleReset = () => {
    setIsbn("");
    setTitle("");
    setAuthor("");
    setPublisher("");
    setPublishedYear("");
    setCoverUrl("");
    setCategory("");
    setCallNumber("");
    setCopies(1);
    setFetchedData(null);
    setFetchError(null);
    setSaveError(null);
    setGeneratedAccessions(null);
    setSavedBookInfo(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Printable CSS style rules */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-barcodes,
          #printable-barcodes * {
            visibility: visible;
          }
          #printable-barcodes {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="no-print">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <BookPlus className="h-6 w-6 text-blue-600" />
          Book Encoding & Cataloging
        </h1>
        <p className="text-sm text-slate-500">
          Scan or enter an ISBN to auto-fetch bibliographic details, review or adjust metadata, and generate printable accession barcodes.
        </p>
      </div>

      {/* VIEW 1: Success & Barcode Generation View */}
      {generatedAccessions && savedBookInfo ? (
        <div className="space-y-6">
          {/* Success Banner (Hidden on Print) */}
          <div className="no-print bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-emerald-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-full text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Book Cataloged Successfully!</h2>
                <p className="text-sm text-emerald-700">
                  Created <strong>{generatedAccessions.length}</strong> physical copy record(s) with sequential accession numbers.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition shadow-sm"
              >
                <Printer className="h-4 w-4" />
                Print Labels
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium text-sm transition shadow-sm"
              >
                <PlusCircle className="h-4 w-4" />
                Encode Another Book
              </button>
            </div>
          </div>

          {/* Book Summary Card (Hidden on Print) */}
          <div className="no-print bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Saved Book Summary
            </h3>
            <div className="flex flex-wrap gap-y-2 gap-x-6 text-sm text-slate-700">
              <div>
                <span className="text-slate-400">Title: </span>
                <span className="font-semibold text-slate-900">{savedBookInfo.title}</span>
              </div>
              {savedBookInfo.author && (
                <div>
                  <span className="text-slate-400">Author: </span>
                  <span className="font-medium text-slate-800">{savedBookInfo.author}</span>
                </div>
              )}
              {savedBookInfo.callNumber && (
                <div>
                  <span className="text-slate-400">Call Number: </span>
                  <span className="font-mono font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                    {savedBookInfo.callNumber}
                  </span>
                </div>
              )}
              <div>
                <span className="text-slate-400">ISBN: </span>
                <span className="font-mono text-slate-600">{savedBookInfo.isbn}</span>
              </div>
            </div>
          </div>

          {/* Printable Barcode Labels Section */}
          <div id="printable-barcodes" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="no-print flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <BarcodeIcon className="h-5 w-5 text-blue-600" />
                  Printable Barcode Stickers
                </h3>
                <p className="text-xs text-slate-500">
                  Ready to print for physical book spines and book covers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Sticker Sheet
              </button>
            </div>

            {/* Grid of Printable Labels */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {generatedAccessions.map((accession) => (
                <div
                  key={accession}
                  className="border-2 border-dashed border-slate-300 rounded-lg p-4 bg-white flex flex-col items-center justify-center text-center shadow-sm"
                  style={{ minHeight: "180px" }}
                >
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    <Library className="h-3 w-3 text-blue-600" />
                    <span>Washington School Philippines</span>
                  </div>

                  {savedBookInfo.callNumber && (
                    <div className="text-xs font-bold text-slate-800 font-mono mb-1">
                      {savedBookInfo.callNumber}
                    </div>
                  )}

                  {/* Barcode component */}
                  <div className="my-1">
                    <Barcode
                      value={accession}
                      width={1.6}
                      height={45}
                      fontSize={13}
                      margin={4}
                      displayValue={true}
                    />
                  </div>

                  <p className="text-[11px] text-slate-700 font-medium truncate max-w-[200px] mt-0.5">
                    {savedBookInfo.title}
                  </p>
                  {savedBookInfo.author && (
                    <p className="text-[10px] text-slate-500 truncate max-w-[200px]">
                      {savedBookInfo.author}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* VIEW 2: Cataloging Form */
        <div className="space-y-6">
          {/* SECTION 1: ISBN Lookup */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-600" />
              1. ISBN Lookup (Google Books)
            </h2>
            <p className="text-xs text-slate-500">
              Scan barcode with a handheld scanner or enter the 10/13-digit ISBN to automatically fetch book details.
            </p>

            <form onSubmit={handleFetchMetadata} className="flex flex-col sm:flex-row gap-3 pt-1">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="e.g. 9780132350884 or 0439708184"
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  disabled={isFetching || isSaving}
                />
              </div>
              <button
                type="submit"
                disabled={isFetching || isSaving}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50 shadow-sm"
              >
                {isFetching ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Fetch Metadata
                  </>
                )}
              </button>
            </form>

            {fetchError && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                <span>{fetchError} (You can still enter the details manually below)</span>
              </div>
            )}
          </div>

          {/* Form wrapper for Section 2 & 3 */}
          <form onSubmit={handleSaveBook} className="space-y-6">
            {/* SECTION 2: Review Form (Manual Fallback) */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <BookPlus className="h-5 w-5 text-blue-600" />
                  2. Review Book Metadata
                </h2>
                <span className="text-xs text-slate-400">
                  {fetchedData ? "Auto-filled from Google Books" : "Manual entry or review"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Book Cover Preview */}
                <div className="md:col-span-1 flex flex-col items-center justify-start p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <p className="text-xs font-semibold text-slate-500 mb-3">Cover Preview</p>
                  {coverUrl ? (
                    <div className="relative w-36 h-48 rounded shadow-md overflow-hidden border border-slate-200 bg-white">
                      <Image
                        src={coverUrl}
                        alt="Book cover preview"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-36 h-48 border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-slate-400 p-2">
                      <BookPlus className="h-10 w-10 text-slate-300 mb-2" />
                      <span className="text-xs">No cover image</span>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-3 text-center">
                    Image is referenced via Cover URL.
                  </p>
                </div>

                {/* Metadata Input Fields */}
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Title */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Harry Potter and the Sorcerer's Stone"
                      required
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Author */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Author(s)
                    </label>
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="e.g. J.K. Rowling"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Publisher */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Publisher
                    </label>
                    <input
                      type="text"
                      value={publisher}
                      onChange={(e) => setPublisher(e.target.value)}
                      placeholder="e.g. Scholastic"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Published Year */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Published Year
                    </label>
                    <input
                      type="text"
                      value={publishedYear}
                      onChange={(e) => setPublishedYear(e.target.value)}
                      placeholder="e.g. 1998"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Category / Genre */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Category / Genre
                    </label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g. Juvenile Fiction / Fantasy"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Call Number (with smart calculation) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Call Number
                      </label>
                      {category.toLowerCase().includes("fiction") && (
                        <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">
                          Auto: FIC + Author
                        </span>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={callNumber}
                        onChange={(e) => setCallNumber(e.target.value)}
                        placeholder="e.g. FIC ROW or 823.914"
                        className="w-full pl-3 pr-10 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateCallNumber}
                        title="Auto-generate Call Number"
                        className="absolute right-1.5 p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition"
                      >
                        <Sparkles className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Cover URL */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cover Image URL
                    </label>
                    <input
                      type="url"
                      value={coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: Number of Copies & Save */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <BarcodeIcon className="h-5 w-5 text-blue-600" />
                3. Physical Copies & Accession Allocation
              </h2>

              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                <div className="w-full sm:w-48">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Number of Copies <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3 py-2.5 text-sm font-semibold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Allocates sequential IDs (e.g. WSI-0001)
                  </p>
                </div>

                <div className="flex-1 w-full sm:w-auto">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50 shadow-sm"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Saving to Library...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Save to Library
                      </>
                    )}
                  </button>
                </div>
              </div>

              {saveError && (
                <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  <span>{saveError}</span>
                </div>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
