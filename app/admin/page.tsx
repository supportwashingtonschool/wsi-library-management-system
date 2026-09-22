import Link from "next/link";
import {
  BookOpen,
  Repeat,
  Users,
  AlertCircle,
  ArrowRight,
  Clock,
  CheckCircle2,
  BookMarked,
  Layers,
} from "lucide-react";
import { getDashboardData } from "@/app/actions/dashboardActions";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const result = await getDashboardData();
  const {
    totalCataloged,
    activeLoans,
    studentsEnrolled,
    overdueItems,
    recentLoans,
  } = result.data;

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

  const isLoanOverdue = (dueDateStr: string, status: string): boolean => {
    if (!dueDateStr) return false;
    if (status.toLowerCase() !== "active") return false;
    return new Date(dueDateStr).getTime() < Date.now();
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Admin Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time library statistics, inventory health, and recent circulation activity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/circulation"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-2 rounded-lg transition shadow-sm"
          >
            <Repeat className="h-3.5 w-3.5" />
            <span>Circulation Desk</span>
          </Link>
          <Link
            href="/admin/cataloging"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 px-3.5 py-2 rounded-lg transition shadow-sm"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Catalog New Book</span>
          </Link>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Cataloged */}
        <Link
          href="/admin/cataloging"
          className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-200 transition group flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Cataloged
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {totalCataloged}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Physical copies in library
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition" />
        </Link>

        {/* Active Loans */}
        <Link
          href="/admin/circulation"
          className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-emerald-200 transition group flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition">
              <Repeat className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Loans
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {activeLoans}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Currently borrowed books
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition" />
        </Link>

        {/* Students Enrolled */}
        <Link
          href="/admin/students"
          className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-purple-200 transition group flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Students Enrolled
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {studentsEnrolled}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Registered student borrowers
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-purple-600 group-hover:translate-x-1 transition" />
        </Link>

        {/* Overdue Items */}
        <Link
          href="/admin/circulation"
          className={`p-5 bg-white border rounded-xl shadow-sm hover:shadow-md transition group flex items-center justify-between ${
            overdueItems > 0
              ? "border-amber-300 ring-1 ring-amber-400/30 hover:border-amber-400"
              : "border-slate-200 hover:border-amber-200"
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`p-3 rounded-xl transition ${
                overdueItems > 0
                  ? "bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white"
                  : "bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white"
              }`}
            >
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Overdue Items
              </p>
              <p
                className={`text-2xl sm:text-3xl font-extrabold ${
                  overdueItems > 0 ? "text-amber-700" : "text-slate-900"
                }`}
              >
                {overdueItems}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {overdueItems > 0 ? "Requires librarian follow-up" : "All loans on schedule"}
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-amber-600 group-hover:translate-x-1 transition" />
        </Link>
      </div>

      {/* Recent Library Activity Table Section */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <span>Recent Library Activity</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              The 5 most recent checkout and return transactions recorded in the library.
            </p>
          </div>

          <Link
            href="/admin/circulation"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
          >
            <span>Open Circulation Desk</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentLoans.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <BookMarked className="h-10 w-10 mx-auto text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No circulation activity recorded yet.</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Books checked out to students via the Circulation Desk will be listed here in real-time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-6">Book Title</th>
                  <th className="py-3.5 px-4">Borrower (Student)</th>
                  <th className="py-3.5 px-4">Checkout Date</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {recentLoans.map((loan) => {
                  const meta = loan.Physical_Books?.Book_Metadata;
                  const physical = loan.Physical_Books;
                  const student = loan.Students;
                  const isLate = isLoanOverdue(loan.due_date, loan.status);
                  const isReturned = (loan.status || "").toLowerCase() === "returned";

                  return (
                    <tr key={loan.id} className="hover:bg-slate-50/80 transition">
                      {/* Book Title & Accession */}
                      <td className="py-4 px-6 font-medium text-slate-900">
                        <div className="space-y-0.5">
                          <span className="block font-bold text-slate-800 line-clamp-1">
                            {meta?.title || "Unknown Book Title"}
                          </span>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                            <span>{loan.book_accession}</span>
                            {physical?.call_number && (
                              <>
                                <span>•</span>
                                <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded font-sans text-[10px]">
                                  {physical.call_number}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Student Name */}
                      <td className="py-4 px-4">
                        <div className="space-y-0.5">
                          <span className="block font-semibold text-slate-800">
                            {student?.full_name || "Unknown Student"}
                          </span>
                          <span className="block text-xs text-slate-400 font-mono">
                            {loan.student_id} {student?.grade_level ? `(${student.grade_level})` : ""}
                          </span>
                        </div>
                      </td>

                      {/* Checkout Date */}
                      <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
                        {formatDate(loan.checkout_date)}
                      </td>

                      {/* Due Date */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={
                            isLate
                              ? "text-red-600 font-bold"
                              : "text-slate-600"
                          }
                        >
                          {formatDate(loan.due_date)}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        {isReturned ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Returned</span>
                          </span>
                        ) : isLate ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-full border border-red-200">
                            <AlertCircle className="h-3 w-3" />
                            <span>Overdue</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                            <Repeat className="h-3 w-3" />
                            <span>Active Loan</span>
                          </span>
                        )}
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
  );
}
