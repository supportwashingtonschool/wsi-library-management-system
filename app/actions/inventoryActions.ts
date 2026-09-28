"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export interface InventoryPhysicalCopy {
  accession_number: string;
  isbn: string;
  call_number: string | null;
  status: string;
  created_at?: string;
}

export interface InventoryBook {
  isbn: string;
  title: string;
  author: string;
  cover_url: string | null;
  category: string | null;
  publisher: string | null;
  published_year: string | null;
  publication_year?: string | null;
  place_of_publication?: string | null;
  created_at?: string;
  Physical_Books: InventoryPhysicalCopy[];
}

export interface InventorySearchResult {
  success: boolean;
  books: InventoryBook[];
  error?: string;
}

export interface UpdateMetadataPayload {
  title: string;
  author: string;
  publisher?: string;
  published_year?: string;
  category?: string;
  cover_url?: string;
}

/**
 * Queries Book_Metadata table to return a list of all distinct categories currently in the database.
 */
export async function getUniqueCategories(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("Book_Metadata")
      .select("category");

    if (error) {
      console.error("Error fetching unique categories:", error.message);
      return [];
    }

    const categoriesSet = new Set<string>();
    (data || []).forEach((row) => {
      if (row.category && typeof row.category === "string") {
        const trimmed = row.category.trim();
        if (trimmed) {
          categoriesSet.add(trimmed);
        }
      }
    });

    return Array.from(categoriesSet).sort((a, b) => a.localeCompare(b));
  } catch (err: unknown) {
    console.error("Unexpected error in getUniqueCategories:", err);
    return [];
  }
}

/**
 * Searches Book_Metadata by title, author, or ISBN.
 * If categoryFilter is provided (and not 'All'), filters by category.
 * Joins related Physical_Books array for each result.
 */
export async function searchInventory(
  query: string = "",
  categoryFilter?: string
): Promise<InventorySearchResult> {
  try {
    const trimmed = query.trim();
    const sanitized = trimmed.replace(/[%_,]/g, " ").trim();
    const cleanCategory = categoryFilter?.trim();

    let req = supabase
      .from("Book_Metadata")
      .select("*, Physical_Books(*)");

    if (cleanCategory && cleanCategory.toLowerCase() !== "all") {
      req = req.ilike("category", `%${cleanCategory}%`);
    }

    if (sanitized) {
      req = req
        .or(
          `title.ilike.%${sanitized}%,author.ilike.%${sanitized}%,isbn.ilike.%${sanitized}%,category.ilike.%${sanitized}%`
        )
        .order("created_at", { ascending: false })
        .limit(50);
    } else {
      req = req
        .order("created_at", { ascending: false })
        .limit(50);
    }

    const { data, error } = await req;

    if (error) {
      return { success: false, books: [], error: error.message };
    }

    // Normalize published_year / publication_year
    const normalized: InventoryBook[] = (data || []).map((b) => ({
      ...b,
      published_year: b.published_year || b.publication_year || null,
      Physical_Books: b.Physical_Books || [],
    }));

    return {
      success: true,
      books: normalized,
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to search inventory.";
    return { success: false, books: [], error: msg };
  }
}

/**
 * Updates Book_Metadata row (Title, Author, Publisher, Published Year, Category, Cover URL) for given ISBN.
 */
export async function updateMetadata(
  isbn: string,
  updatedData: UpdateMetadataPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanIsbn = isbn.trim();
    if (!cleanIsbn) {
      return { success: false, error: "ISBN is required." };
    }

    const title = updatedData.title?.trim();
    if (!title) {
      return { success: false, error: "Book title cannot be empty." };
    }

    const author = updatedData.author?.trim();
    if (!author) {
      return { success: false, error: "Author cannot be empty." };
    }

    const payload = {
      title,
      author,
      publisher: updatedData.publisher?.trim() || null,
      published_year: updatedData.published_year?.trim() || null,
      category: updatedData.category?.trim() || null,
      cover_url: updatedData.cover_url?.trim() || null,
    };

    const { error } = await supabase
      .from("Book_Metadata")
      .update(payload)
      .eq("isbn", cleanIsbn);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/inventory");
    revalidatePath("/");

    return { success: true };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to update book metadata.";
    return { success: false, error: msg };
  }
}

/**
 * Updates call_number and status in Physical_Books table for a specific accession number.
 */
export async function updatePhysicalCopy(
  accessionNumber: string,
  callNumber: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanAccession = accessionNumber.trim().toUpperCase();
    if (!cleanAccession) {
      return { success: false, error: "Accession number is required." };
    }

    const cleanCall = callNumber.trim() || null;
    const cleanStatus = status.trim() || "Available";

    const { error } = await supabase
      .from("Physical_Books")
      .update({
        call_number: cleanCall,
        status: cleanStatus,
      })
      .eq("accession_number", cleanAccession);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/inventory");
    revalidatePath("/");

    return { success: true };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to update physical copy.";
    return { success: false, error: msg };
  }
}

/**
 * Deletes a specific row from Physical_Books.
 * Prevents deletion if the copy is currently checked out on an active loan.
 */
export async function deletePhysicalCopy(
  accessionNumber: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanAccession = accessionNumber.trim().toUpperCase();
    if (!cleanAccession) {
      return { success: false, error: "Accession number is required." };
    }

    // 1. Verify physical copy exists
    const { data: copy, error: copyError } = await supabase
      .from("Physical_Books")
      .select("accession_number, status, isbn")
      .eq("accession_number", cleanAccession)
      .maybeSingle();

    if (copyError) {
      return { success: false, error: `Lookup error: ${copyError.message}` };
    }
    if (!copy) {
      return {
        success: false,
        error: `Physical copy ${cleanAccession} not found.`,
      };
    }

    // 2. Check if there are active loans for this copy
    const { data: activeLoans, error: loanErr } = await supabase
      .from("Loans")
      .select("id, status")
      .eq("book_accession", cleanAccession)
      .ilike("status", "active");

    if (loanErr) {
      return {
        success: false,
        error: `Loan check failed: ${loanErr.message}`,
      };
    }

    if (activeLoans && activeLoans.length > 0) {
      return {
        success: false,
        error: `Cannot delete copy ${cleanAccession} because it is currently checked out to a student. Please return the book first.`,
      };
    }

    // 3. Remove past returned loan records to prevent foreign key restriction
    await supabase
      .from("Loans")
      .delete()
      .eq("book_accession", cleanAccession);

    // 4. Delete the physical copy
    const { error: deleteError } = await supabase
      .from("Physical_Books")
      .delete()
      .eq("accession_number", cleanAccession);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/inventory");
    revalidatePath("/");

    return { success: true };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to delete physical copy.";
    return { success: false, error: msg };
  }
}

/**
 * Permanently deletes a book from the catalog (Book_Metadata).
 * Also safely cleans up all associated physical copies and past loan history,
 * provided none of its physical copies are currently checked out on an active loan.
 */
export async function deleteBook(
  isbn: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanIsbn = isbn.trim();
    if (!cleanIsbn) {
      return { success: false, error: "ISBN is required." };
    }

    // 1. Verify book exists in Book_Metadata
    const { data: book, error: bookErr } = await supabase
      .from("Book_Metadata")
      .select("isbn, title")
      .eq("isbn", cleanIsbn)
      .maybeSingle();

    if (bookErr) {
      return { success: false, error: `Lookup error: ${bookErr.message}` };
    }
    if (!book) {
      return { success: false, error: `Book with ISBN ${cleanIsbn} not found.` };
    }

    // 2. Fetch all physical copies linked to this ISBN
    const { data: copies, error: copyErr } = await supabase
      .from("Physical_Books")
      .select("accession_number")
      .eq("isbn", cleanIsbn);

    if (copyErr) {
      return { success: false, error: `Failed to check copies: ${copyErr.message}` };
    }

    const accessionNumbers = (copies || []).map((c) => c.accession_number);

    // 3. If there are physical copies, verify none are actively borrowed
    if (accessionNumbers.length > 0) {
      const { data: activeLoans, error: loanErr } = await supabase
        .from("Loans")
        .select("id, book_accession, status")
        .in("book_accession", accessionNumbers)
        .ilike("status", "active");

      if (loanErr) {
        return { success: false, error: `Failed to check active loans: ${loanErr.message}` };
      }

      if (activeLoans && activeLoans.length > 0) {
        const borrowedAccessions = Array.from(
          new Set(activeLoans.map((l) => l.book_accession))
        ).join(", ");
        return {
          success: false,
          error: `Cannot delete "${book.title}" because physical copy (${borrowedAccessions}) is currently on an active loan to a student. Please return the book in the Circulation Desk first.`,
        };
      }

      // 4. Remove past returned loans for these physical copies to satisfy foreign key constraints
      const { error: deleteLoansErr } = await supabase
        .from("Loans")
        .delete()
        .in("book_accession", accessionNumbers);

      if (deleteLoansErr) {
        return {
          success: false,
          error: `Failed to clear historical loan records: ${deleteLoansErr.message}`,
        };
      }

      // 5. Delete all physical copies of this book
      const { error: deleteCopiesErr } = await supabase
        .from("Physical_Books")
        .delete()
        .eq("isbn", cleanIsbn);

      if (deleteCopiesErr) {
        return {
          success: false,
          error: `Failed to delete physical copies: ${deleteCopiesErr.message}`,
        };
      }
    }

    // 6. Delete the book metadata record
    const { error: deleteMetaErr } = await supabase
      .from("Book_Metadata")
      .delete()
      .eq("isbn", cleanIsbn);

    if (deleteMetaErr) {
      return {
        success: false,
        error: `Failed to delete book metadata: ${deleteMetaErr.message}`,
      };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/inventory");
    revalidatePath("/");

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete book.";
    return { success: false, error: msg };
  }
}
