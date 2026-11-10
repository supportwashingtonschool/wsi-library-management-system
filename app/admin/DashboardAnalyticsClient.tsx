"use client";

import { useState, useMemo } from "react";
import {
  FileText,
  Layers,
  Repeat,
  Users,
  AlertCircle,
  Sparkles,
  BarChart3,
  BookmarkCheck,
  CheckCircle2,
} from "lucide-react";
import type { DashboardData } from "@/app/actions/dashboardActions";
import ReportExportModal from "./ReportExportModal";

interface DashboardAnalyticsClientProps {
  data: DashboardData;
}

type PeriodType = "today" | "week" | "month" | "all" | "custom";

export default function DashboardAnalyticsClient({
  data,
}: DashboardAnalyticsClientProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [loansFilterTab, setLoansFilterTab] = useState<"all" | "overdue">("all");

  // Determine period boundaries
  const { periodLabel, dateRangeText, periodStart, periodEnd } = useMemo(() => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (selectedPeriod === "today") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return {
        periodLabel: "Today",
        dateRangeText: start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        periodStart: start,
        periodEnd: end,
      };
    }

    if (selectedPeriod === "week") {
      const start = new Date(now);
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      return {
        periodLabel: "This Week",
        dateRangeText: `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
        periodStart: start,
        periodEnd: end,
      };
    }

    if (selectedPeriod === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      return {
        periodLabel: "This Month",
        dateRangeText: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        periodStart: start,
        periodEnd: end,
      };
    }

    if (selectedPeriod === "custom") {
      const start = customStartDate ? new Date(customStartDate) : new Date(0);
      start.setHours(0, 0, 0, 0);
      const customEnd = customEndDate ? new Date(customEndDate) : new Date();
      customEnd.setHours(23, 59, 59, 999);
      return {
        periodLabel: "Custom Range",
        dateRangeText: `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${customEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
        periodStart: start,
        periodEnd: customEnd,
      };
    }

    // Default: All Time
    return {
      periodLabel: "All Time",
      dateRangeText: "School Year Cumulative",
      periodStart: null,
      periodEnd: null,
    };
  }, [selectedPeriod, customStartDate, customEndDate]);

  // Filter loans in period
  const periodLoans = useMemo(() => {
    if (!periodStart || !periodEnd) return data.allLoans || [];
    const startMs = periodStart.getTime();
    const endMs = periodEnd.getTime();
    return (data.allLoans || []).filter((l) => {
      const cTime = new Date(l.checkout_date).getTime();
      return cTime >= startMs && cTime <= endMs;
    });
  }, [data.allLoans, periodStart, periodEnd]);

  // Filter attendance logs in period
  const periodAttendance = useMemo(() => {
    if (!periodStart || !periodEnd) return data.attendanceLogs || [];
    const startMs = periodStart.getTime();
    const endMs = periodEnd.getTime();
    return (data.attendanceLogs || []).filter((a) => {
      const aTime = new Date(a.time_in).getTime();
      return aTime >= startMs && aTime <= endMs;
    });
  }, [data.attendanceLogs, periodStart, periodEnd]);

  // Metrics computation
  const periodCheckouts = periodLoans.length;
  const periodReturned = periodLoans.filter((l) => (l.status || "").toLowerCase() === "returned").length;
  const returnRate = periodCheckouts > 0 ? `${Math.round((periodReturned / periodCheckouts) * 100)}%` : "N/A";
  const periodVisits = periodAttendance.length;

  // Top 5 Borrowed Books in Period
  const topBooks = useMemo(() => {
    const bookMap = new Map<string, { title: string; accession?: string; author?: string; category?: string; count: number }>();
    for (const loan of periodLoans) {
      const title = loan.Physical_Books?.Book_Metadata?.title || loan.book_accession || "Unknown Title";
      const key = title.trim();
      const existing = bookMap.get(key) || {
        title,
        accession: loan.book_accession,
        author: loan.Physical_Books?.Book_Metadata?.author || undefined,
        category: loan.Physical_Books?.Book_Metadata?.category || undefined,
        count: 0,
      };
      existing.count++;
      bookMap.set(key, existing);
    }
    return Array.from(bookMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [periodLoans]);

  // Top 5 Most Active Student Readers in Period
  const topReaders = useMemo(() => {
    const studentMap = new Map<string, { name: string; libraryId: string; gradeLevel: string; count: number }>();
    for (const loan of periodLoans) {
      const id = loan.student_id;
      const existing = studentMap.get(id) || {
        name: loan.Students?.full_name || id,
        libraryId: id,
        gradeLevel: loan.Students?.grade_level || "General",
        count: 0,
      };
      existing.count++;
      studentMap.set(id, existing);
    }
    return Array.from(studentMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [periodLoans]);

  // Grade-Level Engagement (Loans & Visits)
  const gradeEngagement = useMemo(() => {
    const gradeMap = new Map<string, { grade: string; enrolled: number; loans: number; visits: number }>();

    // Seed with known enrolled grades
    for (const g of data.gradeEnrollment || []) {
      gradeMap.set(g.gradeLevel, {
        grade: g.gradeLevel,
        enrolled: g.enrolledStudents,
        loans: 0,
        visits: 0,
      });
    }

    // Accumulate loans
    for (const l of periodLoans) {
      const grade = l.Students?.grade_level?.trim() || "Unspecified";
      const entry = gradeMap.get(grade) || { grade, enrolled: 0, loans: 0, visits: 0 };
      entry.loans++;
      gradeMap.set(grade, entry);
    }

    // Accumulate attendance visits
    for (const a of periodAttendance) {
      const grade = a.Students?.grade_level?.trim() || "Unspecified";
      const entry = gradeMap.get(grade) || { grade, enrolled: 0, loans: 0, visits: 0 };
      entry.visits++;
      gradeMap.set(grade, entry);
    }

    return Array.from(gradeMap.values()).sort((a, b) => (b.loans + b.visits) - (a.loans + a.visits));
  }, [data.gradeEnrollment, periodLoans, periodAttendance]);

  // In-library books read from Attendance logs
  const topInLibraryBooks = useMemo(() => {
    const countMap = new Map<string, { title: string; accession?: string; count: number }>();
    for (const att of periodAttendance) {
      if (!att.book_title && !att.book_accession) continue;
      const title = att.book_title || att.book_accession || "Unknown Book";
      const existing = countMap.get(title) || { title, accession: att.book_accession || undefined, count: 0 };
      existing.count++;
      countMap.set(title, existing);
    }
    return Array.from(countMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [periodAttendance]);

  // Overdue and Active Loans Watchlist
  const overdueAndActiveLoans = useMemo(() => {
    const nowTime = Date.now();
    return (data.allLoans || []).filter((l) => {
      const statusLower = (l.status || "").toLowerCase();
      const isLate =
        statusLower === "overdue" ||
        (statusLower === "active" && new Date(l.due_date).getTime() < nowTime);

      if (loansFilterTab === "overdue") {
        return isLate;
      }
      return statusLower === "active" || isLate;
    });
  }, [data.allLoans, loansFilterTab]);

  return (
    <div className="space-y-6">
      {/* Analytics & Export Action Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Library Statistics &amp; Analytics
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Interactive breakdown of LRC attendance, collection health, circulation trends, and grade engagement.
          </p>
        </div>

        {/* Period Filter Buttons & Export Trigger */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSelectedPeriod("today")}
              className={`px-3 py-1.5 rounded-lg transition ${
                selectedPeriod === "today"
                  ? "bg-white text-blue-600 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod("week")}
              className={`px-3 py-1.5 rounded-lg transition ${
                selectedPeriod === "week"
                  ? "bg-white text-blue-600 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod("month")}
              className={`px-3 py-1.5 rounded-lg transition ${
                selectedPeriod === "month"
                  ? "bg-white text-blue-600 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod("all")}
              className={`px-3 py-1.5 rounded-lg transition ${
                selectedPeriod === "all"
                  ? "bg-white text-blue-600 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod("custom")}
              className={`px-3 py-1.5 rounded-lg transition ${
                selectedPeriod === "custom"
                  ? "bg-white text-blue-600 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Custom Range
            </button>
          </div>

          {/* Primary Export PDF Button */}
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center gap-2 text-xs font-bold text-white bg-[#7A2828] hover:bg-[#8f3030] px-4 py-2 rounded-xl transition shadow-sm"
          >
            <FileText className="h-4 w-4" />
            <span>Export PDF Report</span>
          </button>
        </div>
      </div>

      {/* Custom Date Pickers (Shown if Custom Range is active) */}
      {selectedPeriod === "custom" && (
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl flex flex-wrap items-center gap-3 text-xs animate-in fade-in">
          <span className="font-bold text-amber-900">Custom Date Range:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-medium">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-slate-800"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-medium">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-slate-800"
            />
          </div>
        </div>
      )}

      {/* Period Statistics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Period Visits
          </span>
          <span className="text-xl font-extrabold text-purple-700">{periodVisits}</span>
          <span className="block text-[10px] text-slate-400 mt-0.5">{periodLabel}</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Period Checkouts
          </span>
          <span className="text-xl font-extrabold text-blue-600">{periodCheckouts}</span>
          <span className="block text-[10px] text-slate-400 mt-0.5">Loans issued</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Period Returns
          </span>
          <span className="text-xl font-extrabold text-emerald-600">{periodReturned}</span>
          <span className="block text-[10px] text-slate-400 mt-0.5">Returned in period</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Return Rate
          </span>
          <span className="text-xl font-extrabold text-indigo-600">{returnRate}</span>
          <span className="block text-[10px] text-slate-400 mt-0.5">Circulation turnaround</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Active Loans
          </span>
          <span className="text-xl font-extrabold text-slate-900">{data.activeLoans}</span>
          <span className="block text-[10px] text-slate-400 mt-0.5">Currently out</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Overdue Items
          </span>
          <span className={`text-xl font-extrabold ${data.overdueItems > 0 ? "text-amber-700" : "text-slate-900"}`}>
            {data.overdueItems}
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            {data.overdueItems > 0 ? "Follow-up required" : "All on track"}
          </span>
        </div>
      </div>

      {/* 2x2 Analytics Visual Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Inventory & Collection Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600" />
                <span>Inventory &amp; Collection Breakdown</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {data.inventoryStatusCounts.total} Total Holdings
              </span>
            </div>

            {/* Status Distribution Progress Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 font-medium">
                <span>Holdings Health:</span>
                <span>
                  {data.inventoryStatusCounts.available} Available / {data.inventoryStatusCounts.checkedOut} Checked Out
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                <div
                  className="bg-emerald-500 transition-all"
                  style={{
                    width: `${data.inventoryStatusCounts.total > 0 ? (data.inventoryStatusCounts.available / data.inventoryStatusCounts.total) * 100 : 0}%`,
                  }}
                  title={`Available: ${data.inventoryStatusCounts.available}`}
                />
                <div
                  className="bg-blue-500 transition-all"
                  style={{
                    width: `${data.inventoryStatusCounts.total > 0 ? (data.inventoryStatusCounts.checkedOut / data.inventoryStatusCounts.total) * 100 : 0}%`,
                  }}
                  title={`Checked Out: ${data.inventoryStatusCounts.checkedOut}`}
                />
                <div
                  className="bg-amber-500 transition-all"
                  style={{
                    width: `${data.inventoryStatusCounts.total > 0 ? (data.inventoryStatusCounts.maintenance / data.inventoryStatusCounts.total) * 100 : 0}%`,
                  }}
                  title={`Maintenance: ${data.inventoryStatusCounts.maintenance}`}
                />
                <div
                  className="bg-rose-500 transition-all"
                  style={{
                    width: `${data.inventoryStatusCounts.total > 0 ? (data.inventoryStatusCounts.lost / data.inventoryStatusCounts.total) * 100 : 0}%`,
                  }}
                  title={`Lost: ${data.inventoryStatusCounts.lost}`}
                />
              </div>

              {/* Status Legend */}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Available ({data.inventoryStatusCounts.available})</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>Checked Out ({data.inventoryStatusCounts.checkedOut})</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Maintenance ({data.inventoryStatusCounts.maintenance})</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Lost ({data.inventoryStatusCounts.lost})</span>
                </span>
              </div>
            </div>

            {/* Category Breakdown List */}
            <div className="mt-5 space-y-2.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Top Categories / Subjects:
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {(data.categoryBreakdown || []).slice(0, 6).map((cat) => {
                  const maxCopies = data.categoryBreakdown[0]?.copyCount || 1;
                  const pct = Math.round((cat.copyCount / maxCopies) * 100);

                  return (
                    <div key={cat.category} className="text-xs">
                      <div className="flex items-center justify-between text-slate-700 mb-0.5">
                        <span className="font-semibold truncate max-w-[200px]" title={cat.category}>
                          {cat.category}
                        </span>
                        <span className="text-slate-500 font-mono text-[11px]">
                          {cat.copyCount} {cat.copyCount === 1 ? "copy" : "copies"} ({cat.titleCount} titles)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Popular Titles & Circulation Trends */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Repeat className="h-4 w-4 text-emerald-600" />
                <span>Popular Titles &amp; Circulation</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium">{periodLabel}</span>
            </div>

            {/* Top 5 Borrowed Books */}
            <div className="mt-4 space-y-2.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Top Borrowed Books ({periodLabel}):
              </span>
              {topBooks.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4 text-center">
                  No checkouts recorded in this period.
                </p>
              ) : (
                <div className="space-y-2">
                  {topBooks.map((b, i) => (
                    <div
                      key={i}
                      className="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl transition flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 truncate block" title={b.title}>
                            {b.title}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {b.author ? `by ${b.author}` : b.category || "General Collection"}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md shrink-0 border border-blue-200">
                        {b.count} {b.count === 1 ? "loan" : "loans"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* In-Library Reading Popularity */}
            {topInLibraryBooks.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <BookmarkCheck className="h-3.5 w-3.5 text-purple-600" />
                  <span>Top Books Read in LRC (In-House):</span>
                </span>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {topInLibraryBooks.map((b, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-800 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200"
                    >
                      <span>{b.title}</span>
                      <strong className="text-purple-600 font-bold">({b.count})</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Student & Grade-Level Engagement */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600" />
                <span>Student &amp; Grade Engagement</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {data.studentsEnrolled} Registered Borrowers
              </span>
            </div>

            {/* Grade Level Activity Table */}
            <div className="mt-4">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                Borrowing &amp; Visits by Grade Level ({periodLabel}):
              </span>
              <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="py-2 px-3">Grade Level</th>
                      <th className="py-2 px-3 text-right">Enrolled</th>
                      <th className="py-2 px-3 text-right">Loans</th>
                      <th className="py-2 px-3 text-right">Visits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {gradeEngagement.map((g) => (
                      <tr key={g.grade} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{g.grade}</td>
                        <td className="py-2 px-3 text-right text-slate-500">{g.enrolled}</td>
                        <td className="py-2 px-3 text-right font-bold text-blue-700">{g.loans}</td>
                        <td className="py-2 px-3 text-right font-bold text-purple-700">{g.visits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Top Active Readers */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>Top Active Student Readers</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium">{periodLabel}</span>
            </div>

            <div className="mt-4 space-y-2.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Most Active Borrowers:
              </span>
              {topReaders.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4 text-center">
                  No student checkouts recorded in this period.
                </p>
              ) : (
                <div className="space-y-2">
                  {topReaders.map((r, i) => (
                    <div
                      key={r.libraryId}
                      className="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl transition flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 truncate block">
                            {r.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {r.libraryId} • {r.gradeLevel}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md shrink-0 border border-purple-200">
                        {r.count} {r.count === 1 ? "book" : "books"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card 5: Actionable Overdue & Active Loans Watchlist */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <AlertCircle className={`h-5 w-5 ${data.overdueItems > 0 ? "text-amber-600" : "text-blue-600"}`} />
              <span>Actionable Overdue &amp; Active Loans Watchlist</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live tracking of active student loans and overdue items requiring librarian notification.
            </p>
          </div>

          <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLoansFilterTab("all")}
              className={`px-3 py-1 rounded-lg transition ${
                loansFilterTab === "all"
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Active Loans ({data.activeLoans})
            </button>
            <button
              type="button"
              onClick={() => setLoansFilterTab("overdue")}
              className={`px-3 py-1 rounded-lg transition ${
                loansFilterTab === "overdue"
                  ? "bg-white text-amber-700 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Overdue Only ({data.overdueItems})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-6">Book Title</th>
                <th className="py-3 px-4">Borrower Student</th>
                <th className="py-3 px-4">Checkout Date</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-6 text-right">Status / Overdue Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {overdueAndActiveLoans.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-500 mb-1" />
                    <span className="text-xs">
                      {loansFilterTab === "overdue" ? "No overdue loans! All books are on schedule." : "No active loans currently."}
                    </span>
                  </td>
                </tr>
              ) : (
                overdueAndActiveLoans.map((loan) => {
                  const meta = loan.Physical_Books?.Book_Metadata;
                  const student = loan.Students;
                  const isLate =
                    (loan.status || "").toLowerCase() === "overdue" ||
                    ((loan.status || "").toLowerCase() === "active" &&
                      new Date(loan.due_date).getTime() < Date.now());

                  const daysOverdue = isLate
                    ? Math.max(1, Math.floor((Date.now() - new Date(loan.due_date).getTime()) / (1000 * 60 * 60 * 24)))
                    : 0;

                  return (
                    <tr key={loan.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-6 font-medium text-slate-900">
                        <span className="block font-bold text-slate-800 line-clamp-1">
                          {meta?.title || "Unknown Book Title"}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                          <span>{loan.book_accession}</span>
                          {loan.Physical_Books?.call_number && (
                            <>
                              <span>•</span>
                              <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded font-sans text-[10px]">
                                {loan.Physical_Books.call_number}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="block font-semibold text-slate-800">
                          {student?.full_name || "Unknown Student"}
                        </span>
                        <span className="block text-xs text-slate-400 font-mono">
                          {loan.student_id} {student?.grade_level ? `(${student.grade_level})` : ""}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {new Date(loan.checkout_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-medium">
                        <span className={isLate ? "text-red-600 font-bold" : "text-slate-700"}>
                          {new Date(loan.due_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </td>

                      <td className="py-3.5 px-6 text-right whitespace-nowrap">
                        {isLate ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 border border-red-200 px-2.5 py-1 rounded-full">
                            <AlertCircle className="h-3 w-3" />
                            <span>Overdue by {daysOverdue} {daysOverdue === 1 ? "day" : "days"}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                            <Repeat className="h-3 w-3" />
                            <span>Active Loan</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official PDF Report Export Modal */}
      <ReportExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        periodLabel={periodLabel}
        dateRangeText={dateRangeText}
        kpiSummary={{
          totalCataloged: data.totalCataloged,
          totalTitles: data.totalTitles,
          activeLoans: data.activeLoans,
          overdueItems: data.overdueItems,
          enrolledStudents: data.studentsEnrolled,
          periodVisits,
          periodCheckouts,
          returnRate,
        }}
        attendanceLogs={periodAttendance}
        inventoryStatusCounts={data.inventoryStatusCounts}
        categoryBreakdown={data.categoryBreakdown}
        topBooks={topBooks}
        topReaders={topReaders}
        gradeEngagement={gradeEngagement}
        overdueAndActiveLoans={overdueAndActiveLoans}
      />
    </div>
  );
}
