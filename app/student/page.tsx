"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  User,
  BookOpen,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  LogOut,
  ArrowLeft,
  Search,
  Bookmark,
  Sparkles,
  History,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import {
  getStudentDashboard,
  type StudentProfile,
  type StudentLoan,
} from "@/app/actions/studentPortalActions";

export default function StudentPortalPage() {
  // Navigation & View State
  const [view, setView] = useState<"login" | "dashboard">("login");
  const [libraryIdInput, setLibraryIdInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Student Profile & Loans State
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loans, setLoans] = useState<StudentLoan[]>([]);

  // Handle Login / ID Lookup
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = libraryIdInput.trim();
    if (!cleanId) {
      setErrorMessage("Please enter your Student Library ID.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const result = await getStudentDashboard(cleanId);

    if (!result.success || !result.student) {
      setErrorMessage(
        result.error || "Student not found. Please check your Library ID."
      );
      setIsLoading(false);
      return;
    }

    setStudent(result.student);
    setLoans(result.loans || []);
    setIsLoading(false);
    setView("dashboard");
  };

  // Handle Switch User / Log Out
  const handleLogout = () => {
    setStudent(null);
    setLoans([]);
    setLibraryIdInput("");
    setErrorMessage(null);
    setView("login");
  };

  // Computed Loan Buckets
  const activeLoans = loans.filter(
    (l) => (l.status || "").toLowerCase() === "active"
  );
  const returnedLoans = loans.filter(
    (l) => (l.status || "").toLowerCase() === "returned"
  );

  // Helpers for Due Date calculations
  const isOverdue = (dueDateStr: string): boolean => {
    if (!dueDateStr) return false;
    const due = new Date(dueDateStr);
    return due.getTime() < Date.now();
  };

  const getDaysRemainingText = (dueDateStr: string): { text: string; isLate: boolean; isToday: boolean } => {
    if (!dueDateStr) return { text: "No due date", isLate: false, isToday: false };
    const due = new Date(dueDateStr);
    const now = new Date();
    
    // Set to start of day for clean day comparison
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffDays = Math.round((dueDay - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const lateDays = Math.abs(diffDays);
      return {
        text: `Overdue by ${lateDays} ${lateDays === 1 ? "day" : "days"}`,
        isLate: true,
        isToday: false,
      };
    } else if (diffDays === 0) {
      return { text: "Due Today", isLate: false, isToday: true };
    } else {
      return {
        text: `Due in ${diffDays} ${diffDays === 1 ? "day" : "days"}`,
        isLate: false,
        isToday: false,
      };
    }
  };

  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return "N/A";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative w-10 h-10 rounded-full overflow-hidden bg-white shadow-sm ring-2 ring-blue-600/20 group-hover:ring-blue-600/40 transition shrink-0">
                <Image
                  src="/logo.png"
                  alt="Washington School Philippines Logo"
                  width={40}
                  height={40}
                  className="w-full h-full object-contain p-0.5"
                />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight block leading-none">
                  Washington School
                </span>
                <span className="text-[10px] text-blue-600 font-semibold tracking-wider uppercase">
                  Student Library Portal
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Public Catalog</span>
            </Link>

            {view === "dashboard" && student && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-lg transition border border-rose-200"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Switch User</span>
                <span className="sm:hidden">Exit</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {view === "login" ? (
          /* ================= LOGIN VIEW ================= */
          <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-blue-50/50 via-slate-50 to-slate-100">
            <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6 sm:p-8">
              {/* Portal Icon & Title */}
              <div className="text-center space-y-3 mb-8">
                <div className="relative w-24 h-24 mx-auto rounded-full overflow-hidden bg-white p-1 shadow-xl ring-4 ring-blue-100 mb-2">
                  <Image
                    src="/logo.png"
                    alt="Washington School Philippines Official Seal"
                    width={96}
                    height={96}
                    className="w-full h-full object-contain"
                    priority
                  />
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Student Portal
                </h1>
                <p className="text-sm text-slate-500">
                  Access your active book loans, due dates, and reading history
                  instantly.
                </p>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-sm animate-shake">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Access Notice</span>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label
                    htmlFor="libraryId"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
                  >
                    Student Library ID
                  </label>
                  <div className="relative">
                    <User className="h-5 w-5 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      id="libraryId"
                      type="text"
                      value={libraryIdInput}
                      onChange={(e) => {
                        setLibraryIdInput(e.target.value.toUpperCase());
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="e.g. WSI-S-0001"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 text-slate-900 font-mono text-sm tracking-wider uppercase placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-600 transition"
                      autoFocus
                      required
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
                    <Bookmark className="h-3.5 w-3.5 text-slate-400" />
                    <span>Your Library ID is printed on your school ID card.</span>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying ID...</span>
                    </>
                  ) : (
                    <>
                      <span>View My Dashboard</span>
                      <Sparkles className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick Links */}
              <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <Link
                  href="/"
                  className="hover:text-blue-600 transition flex items-center gap-1 font-medium"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Public Catalog</span>
                </Link>
                <Link
                  href="/login"
                  className="hover:text-blue-600 transition flex items-center gap-1 font-medium"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Librarian Desk</span>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* ================= DASHBOARD VIEW ================= */
          student && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
              {/* Student Header Card */}
              <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4 sm:gap-5">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-white p-1 shadow-lg ring-2 ring-white/30 shrink-0">
                      <Image
                        src="/logo.png"
                        alt="Washington School Philippines Official Seal"
                        width={80}
                        height={80}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/30 text-blue-200 text-xs font-semibold uppercase tracking-wider border border-blue-400/30">
                        <GraduationCap className="h-3.5 w-3.5 text-blue-300" />
                        <span>{student.grade_level || "Student"}</span>
                      </div>

                      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
                        Welcome back, {student.full_name}!
                      </h1>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                        <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-lg border border-white/10 font-mono text-xs text-blue-200">
                          <User className="h-3.5 w-3.5" />
                          ID: {student.library_id}
                        </span>
                        <span>•</span>
                        <span>
                          Enrolled since {formatDate(student.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Stat Badges & Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-white/10 backdrop-blur rounded-2xl px-5 py-3 border border-white/10 text-center">
                      <span className="block text-2xl font-black text-white">
                        {activeLoans.length}
                      </span>
                      <span className="text-[11px] text-blue-200 font-medium uppercase tracking-wider">
                        Active Loans
                      </span>
                    </div>

                    <div className="bg-white/10 backdrop-blur rounded-2xl px-5 py-3 border border-white/10 text-center">
                      <span className="block text-2xl font-black text-emerald-300">
                        {returnedLoans.length}
                      </span>
                      <span className="text-[11px] text-blue-200 font-medium uppercase tracking-wider">
                        Books Returned
                      </span>
                    </div>

                    <button
                      onClick={handleLogout}
                      className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-3 rounded-2xl transition border border-white/20"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Loans Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                        Active Loans
                      </h2>
                      <p className="text-xs text-slate-500">
                        Books currently in your possession that must be returned to the library.
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {activeLoans.length}{" "}
                    {activeLoans.length === 1 ? "Book" : "Books"}
                  </span>
                </div>

                {activeLoans.length === 0 ? (
                  /* Clean Empty State */
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center space-y-4 shadow-sm">
                    <div className="mx-auto w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <div className="space-y-1 max-w-md mx-auto">
                      <h3 className="text-lg font-bold text-slate-800">
                        No Active Loans
                      </h3>
                      <p className="text-sm text-slate-500">
                        You have no books currently checked out! You&apos;re all caught up.
                        Head over to the catalog to discover your next read.
                      </p>
                    </div>
                    <Link
                      href="/"
                      className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-xl transition shadow-md shadow-blue-500/20"
                    >
                      <Search className="h-4 w-4" />
                      <span>Browse Library Catalog</span>
                    </Link>
                  </div>
                ) : (
                  /* Active Loans Grid */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeLoans.map((loan) => {
                      const bookMeta = loan.Physical_Books?.Book_Metadata;
                      const physical = loan.Physical_Books;
                      const overdue = isOverdue(loan.due_date);
                      const dueStatus = getDaysRemainingText(loan.due_date);

                      return (
                        <div
                          key={loan.id}
                          className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition duration-200 flex flex-col border ${
                            overdue
                              ? "border-red-300 ring-2 ring-red-500/20"
                              : "border-slate-200"
                          }`}
                        >
                          {/* Card Top Banner if Overdue */}
                          {overdue && (
                            <div className="bg-red-600 text-white px-4 py-2 flex items-center gap-2 text-xs font-bold">
                              <AlertCircle className="h-4 w-4 flex-shrink-0 animate-pulse" />
                              <span>Action Needed: This book is overdue!</span>
                            </div>
                          )}

                          <div className="p-5 flex gap-4 flex-1">
                            {/* Book Cover Thumbnail */}
                            <div className="relative w-24 h-36 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm">
                              {bookMeta?.cover_url ? (
                                <Image
                                  src={bookMeta.cover_url}
                                  alt={`Cover of ${bookMeta.title || "book"}`}
                                  fill
                                  unoptimized
                                  className="object-cover"
                                />
                              ) : (
                                <div className="w-full h-full p-2 flex flex-col items-center justify-center text-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
                                  <BookOpen className="h-6 w-6 text-slate-300 mb-1" />
                                  <span className="text-[10px] font-bold text-slate-600 line-clamp-2">
                                    {bookMeta?.title || loan.book_accession}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Book Details */}
                            <div className="flex-1 flex flex-col justify-between min-w-0">
                              <div>
                                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                  <span className="text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                    {loan.book_accession}
                                  </span>
                                  {physical?.call_number && (
                                    <span className="text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                                      {physical.call_number}
                                    </span>
                                  )}
                                </div>

                                <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-2" title={bookMeta?.title}>
                                  {bookMeta?.title || "Unknown Book Title"}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                                  by {bookMeta?.author || "Unknown Author"}
                                </p>
                              </div>

                              {/* Dates & Due Status */}
                              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-400 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Borrowed:
                                  </span>
                                  <span className="text-slate-700 font-medium">
                                    {formatDate(loan.checkout_date)}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-400 flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Due Date:
                                  </span>
                                  <span
                                    className={`font-bold ${
                                      overdue
                                        ? "text-red-600"
                                        : dueStatus.isToday
                                        ? "text-amber-600"
                                        : "text-slate-900"
                                    }`}
                                  >
                                    {formatDate(loan.due_date)}
                                  </span>
                                </div>

                                {/* Status Tag */}
                                <div className="pt-1">
                                  <span
                                    className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg w-full justify-center ${
                                      overdue
                                        ? "bg-red-100 text-red-700 border border-red-200"
                                        : dueStatus.isToday
                                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    }`}
                                  >
                                    {overdue ? (
                                      <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                                    ) : (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    )}
                                    <span>{dueStatus.text}</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Past Reading History Section */}
              <section className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-slate-200 text-slate-700 rounded-xl">
                      <History className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                        Past Reading History
                      </h2>
                      <p className="text-xs text-slate-500">
                        Record of books you have returned to the Washington School Philippines Library.
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {returnedLoans.length} Returned
                  </span>
                </div>

                {returnedLoans.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                    No past borrowing history recorded yet.
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                          <tr>
                            <th className="py-3.5 px-4 sm:px-6">Book Title & Author</th>
                            <th className="py-3.5 px-4">Accession</th>
                            <th className="py-3.5 px-4">Borrowed On</th>
                            <th className="py-3.5 px-4">Returned On</th>
                            <th className="py-3.5 px-4 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {returnedLoans.map((loan) => {
                            const meta = loan.Physical_Books?.Book_Metadata;
                            return (
                              <tr
                                key={loan.id}
                                className="hover:bg-slate-50/80 transition"
                              >
                                <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">
                                  <div className="flex items-center gap-3">
                                    {meta?.cover_url && (
                                      <div className="relative w-8 h-12 rounded overflow-hidden flex-shrink-0 border border-slate-200 hidden sm:block">
                                        <Image
                                          src={meta.cover_url}
                                          alt=""
                                          fill
                                          unoptimized
                                          className="object-cover"
                                        />
                                      </div>
                                    )}
                                    <div>
                                      <span className="block font-bold text-slate-800 line-clamp-1">
                                        {meta?.title || loan.book_accession}
                                      </span>
                                      <span className="text-xs text-slate-400 block line-clamp-1">
                                        {meta?.author || "Unknown author"}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                                  {loan.book_accession}
                                </td>
                                <td className="py-3.5 px-4 text-slate-600">
                                  {formatDate(loan.checkout_date)}
                                </td>
                                <td className="py-3.5 px-4 text-slate-600">
                                  {formatDate(loan.returned_date || loan.created_at)}
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>Returned</span>
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )
        )}
      </main>

      {/* Public Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-xs text-slate-500">
          <div className="relative w-5 h-5 rounded-full overflow-hidden shrink-0 border border-slate-200">
            <Image
              src="/logo.png"
              alt="Washington School Philippines"
              width={20}
              height={20}
              className="w-full h-full object-contain"
            />
          </div>
          <span>&copy; {new Date().getFullYear()} Washington School Philippines. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
