"use client";

import { useState } from "react";
import {
  FileText,
  Download,
  Printer,
  X,
  Building2,
  Layers,
  Users,
  Repeat,
  AlertCircle,
  Clock,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  InventoryStatusCounts,
  CategoryBreakdownItem,
  LoanAnalyticsItem,
} from "@/app/actions/dashboardActions";
import type { AttendanceLogItem } from "@/app/actions/attendanceActions";

interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodLabel: string;
  dateRangeText: string;
  kpiSummary: {
    totalCataloged: number;
    totalTitles: number;
    activeLoans: number;
    overdueItems: number;
    enrolledStudents: number;
    periodVisits: number;
    periodCheckouts: number;
    returnRate: string;
  };
  attendanceLogs: AttendanceLogItem[];
  inventoryStatusCounts: InventoryStatusCounts;
  categoryBreakdown: CategoryBreakdownItem[];
  topBooks: Array<{ title: string; accession?: string; author?: string; category?: string; count: number }>;
  topReaders: Array<{ name: string; libraryId: string; gradeLevel: string; count: number }>;
  gradeEngagement: Array<{ grade: string; enrolled: number; loans: number; visits: number }>;
  overdueAndActiveLoans: LoanAnalyticsItem[];
}

export default function ReportExportModal({
  isOpen,
  onClose,
  periodLabel,
  dateRangeText,
  kpiSummary,
  attendanceLogs,
  inventoryStatusCounts,
  categoryBreakdown,
  topBooks,
  topReaders,
  gradeEngagement,
  overdueAndActiveLoans,
}: ReportExportModalProps) {
  // Section toggle states
  const [includeKpi, setIncludeKpi] = useState(true);
  const [includeAttendance, setIncludeAttendance] = useState(true);
  const [includeInventory, setIncludeInventory] = useState(true);
  const [includePopular, setIncludePopular] = useState(true);
  const [includeGrade, setIncludeGrade] = useState(true);
  const [includeOverdue, setIncludeOverdue] = useState(true);
  const [includeSignatories, setIncludeSignatories] = useState(true);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!isOpen) return null;

  const reportDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const reportTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  /**
   * Helper to fetch an image asset and convert it to a base64 Data URL for jsPDF.
   */
  const getImageDataUrl = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  /**
   * Generates and downloads the official WSI LRC PDF Report.
   */
  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let currentY = 14;

      // 1. Official Maroon Header Banner (#7A2828)
      doc.setFillColor(122, 40, 40);
      doc.rect(10, currentY, pageWidth - 20, 24, "F");

      // Try loading logo
      const logoDataUrl = await getImageDataUrl("/wsi-logo.png");
      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, "PNG", 14, currentY + 2, 20, 20);
        } catch {
          // Continue if image add fails
        }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("WASHINGTON SCHOOL PHILIPPINES", 38, currentY + 7);

      doc.setFontSize(10);
      doc.setTextColor(254, 240, 138); // Amber-100
      doc.text("LEARNING RESOURCE CENTER (WSI LRC)", 38, currentY + 13);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text("Lot 3 South Horizon I, Governor's Drive, Brgy. Cabilang Baybay Carmona Cavite", 38, currentY + 18.5);

      currentY += 30;

      // Report Title & Period Metadata
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("OFFICIAL LIBRARY STATISTICS & CIRCULATION REPORT", 10, currentY);

      currentY += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Reporting Period: ${periodLabel} (${dateRangeText})  |  Generated: ${reportDate} at ${reportTime}`, 10, currentY);

      currentY += 6;

      // 2. Executive KPI Summary Table
      if (includeKpi) {
        autoTable(doc, {
          startY: currentY,
          head: [["Metric Category", "Summary Count", "Details / Health Status"]],
          body: [
            ["Total Physical Holdings", `${kpiSummary.totalCataloged} Copies`, `${kpiSummary.totalTitles} unique cataloged titles`],
            ["Registered Student Borrowers", `${kpiSummary.enrolledStudents} Students`, "Enrolled library cardholders"],
            ["Circulation in Period", `${kpiSummary.periodCheckouts} Checkouts`, `${kpiSummary.returnRate} return rate`],
            ["Active Loans & Overdue Items", `${kpiSummary.activeLoans} Active Loans`, `${kpiSummary.overdueItems} overdue requiring follow-up`],
            ["LRC Student Attendance (Visits)", `${kpiSummary.periodVisits} Recorded Visits`, "Total in-library student attendance sessions"],
          ],
          theme: "striped",
          headStyles: { fillColor: [122, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
          styles: { fontSize: 8, cellPadding: 2 },
          margin: { left: 10, right: 10 },
        });
        currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      }

      // 3. WSI LRC Daily Attendance & Reading Log Table
      if (includeAttendance && attendanceLogs.length > 0) {
        if (currentY > pageHeight - 45) {
          doc.addPage();
          currentY = 16;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(122, 40, 40);
        doc.text("WSI LRC DAILY ATTENDANCE & IN-LIBRARY READING LOG", 10, currentY);
        currentY += 3;

        const attendanceRows = attendanceLogs.slice(0, 30).map((log) => [
          new Date(log.time_in).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          new Date(log.time_in).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
          log.student_id,
          log.Students ? `${log.Students.full_name || ""} (${log.Students.grade_level || ""})` : "—",
          log.book_title || "—",
          log.time_out
            ? new Date(log.time_out).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
            : "Currently Inside",
          log.remarks || "—",
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [["Date", "Time In", "LRC No.", "Student & Grade", "Book Read", "Time Out", "Remarks"]],
          body: attendanceRows,
          theme: "grid",
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
          styles: { fontSize: 7, cellPadding: 1.8 },
          margin: { left: 10, right: 10 },
        });
        currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      }

      // 4. Inventory Health & Category Breakdown
      if (includeInventory) {
        if (currentY > pageHeight - 50) {
          doc.addPage();
          currentY = 16;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(122, 40, 40);
        doc.text("COLLECTION & INVENTORY HEALTH BREAKDOWN", 10, currentY);
        currentY += 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(
          `Holdings Status: ${inventoryStatusCounts.available} Available, ${inventoryStatusCounts.checkedOut} Checked Out, ${inventoryStatusCounts.maintenance} Maintenance, ${inventoryStatusCounts.lost} Lost`,
          10,
          currentY
        );
        currentY += 3;

        const catRows = categoryBreakdown.slice(0, 15).map((c) => [
          c.category,
          String(c.titleCount),
          String(c.copyCount),
          String(c.availableCount),
          String(c.borrowedCount),
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [["Category / Subject", "Titles", "Total Copies", "Available", "Borrowed / Out"]],
          body: catRows,
          theme: "striped",
          headStyles: { fillColor: [122, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
          styles: { fontSize: 7.5, cellPadding: 1.8 },
          margin: { left: 10, right: 10 },
        });
        currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      }

      // 5. Popular Titles & Top Student Readers
      if (includePopular && (topBooks.length > 0 || topReaders.length > 0)) {
        if (currentY > pageHeight - 50) {
          doc.addPage();
          currentY = 16;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(122, 40, 40);
        doc.text("POPULAR TITLES & TOP STUDENT BORROWERS", 10, currentY);
        currentY += 3;

        const maxRows = Math.max(topBooks.length, topReaders.length, 1);
        const combinedRows = [];
        for (let i = 0; i < Math.min(5, maxRows); i++) {
          const book = topBooks[i];
          const reader = topReaders[i];
          combinedRows.push([
            book ? `${i + 1}. ${book.title} (${book.count}x)` : "—",
            book?.category || "—",
            reader ? `${i + 1}. ${reader.name} (${reader.libraryId})` : "—",
            reader ? `${reader.gradeLevel} • ${reader.count} loans` : "—",
          ]);
        }

        autoTable(doc, {
          startY: currentY,
          head: [["Top Borrowed Book Title", "Category", "Top Student Reader", "Grade & Loans"]],
          body: combinedRows,
          theme: "striped",
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
          styles: { fontSize: 7.5, cellPadding: 2 },
          margin: { left: 10, right: 10 },
        });
        currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      }

      // 6. Grade-Level Engagement Breakdown
      if (includeGrade && gradeEngagement.length > 0) {
        if (currentY > pageHeight - 50) {
          doc.addPage();
          currentY = 16;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(122, 40, 40);
        doc.text("STUDENT ENGAGEMENT BY GRADE LEVEL", 10, currentY);
        currentY += 3;

        const gradeRows = gradeEngagement.map((g) => [
          g.grade,
          String(g.enrolled),
          String(g.loans),
          String(g.visits),
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [["Grade Level", "Enrolled Students", "Period Checkouts", "LRC Attendance Visits"]],
          body: gradeRows,
          theme: "striped",
          headStyles: { fillColor: [122, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
          styles: { fontSize: 7.5, cellPadding: 1.8 },
          margin: { left: 10, right: 10 },
        });
        currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      }

      // 7. Actionable Overdue & Active Loans Watchlist
      if (includeOverdue && overdueAndActiveLoans.length > 0) {
        if (currentY > pageHeight - 45) {
          doc.addPage();
          currentY = 16;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(122, 40, 40);
        doc.text("OVERDUE & ACTIVE LOANS WATCHLIST", 10, currentY);
        currentY += 3;

        const overdueRows = overdueAndActiveLoans.slice(0, 20).map((item) => {
          const isLate =
            (item.status || "").toLowerCase() === "overdue" ||
            ((item.status || "").toLowerCase() === "active" && new Date(item.due_date).getTime() < Date.now());
          const daysOverdue = isLate
            ? Math.max(1, Math.floor((Date.now() - new Date(item.due_date).getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

          return [
            item.book_accession,
            item.Physical_Books?.Book_Metadata?.title || "Unknown Book",
            item.Students?.full_name || item.student_id,
            item.Students?.grade_level || "—",
            new Date(item.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            isLate ? `OVERDUE (${daysOverdue} days)` : "Active Loan",
          ];
        });

        autoTable(doc, {
          startY: currentY,
          head: [["Accession", "Book Title", "Student Borrower", "Grade", "Due Date", "Status"]],
          body: overdueRows,
          theme: "grid",
          headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: "bold" },
          styles: { fontSize: 7.5, cellPadding: 1.8 },
          margin: { left: 10, right: 10 },
        });
        currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      }

      // 8. Official Signatories Block
      if (includeSignatories) {
        if (currentY > pageHeight - 45) {
          doc.addPage();
          currentY = 20;
        } else {
          currentY += 6;
        }

        // Draw signatures side by side
        const sigY = currentY + 12;

        // Try adding Principal signature image over principal's line
        const principalSigUrl = await getImageDataUrl("/principal-signature.png");
        if (principalSigUrl) {
          try {
            doc.addImage(principalSigUrl, "PNG", pageWidth - 78, sigY - 14, 34, 16);
          } catch {
            // continue
          }
        }

        // Left Signatory: School Librarian
        doc.setDrawColor(148, 163, 184);
        doc.line(20, sigY, 80, sigY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text("ESTER V. ROBLES", 50, sigY + 4, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text("School Librarian", 50, sigY + 8, { align: "center" });

        // Right Signatory: School Principal
        doc.line(pageWidth - 80, sigY, pageWidth - 20, sigY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text("JONATHAN SON P. ACERON", pageWidth - 50, sigY + 4, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text("School Principal", pageWidth - 50, sigY + 8, { align: "center" });
      }

      // Add Page Numbers in Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${i} of ${totalPages}  •  Washington School Philippines — Learning Resource Center (WSI LRC)`,
          pageWidth / 2,
          pageHeight - 7,
          { align: "center" }
        );
      }

      // Save PDF
      const cleanPeriod = periodLabel.replace(/\s+/g, "-").toLowerCase();
      const filenameDate = new Date().toISOString().split("T")[0];
      doc.save(`WSI-LRC-Report-${cleanPeriod}-${filenameDate}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to export PDF. Please check your browser console or try printing instead.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  /**
   * Triggers native browser print with styled preview sheet.
   */
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="p-4 sm:px-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#7A2828] text-white rounded-lg">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Official Library Statistics &amp; PDF Report
              </h2>
              <p className="text-xs text-slate-300">
                Reporting Period: <strong className="text-amber-300">{periodLabel}</strong> ({dateRangeText})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-lg transition"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Report</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#7A2828] hover:bg-[#8f3030] px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isGeneratingPdf ? "Generating PDF..." : "Download PDF (.pdf)"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Section Toggles Toolbar (Hidden on Print) */}
        <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center gap-3 text-xs shrink-0 print:hidden">
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mr-1">
            Include in Report:
          </span>

          <label className="inline-flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeKpi}
              onChange={(e) => setIncludeKpi(e.target.checked)}
              className="rounded text-[#7A2828] focus:ring-[#7A2828]"
            />
            <span>Executive KPI Summary</span>
          </label>

          <label className="inline-flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeAttendance}
              onChange={(e) => setIncludeAttendance(e.target.checked)}
              className="rounded text-[#7A2828] focus:ring-[#7A2828]"
            />
            <span>Daily Attendance &amp; Reading Log</span>
          </label>

          <label className="inline-flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeInventory}
              onChange={(e) => setIncludeInventory(e.target.checked)}
              className="rounded text-[#7A2828] focus:ring-[#7A2828]"
            />
            <span>Inventory &amp; Category Breakdown</span>
          </label>

          <label className="inline-flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includePopular}
              onChange={(e) => setIncludePopular(e.target.checked)}
              className="rounded text-[#7A2828] focus:ring-[#7A2828]"
            />
            <span>Popular Titles &amp; Top Readers</span>
          </label>

          <label className="inline-flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeGrade}
              onChange={(e) => setIncludeGrade(e.target.checked)}
              className="rounded text-[#7A2828] focus:ring-[#7A2828]"
            />
            <span>Grade-Level Engagement</span>
          </label>

          <label className="inline-flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeOverdue}
              onChange={(e) => setIncludeOverdue(e.target.checked)}
              className="rounded text-[#7A2828] focus:ring-[#7A2828]"
            />
            <span>Overdue Loans Watchlist</span>
          </label>

          <label className="inline-flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeSignatories}
              onChange={(e) => setIncludeSignatories(e.target.checked)}
              className="rounded text-[#7A2828] focus:ring-[#7A2828]"
            />
            <span>Official Signatories</span>
          </label>
        </div>

        {/* Live A4 / Letter Document Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/70 print:p-0 print:bg-white">
          <div
            id="printable-report"
            className="max-w-[8.27in] mx-auto bg-white p-6 sm:p-10 rounded-xl shadow-lg border border-slate-300 print:shadow-none print:border-none print:p-0 space-y-6 text-slate-800"
          >
            {/* 1. Official WSI Letterhead */}
            <div className="bg-[#7A2828] text-white p-3.5 sm:p-4 rounded-xl flex items-center gap-4 shadow-sm">
              <div className="relative w-14 h-14 bg-white rounded-full p-1 shrink-0 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/wsi-logo.png"
                  alt="WSI Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1 leading-tight">
                <h1 className="text-base sm:text-lg font-black tracking-wider uppercase text-white font-sans">
                  WASHINGTON SCHOOL PHILIPPINES
                </h1>
                <h2 className="text-xs sm:text-sm font-bold text-amber-200 uppercase tracking-wide">
                  LEARNING RESOURCE CENTER (WSI LRC)
                </h2>
                <p className="text-[10px] text-amber-100/80 font-medium mt-0.5">
                  Lot 3 South Horizon I, Governor&apos;s Drive, Brgy. Cabilang Baybay Carmona Cavite
                </p>
              </div>
            </div>

            {/* Document Title & Period Subheading */}
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  Official Library Statistics &amp; Circulation Report
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reporting Period: <strong className="text-slate-800">{periodLabel}</strong> ({dateRangeText})
                </p>
              </div>
              <div className="text-right text-[11px] text-slate-400">
                <span>Generated on {reportDate} at {reportTime}</span>
              </div>
            </div>

            {/* 2. Executive KPI Summary */}
            {includeKpi && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#7A2828] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  <span>Executive Library Summary</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="block text-slate-500 font-semibold text-[10px] uppercase">
                      Total Holdings
                    </span>
                    <span className="text-lg font-extrabold text-slate-900">
                      {kpiSummary.totalCataloged}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      {kpiSummary.totalTitles} unique titles
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="block text-slate-500 font-semibold text-[10px] uppercase">
                      Period Circulation
                    </span>
                    <span className="text-lg font-extrabold text-blue-600">
                      {kpiSummary.periodCheckouts}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      Return Rate: {kpiSummary.returnRate}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="block text-slate-500 font-semibold text-[10px] uppercase">
                      LRC Attendance
                    </span>
                    <span className="text-lg font-extrabold text-purple-600">
                      {kpiSummary.periodVisits}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      In-library student visits
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="block text-slate-500 font-semibold text-[10px] uppercase">
                      Active / Overdue
                    </span>
                    <span className="text-lg font-extrabold text-amber-700">
                      {kpiSummary.activeLoans} / {kpiSummary.overdueItems}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      {kpiSummary.overdueItems > 0 ? "Requires librarian notice" : "All loans on track"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. WSI LRC Daily Attendance & Reading Log */}
            {includeAttendance && attendanceLogs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#7A2828] uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>WSI LRC Daily Attendance &amp; Reading Log</span>
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-white text-[10px] uppercase font-bold">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-2">Time In</th>
                        <th className="py-2 px-3">LRC No. / Student</th>
                        <th className="py-2 px-3">Book Read</th>
                        <th className="py-2 px-2">Time Out</th>
                        <th className="py-2 px-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {attendanceLogs.slice(0, 15).map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 whitespace-nowrap text-slate-500">
                            {new Date(log.time_in).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </td>
                          <td className="py-1.5 px-2 whitespace-nowrap font-medium">
                            {new Date(log.time_in).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </td>
                          <td className="py-1.5 px-3">
                            <span className="font-bold text-slate-900 block">{log.Students?.full_name || log.student_id}</span>
                            <span className="text-[10px] font-mono text-slate-400">{log.student_id} • {log.Students?.grade_level || ""}</span>
                          </td>
                          <td className="py-1.5 px-3 text-slate-800">{log.book_title || "—"}</td>
                          <td className="py-1.5 px-2 whitespace-nowrap font-medium">
                            {log.time_out
                              ? new Date(log.time_out).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                              : "Currently Inside"}
                          </td>
                          <td className="py-1.5 px-3 text-slate-500">{log.remarks || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. Collection & Inventory Breakdown */}
            {includeInventory && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#7A2828] uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>Collection &amp; Inventory Breakdown</span>
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#7A2828] text-white text-[10px] uppercase font-bold">
                      <tr>
                        <th className="py-2 px-3">Category / Subject</th>
                        <th className="py-2 px-3 text-right">Unique Titles</th>
                        <th className="py-2 px-3 text-right">Total Copies</th>
                        <th className="py-2 px-3 text-right">Available Copies</th>
                        <th className="py-2 px-3 text-right">Borrowed / Out</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {categoryBreakdown.slice(0, 10).map((cat) => (
                        <tr key={cat.category} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 font-medium text-slate-900">{cat.category}</td>
                          <td className="py-1.5 px-3 text-right">{cat.titleCount}</td>
                          <td className="py-1.5 px-3 text-right font-bold text-slate-900">{cat.copyCount}</td>
                          <td className="py-1.5 px-3 text-right text-emerald-700 font-semibold">{cat.availableCount}</td>
                          <td className="py-1.5 px-3 text-right text-blue-700">{cat.borrowedCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. Popular Titles & Top Student Readers */}
            {includePopular && (topBooks.length > 0 || topReaders.length > 0) && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#7A2828] uppercase tracking-wider flex items-center gap-1.5">
                  <Repeat className="h-3.5 w-3.5" />
                  <span>Popular Titles &amp; Active Readers</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <span className="block font-bold text-slate-800 text-[11px] mb-2 uppercase">
                      Top Borrowed Books
                    </span>
                    <ul className="space-y-1.5">
                      {topBooks.slice(0, 5).map((b, i) => (
                        <li key={i} className="flex items-center justify-between">
                          <span className="font-medium text-slate-800 truncate pr-2">
                            {i + 1}. {b.title}
                          </span>
                          <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                            {b.count} loans
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <span className="block font-bold text-slate-800 text-[11px] mb-2 uppercase">
                      Top Active Readers
                    </span>
                    <ul className="space-y-1.5">
                      {topReaders.slice(0, 5).map((r, i) => (
                        <li key={i} className="flex items-center justify-between">
                          <span className="font-medium text-slate-800 truncate pr-2">
                            {i + 1}. {r.name} ({r.gradeLevel})
                          </span>
                          <span className="font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded text-[10px]">
                            {r.count} books
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 6. Grade-Level Engagement */}
            {includeGrade && gradeEngagement.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#7A2828] uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  <span>Student Engagement by Grade Level</span>
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#7A2828] text-white text-[10px] uppercase font-bold">
                      <tr>
                        <th className="py-2 px-3">Grade Level</th>
                        <th className="py-2 px-3 text-right">Enrolled Students</th>
                        <th className="py-2 px-3 text-right">Period Checkouts</th>
                        <th className="py-2 px-3 text-right">LRC Attendance Visits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {gradeEngagement.map((g) => (
                        <tr key={g.grade} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 font-semibold text-slate-900">{g.grade}</td>
                          <td className="py-1.5 px-3 text-right">{g.enrolled}</td>
                          <td className="py-1.5 px-3 text-right font-bold text-blue-700">{g.loans}</td>
                          <td className="py-1.5 px-3 text-right font-bold text-purple-700">{g.visits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 7. Overdue & Active Loans Watchlist */}
            {includeOverdue && overdueAndActiveLoans.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Overdue &amp; Active Loans Watchlist</span>
                </h4>
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-red-800 text-white text-[10px] uppercase font-bold">
                      <tr>
                        <th className="py-2 px-3">Accession</th>
                        <th className="py-2 px-3">Book Title</th>
                        <th className="py-2 px-3">Student Borrower</th>
                        <th className="py-2 px-3">Due Date</th>
                        <th className="py-2 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100 text-slate-700">
                      {overdueAndActiveLoans.slice(0, 10).map((loan) => {
                        const isLate =
                          (loan.status || "").toLowerCase() === "overdue" ||
                          ((loan.status || "").toLowerCase() === "active" &&
                            new Date(loan.due_date).getTime() < Date.now());

                        return (
                          <tr key={loan.id} className="hover:bg-red-50/40">
                            <td className="py-1.5 px-3 font-mono font-bold text-slate-800">{loan.book_accession}</td>
                            <td className="py-1.5 px-3 font-medium text-slate-900">{loan.Physical_Books?.Book_Metadata?.title || "Unknown Book"}</td>
                            <td className="py-1.5 px-3">{loan.Students?.full_name || loan.student_id}</td>
                            <td className="py-1.5 px-3">{new Date(loan.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                            <td className="py-1.5 px-3 text-right">
                              {isLate ? (
                                <span className="font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded text-[10px]">
                                  OVERDUE
                                </span>
                              ) : (
                                <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[10px]">
                                  Active
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 8. Official Signatories Block */}
            {includeSignatories && (
              <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center mt-6">
                <div className="flex flex-col items-center">
                  <div className="w-44 border-b border-slate-400 mb-1" />
                  <span className="text-xs font-bold text-slate-900 uppercase">
                    Ester V. Robles
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    School Librarian
                  </span>
                </div>

                <div className="flex flex-col items-center relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/principal-signature.png"
                    alt="Principal Signature"
                    className="absolute -top-7 w-20 h-10 object-contain pointer-events-none"
                  />
                  <div className="w-44 border-b border-slate-400 mb-1" />
                  <span className="text-xs font-bold text-slate-900 uppercase">
                    Jonathan Son P. Aceron
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    School Principal
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
