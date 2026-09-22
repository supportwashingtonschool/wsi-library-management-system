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
  totalCataloged: number;
  activeLoans: number;
  studentsEnrolled: number;
  overdueItems: number;
  recentLoans: RecentLoanItem[];
}

export interface DashboardResponse {
  success: boolean;
  data: DashboardData;
  error?: string;
}

/**
 * Server Action to fetch aggregate library metrics and recent loans.
 * - Counts total physical books cataloged.
 * - Counts active loans.
 * - Counts enrolled students.
 * - Counts active loans that have passed their due date (overdue).
 * - Retrieves the 5 most recent loan activities with joined book and student details.
 */
export async function getDashboardData(): Promise<DashboardResponse> {
  try {
    const nowIso = new Date().toISOString();

    const [
      catalogedRes,
      activeLoansRes,
      studentsRes,
      overdueRes,
      recentLoansRes,
    ] = await Promise.all([
      // 1. Count total rows in Physical_Books (Total Cataloged)
      supabase
        .from("Physical_Books")
        .select("*", { count: "exact", head: true }),

      // 2. Count total rows in Loans where status is 'Active' or 'active' (Active Loans)
      supabase
        .from("Loans")
        .select("*", { count: "exact", head: true })
        .ilike("status", "active"),

      // 3. Count total rows in Students (Students Enrolled)
      supabase
        .from("Students")
        .select("*", { count: "exact", head: true }),

      // 4. Count total rows in Loans where status is 'Active' or 'active' AND due_date < current date (Overdue Items)
      supabase
        .from("Loans")
        .select("*", { count: "exact", head: true })
        .ilike("status", "active")
        .lt("due_date", nowIso),

      // 5. Fetch the 5 most recent rows from Loans table, joining Physical_Books, Book_Metadata, and Students
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

    if (catalogedRes.error) console.error("Error fetching total cataloged:", catalogedRes.error);
    if (activeLoansRes.error) console.error("Error fetching active loans:", activeLoansRes.error);
    if (studentsRes.error) console.error("Error fetching students:", studentsRes.error);
    if (overdueRes.error) console.error("Error fetching overdue loans:", overdueRes.error);
    if (recentLoansRes.error) console.error("Error fetching recent loans:", recentLoansRes.error);

    return {
      success: true,
      data: {
        totalCataloged: catalogedRes.count || 0,
        activeLoans: activeLoansRes.count || 0,
        studentsEnrolled: studentsRes.count || 0,
        overdueItems: overdueRes.count || 0,
        recentLoans: (recentLoansRes.data as unknown as RecentLoanItem[]) || [],
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load dashboard data.";
    console.error("Dashboard data error:", message);
    return {
      success: false,
      data: {
        totalCataloged: 0,
        activeLoans: 0,
        studentsEnrolled: 0,
        overdueItems: 0,
        recentLoans: [],
      },
      error: message,
    };
  }
}
