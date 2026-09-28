"use server";

import { supabase } from "@/lib/supabase";

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

export interface DashboardData {
  totalCataloged: number; // Physical copy count
  totalTitles: number;    // Unique title count in Book_Metadata
  activeLoans: number;
  studentsEnrolled: number;
  overdueItems: number;
  recentLoans: RecentLoanItem[];
  auditTimestamp: string;
}

export interface DashboardResponse {
  success: boolean;
  data: DashboardData;
  error?: string;
}

/**
 * Server Action to fetch aggregate library metrics and recent loans.
 * - Counts total physical copies cataloged (Physical_Books).
 * - Counts unique titles cataloged (Book_Metadata).
 * - Counts active loans (Loans).
 * - Counts enrolled students (Students).
 * - Counts overdue loans.
 * - Retrieves the 5 most recent loan activities.
 */
export async function getDashboardData(): Promise<DashboardResponse> {
  const timestamp = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  try {
    const nowIso = new Date().toISOString();

    const [
      physicalBooksRes,
      titlesRes,
      activeLoansRes,
      studentsRes,
      overdueRes,
      recentLoansRes,
    ] = await Promise.all([
      // 1. Count total physical copies in Physical_Books
      supabase
        .from("Physical_Books")
        .select("*", { count: "exact", head: true }),

      // 2. Count total unique titles in Book_Metadata
      supabase
        .from("Book_Metadata")
        .select("*", { count: "exact", head: true }),

      // 3. Count total rows in Loans where status is 'Active' or 'active' (Active Loans)
      supabase
        .from("Loans")
        .select("*", { count: "exact", head: true })
        .ilike("status", "active"),

      // 4. Count total rows in Students (Students Enrolled)
      supabase
        .from("Students")
        .select("*", { count: "exact", head: true }),

      // 5. Count total rows in Loans where status is 'Active' or 'active' AND due_date < current date (Overdue Items)
      supabase
        .from("Loans")
        .select("*", { count: "exact", head: true })
        .ilike("status", "active")
        .lt("due_date", nowIso),

      // 6. Fetch the 5 most recent rows from Loans table, joining Physical_Books, Book_Metadata, and Students
      supabase
        .from("Loans")
        .select(`
          id,
          book_accession,
          student_id,
          checkout_date,
          due_date,
          status,
          Physical_Books (
            call_number,
            Book_Metadata (
              title,
              author
            )
          ),
          Students (
            full_name,
            grade_level
          )
        `)
        .order("checkout_date", { ascending: false })
        .limit(5),
    ]);

    // Resilient fallback if exact head count returned undefined:
    let resolvedCataloged = physicalBooksRes.count ?? 0;
    if (resolvedCataloged === 0 && !physicalBooksRes.error) {
      // Secondary fallback query
      const fallbackPhys = await supabase.from("Physical_Books").select("accession_number");
      if (fallbackPhys.data && fallbackPhys.data.length > 0) {
        resolvedCataloged = fallbackPhys.data.length;
      }
    }

    let resolvedTitles = titlesRes.count ?? 0;
    if (resolvedTitles === 0 && !titlesRes.error) {
      const fallbackMeta = await supabase.from("Book_Metadata").select("isbn");
      if (fallbackMeta.data && fallbackMeta.data.length > 0) {
        resolvedTitles = fallbackMeta.data.length;
      }
    }

    let resolvedStudents = studentsRes.count ?? 0;
    if (resolvedStudents === 0 && !studentsRes.error) {
      const fallbackStud = await supabase.from("Students").select("library_id");
      if (fallbackStud.data && fallbackStud.data.length > 0) {
        resolvedStudents = fallbackStud.data.length;
      }
    }

    if (physicalBooksRes.error) console.error("Error fetching physical books count:", physicalBooksRes.error);
    if (titlesRes.error) console.error("Error fetching titles count:", titlesRes.error);
    if (activeLoansRes.error) console.error("Error fetching active loans:", activeLoansRes.error);
    if (studentsRes.error) console.error("Error fetching students:", studentsRes.error);
    if (overdueRes.error) console.error("Error fetching overdue loans:", overdueRes.error);
    if (recentLoansRes.error) console.error("Error fetching recent loans:", recentLoansRes.error);

    return {
      success: true,
      data: {
        totalCataloged: resolvedCataloged,
        totalTitles: resolvedTitles,
        activeLoans: activeLoansRes.count ?? 0,
        studentsEnrolled: resolvedStudents,
        overdueItems: overdueRes.count ?? 0,
        recentLoans: (recentLoansRes.data as unknown as RecentLoanItem[]) || [],
        auditTimestamp: timestamp,
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
      },
      error: message,
    };
  }
}
