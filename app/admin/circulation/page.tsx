"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Repeat,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  BookOpen,
  Calendar,
} from "lucide-react";
import {
  checkoutBook,
  returnBook,
  getActiveLoans,
  type ActiveLoanItem,
} from "@/app/actions/circulationActions";

export default function CirculationPage() {
  // Checkout State
  const [checkoutStudentId, setCheckoutStudentId] = useState("");
  const [checkoutAccession, setCheckoutAccession] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Return State
  const [returnAccession, setReturnAccession] = useState("");
  const [isReturning, setIsReturning] = useState(false);
  const [returnSuccess, setReturnSuccess] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);

  // Active Loans List State
  const [activeLoans, setActiveLoans] = useState<ActiveLoanItem[]>([]);
  const [isLoadingLoans, setIsLoadingLoans] = useState(true);

  // Load Active Loans
  const loadLoans = useCallback(async () => {
    setIsLoadingLoans(true);
    const result = await getActiveLoans();
    setIsLoadingLoans(false);
    if (result.success) {
      setActiveLoans(result.loans);
    }
  }, []);

  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  // Handle Checkout
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutStudentId.trim() || !checkoutAccession.trim()) {
      setCheckoutError("Please enter both Student ID and Book Accession Number.");
      return;
    }

    setIsCheckingOut(true);
    setCheckoutSuccess(null);
    setCheckoutError(null);

    const result = await checkoutBook(checkoutStudentId.trim(), checkoutAccession.trim());
    setIsCheckingOut(false);

    if (!result.success) {
      setCheckoutError(result.error || "Failed to process checkout.");
    } else {
      setCheckoutSuccess(result.message || "Book successfully checked out!");
      setCheckoutAccession("");
      loadLoans();
    }
  };

  // Handle Return
  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnAccession.trim()) {
      setReturnError("Please enter the Book Accession Number.");
      return;
    }

    setIsReturning(true);
    setReturnSuccess(null);
    setReturnError(null);

    const result = await returnBook(returnAccession.trim());
    setIsReturning(false);

    if (!result.success) {
      setReturnError(result.error || "Failed to process return.");
    } else {
      setReturnSuccess(result.message || "Book successfully returned!");
      setReturnAccession("");
      loadLoans();
    }
  };

  // Quick return from active loans table
  const handleQuickReturn = async (accession: string) => {
    setReturnAccession(accession);
    setIsReturning(true);
    setReturnSuccess(null);
    setReturnError(null);

    const result = await returnBook(accession);
    setIsReturning(false);

    if (!result.success) {
      setReturnError(result.error || "Failed to return book.");
    } else {
      setReturnSuccess(result.message || "Book successfully returned!");
      setReturnAccession("");
      loadLoans();
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Repeat className="h-6 w-6 text-blue-600" />
          Circulation Desk
        </h1>
        <p className="text-sm text-slate-500">
          Issue loans to registered students with 7-day automatic due dates, and process returned physical copies.
        </p>
      </div>

      {/* Main Circulation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Checkout Section */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                  <ArrowUpRight className="h-5 w-5" />
                </span>
                Issue Book (Checkout)
              </h2>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Loan: 7 Days
              </span>
            </div>

            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student Library ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={checkoutStudentId}
                  onChange={(e) => setCheckoutStudentId(e.target.value)}
                  placeholder="e.g. WSI-S-0001"
                  required
                  className="w-full px-3.5 py-2.5 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Scan student card or enter library ID.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Book Accession Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={checkoutAccession}
                  onChange={(e) => setCheckoutAccession(e.target.value)}
                  placeholder="e.g. WSI-0001"
                  required
                  className="w-full px-3.5 py-2.5 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Scan barcode sticker from book spine or cover.
                </p>
              </div>

              <button
                type="submit"
                disabled={isCheckingOut}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50 shadow-sm"
              >
                {isCheckingOut ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Processing Checkout...
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="h-4 w-4" />
                    Process Checkout
                  </>
                )}
              </button>
            </form>

            {/* Checkout Error Alert */}
            {checkoutError && (
              <div className="flex items-start gap-2.5 text-xs text-rose-800 bg-rose-50 border border-rose-200 p-3.5 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                <div>
                  <span className="font-semibold block">Checkout Failed</span>
                  <span>{checkoutError}</span>
                </div>
              </div>
            )}

            {/* Checkout Success Alert */}
            {checkoutSuccess && (
              <div className="flex items-start gap-2.5 text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 p-3.5 rounded-lg">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <div>
                  <span className="font-semibold block">Checkout Complete</span>
                  <span>{checkoutSuccess}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Check-in Section */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                  <ArrowDownLeft className="h-5 w-5" />
                </span>
                Return Book (Check-in)
              </h2>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Auto-Restore Status
              </span>
            </div>

            <form onSubmit={handleReturn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Book Accession Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={returnAccession}
                  onChange={(e) => setReturnAccession(e.target.value)}
                  placeholder="e.g. WSI-0001"
                  required
                  className="w-full px-3.5 py-2.5 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Scan barcode sticker from the returned book.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-slate-800">
                  <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                  <span>Return Action Policy</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Returning clears the student&apos;s active loan and immediately restores the book status to &quot;Available&quot; for new checkouts.
                </p>
              </div>

              <button
                type="submit"
                disabled={isReturning}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50 shadow-sm"
              >
                {isReturning ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Processing Return...
                  </>
                ) : (
                  <>
                    <ArrowDownLeft className="h-4 w-4" />
                    Process Return
                  </>
                )}
              </button>
            </form>

            {/* Return Error Alert */}
            {returnError && (
              <div className="flex items-start gap-2.5 text-xs text-rose-800 bg-rose-50 border border-rose-200 p-3.5 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                <div>
                  <span className="font-semibold block">Return Error</span>
                  <span>{returnError}</span>
                </div>
              </div>
            )}

            {/* Return Success Alert */}
            {returnSuccess && (
              <div className="flex items-start gap-2.5 text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 p-3.5 rounded-lg">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <div>
                  <span className="font-semibold block">Book Returned</span>
                  <span>{returnSuccess}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Loans Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-800">
              Active Loans on Record ({activeLoans.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={loadLoans}
            disabled={isLoadingLoans}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition self-end sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingLoans ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Accession ID</th>
                <th className="px-5 py-3">Book Title</th>
                <th className="px-5 py-3">Borrower (Student)</th>
                <th className="px-5 py-3">Checkout Date</th>
                <th className="px-5 py-3">Due Date</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingLoans ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading circulation records...
                  </td>
                </tr>
              ) : activeLoans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No active loans currently checked out. All books are available on shelf.
                  </td>
                </tr>
              ) : (
                activeLoans.map((loan) => {
                  const isOverdue = new Date(loan.due_date) < new Date();
                  const dueDateFormatted = new Date(loan.due_date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  const checkoutFormatted = new Date(loan.checkout_date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

                  return (
                    <tr key={loan.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                          {loan.book_accession}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900 line-clamp-1">
                          {loan.Physical_Books?.Book_Metadata?.title || "Book Title"}
                        </div>
                        {loan.Physical_Books?.call_number && (
                          <div className="text-[11px] font-mono text-slate-500">
                            {loan.Physical_Books.call_number}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-800">
                          {loan.Students?.full_name || "Unknown"}
                        </div>
                        <div className="text-xs font-mono text-slate-500">
                          {loan.student_id} {loan.Students?.grade_level ? `• ${loan.Students.grade_level}` : ""}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600">
                        {checkoutFormatted}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${
                            isOverdue
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          <Calendar className="h-3 w-3" />
                          {dueDateFormatted} {isOverdue ? "(Overdue)" : ""}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleQuickReturn(loan.book_accession)}
                          disabled={isReturning}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50"
                        >
                          Return Book
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
