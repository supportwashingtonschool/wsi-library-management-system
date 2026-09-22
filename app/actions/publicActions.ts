"use server";

import { supabase } from "@/lib/supabase";

export interface CatalogBook {
  isbn: string;
  title: string;
  author: string;
  cover_url: string | null;
  category: string | null;
  publisher?: string | null;
  published_year?: string | null;
  publication_year?: string | null;
  call_number?: string | null;
  available_copies: number;
  total_copies: number;
}

/**
 * Search the public catalog:
 * - If query is empty, returns the 10 most recently added books.
 * - If query is provided, searches by title, author, category, or isbn using case-insensitive ilike.
 * - Counts 'Available' physical copies for each matching title.
 */
export async function searchCatalog(query: string = ""): Promise<CatalogBook[]> {
  try {
    const trimmed = query.trim();
    // Sanitize query by removing characters that could break PostgREST or filter syntax
    const sanitized = trimmed.replace(/[%_,]/g, " ").trim();

    let booksQuery = supabase
      .from("Book_Metadata")
      .select("*");

    if (sanitized) {
      booksQuery = booksQuery
        .or(
          `title.ilike.%${sanitized}%,author.ilike.%${sanitized}%,category.ilike.%${sanitized}%,isbn.ilike.%${sanitized}%`
        )
        .order("created_at", { ascending: false })
        .limit(50);
    } else {
      booksQuery = booksQuery
        .order("created_at", { ascending: false })
        .limit(10);
    }

    const { data: books, error: booksError } = await booksQuery;

    if (booksError) {
      console.error("Error fetching catalog books:", booksError);
      return [];
    }

    if (!books || books.length === 0) {
      return [];
    }

    // Extract all ISBNs to query physical copy availability
    const isbns = books.map((b) => b.isbn);
    const { data: physicalCopies, error: copiesError } = await supabase
      .from("Physical_Books")
      .select("isbn, status, call_number")
      .in("isbn", isbns);

    if (copiesError) {
      console.error("Error fetching physical book copies:", copiesError);
    }

    const copiesList = physicalCopies || [];

    // Map each book with its count of available copies
    const results: CatalogBook[] = books.map((book) => {
      const bookCopies = copiesList.filter((c) => c.isbn === book.isbn);
      const availableCount = bookCopies.filter(
        (c) => c.status && c.status.toLowerCase() === "available"
      ).length;

      // Find first call number if assigned
      const callNumber = bookCopies.find((c) => c.call_number)?.call_number || null;

      const year = book.published_year || book.publication_year || null;

      return {
        isbn: book.isbn,
        title: book.title,
        author: book.author,
        cover_url: book.cover_url || null,
        category: book.category || null,
        publisher: book.publisher || null,
        published_year: year,
        call_number: callNumber,
        available_copies: availableCount,
        total_copies: bookCopies.length,
      };
    });

    return results;
  } catch (err: unknown) {
    console.error("Unexpected error in searchCatalog:", err);
    return [];
  }
}
