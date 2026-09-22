"use server";

import { supabase } from "@/lib/supabase";

export interface CheckoutResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    bookAccession: string;
    bookTitle?: string;
    studentName: string;
    studentId: string;
    dueDate: string;
  };
}

export interface ReturnResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ActiveLoanItem {
  id: string;
  book_accession: string;
  student_id: string;
  checkout_date: string;
  due_date: string;
  status: string;
  Physical_Books?: {
    call_number?: string;
    Book_Metadata?: {
      title?: string;
      author?: string;
    };
  };
  Students?: {
    full_name?: string;
    grade_level?: string;
  };
}

/**
 * Check out a book to a student:
 * - Verifies the student exists.
 * - Verifies the book exists and its status is 'Available'.
 * - Inserts a new row into Loans (status: 'Active', due_date: 7 days from now).
 * - Updates Physical_Books status to 'Checked Out'.
 */
export async function checkoutBook(
  studentId: string,
  accessionNumber: string
): Promise<CheckoutResult> {
  try {
    const cleanStudentId = studentId.trim().toUpperCase();
    const cleanAccession = accessionNumber.trim().toUpperCase();

    if (!cleanStudentId) {
      return { success: false, error: "Please provide a Student Library ID (e.g. WSI-S-0001)." };
    }
    if (!cleanAccession) {
      return { success: false, error: "Please provide a Book Accession Number (e.g. WSI-0001)." };
    }

    // 1. Verify Student exists
    const { data: student, error: studentError } = await supabase
      .from("Students")
      .select("library_id, full_name, grade_level")
      .ilike("library_id", cleanStudentId)
      .maybeSingle();

    if (studentError) {
      return { success: false, error: `Student lookup failed: ${studentError.message}` };
    }
    if (!student) {
      return {
        success: false,
        error: `Student with Library ID "${cleanStudentId}" was not found. Please check the ID or enroll the student first in Student Management.`,
      };
    }

    // 2. Verify Book exists and check its availability
    const { data: book, error: bookError } = await supabase
      .from("Physical_Books")
      .select("accession_number, status, call_number, Book_Metadata(title, author)")
      .ilike("accession_number", cleanAccession)
      .maybeSingle();

    if (bookError) {
      return { success: false, error: `Book lookup failed: ${bookError.message}` };
    }
    if (!book) {
      return {
        success: false,
        error: `Book with Accession Number "${cleanAccession}" was not found in the catalog.`,
      };
    }

    // Check status
    if (book.status && book.status.toLowerCase() !== "available") {
      return {
        success: false,
        error: `Book "${book.accession_number}" is currently "${book.status}" and cannot be borrowed.`,
      };
    }

    // 3. Compute loan dates: Due date is 7 days from today
    const checkoutDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    // 4. Insert new loan transaction into Loans table
    const { error: loanInsertError } = await supabase
      .from("Loans")
      .insert({
        book_accession: book.accession_number,
        student_id: student.library_id,
        checkout_date: checkoutDate.toISOString(),
        due_date: dueDate.toISOString(),
        status: "Active",
      });

    if (loanInsertError) {
      return {
        success: false,
        error: `Failed to create loan record: ${loanInsertError.message}`,
      };
    }

    // 5. Update Physical_Books status to 'Checked Out'
    const { error: statusUpdateError } = await supabase
      .from("Physical_Books")
      .update({ status: "Checked Out" })
      .eq("accession_number", book.accession_number);

    if (statusUpdateError) {
      return {
        success: false,
        error: `Loan recorded, but failed to update book status: ${statusUpdateError.message}`,
      };
    }

    const title = (book.Book_Metadata as { title?: string })?.title || book.accession_number;
    const formattedDue = dueDate.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return {
      success: true,
      message: `Successfully checked out "${title}" (${book.accession_number}) to ${student.full_name} (${student.library_id}). Due back on ${formattedDue}.`,
      data: {
        bookAccession: book.accession_number,
        bookTitle: title,
        studentName: student.full_name,
        studentId: student.library_id,
        dueDate: dueDate.toISOString(),
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred during checkout.";
    return { success: false, error: msg };
  }
}

/**
 * Return a borrowed book:
 * - Finds the 'Active' loan for the accession number.
 * - Updates the loan status to 'Returned' (and sets returned_date).
 * - Updates Physical_Books status back to 'Available'.
 */
export async function returnBook(accessionNumber: string): Promise<ReturnResult> {
  try {
    const cleanAccession = accessionNumber.trim().toUpperCase();
    if (!cleanAccession) {
      return { success: false, error: "Please provide a Book Accession Number (e.g. WSI-0001)." };
    }

    // 1. Verify Book exists
    const { data: book, error: bookError } = await supabase
      .from("Physical_Books")
      .select("accession_number, status, Book_Metadata(title)")
      .ilike("accession_number", cleanAccession)
      .maybeSingle();

    if (bookError) {
      return { success: false, error: `Book lookup failed: ${bookError.message}` };
    }
    if (!book) {
      return {
        success: false,
        error: `Book with Accession Number "${cleanAccession}" was not found.`,
      };
    }

    // 2. Find active loan for this accession number
    const { data: activeLoan, error: loanFetchError } = await supabase
      .from("Loans")
      .select("id, status, student_id, Students(full_name)")
      .eq("book_accession", book.accession_number)
      .ilike("status", "active")
      .order("checkout_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (loanFetchError) {
      return { success: false, error: `Error finding loan record: ${loanFetchError.message}` };
    }

    // If active loan found, update loan status to 'Returned'
    if (activeLoan) {
      const { error: loanUpdateError } = await supabase
        .from("Loans")
        .update({
          status: "Returned",
          returned_date: new Date().toISOString(),
        })
        .eq("id", activeLoan.id);

      if (loanUpdateError) {
        return {
          success: false,
          error: `Failed to update loan status: ${loanUpdateError.message}`,
        };
      }
    }

    // 3. Update Physical_Books status back to 'Available'
    const { error: bookStatusError } = await supabase
      .from("Physical_Books")
      .update({ status: "Available" })
      .eq("accession_number", book.accession_number);

    if (bookStatusError) {
      return {
        success: false,
        error: `Failed to update book status to Available: ${bookStatusError.message}`,
      };
    }

    const title = (book.Book_Metadata as { title?: string })?.title || book.accession_number;
    const borrower = (activeLoan?.Students as { full_name?: string })?.full_name
      ? ` (previously borrowed by ${(activeLoan?.Students as { full_name?: string })?.full_name})`
      : "";

    return {
      success: true,
      message: `Book "${title}" (${book.accession_number}) has been returned successfully${borrower}. Status is now Available.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred during book return.";
    return { success: false, error: msg };
  }
}

/**
 * Fetch all currently active loans for the circulation dashboard.
 */
export async function getActiveLoans(): Promise<{
  success: boolean;
  loans: ActiveLoanItem[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
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
      .ilike("status", "active")
      .order("checkout_date", { ascending: false });

    if (error) {
      return { success: false, loans: [], error: error.message };
    }

    return {
      success: true,
      loans: (data as unknown as ActiveLoanItem[]) || [],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load active loans.";
    return { success: false, loans: [], error: msg };
  }
}
