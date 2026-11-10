"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Newspaper,
  Upload,
  BookOpen,
  Star,
  Pencil,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  X,
  FileText,
  Sparkles,
  Database,
  Copy,
  Check,
} from "lucide-react";
import {
  getNewsletters,
  createNewsletter,
  updateNewsletter,
  setFeaturedNewsletter,
  deleteNewsletter,
  type Newsletter,
} from "@/app/actions/newsletterActions";
import { extractPdfMetadataAndCover } from "@/lib/pdfUtils";

export default function AdminNewslettersPage() {
  // Form State
  const [title, setTitle] = useState("");
  const [issueLabel, setIssueLabel] = useState("");
  const [description, setDescription] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number>(1);
  const [isAnalyzingPdf, setIsAnalyzingPdf] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Newsletters List State
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [featuringId, setFeaturingId] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const MIGRATION_SQL = `-- 6. Newsletters Table & 'newsletters' Storage Bucket Configuration
CREATE TABLE IF NOT EXISTS "Newsletters" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    issue_label TEXT NOT NULL,
    description TEXT,
    pdf_url TEXT NOT NULL,
    cover_url TEXT,
    page_count INTEGER NOT NULL DEFAULT 1,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_newsletters_featured ON "Newsletters"(is_featured);
CREATE INDEX IF NOT EXISTS idx_newsletters_published_at ON "Newsletters"(published_at DESC);

ALTER TABLE "Newsletters" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public all access on Newsletters"
    ON "Newsletters" FOR ALL USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('newsletters', 'newsletters', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow public read on newsletters bucket"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'newsletters');

CREATE POLICY "Allow public insert on newsletters bucket"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'newsletters');

CREATE POLICY "Allow public delete on newsletters bucket"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'newsletters');`;

  const copySqlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(MIGRATION_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    } catch (err) {
      console.warn("Could not copy SQL:", err);
    }
  };

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<Newsletter | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editIssueLabel, setEditIssueLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsFeatured, setEditIsFeatured] = useState(false);
  const [editPdfFile, setEditPdfFile] = useState<File | null>(null);
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [editPageCount, setEditPageCount] = useState<number>(1);
  const [isEditAnalyzing, setIsEditAnalyzing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const editPdfInputRef = useRef<HTMLInputElement>(null);

  // Fetch all newsletters
  const loadNewsletters = useCallback(async () => {
    setIsLoadingList(true);
    const res = await getNewsletters();
    setIsLoadingList(false);
    if (res.success) {
      setNewsletters(res.newsletters);
      // Auto-check "Feature as Latest Issue" if this will be the first newsletter
      if (res.newsletters.length === 0) {
        setIsFeatured(true);
      }
    } else {
      setActionError(res.error || "Failed to load newsletters.");
    }
  }, []);

  useEffect(() => {
    loadNewsletters();
  }, [loadNewsletters]);

  // Handle PDF file selection for new newsletter
  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setFormError("Please select a valid PDF file exported from Microsoft Publisher.");
      return;
    }

    setFormError(null);
    setIsAnalyzingPdf(true);
    setPdfFile(file);

    // Auto-suggest title from filename if title is currently empty
    if (!title.trim()) {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]/g, " ")
        .trim();
      setTitle(cleanName);
    }

    try {
      const info = await extractPdfMetadataAndCover(file);
      setCoverFile(info.coverFile);
      setCoverPreview(info.coverPreviewUrl);
      setPageCount(info.pageCount);
    } catch (err: unknown) {
      console.error("PDF analysis error:", err);
      const msg = err instanceof Error ? err.message : "Failed to extract PDF cover.";
      setFormError(`Notice: ${msg}. You can still publish, but the cover thumbnail could not be generated.`);
      setCoverFile(null);
      setCoverPreview(null);
      setPageCount(1);
    } finally {
      setIsAnalyzingPdf(false);
    }
  };

  // Handle PDF change inside Edit Modal
  const handleEditPdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setEditError("Please select a valid PDF file.");
      return;
    }

    setEditError(null);
    setIsEditAnalyzing(true);
    setEditPdfFile(file);

    try {
      const info = await extractPdfMetadataAndCover(file);
      setEditCoverFile(info.coverFile);
      setEditCoverPreview(info.coverPreviewUrl);
      setEditPageCount(info.pageCount);
    } catch (err: unknown) {
      console.error("PDF analysis error in edit modal:", err);
      const msg = err instanceof Error ? err.message : "Failed to extract PDF cover.";
      setEditError(`Notice: ${msg}`);
    } finally {
      setIsEditAnalyzing(false);
    }
  };

  // Submit publish form
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!title.trim()) {
      setFormError("Newsletter Title is required.");
      return;
    }
    if (!issueLabel.trim()) {
      setFormError("Issue / Period Label is required (e.g. 'October 2026' or 'Vol. 1').");
      return;
    }
    if (!pdfFile) {
      setFormError("Please select a PDF newsletter file to upload.");
      return;
    }

    setIsPublishing(true);

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("issue_label", issueLabel.trim());
      formData.append("description", description.trim());
      formData.append("page_count", String(pageCount));
      formData.append("is_featured", isFeatured ? "true" : "false");
      formData.append("pdf", pdfFile);
      if (coverFile) {
        formData.append("cover", coverFile);
      }

      const res = await createNewsletter(formData);

      if (!res.success) {
        setFormError(res.error || "Failed to publish newsletter.");
        setIsPublishing(false);
        return;
      }

      setFormSuccess(`"${title}" published successfully!`);
      // Reset form
      setTitle("");
      setIssueLabel("");
      setDescription("");
      setPdfFile(null);
      setCoverFile(null);
      setCoverPreview(null);
      setPageCount(1);
      if (pdfInputRef.current) {
        pdfInputRef.current.value = "";
      }

      await loadNewsletters();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setFormError(msg);
    } finally {
      setIsPublishing(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (item: Newsletter) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditIssueLabel(item.issue_label);
    setEditDescription(item.description || "");
    setEditIsFeatured(item.is_featured);
    setEditPdfFile(null);
    setEditCoverFile(null);
    setEditCoverPreview(item.cover_url);
    setEditPageCount(item.page_count);
    setEditError(null);
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editTitle.trim()) {
      setEditError("Newsletter title is required.");
      return;
    }
    if (!editIssueLabel.trim()) {
      setEditError("Issue label is required.");
      return;
    }

    setIsUpdating(true);
    setEditError(null);

    try {
      const formData = new FormData();
      formData.append("title", editTitle.trim());
      formData.append("issue_label", editIssueLabel.trim());
      formData.append("description", editDescription.trim());
      formData.append("page_count", String(editPageCount));
      formData.append("is_featured", editIsFeatured ? "true" : "false");

      if (editPdfFile) {
        formData.append("pdf", editPdfFile);
      }
      if (editCoverFile) {
        formData.append("cover", editCoverFile);
      }

      const res = await updateNewsletter(editingItem.id, formData);
      if (!res.success) {
        setEditError(res.error || "Failed to update newsletter.");
        setIsUpdating(false);
        return;
      }

      setEditingItem(null);
      setActionSuccess("Newsletter updated successfully.");
      await loadNewsletters();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update newsletter.";
      setEditError(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  // Set Featured
  const handleSetFeatured = async (item: Newsletter) => {
    if (item.is_featured) return;
    setFeaturingId(item.id);
    setActionError(null);
    setActionSuccess(null);

    const res = await setFeaturedNewsletter(item.id);
    setFeaturingId(null);
    if (res.success) {
      setActionSuccess(`"${item.title}" is now set as the Featured Latest Issue!`);
      await loadNewsletters();
    } else {
      setActionError(res.error || "Failed to set featured newsletter.");
    }
  };

  // Delete Newsletter
  const handleDelete = async (item: Newsletter) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${item.title}" (${item.issue_label})? This will permanently remove its PDF and flipbook from the library.`
    );
    if (!confirmed) return;

    setDeletingId(item.id);
    setActionError(null);
    setActionSuccess(null);

    const res = await deleteNewsletter(item.id);
    setDeletingId(null);
    if (res.success) {
      setActionSuccess(`Deleted "${item.title}".`);
      await loadNewsletters();
    } else {
      setActionError(res.error || "Failed to delete newsletter.");
    }
  };

  // Filtered newsletters
  const filteredNewsletters = newsletters.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.issue_label.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Newspaper className="h-7 w-7 text-blue-600" />
            School Newsletters
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Publish Microsoft Publisher PDFs as interactive 2-page 3D flipbooks for the public OPAC.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/newsletters"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3.5 py-2 rounded-lg transition shadow-sm"
          >
            <BookOpen className="h-4 w-4" />
            <span>Open Public Flipbook</span>
            <ExternalLink className="h-3 w-3 opacity-60 ml-0.5" />
          </Link>
        </div>
      </div>

      {/* Action feedback banners */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {actionError && (
        actionError.includes("TABLE_NOT_FOUND") || actionError.includes("public.Newsletters") ? (
          <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs sm:text-sm space-y-3 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Database className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-amber-950 text-sm sm:text-base">
                    One-Time Supabase Database Setup Required
                  </h3>
                  <p className="text-xs text-amber-800 mt-1">
                    The <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">Newsletters</code> table and storage bucket have not been created in your Supabase project yet. Simply copy the SQL snippet below and execute it once in your Supabase SQL Editor.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="text-amber-700 hover:text-amber-900 p-1 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={copySqlToClipboard}
                className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition shadow-xs"
              >
                {copiedSql ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-amber-200" />
                    <span>Copied Migration SQL!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Migration SQL</span>
                  </>
                )}
              </button>

              <a
                href="https://supabase.com/dashboard/project/thmurdlolmzlyqyfhpom/sql/new"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:text-amber-950 bg-amber-200/60 hover:bg-amber-200 px-3.5 py-2 rounded-lg transition border border-amber-300"
              >
                <span>Open Supabase SQL Editor</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>

              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  loadNewsletters();
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-950 bg-white hover:bg-amber-100/50 px-3.5 py-2 rounded-lg transition border border-amber-200 ml-auto"
              >
                <RefreshCw className="h-3.5 w-3.5 text-amber-600" />
                <span>I&apos;ve Run the SQL • Refresh</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-rose-700 hover:text-rose-900 p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      )}

      {/* Main Grid: Left = Upload Form, Right = Published Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Upload Form */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" />
              Upload & Publish Issue
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Select your PDF exported from Publisher. Page 1 will be automatically extracted as the cover.
            </p>
          </div>

          {formSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handlePublish} className="space-y-4">
            {/* PDF File Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Upload Publisher PDF <span className="text-rose-500">*</span>
              </label>
              <div
                onClick={() => pdfInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
                  pdfFile
                    ? "border-blue-400 bg-blue-50/50"
                    : "border-slate-300 hover:border-blue-500 hover:bg-slate-50"
                }`}
              >
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfChange}
                  className="hidden"
                />

                {isAnalyzingPdf ? (
                  <div className="py-4 space-y-2">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-600" />
                    <p className="text-xs font-semibold text-slate-700">
                      Reading PDF & extracting Page 1 cover...
                    </p>
                    <p className="text-[11px] text-slate-400">Please wait a moment</p>
                  </div>
                ) : pdfFile ? (
                  <div className="flex items-center gap-3 text-left">
                    {coverPreview ? (
                      <div className="relative w-16 h-22 rounded border border-slate-200 overflow-hidden shadow-xs shrink-0 bg-white">
                        <Image
                          src={coverPreview}
                          alt="Extracted cover"
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-22 rounded border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
                        <FileText className="h-6 w-6 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{pdfFile.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB • {pageCount} {pageCount === 1 ? "page" : "pages"}
                      </p>
                      <div className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        <Sparkles className="h-3 w-3 text-emerald-600" />
                        Page 1 Cover Extracted
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-3">
                    <Upload className="h-7 w-7 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-medium text-slate-700">
                      Click to choose PDF or drag and drop
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Exported from Microsoft Publisher (up to 50MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Newsletter Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. The Washingtonian — LRC Highlights"
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Issue / Period Label */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Issue / Period Label <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={issueLabel}
                onChange={(e) => setIssueLabel(e.target.value)}
                placeholder="e.g. October 2026, or S.Y. 2026-2027 • Vol. 1"
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description / Highlights (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Brief summary of articles, author visits, book fairs, or library announcements..."
                className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Featured toggle */}
            <div className="pt-2">
              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="font-semibold text-slate-800">Feature as Latest Issue</span>
              </label>
              <p className="text-[11px] text-slate-400 pl-6 mt-0.5">
                Automatically opens in the interactive flipbook stage on the /newsletters page.
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={isPublishing || isAnalyzingPdf}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-xs sm:text-sm py-2.5 rounded-lg shadow-sm transition flex items-center justify-center gap-2"
              >
                {isPublishing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Uploading & Publishing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span>Publish Newsletter</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Published Newsletters Library */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  Published Newsletters
                </h2>
                <p className="text-xs text-slate-500">
                  {newsletters.length} issue{newsletters.length === 1 ? "" : "s"} in library
                </p>
              </div>

              {/* Search */}
              <div className="relative sm:w-64">
                <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title or issue..."
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            {/* List */}
            {isLoadingList ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-600" />
                <p className="text-xs font-medium">Loading newsletters...</p>
              </div>
            ) : filteredNewsletters.length === 0 ? (
              <div className="py-14 text-center text-slate-400 space-y-2">
                <Newspaper className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No newsletters found</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  {searchQuery
                    ? `No issues match "${searchQuery}".`
                    : "Upload your first Microsoft Publisher newsletter using the form on the left."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNewsletters.map((item) => (
                  <div
                    key={item.id}
                    className="border border-slate-200 hover:border-slate-300 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition bg-white shadow-xs"
                  >
                    {/* Left: Thumbnail + Details */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Cover Thumbnail */}
                      <div className="relative w-14 h-18 sm:w-16 sm:h-22 rounded-md border border-slate-200 overflow-hidden bg-slate-100 shrink-0 shadow-xs">
                        {item.cover_url ? (
                          <Image
                            src={item.cover_url}
                            alt={item.title}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <BookOpen className="h-6 w-6" />
                          </div>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {item.is_featured && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                              Featured Latest Issue
                            </span>
                          )}
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                            {item.issue_label}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {item.page_count} {item.page_count === 1 ? "page" : "pages"}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 truncate" title={item.title}>
                          {item.title}
                        </h3>

                        {item.description && (
                          <p className="text-xs text-slate-500 line-clamp-1">{item.description}</p>
                        )}

                        <p className="text-[10px] text-slate-400">
                          Published: {new Date(item.published_at || item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      {/* Preview Flipbook */}
                      <Link
                        href={`/newsletters?issue=${item.id}`}
                        target="_blank"
                        title="Preview Flipbook"
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 px-2.5 py-1.5 rounded-lg transition"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                        <span className="hidden sm:inline">Preview Flipbook</span>
                      </Link>

                      {/* Set as Featured / Star */}
                      <button
                        type="button"
                        onClick={() => handleSetFeatured(item)}
                        disabled={item.is_featured || featuringId === item.id}
                        title={item.is_featured ? "Currently Featured" : "Set as Featured Issue"}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1 ${
                          item.is_featured
                            ? "bg-amber-50 border-amber-200 text-amber-700 cursor-default font-semibold"
                            : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600 hover:text-amber-600"
                        }`}
                      >
                        {featuringId === item.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Star
                            className={`h-3.5 w-3.5 ${
                              item.is_featured ? "fill-amber-500 text-amber-500" : ""
                            }`}
                          />
                        )}
                        <span className="hidden md:inline">
                          {item.is_featured ? "Featured" : "Set as Featured"}
                        </span>
                      </button>

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        title="Edit Details"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        title="Delete Newsletter"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      >
                        {deletingId === item.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin text-rose-600" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Newsletter Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Pencil className="h-4 w-4 text-blue-600" />
                Edit Newsletter Details
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Newsletter Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Issue / Period Label <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editIssueLabel}
                  onChange={(e) => setEditIssueLabel(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Highlights (Optional)
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Optional PDF replacement */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Replace PDF (Optional)
                </label>
                <div
                  onClick={() => editPdfInputRef.current?.click()}
                  className="border border-dashed border-slate-300 rounded-lg p-2.5 text-center cursor-pointer hover:bg-slate-50 transition"
                >
                  <input
                    ref={editPdfInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleEditPdfChange}
                    className="hidden"
                  />
                  {isEditAnalyzing ? (
                    <div className="flex items-center justify-center gap-2 py-1 text-xs text-blue-600">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Reading new PDF...</span>
                    </div>
                  ) : editPdfFile ? (
                    <div className="flex items-center gap-2.5 text-left">
                      {editCoverPreview && (
                        <div className="relative w-10 h-14 rounded border border-slate-200 overflow-hidden shrink-0">
                          <Image
                            src={editCoverPreview}
                            alt="Cover preview"
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-blue-700 truncate">
                          New: {editPdfFile.name}
                        </p>
                        <p className="text-[11px] text-slate-500">{editPageCount} pages detected</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-left">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700">
                          Click to choose a replacement PDF from Publisher
                        </p>
                        <p className="text-[11px] text-slate-400">Current: {editingItem.page_count} pages</p>
                      </div>
                      {editCoverPreview && (
                        <div className="relative w-8 h-11 rounded border border-slate-200 overflow-hidden shrink-0">
                          <Image
                            src={editCoverPreview}
                            alt="Current cover"
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Feature toggle */}
              <div>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editIsFeatured}
                    onChange={(e) => setEditIsFeatured(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span className="font-semibold text-slate-800">Set as Featured Latest Issue</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating || isEditAnalyzing}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-xs px-4 py-2 rounded-lg transition flex items-center gap-1.5"
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
