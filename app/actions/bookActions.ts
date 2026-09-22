"use server";

import { supabase } from "@/lib/supabase";

export interface BookMetadata {
  isbn: string;
  title: string;
  author: string;
  cover_url: string;
  category: string;
  publisher: string;
  published_year: string;
  call_number?: string;
}

export interface BookMetadataPayload {
  isbn: string;
  title: string;
  author: string;
  cover_url?: string;
  category?: string;
  publisher?: string;
  published_year?: string;
  call_number?: string;
}

export interface SaveBookResult {
  success: boolean;
  accessionNumbers?: string[];
  error?: string;
}

/**
 * Fetch book metadata with Google Books API + API key support,
 * and resilient OpenLibrary fallback (maps to standard metadata).
 * Returns null if both services fail or find nothing.
 */
export async function fetchBookFromGoogle(isbn: string): Promise<BookMetadata | null> {
  const cleanIsbn = isbn.replace(/[-\s]/g, "").trim();
  if (!cleanIsbn) {
    return null;
  }

  // 1. Attempt Google Books API with GOOGLE_BOOKS_API_KEY support
  try {
    const apiKeyParam = process.env.GOOGLE_BOOKS_API_KEY
      ? `&key=${process.env.GOOGLE_BOOKS_API_KEY}`
      : "";
    const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(cleanIsbn)}${apiKeyParam}`;

    const googleRes = await fetch(googleUrl, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });

    if (googleRes.ok) {
      const googleData = await googleRes.json();
      if (googleData.totalItems > 0 && googleData.items && googleData.items.length > 0) {
        const volumeInfo = googleData.items[0].volumeInfo || {};

        let cover_url =
          volumeInfo.imageLinks?.thumbnail ||
          volumeInfo.imageLinks?.smallThumbnail ||
          "";
        if (cover_url.startsWith("http://")) {
          cover_url = cover_url.replace(/^http:\/\//i, "https://");
        }

        // If Google Books has no cover image, fallback to OpenLibrary covers
        if (!cover_url) {
          try {
            const olCoverCheck = await fetch(
              `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`,
              { method: "HEAD", next: { revalidate: 86400 } }
            );
            if (olCoverCheck.ok) {
              cover_url = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;
            }
          } catch {
            // ignore network issues with cover check
          }
        }

        let published_year = "";
        if (volumeInfo.publishedDate) {
          const yearMatch = String(volumeInfo.publishedDate).match(/\b\d{4}\b/);
          published_year = yearMatch ? yearMatch[0] : String(volumeInfo.publishedDate);
        }

        return {
          isbn: cleanIsbn,
          title: volumeInfo.title || "",
          author: Array.isArray(volumeInfo.authors)
            ? volumeInfo.authors.join(", ")
            : volumeInfo.authors || "",
          cover_url,
          category: Array.isArray(volumeInfo.categories)
            ? volumeInfo.categories.join(", ")
            : volumeInfo.categories || "",
          publisher: volumeInfo.publisher || "",
          published_year,
        };
      }
    }
  } catch (googleError) {
    console.warn("Google Books API request failed, falling back to OpenLibrary:", googleError);
  }

  // 2. OpenLibrary Fallback: Primary endpoint
  try {
    const olBibKey = `ISBN:${cleanIsbn}`;
    const openLibraryUrl = `https://openlibrary.org/api/books?bibkeys=${olBibKey}&jscmd=data&format=json`;

    const olRes = await fetch(openLibraryUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "WSILibraryManagementSystem/1.0",
      },
      next: { revalidate: 3600 },
    });

    if (olRes.ok) {
      const olData = await olRes.json();
      const bookObj = olData[olBibKey];

      if (bookObj && bookObj.title) {
        let published_year = "";
        if (bookObj.publish_date) {
          const match = String(bookObj.publish_date).match(/\b\d{4}\b/);
          published_year = match ? match[0] : String(bookObj.publish_date);
        }

        const author = Array.isArray(bookObj.authors)
          ? bookObj.authors.map((a: { name?: string }) => a.name || "").filter(Boolean).join(", ")
          : "";

        const publisher = Array.isArray(bookObj.publishers)
          ? bookObj.publishers.map((p: { name?: string }) => p.name || "").filter(Boolean).join(", ")
          : "";

        const category = Array.isArray(bookObj.subjects)
          ? bookObj.subjects.map((s: { name?: string }) => s.name || "").slice(0, 3).filter(Boolean).join(", ")
          : "";

        const cover_url =
          bookObj.cover?.large ||
          bookObj.cover?.medium ||
          `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;

        return {
          isbn: cleanIsbn,
          title: bookObj.title || "",
          author,
          cover_url,
          category,
          publisher,
          published_year,
        };
      }
    }

    // 3. OpenLibrary Fallback: Secondary direct ISBN endpoint (follow redirects)
    const directOlUrl = `https://openlibrary.org/isbn/${cleanIsbn}.json`;
    const directRes = await fetch(directOlUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "WSILibraryManagementSystem/1.0",
      },
      redirect: "follow",
      next: { revalidate: 3600 },
    });

    if (directRes.ok) {
      const directJson = await directRes.json();
      if (directJson && directJson.title) {
        let published_year = "";
        if (directJson.publish_date) {
          const match = String(directJson.publish_date).match(/\b\d{4}\b/);
          published_year = match ? match[0] : String(directJson.publish_date);
        }

        let author = "";
        if (Array.isArray(directJson.authors) && directJson.authors.length > 0) {
          author = directJson.authors.map((a: { name?: string }) => a.name || "").filter(Boolean).join(", ");
        } else if (Array.isArray(directJson.author) && directJson.author.length > 0) {
          author = directJson.author.join(", ");
        }

        let publisher = "";
        if (Array.isArray(directJson.publishers)) {
          publisher = directJson.publishers
            .map((p: { name?: string } | string) => (typeof p === "string" ? p : p.name || ""))
            .filter(Boolean)
            .join(", ");
        }

        return {
          isbn: cleanIsbn,
          title: directJson.title || "",
          author,
          cover_url: `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`,
          category: "",
          publisher,
          published_year,
        };
      }
    }
  } catch (olError) {
    console.warn("OpenLibrary fallback failed:", olError);
  }

  // 4. Return gracefully as null if both APIs fail or find no items
  return null;
}

/**
 * Upsert book metadata and insert physical book copy records with sequential accession numbers.
 */
export async function saveBook(
  bookData: BookMetadataPayload,
  copies: number = 1
): Promise<SaveBookResult> {
  try {
    const cleanIsbn = bookData.isbn.replace(/[-\s]/g, "").trim();
    if (!cleanIsbn) {
      return { success: false, error: "ISBN is required." };
    }
    if (!bookData.title.trim()) {
      return { success: false, error: "Title is required." };
    }

    // 1. Upsert metadata into Book_Metadata
    const metaPayload: Record<string, unknown> = {
      isbn: cleanIsbn,
      title: bookData.title.trim(),
      author: bookData.author.trim(),
      cover_url: bookData.cover_url?.trim() || null,
      category: bookData.category?.trim() || null,
      publisher: bookData.publisher?.trim() || null,
      published_year: bookData.published_year?.trim() || null,
    };

    let { error: metaError } = await supabase
      .from("Book_Metadata")
      .upsert(metaPayload, { onConflict: "isbn" });

    // Fallback: If DB table uses 'publication_year' instead of 'published_year'
    if (metaError && (metaError.message.includes("published_year") || metaError.message.includes("schema cache"))) {
      delete metaPayload.published_year;
      metaPayload.publication_year = bookData.published_year?.trim() || null;
      const retry = await supabase
        .from("Book_Metadata")
        .upsert(metaPayload, { onConflict: "isbn" });
      metaError = retry.error;
    }

    if (metaError) {
      return { success: false, error: `Failed to save metadata: ${metaError.message}` };
    }

    // 2. Query Physical_Books to determine the highest existing accession number
    const { data: physicalBooks, error: fetchError } = await supabase
      .from("Physical_Books")
      .select("accession_number");

    if (fetchError) {
      return { success: false, error: `Failed to query existing copies: ${fetchError.message}` };
    }

    let maxNumber = 0;
    if (physicalBooks && physicalBooks.length > 0) {
      for (const item of physicalBooks) {
        if (item.accession_number) {
          const match = item.accession_number.match(/^WSI-(\d+)$/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNumber) {
              maxNumber = num;
            }
          }
        }
      }
    }

    // 3. Generate sequential accession numbers and copy records
    const copyCount = Math.max(1, Math.floor(copies || 1));
    const newAccessionNumbers: string[] = [];
    const newPhysicalRecords = [];

    for (let i = 1; i <= copyCount; i++) {
      const currentSeq = maxNumber + i;
      const formattedAccession = `WSI-${String(currentSeq).padStart(4, "0")}`;
      newAccessionNumbers.push(formattedAccession);

      newPhysicalRecords.push({
        accession_number: formattedAccession,
        isbn: cleanIsbn,
        call_number: bookData.call_number?.trim() || null,
        status: "Available",
      });
    }

    // 4. Insert physical book rows
    const { error: insertError } = await supabase
      .from("Physical_Books")
      .insert(newPhysicalRecords);

    if (insertError) {
      return { success: false, error: `Failed to create physical copy records: ${insertError.message}` };
    }

    return {
      success: true,
      accessionNumbers: newAccessionNumbers,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred while saving the book.";
    return { success: false, error: message };
  }
}
