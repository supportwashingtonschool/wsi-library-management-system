"use server";

import { supabase } from "@/lib/supabase";
import {
  getAttendanceLogsForDashboard,
  type AttendanceLogItem,
} from "@/app/actions/attendanceActions";

export interface RecentLoanItem {
  id: string;
  book_accession: string;
  student_id: string;
  checkout_date: string;
  due_date: string;
  status: string;
  Physical_Books?: {
    call_number?: string | null;
    Book_Metadata?: {
      title?: string | null;
      author?: string | null;
    } | null;
  } | null;
  Students?: {
    full_name?: string | null;
    grade_level?: string | null;
  } | null;
}

export interface InventoryStatusCounts {
  available: number;
  checkedOut: number;
  lost: number;
  damaged: number;
  maintenance: number;
  total: number;
}

export interface CategoryBreakdownItem {
  category: string;
  titleCount: number;
  copyCount: number;
  availableCount: number;
  borrowedCount: number;
}

export interface GradeBreakdownItem {
  gradeLevel: string;
  enrolledStudents: number;
}

export interface LoanAnalyticsItem {
  id: string;
  book_accession: string;
  student_id: string;
  checkout_date: string;
  due_date: string;
  returned_date?: string | null;
  status: string;
  Physical_Books?: {
    call_number?: string | null;
    isbn?: string | null;
    Book_Metadata?: {
      isbn?: string | null;
      title?: string | null;
      author?: string | null;
      category?: string | null;
    } | null;
  } | null;
  Students?: {
    full_name?: string | null;
    grade_level?: string | null;
  } | null;
}

export interface DashboardData {
  totalCataloged: number; // Physical copy count
  totalTitles: number;    // Unique title count in Book_Metadata
  activeLoans: number;
  studentsEnrolled: number;
  overdueItems: number;
  recentLoans: RecentLoanItem[];
  auditTimestamp: string;
  // Comprehensive analytics & WSI LRC reporting datasets
  inventoryStatusCounts: InventoryStatusCounts;
  categoryBreakdown: CategoryBreakdownItem[];
  gradeEnrollment: GradeBreakdownItem[];
  allLoans: LoanAnalyticsItem[];
  attendanceLogs: AttendanceLogItem[];
  todayVisitsCount: number;
  currentlyInsideCount: number;
}

export interface DashboardResponse {
  success: boolean;
  data: DashboardData;
  error?: string;
}

/**
 * Server Action to fetch aggregate library metrics, circulation datasets,
 * collection analytics, and student attendance logs.
 */
export async function getDashboardData(): Promise<DashboardResponse> {
  const timestamp = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  try {
    const [
      physicalBooksRes,
      titlesRes,
      studentsRes,
      loansRes,
      attendanceRes,
    ] = await Promise.all([
      // 1. Fetch physical books with status and book metadata
      supabase
        .from("Physical_Books")
        .select(`
          accession_number,
          status,
          isbn,
          call_number,
          Book_Metadata (
            isbn,
            title,
            category
          )
        `),

      // 2. Count total unique titles
      supabase
        .from("Book_Metadata")
        .select("isbn", { count: "exact" }),

      // 3. Fetch students to count and aggregate grade enrollments
      supabase
        .from("Students")
        .select("library_id, full_name, grade_level"),

      // 4. Fetch all loans with joined book metadata and student info
      supabase
        .from("Loans")
        .select(`
          id,
          book_accession,
          student_id,
          checkout_date,
          due_date,
          returned_date,
          status,
          Physical_Books (
            call_number,
            isbn,
            Book_Metadata (
              isbn,
              title,
              author,
              category
            )
          ),
          Students (
            full_name,
            grade_level
          )
        `)
        .order("checkout_date", { ascending: false }),

      // 5. Fetch attendance logs for WSI LRC Daily Statistics
      getAttendanceLogsForDashboard(),
    ]);

    // --- 1. Compute Inventory & Category Breakdowns ---
    const physicalCopies = physicalBooksRes.data || [];
    const statusCounts: InventoryStatusCounts = {
      available: 0,
      checkedOut: 0,
      lost: 0,
      damaged: 0,
      maintenance: 0,
      total: physicalCopies.length,
    };

    const categoryMap = new Map<
      string,
      { isbns: Set<string>; copyCount: number; available: number; borrowed: number }
    >();

    for (const copy of physicalCopies) {
      const rawStatus = (copy.status || "").trim().toLowerCase();
      if (rawStatus === "available") {
        statusCounts.available++;
      } else if (rawStatus === "checked out" || rawStatus === "borrowed") {
        statusCounts.checkedOut++;
      } else if (rawStatus === "lost") {
        statusCounts.lost++;
      } else if (rawStatus === "damaged") {
        statusCounts.damaged++;
      } else if (rawStatus === "maintenance") {
        statusCounts.maintenance++;
      } else {
        statusCounts.available++;
      }

      const meta = copy.Book_Metadata as { isbn?: string; title?: string; category?: string } | null;
      const categoryName = (meta?.category || "").trim() || "General / Uncategorized";
      const isbnKey = meta?.isbn || copy.isbn || copy.accession_number;

      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          isbns: new Set<string>(),
          copyCount: 0,
          available: 0,
          borrowed: 0,
        });
      }
      const entry = categoryMap.get(categoryName)!;
      entry.isbns.add(isbnKey);
      entry.copyCount++;
      if (rawStatus === "available") entry.available++;
      if (rawStatus === "checked out" || rawStatus === "borrowed") entry.borrowed++;
    }

    const categoryBreakdown: CategoryBreakdownItem[] = Array.from(categoryMap.entries())
      .map(([cat, val]) => ({
        category: cat,
        titleCount: val.isbns.size,
        copyCount: val.copyCount,
        availableCount: val.available,
        borrowedCount: val.borrowed,
      }))
      .sort((a, b) => b.copyCount - a.copyCount);

    // --- 2. Compute Unique Titles Count ---
    const totalTitlesCount = titlesRes.count ?? (titlesRes.data ? titlesRes.data.length : 0);

    // --- 3. Compute Grade Enrollment ---
    const studentsList = studentsRes.data || [];
    const gradeEnrollmentMap = new Map<string, number>();

    for (const st of studentsList) {
      const grade = (st.grade_level || "").trim() || "Unspecified";
      gradeEnrollmentMap.set(grade, (gradeEnrollmentMap.get(grade) || 0) + 1);
    }

    const gradeEnrollment: GradeBreakdownItem[] = Array.from(gradeEnrollmentMap.entries())
      .map(([gradeLevel, enrolledStudents]) => ({ gradeLevel, enrolledStudents }))
      .sort((a, b) => a.gradeLevel.localeCompare(b.gradeLevel, undefined, { numeric: true }));

    // --- 4. Process Loans & Active / Overdue Metrics ---
    const allLoans = (loansRes.data as unknown as LoanAnalyticsItem[]) || [];
    const recentLoans: RecentLoanItem[] = allLoans.slice(0, 5).map((l) => ({
      id: l.id,
      book_accession: l.book_accession,
      student_id: l.student_id,
      checkout_date: l.checkout_date,
      due_date: l.due_date,
      status: l.status,
      Physical_Books: l.Physical_Books
        ? {
            call_number: l.Physical_Books.call_number,
            Book_Metadata: l.Physical_Books.Book_Metadata
              ? {
                  title: l.Physical_Books.Book_Metadata.title,
                  author: l.Physical_Books.Book_Metadata.author,
                }
              : null,
          }
        : null,
      Students: l.Students,
    }));

    const nowTime = Date.now();
    let activeLoansCount = 0;
    let overdueItemsCount = 0;

    for (const loan of allLoans) {
      const statusLower = (loan.status || "").toLowerCase();
      const isLate =
        statusLower === "overdue" ||
        (statusLower === "active" && new Date(loan.due_date).getTime() < nowTime);

      if (statusLower === "active") {
        activeLoansCount++;
      }
      if (isLate) {
        overdueItemsCount++;
      }
    }

    // --- 5. Attendance Analytics ---
    const attendanceLogs = attendanceRes.logs || [];
    const todayStr = new Date().toDateString();
    let todayVisitsCount = 0;
    let currentlyInsideCount = 0;

    for (const att of attendanceLogs) {
      if (new Date(att.time_in).toDateString() === todayStr) {
        todayVisitsCount++;
      }
      if (att.time_out === null) {
        currentlyInsideCount++;
      }
    }

    return {
      success: true,
      data: {
        totalCataloged: statusCounts.total,
        totalTitles: totalTitlesCount,
        activeLoans: activeLoansCount,
        studentsEnrolled: studentsList.length,
        overdueItems: overdueItemsCount,
        recentLoans,
        auditTimestamp: timestamp,
        inventoryStatusCounts: statusCounts,
        categoryBreakdown,
        gradeEnrollment,
        allLoans,
        attendanceLogs,
        todayVisitsCount,
        currentlyInsideCount,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load dashboard data.";
    console.error("Dashboard data error:", message);
    return {
      success: false,
      data: {
        totalCataloged: 0,
        totalTitles: 0,
        activeLoans: 0,
        studentsEnrolled: 0,
        overdueItems: 0,
        recentLoans: [],
        auditTimestamp: timestamp,
        inventoryStatusCounts: {
          available: 0,
          checkedOut: 0,
          lost: 0,
          damaged: 0,
          maintenance: 0,
          total: 0,
        },
        categoryBreakdown: [],
        gradeEnrollment: [],
        allLoans: [],
        attendanceLogs: [],
        todayVisitsCount: 0,
        currentlyInsideCount: 0,
      },
      error: message,
    };
  }
}
