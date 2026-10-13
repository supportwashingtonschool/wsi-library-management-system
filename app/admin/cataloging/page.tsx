"use client";

import { useState, useEffect, useRef } from "react";
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
  AlertTriangle,
  Check,
  ShieldCheck,
} from "lucide-react";
import {
  fetchBookFromGoogle,
  saveBook,
  type BookMetadata,
} from "@/app/actions/bookActions";
import {
  parseExcelFile,
  confirmBulkImport,
  type ParsedBookRow,
  type ConfirmImportResult,
} from "@/app/actions/importActions";

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

  // Section 5: Safe Bulk Excel Import State
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedBooks, setParsedBooks] = useState<ParsedBookRow[] | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<ConfirmImportResult | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle parsing the uploaded Excel file (previews data before DB insert)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsParsing(true);
    setParseError(null);
    setConfirmError(null);
    setConfirmSuccess(null);
    setParsedBooks(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await parseExcelFile(formData);
      setIsParsing(false);

      if (!result.success || !result.books) {
        setParseError(result.error || "Failed to parse the Excel file.");
      } else {
        setParsedBooks(result.books);
        // Default checkboxes: checked if NOT a duplicate
        const initialSelected = new Set<string>();
        result.books.forEach((b) => {
          if (!b.isDuplicate) {
            initialSelected.add(b.id);
          }
        });
        setSelectedRowIds(initialSelected);
      }
    } catch (err: unknown) {
      setIsParsing(false);
      setParseError(err instanceof Error ? err.message : "An unexpected error occurred while parsing.");
    }
  };

  // Toggle single row selection
  const handleToggleRow = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select / Deselect all rows
  const handleSelectAll = (checked: boolean) => {
    if (!parsedBooks) return;
    if (checked) {
      setSelectedRowIds(new Set(parsedBooks.map((b) => b.id)));
    } else {
      setSelectedRowIds(new Set());
    }
  };

  // Select only new books (skip duplicates)
  const handleSelectNewOnly = () => {
    if (!parsedBooks) return;
    setSelectedRowIds(new Set(parsedBooks.filter((b) => !b.isDuplicate).map((b) => b.id)));
  };

  // Confirm & Import Selected Books into Database
  const handleConfirmImport = async () => {
    if (!parsedBooks) return;
    const selectedBooks = parsedBooks.filter((b) => selectedRowIds.has(b.id));

    if (selectedBooks.length === 0) {
      setConfirmError("No books are selected. Please check at least one book to import.");
      return;
    }

    setIsConfirming(true);
    setConfirmError(null);
    setConfirmSuccess(null);

    try {
      const payload = selectedBooks.map((b) => ({
        title: b.title,
        author: b.author,
        publisher: b.publisher,
        category: b.category,
        isbn: b.isbn,
        call_number: b.call_number,
        published_year: b.published_year,
      }));

      const result = await confirmBulkImport(payload);
      setIsConfirming(false);

      if (!result.success) {
        setConfirmError(result.error || "Failed to import books into the database.");
      } else {
        setConfirmSuccess(result);
        setParsedBooks(null);
        setSelectedRowIds(new Set());
        setUploadedFileName("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } catch (err: unknown) {
      setIsConfirming(false);
      setConfirmError(err instanceof Error ? err.message : "An unexpected error occurred during import.");
    }
  };

  // Cancel / Reset the preview
  const handleCancelPreview = () => {
    setParsedBooks(null);
    setSelectedRowIds(new Set());
    setParseError(null);
    setConfirmError(null);
    setUploadedFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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

          {/* SECTION 4: Safe Bulk Import Legacy Catalog Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <span>Safe Bulk Import from Excel</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Preview spreadsheet records and detect duplicates against your database before saving.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit">
                Pre-import Verification
              </span>
            </div>

            {/* Step 1: File Upload (when no preview is active) */}
            {!parsedBooks && (
              <div className="space-y-4">
                {/* Column Guide & Formatting Tips */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-600 space-y-2">
                  <p className="font-semibold text-slate-700">Supported Excel Columns (Row 1 headers of Sheet 1):</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] font-bold text-slate-900 shadow-2xs">
                      Title <span className="text-rose-500">*</span>
                    </span>
                    <span className="font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] text-slate-700 shadow-2xs">
                      Author
                    </span>
                    <span className="font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] text-slate-700 shadow-2xs">
                      Publisher
                    </span>
                    <span className="font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] text-slate-700 shadow-2xs">
                      Category
                    </span>
                    <span className="font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] text-slate-700 shadow-2xs">
                      ISBN
                    </span>
                  </div>
                  <ul className="text-[11px] text-slate-500 list-disc list-inside space-y-0.5 pt-0.5">
                    <li>Missing titles will be skipped automatically.</li>
                    <li>Items without an ISBN will be assigned an automated pseudo-ISBN (<code className="font-mono text-slate-700">WSI-CUSTOM-...</code>).</li>
                    <li>Titles and ISBNs matching existing library records will be flagged as duplicates.</li>
                  </ul>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Select Excel File (.xlsx) to Preview
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={handleFileChange}
                      disabled={isParsing}
                      className="flex-1 text-xs text-slate-600 file:mr-3 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer border border-slate-300 rounded-lg p-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Parsing Spinner */}
                {isParsing && (
                  <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 animate-pulse">
                    <RefreshCw className="h-5 w-5 animate-spin text-blue-600 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">
                        Parsing Excel sheet and checking library catalog for duplicates...
                      </p>
                      <p className="text-[11px] text-blue-700 mt-0.5">
                        Please wait a moment while we scan your records.
                      </p>
                    </div>
                  </div>
                )}

                {/* Parse Error Banner */}
                {parseError && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-semibold">Parse Error: </span>
                      <span>{parseError}</span>
                    </div>
                  </div>
                )}

                {/* Confirm Success Banner */}
                {confirmSuccess && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <span className="text-sm font-bold">
                        Import Completed Successfully!
                      </span>
                    </div>
                    <div className="text-xs text-emerald-800 pl-7 space-y-1">
                      <p>
                        Successfully inserted <strong>{confirmSuccess.count} physical copies</strong> into the library catalog.
                      </p>
                      {confirmSuccess.startAccession && confirmSuccess.endAccession && (
                        <p className="text-[11px] font-mono text-emerald-700">
                          Allocated Accession Range: <span className="font-bold">{confirmSuccess.startAccession}</span> to <span className="font-bold">{confirmSuccess.endAccession}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Interactive Preview Table (when books have been parsed) */}
            {parsedBooks && (
              <div className="space-y-4">
                {/* Stats & Batch Controls Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium text-slate-700">
                      File: <strong>{uploadedFileName || "Spreadsheet"}</strong>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-800 font-semibold">
                      Total: {parsedBooks.length}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded font-semibold">
                      New: {parsedBooks.filter((b) => !b.isDuplicate).length}
                    </span>
                    {parsedBooks.some((b) => b.isDuplicate) && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded font-semibold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-600" />
                        Duplicates: {parsedBooks.filter((b) => b.isDuplicate).length}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 rounded font-bold">
                      Selected: {selectedRowIds.size}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleSelectNewOnly}
                      className="px-2.5 py-1 text-slate-700 hover:text-emerald-700 bg-white hover:bg-emerald-50 border border-slate-200 rounded-md font-medium transition cursor-pointer"
                    >
                      Select New Only
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectAll(true)}
                      className="px-2.5 py-1 text-slate-700 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-200 rounded-md font-medium transition cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectAll(false)}
                      className="px-2.5 py-1 text-slate-700 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 rounded-md font-medium transition cursor-pointer"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelPreview}
                      disabled={isConfirming}
                      className="px-2.5 py-1 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-md font-medium transition cursor-pointer"
                      title="Cancel preview and upload a different file"
                    >
                      Change File
                    </button>
                  </div>
                </div>

                {/* Preview Table */}
                <div className="max-h-[460px] overflow-y-auto overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                  <table className="w-full text-left text-xs text-slate-700 border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10 shadow-xs border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold text-[11px]">
                      <tr>
                        <th className="px-3.5 py-3 bg-slate-100 border-b border-slate-200 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              parsedBooks.length > 0 &&
                              selectedRowIds.size === parsedBooks.length
                            }
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                            title="Select / Deselect all rows"
                          />
                        </th>
                        <th className="px-3 py-3 bg-slate-100 border-b border-slate-200 w-28">Status</th>
                        <th className="px-3 py-3 bg-slate-100 border-b border-slate-200">Title</th>
                        <th className="px-3 py-3 bg-slate-100 border-b border-slate-200">Author</th>
                        <th className="px-3 py-3 bg-slate-100 border-b border-slate-200">ISBN</th>
                        <th className="px-3 py-3 bg-slate-100 border-b border-slate-200">Category</th>
                        <th className="px-3 py-3 bg-slate-100 border-b border-slate-200">Publisher</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedBooks.map((book) => {
                        const isSelected = selectedRowIds.has(book.id);
                        return (
                          <tr
                            key={book.id}
                            className={`transition cursor-pointer ${
                              book.isDuplicate
                                ? "bg-amber-50/70 hover:bg-amber-100/70 border-l-4 border-l-amber-500"
                                : isSelected
                                ? "bg-blue-50/30 hover:bg-blue-50/60"
                                : "hover:bg-slate-50"
                            }`}
                            onClick={() => handleToggleRow(book.id)}
                          >
                            <td
                              className="px-3.5 py-2.5 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleRow(book.id)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                              />
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {book.isDuplicate ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                                    Duplicate
                                  </span>
                                  {book.duplicateReason && (
                                    <p className="text-[10px] text-amber-700 font-medium truncate max-w-[140px]">
                                      {book.duplicateReason}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  <Check className="h-3 w-3 text-emerald-600" />
                                  Ready
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-slate-900 max-w-[240px]">
                              <p className="truncate" title={book.title}>
                                {book.title}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 text-slate-600 max-w-[180px]">
                              <p className="truncate" title={book.author}>
                                {book.author || "—"}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px]">
                              {book.isbn ? (
                                <span className="text-slate-700">{book.isbn}</span>
                              ) : (
                                <span className="text-[10px] italic text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                  Will auto-generate
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600 max-w-[140px]">
                              <p className="truncate" title={book.category}>
                                {book.category || "—"}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 text-slate-600 max-w-[140px]">
                              <p className="truncate" title={book.publisher}>
                                {book.publisher || "—"}
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Confirm Error Banner */}
                {confirmError && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-semibold">Import Error: </span>
                      <span>{confirmError}</span>
                    </div>
                  </div>
                )}

                {/* Bottom Action Footer */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-600">
                    <strong>{selectedRowIds.size}</strong> of {parsedBooks.length} book(s) selected for import.
                    {selectedRowIds.size > 0 && (
                      <span className="text-slate-400 ml-1">
                        (Sequential accession numbers will be allocated automatically)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCancelPreview}
                      disabled={isConfirming}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      disabled={selectedRowIds.size === 0 || isConfirming}
                      className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 shadow-sm cursor-pointer whitespace-nowrap"
                    >
                      {isConfirming ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Importing {selectedRowIds.size} Book(s)...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4" />
                          <span>Confirm &amp; Import Selected ({selectedRowIds.size})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
