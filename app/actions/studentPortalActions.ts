"use server";

import { supabase } from "@/lib/supabase";

export interface StudentProfile {
  library_id: string;
  full_name: string;
  grade_level: string;
  created_at?: string;
}

export interface LoanBookMetadata {
  isbn: string;
  title: string;
  author: string;
  category?: string | null;
  cover_url?: string | null;
  publisher?: string | null;
  published_year?: string | null;
  publication_year?: string | null;
  place_of_publication?: string | null;
}

export interface LoanPhysicalBook {
  accession_number: string;
  isbn: string;
  status: string;
  call_number?: string | null;
  created_at?: string;
  Book_Metadata?: LoanBookMetadata | null;
}

export interface StudentLoan {
  id: string;
  book_accession: string;
  student_id: string;
  checkout_date: string;
  due_date: string;
  status: string;
  returned_date?: string | null;
  created_at?: string;
  Physical_Books?: LoanPhysicalBook | null;
}

export interface StudentDashboardResponse {
  success: boolean;
  error?: string;
  student?: StudentProfile;
  loans?: StudentLoan[];
}

/**
 * Server Action to fetch student profile and their full loan history.
 *
 * 1. Query the Students table to ensure the library_id exists.
 *    If not, return an error: 'Student not found'.
 * 2. Query the Loans table where student_id matches the libraryId,
 *    joining Physical_Books and Book_Metadata.
 */
export async function getStudentDashboard(
  libraryId: string
): Promise<StudentDashboardResponse> {
  try {
    const cleanId = (libraryId || "").trim().toUpperCase();

    if (!cleanId) {
      return {
        success: false,
        error: "Please enter your Library ID (e.g., WSI-S-0001).",
      };
    }

    // 1. First, query the Students table to verify the library_id exists
    const { data: student, error: studentError } = await supabase
      .from("Students")
      .select("library_id, full_name, grade_level, created_at")
      .ilike("library_id", cleanId)
      .maybeSingle();

    if (studentError) {
      return {
        success: false,
        error: `Database error during student lookup: ${studentError.message}`,
      };
    }

    if (!student) {
      return {
        success: false,
        error: "Student not found",
      };
    }

    // 2. Second, query the Loans table where student_id matches libraryId
    // Foreign key joins fetch related book data in a single round-trip:
    // select('*, Physical_Books(*, Book_Metadata(*))')
    const { data: loans, error: loansError } = await supabase
      .from("Loans")
      .select("*, Physical_Books(*, Book_Metadata(*))")
      .ilike("student_id", student.library_id)
      .order("checkout_date", { ascending: false });

    if (loansError) {
      return {
        success: false,
        error: `Failed to load student loans: ${loansError.message}`,
      };
    }

    return {
      success: true,
      student,
      loans: (loans as unknown as StudentLoan[]) || [],
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return {
      success: false,
      error: message,
    };
  }
}
