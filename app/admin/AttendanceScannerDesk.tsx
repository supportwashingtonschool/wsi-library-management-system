"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Image from "next/image";
import {
  ScanLine,
  UserCheck,
  BookOpen,
  AlertCircle,
  LogOut,
  Pencil,
  Trash2,
  Search,
  Filter,
  Users,
  X,
  Check,
  RefreshCw,
} from "lucide-react";
import {
  scanStudentAttendance,
  manualTimeOutAttendance,
  timeOutAllActiveAttendance,
  updateAttendanceDetails,
  deleteAttendanceLog,
  type AttendanceLogItem,
  type ScanAttendanceResult,
} from "@/app/actions/attendanceActions";

interface AttendanceScannerDeskProps {
  initialLogs: AttendanceLogItem[];
  currentlyInsideCount?: number;
  todayVisitsCount?: number;
}

const REMARK_PRESETS = ["Reading", "Research", "Study", "Borrow / Return", "LRC Use"];

export default function AttendanceScannerDesk({
  initialLogs,
  currentlyInsideCount = 0,
  todayVisitsCount = 0,
}: AttendanceScannerDeskProps) {
  const [logs, setLogs] = useState<AttendanceLogItem[]>(initialLogs);
  const [studentBarcode, setStudentBarcode] = useState("");
  const [bookInput, setBookInput] = useState("");
  const [remarks, setRemarks] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTodayOnly, setFilterTodayOnly] = useState(true);

  const [isPending, startTransition] = useTransition();
  const [scanResult, setScanResult] = useState<ScanAttendanceResult | null>(null);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBook, setEditBook] = useState("");
  const [editRemarks, setEditRemarks] = useState("");

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Sync initial logs when parent updates
  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  // Keep focus on barcode input for fast scanning
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanBarcode = studentBarcode.trim();
    if (!cleanBarcode) return;

    startTransition(async () => {
      const res = await scanStudentAttendance(cleanBarcode, bookInput.trim(), remarks.trim());
      setScanResult(res);

      if (res.success && res.record) {
        setLogs((prev) => {
          // If record updated (e.g. TIME_OUT)
          const idx = prev.findIndex((p) => p.id === res.record!.id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = res.record!;
            return next;
          }
          // If new record (TIME_IN)
          return [res.record!, ...prev];
        });

        // Reset inputs
        setStudentBarcode("");
        setBookInput("");
        setRemarks("");
      }

      // Re-focus scanner
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);
    });
  };

  const handleManualTimeOut = async (id: string) => {
    startTransition(async () => {
      const res = await manualTimeOutAttendance(id);
      if (res.success) {
        const nowIso = new Date().toISOString();
        setLogs((prev) =>
          prev.map((item) => (item.id === id ? { ...item, time_out: nowIso } : item))
        );
      }
    });
  };

  const handleTimeOutAll = async () => {
    if (!confirm("Are you sure you want to mark Time Out for all students currently inside?")) {
      return;
    }
    startTransition(async () => {
      const res = await timeOutAllActiveAttendance();
      if (res.success) {
        const nowIso = new Date().toISOString();
        setLogs((prev) =>
          prev.map((item) => (item.time_out === null ? { ...item, time_out: nowIso } : item))
        );
      }
    });
  };

  const handleSaveEdit = async (id: string) => {
    startTransition(async () => {
      const res = await updateAttendanceDetails(id, {
        bookInput: editBook,
        remarks: editRemarks,
      });
      if (res.success) {
        setLogs((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  book_title: editBook.trim() || item.book_title,
                  remarks: editRemarks.trim() || item.remarks,
                }
              : item
          )
        );
        setEditingId(null);
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this attendance entry?")) return;
    startTransition(async () => {
      const res = await deleteAttendanceLog(id);
      if (res.success) {
        setLogs((prev) => prev.filter((item) => item.id !== id));
      }
    });
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  const calculateDuration = (inIso: string, outIso?: string | null) => {
    if (!outIso) return null;
    try {
      const mins = Math.max(
        1,
        Math.round((new Date(outIso).getTime() - new Date(inIso).getTime()) / 60000)
      );
      if (mins < 60) return `${mins}m`;
      const hrs = Math.floor(mins / 60);
      const rem = mins % 60;
      return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
    } catch {
      return null;
    }
  };

  const todayDateStr = new Date().toDateString();

  const filteredLogs = logs.filter((log) => {
    if (filterTodayOnly) {
      if (new Date(log.time_in).toDateString() !== todayDateStr) {
        return false;
      }
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const student = log.Students;
    return (
      log.student_id.toLowerCase().includes(q) ||
      (student?.full_name || "").toLowerCase().includes(q) ||
      (student?.grade_level || "").toLowerCase().includes(q) ||
      (log.book_title || "").toLowerCase().includes(q) ||
      (log.book_accession || "").toLowerCase().includes(q) ||
      (log.remarks || "").toLowerCase().includes(q)
    );
  });

  const activeCount = logs.filter((l) => l.time_out === null).length;
  const todayCount = logs.filter(
    (l) => new Date(l.time_in).toDateString() === todayDateStr
  ).length;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden space-y-0">
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/30 border border-blue-400/30 rounded-xl text-blue-300">
              <ScanLine className="h-5 w-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>WSI LRC Daily Attendance & Reading Log</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Time In / Out
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Scan student ID barcode to record Time In &amp; Time Out, log in-library reading material,
            and monitor live student attendance in the Learning Resource Center.
          </p>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-3">
          <div className="bg-emerald-950/60 border border-emerald-500/30 rounded-xl px-4 py-2 text-center">
            <span className="block text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
              Currently Inside
            </span>
            <span className="text-xl font-extrabold text-emerald-300">
              {activeCount || currentlyInsideCount}
            </span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2 text-center">
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Today&apos;s Visits
            </span>
            <span className="text-xl font-extrabold text-white">
              {todayCount || todayVisitsCount}
            </span>
          </div>
        </div>
      </div>

      {/* Barcode Scanner Console */}
      <div className="p-6 bg-slate-50/70 border-b border-slate-200">
        <form onSubmit={handleScanSubmit} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Student Barcode Input (Primary) */}
            <div className="lg:col-span-5 relative">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <ScanLine className="h-3.5 w-3.5 text-blue-600" />
                <span>Student ID Barcode (Auto-Toggle In / Out)</span>
                <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={studentBarcode}
                  onChange={(e) => setStudentBarcode(e.target.value)}
                  placeholder="Scan Student ID Barcode (e.g. WSI-LRC-S-0064)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-blue-500/50 rounded-xl text-sm font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-inner"
                  disabled={isPending}
                  autoComplete="off"
                />
                <ScanLine className="absolute left-3.5 top-3 h-4 w-4 text-blue-500" />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Tip: 1st scan logs <strong className="text-emerald-700">Time In</strong>. Scanning again while inside logs <strong className="text-blue-700">Time Out</strong>.
              </p>
            </div>

            {/* Book Read Barcode / Title Input (Optional) */}
            <div className="lg:col-span-4">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                <span>Book Read (Scan WSI-XXXX or Title)</span>
                <span className="text-slate-400 font-normal lowercase">(optional)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={bookInput}
                  onChange={(e) => setBookInput(e.target.value)}
                  placeholder="Scan Book Accession (e.g. WSI-0139) or Title..."
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition shadow-xs"
                  disabled={isPending}
                />
                <BookOpen className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            {/* Submit / Scan Button */}
            <div className="lg:col-span-3 flex items-end">
              <button
                type="submit"
                disabled={isPending || !studentBarcode.trim()}
                className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm py-2.5 px-4 rounded-xl transition shadow-sm disabled:opacity-50 disabled:pointer-events-none"
              >
                {isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Processing Scan...</span>
                  </>
                ) : (
                  <>
                    <ScanLine className="h-4 w-4" />
                    <span>Scan / Log Visit</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Remarks Row & Preset Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/80">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <span>Quick Remarks:</span>
            </span>
            {REMARK_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRemarks(preset)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition font-medium ${
                  remarks === preset
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                }`}
              >
                {preset}
              </button>
            ))}
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Or type custom remarks..."
              className="flex-1 min-w-[180px] px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition"
              disabled={isPending}
            />
          </div>
        </form>

        {/* Scan Status Toast Banner */}
        {scanResult && (
          <div
            className={`mt-4 p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm transition animate-in fade-in slide-in-from-top-1 ${
              scanResult.success
                ? scanResult.action === "TIME_IN"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-blue-50 border-blue-200 text-blue-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-3">
              {scanResult.success ? (
                scanResult.action === "TIME_IN" ? (
                  <div className="p-1.5 rounded-lg bg-emerald-600 text-white">
                    <UserCheck className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="p-1.5 rounded-lg bg-blue-600 text-white">
                    <LogOut className="h-4 w-4" />
                  </div>
                )
              ) : (
                <div className="p-1.5 rounded-lg bg-rose-600 text-white">
                  <AlertCircle className="h-4 w-4" />
                </div>
              )}

              <div>
                <span className="font-bold">
                  {scanResult.action === "TIME_IN"
                    ? "TIME IN RECORDED"
                    : scanResult.action === "TIME_OUT"
                    ? "TIME OUT RECORDED"
                    : "SCAN NOTICE"}
                  :{" "}
                </span>
                <span>{scanResult.message || scanResult.error}</span>
              </div>
            </div>

            <button
              onClick={() => setScanResult(null)}
              className="text-slate-400 hover:text-slate-700 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Daily Attendance Table Controls */}
      <div className="p-4 sm:px-6 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student, ID, book or remarks..."
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white w-56 sm:w-72 transition"
            />
          </div>

          <button
            type="button"
            onClick={() => setFilterTodayOnly((v) => !v)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
              filterTodayOnly
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Filter className="h-3 w-3" />
            <span>{filterTodayOnly ? "Showing Today's Logs" : "Showing All History"}</span>
          </button>
        </div>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={handleTimeOutAll}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Time Out All Active ({activeCount})</span>
          </button>
        )}
      </div>

      {/* Live Table (WSI LRC DAILY STATISTICS Layout) */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
            <tr>
              <th className="py-3 px-6">Date</th>
              <th className="py-3 px-4">Time In</th>
              <th className="py-3 px-6">LRC No. / Student Borrower</th>
              <th className="py-3 px-6">Book Read (In LRC)</th>
              <th className="py-3 px-4">Time Out</th>
              <th className="py-3 px-6">Remarks</th>
              <th className="py-3 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="space-y-2">
                    <ScanLine className="h-8 w-8 mx-auto text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">
                      {filterTodayOnly ? "No student attendance recorded today yet." : "No attendance logs found."}
                    </p>
                    <p className="text-xs text-slate-400">
                      Scan a Student ID barcode above to log their library visit.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredLogs.map((item) => {
                const student = item.Students;
                const isInside = item.time_out === null;
                const isEditing = editingId === item.id;
                const duration = calculateDuration(item.time_in, item.time_out);

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/80 transition ${
                      isInside ? "bg-emerald-50/20" : ""
                    }`}
                  >
                    {/* Date */}
                    <td className="py-3.5 px-6 whitespace-nowrap text-slate-600 font-medium">
                      {formatDate(item.time_in)}
                    </td>

                    {/* Time In */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-900">
                      {formatTime(item.time_in)}
                    </td>

                    {/* LRC No. & Student */}
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                          {student?.photo_url ? (
                            <Image
                              src={student.photo_url}
                              alt={student.full_name || item.student_id}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          ) : (
                            <Users className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <span className="block font-bold text-slate-900">
                            {student?.full_name || "Unenrolled Borrower"}
                          </span>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                            <span className="font-bold text-[#7A2828]">{item.student_id}</span>
                            {student?.grade_level && (
                              <>
                                <span>•</span>
                                <span className="text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded font-sans text-[10px] font-semibold">
                                  {student.grade_level}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Book Read */}
                    <td className="py-3.5 px-6">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editBook}
                          onChange={(e) => setEditBook(e.target.value)}
                          placeholder="Accession or Title..."
                          className="w-full px-2 py-1 bg-white border border-blue-400 rounded text-xs text-slate-800"
                        />
                      ) : item.book_title ? (
                        <div className="space-y-0.5 max-w-xs">
                          <span className="block font-medium text-slate-800 line-clamp-1">
                            {item.book_title}
                          </span>
                          {item.book_accession && (
                            <span className="inline-block text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                              {item.book_accession}
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditBook("");
                            setEditRemarks(item.remarks || "");
                          }}
                          className="text-xs text-slate-400 hover:text-blue-600 italic flex items-center gap-1"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>+ Add Book</span>
                        </button>
                      )}
                    </td>

                    {/* Time Out */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {isInside ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-2.5 py-1 rounded-full animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          <span>Currently Inside</span>
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="block font-bold text-slate-800">
                            {formatTime(item.time_out)}
                          </span>
                          {duration && (
                            <span className="block text-[10px] font-medium text-slate-400">
                              Duration: {duration}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Remarks */}
                    <td className="py-3.5 px-6">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editRemarks}
                          onChange={(e) => setEditRemarks(e.target.value)}
                          placeholder="Remarks..."
                          className="w-full px-2 py-1 bg-white border border-blue-400 rounded text-xs text-slate-800"
                        />
                      ) : item.remarks ? (
                        <span className="inline-block text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                          {item.remarks}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(item.id)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                              title="Save changes"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            {isInside && (
                              <button
                                type="button"
                                onClick={() => handleManualTimeOut(item.id)}
                                disabled={isPending}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition shadow-2xs"
                                title="Record Time Out"
                              >
                                <LogOut className="h-3 w-3" />
                                <span>Time Out</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(item.id);
                                setEditBook(item.book_title || item.book_accession || "");
                                setEditRemarks(item.remarks || "");
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                              title="Edit Book Read or Remarks"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
