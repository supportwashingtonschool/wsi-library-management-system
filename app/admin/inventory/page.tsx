"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  Database,
  Search,
  BookOpen,
  Save,
  Trash2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Layers,
  BookMarked,
  Printer,
  Filter,
  Library,
  X,
  Inbox,
} from "lucide-react";
import {
  searchInventory,
  getUniqueCategories,
  updateMetadata,
  updatePhysicalCopy,
  deletePhysicalCopy,
  type InventoryBook,
  type InventoryPhysicalCopy,
} from "@/app/actions/inventoryActions";

// Dynamically import react-barcode to avoid SSR canvas/window mismatches
const Barcode = dynamic(() => import("react-barcode"), { ssr: false });

const STATUS_OPTIONS = ["Available", "Checked Out", "Lost", "Maintenance"];

interface BatchPrintItem {
  accessionNumber: string;
  callNumber?: string | null;
  title: string;
  author?: string | null;
  isbn: string;
}

export default function InventoryPage() {
  // Search & Filter State
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [books, setBooks] = useState<InventoryBook[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Selected Book State
  const [selectedBook, setSelectedBook] = useState<InventoryBook | null>(null);

  // Metadata Form State
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publishedYear, setPublishedYear] = useState("");
  const [category, setCategory] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [isUpdatingMeta, setIsUpdatingMeta] = useState(false);
  const [metaMessage, setMetaMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Physical Copies State
  const [copies, setCopies] = useState<InventoryPhysicalCopy[]>([]);
  const [savingAccession, setSavingAccession] = useState<string | null>(null);
  const [deletingAccession, setDeletingAccession] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<{
    accession: string;
    success: boolean;
    text: string;
  } | null>(null);

  // Batch Print Barcodes State
  const [batchPrintItems, setBatchPrintItems] = useState<BatchPrintItem[]>([]);
  const [isBatchPrintModalOpen, setIsBatchPrintModalOpen] = useState(false);

  // Perform search with optional category filter
  const handleSearch = useCallback(
    async (searchQuery: string, categoryFilter: string = selectedCategory) => {
      const cleanQuery = searchQuery.trim();
      const cleanCategory = categoryFilter.trim();

      // If BOTH the search query and the category filter are empty strings (""),
      // do not trigger the database fetch. Instead, set the results array to empty [].
      if (!cleanQuery && !cleanCategory) {
        setBooks([]);
        setSelectedBook(null);
        setIsSearching(false);
        setSearchError(null);
        return;
      }

      setIsSearching(true);
      setSearchError(null);

      const result = await searchInventory(cleanQuery, cleanCategory);
      setIsSearching(false);

      if (!result.success) {
        setSearchError(result.error || "Failed to search inventory.");
        return;
      }

      setBooks(result.books);

      // If current selected book exists in refreshed results, keep it updated
      if (selectedBook) {
        const refreshed = result.books.find((b) => b.isbn === selectedBook.isbn);
        if (refreshed) {
          setSelectedBook(refreshed);
          setCopies(refreshed.Physical_Books);
        } else {
          setSelectedBook(null);
        }
      }
    },
    [selectedCategory, selectedBook]
  );

  // Initial load: fetch unique categories only (do NOT auto-fetch all books)
  useEffect(() => {
    async function init() {
      const cats = await getUniqueCategories();
      setCategories(cats);
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When a book is selected, populate form fields
  const handleSelectBook = (book: InventoryBook) => {
    setSelectedBook(book);
    setTitle(book.title || "");
    setAuthor(book.author || "");
    setPublisher(book.publisher || "");
    setPublishedYear(book.published_year || "");
    setCategory(book.category || "");
    setCoverUrl(book.cover_url || "");
    setCopies([...(book.Physical_Books || [])]);
    setMetaMessage(null);
    setCopyFeedback(null);
  };

  // Submit search form
  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query, selectedCategory);
  };

  // Category filter changed
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCategory = e.target.value;
    setSelectedCategory(newCategory);
    handleSearch(query, newCategory);
  };

  // Total physical copies in currently filtered list
  const totalCopiesCount = books.reduce(
    (sum, b) => sum + (b.Physical_Books?.length || 0),
    0
  );

  // Trigger Batch Print Barcodes
  const handleBatchPrint = () => {
    const items: BatchPrintItem[] = [];
    books.forEach((book) => {
      (book.Physical_Books || []).forEach((copy) => {
        items.push({
          accessionNumber: copy.accession_number,
          callNumber: copy.call_number,
          title: book.title,
          author: book.author,
          isbn: book.isbn,
        });
      });
    });

    if (items.length === 0) {
      alert("No physical copies found in the current filter to print.");
      return;
    }

    setBatchPrintItems(items);
    setIsBatchPrintModalOpen(true);

    // Immediately trigger window.print() once the print view renders
    setTimeout(() => {
      window.print();
    }, 350);
  };

  // Handle Metadata Update
  const handleUpdateMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook) return;

    setIsUpdatingMeta(true);
    setMetaMessage(null);

    const result = await updateMetadata(selectedBook.isbn, {
      title,
      author,
      publisher,
      published_year: publishedYear,
      category,
      cover_url: coverUrl,
    });

    setIsUpdatingMeta(false);

    if (!result.success) {
      setMetaMessage({
        type: "error",
        text: result.error || "Failed to update metadata.",
      });
    } else {
      setMetaMessage({
        type: "success",
        text: "Bibliographic metadata updated successfully across the library!",
      });

      // Update local state in book list
      const updatedBook: InventoryBook = {
        ...selectedBook,
        title,
        author,
        publisher,
        published_year: publishedYear,
        category,
        cover_url: coverUrl,
        Physical_Books: copies,
      };
      setSelectedBook(updatedBook);
      setBooks((prev) =>
        prev.map((b) => (b.isbn === updatedBook.isbn ? updatedBook : b))
      );

      // Refresh categories list if category changed
      getUniqueCategories().then(setCategories);
    }
  };

  // Handle local change for a copy's row
  const handleCopyChange = (
    accession: string,
    field: "call_number" | "status",
    val: string
  ) => {
    setCopies((prev) =>
      prev.map((c) =>
        c.accession_number === accession ? { ...c, [field]: val } : c
      )
    );
  };

  // Save changes to a specific physical copy
  const handleSaveCopy = async (copy: InventoryPhysicalCopy) => {
    setSavingAccession(copy.accession_number);
    setCopyFeedback(null);

    const result = await updatePhysicalCopy(
      copy.accession_number,
      copy.call_number || "",
      copy.status
    );

    setSavingAccession(null);

    if (!result.success) {
      setCopyFeedback({
        accession: copy.accession_number,
        success: false,
        text: result.error || "Failed to update physical copy.",
      });
    } else {
      setCopyFeedback({
        accession: copy.accession_number,
        success: true,
        text: `Copy ${copy.accession_number} saved.`,
      });

      // Update parent book's physical copies
      if (selectedBook) {
        const updatedList = copies.map((c) =>
          c.accession_number === copy.accession_number ? copy : c
        );
        setSelectedBook({
          ...selectedBook,
          Physical_Books: updatedList,
        });
        setBooks((prev) =>
          prev.map((b) =>
            b.isbn === selectedBook.isbn
              ? { ...b, Physical_Books: updatedList }
              : b
          )
        );
      }
    }
  };

  // Delete a physical copy
  const handleDeleteCopy = async (accession: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete physical copy "${accession}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingAccession(accession);
    setCopyFeedback(null);

    const result = await deletePhysicalCopy(accession);
    setDeletingAccession(null);

    if (!result.success) {
      setCopyFeedback({
        accession,
        success: false,
        text: result.error || "Failed to delete copy.",
      });
    } else {
      // Remove copy from state
      const updatedList = copies.filter((c) => c.accession_number !== accession);
      setCopies(updatedList);
      if (selectedBook) {
        setSelectedBook({
          ...selectedBook,
          Physical_Books: updatedList,
        });
        setBooks((prev) =>
          prev.map((b) =>
            b.isbn === selectedBook.isbn
              ? { ...b, Physical_Books: updatedList }
              : b
          )
        );
      }
      setCopyFeedback({
        accession,
        success: true,
        text: `Copy ${accession} successfully deleted from inventory.`,
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Printable CSS style rules */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #batch-printable-barcodes,
          #batch-printable-barcodes * {
            visibility: visible;
          }
          #batch-printable-barcodes {
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

      {/* Screen Header & Batch Print Button */}
      <div className="no-print flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Database className="h-7 w-7 text-blue-600" />
            <span>Inventory Management</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Search the catalog, filter by genre, modify metadata, and batch print barcode stickers.
          </p>
        </div>

        {/* Batch Print Barcodes Button */}
        <div>
          <button
            type="button"
            onClick={handleBatchPrint}
            disabled={totalCopiesCount === 0 || isSearching}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition shadow-md shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              totalCopiesCount === 0
                ? "No physical copies in current filter"
                : "Batch print barcode labels for filtered physical books"
            }
          >
            <Printer className="h-4 w-4" />
            <span>
              {selectedCategory && selectedCategory !== "all"
                ? `Print Barcodes for ${selectedCategory}`
                : "Batch Print Barcodes"}
            </span>
            <span className="bg-indigo-500/60 px-2 py-0.5 rounded-full text-xs font-mono font-bold">
              {totalCopiesCount}
            </span>
          </button>
        </div>
      </div>

      {/* SECTION 1: Search & Category Filter Bar */}
      <div className="no-print bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <form
          onSubmit={onSearchSubmit}
          className="flex flex-col sm:flex-row gap-3"
        >
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="h-5 w-5 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                const val = e.target.value;
                setQuery(val);
                if (!val.trim() && !selectedCategory) {
                  setBooks([]);
                  setSelectedBook(null);
                }
              }}
              placeholder="Search by title, author, category, or ISBN..."
              className="w-full pl-11 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter by Category Dropdown */}
          <div className="relative sm:w-64">
            <div className="absolute left-3.5 top-3 text-slate-400 pointer-events-none">
              <Filter className="h-4 w-4" />
            </div>
            <select
              value={selectedCategory}
              onChange={handleCategoryChange}
              className="w-full pl-10 pr-8 py-2.5 text-sm border border-slate-300 rounded-xl bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a Category...</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Search Button */}
          <button
            type="submit"
            disabled={isSearching}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 shadow-sm"
          >
            {isSearching ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                <span>Search</span>
              </>
            )}
          </button>
        </form>

        {searchError && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}
      </div>

      {/* SECTION 2: Content Area (Empty State or Results & Editor) */}
      {books.length === 0 ? (
        /* Empty State */
        <div className="no-print bg-white border border-slate-200 rounded-2xl p-12 sm:p-16 text-center space-y-4 shadow-sm">
          <div className="p-4 bg-slate-100 rounded-full w-16 h-16 mx-auto flex items-center justify-center text-slate-400">
            <Inbox className="h-8 w-8 text-slate-400" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-slate-800">
              Inventory Ready
            </h3>
            <p className="text-sm text-slate-500">
              Search for a book or select a category to begin managing inventory.
            </p>
          </div>
        </div>
      ) : (
        /* When books.length > 0 */
        <div className="no-print space-y-8">
          {/* Results Grid Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Matching Titles ({books.length})
                {selectedCategory && (
                  <span className="text-blue-600 ml-1.5 font-semibold">
                    in &quot;{selectedCategory}&quot;
                  </span>
                )}
              </span>
              {selectedBook && (
                <span className="text-xs text-blue-600 font-medium truncate max-w-xs">
                  Active: <strong>{selectedBook.title}</strong>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-1">
              {books.map((book) => {
                const isSelected = selectedBook?.isbn === book.isbn;
                const copyCount = book.Physical_Books?.length || 0;

                return (
                  <button
                    key={book.isbn}
                    type="button"
                    onClick={() => handleSelectBook(book)}
                    className={`flex items-start gap-3 p-3 rounded-xl text-left border transition ${
                      isSelected
                        ? "bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-sm"
                        : "bg-slate-50/70 hover:bg-slate-100 border-slate-200"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-10 h-14 bg-slate-200 rounded shrink-0 overflow-hidden border border-slate-300">
                      {book.cover_url ? (
                        <Image
                          src={book.cover_url}
                          alt=""
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <BookOpen className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    {/* Book Info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {book.title}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {book.author}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          ISBN: {book.isbn}
                        </span>
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded">
                          {copyCount} {copyCount === 1 ? "Copy" : "Copies"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* If no book is selected yet, prompt to pick one */}
          {!selectedBook ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3 shadow-sm">
              <BookMarked className="h-9 w-9 mx-auto text-slate-300" />
              <h2 className="text-sm font-bold text-slate-700">No Book Selected</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Choose a title from the matching results above to inspect and edit its bibliographic metadata and physical holdings.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
          {/* SECTION 2: Metadata Edit Form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  <span>Edit Bibliographic Metadata</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Modifying this metadata updates the universal concept of this book title across all library records.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
                ISBN: {selectedBook.isbn}
              </span>
            </div>

            {metaMessage && (
              <div
                className={`p-4 rounded-xl flex items-center gap-2.5 text-xs font-semibold ${
                  metaMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {metaMessage.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                )}
                <span>{metaMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleUpdateMetadata} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Cover Preview Column */}
                <div className="md:col-span-1 flex flex-col items-center justify-start p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <p className="text-xs font-semibold text-slate-500 mb-3">Cover Preview</p>
                  {coverUrl ? (
                    <div className="relative w-32 h-44 rounded-lg shadow-md overflow-hidden border border-slate-200 bg-white">
                      <Image
                        src={coverUrl}
                        alt="Book cover preview"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-44 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 p-2">
                      <BookOpen className="h-8 w-8 text-slate-300 mb-1" />
                      <span className="text-[11px]">No cover URL</span>
                    </div>
                  )}
                  <span className="text-[10px] text-slate-400 mt-2">
                    Enter valid image URL to refresh preview
                  </span>
                </div>

                {/* Form Fields */}
                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Title */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Author */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Author(s) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      required
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
                      placeholder="e.g. 2024"
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
                      placeholder="e.g. Fiction, History"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Cover URL */}
                  <div>
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

              {/* Submit Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingMeta}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 shadow-sm"
                >
                  {isUpdatingMeta ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Updating Metadata...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Update Metadata</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* SECTION 3: Physical Copies Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-blue-600" />
                  <span>Physical Copies & Holdings</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage individual physical barcodes, shelf call numbers, and copy statuses.
                </p>
              </div>

              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 self-start sm:self-auto">
                {copies.length} {copies.length === 1 ? "Copy" : "Copies"} Registered
              </span>
            </div>

            {copyFeedback && (
              <div
                className={`p-3 rounded-xl flex items-center gap-2 text-xs font-semibold ${
                  copyFeedback.success
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {copyFeedback.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                )}
                <span>{copyFeedback.text}</span>
              </div>
            )}

            {copies.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No physical copies are currently attached to this ISBN.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Accession Number</th>
                      <th className="py-3 px-4">Call Number</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {copies.map((copy) => {
                      const isSaving = savingAccession === copy.accession_number;
                      const isDeleting = deletingAccession === copy.accession_number;

                      return (
                        <tr
                          key={copy.accession_number}
                          className="hover:bg-slate-50/80 transition"
                        >
                          {/* Accession Number */}
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {copy.accession_number}
                          </td>

                          {/* Editable Call Number */}
                          <td className="py-3.5 px-4">
                            <input
                              type="text"
                              value={copy.call_number || ""}
                              onChange={(e) =>
                                handleCopyChange(
                                  copy.accession_number,
                                  "call_number",
                                  e.target.value
                                )
                              }
                              placeholder="e.g. FIC ROW"
                              className="w-full max-w-[200px] px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>

                          {/* Editable Status */}
                          <td className="py-3.5 px-4">
                            <select
                              value={copy.status}
                              onChange={(e) =>
                                handleCopyChange(
                                  copy.accession_number,
                                  "status",
                                  e.target.value
                                )
                              }
                              className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {STATUS_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {/* Save Button */}
                              <button
                                type="button"
                                onClick={() => handleSaveCopy(copy)}
                                disabled={isSaving || isDeleting}
                                title="Save copy changes"
                                className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition disabled:opacity-50"
                              >
                                {isSaving ? (
                                  <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteCopy(copy.accession_number)}
                                disabled={isSaving || isDeleting}
                                title="Delete this physical copy"
                                className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                              >
                                {isDeleting ? (
                                  <RefreshCw className="h-4 w-4 animate-spin text-rose-500" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )}

      {/* BATCH PRINT MODAL (On-Screen Preview) */}
      {isBatchPrintModalOpen && batchPrintItems.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Printer className="h-5 w-5 text-indigo-600" />
                  <span>Batch Barcode Sticker Sheet</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {batchPrintItems.length} {batchPrintItems.length === 1 ? "label" : "labels"} generated
                  {selectedCategory ? ` for category "${selectedCategory}"` : " for filtered items"}.
                  Standard 3-column sticker layout.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl transition shadow-sm"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchPrintModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: On-Screen Grid Preview */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {batchPrintItems.map((item) => (
                  <div
                    key={item.accessionNumber}
                    className="border-2 border-dashed border-slate-300 rounded-xl p-3 bg-white flex flex-col items-center justify-center text-center shadow-sm"
                  >
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">
                      <Library className="h-3 w-3 text-blue-600" />
                      <span>Washington School Philippines</span>
                    </div>

                    {item.callNumber && (
                      <div className="text-xs font-bold text-slate-800 font-mono mb-0.5">
                        {item.callNumber}
                      </div>
                    )}

                    <div className="my-1">
                      <Barcode
                        value={item.accessionNumber}
                        width={1.4}
                        height={40}
                        fontSize={12}
                        margin={2}
                        displayValue={true}
                      />
                    </div>

                    <p className="text-[11px] text-slate-800 font-medium truncate max-w-[200px] mt-0.5">
                      {item.title}
                    </p>
                    {item.author && (
                      <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                        {item.author}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT-ONLY VIEW: Clean Sticker Sheet for window.print() */}
      {batchPrintItems.length > 0 && (
        <div id="batch-printable-barcodes" className="hidden print:block">
          <div className="grid grid-cols-3 gap-4 p-4">
            {batchPrintItems.map((item) => (
              <div
                key={item.accessionNumber}
                className="border border-slate-400 rounded-lg p-3 bg-white flex flex-col items-center justify-center text-center shadow-none break-inside-avoid"
                style={{ minHeight: "175px" }}
              >
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-800 uppercase tracking-wider mb-0.5">
                  <span>Washington School Philippines</span>
                </div>

                {item.callNumber && (
                  <div className="text-xs font-bold text-slate-900 font-mono mb-0.5">
                    {item.callNumber}
                  </div>
                )}

                <div className="my-1">
                  <Barcode
                    value={item.accessionNumber}
                    width={1.5}
                    height={42}
                    fontSize={12}
                    margin={2}
                    displayValue={true}
                  />
                </div>

                <p className="text-[11px] text-slate-900 font-semibold truncate max-w-[210px] mt-0.5">
                  {item.title}
                </p>
                {item.author && (
                  <p className="text-[10px] text-slate-600 truncate max-w-[210px]">
                    {item.author}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
