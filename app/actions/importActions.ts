"use server";

import ExcelJS from "exceljs";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export interface ParsedBookRow {
  id: string; // Unique row ID for React key & checkbox state
  title: string;
  author: string;
  publisher: string;
  category: string;
  isbn: string;
  call_number?: string;
  published_year?: string;
  isDuplicate: boolean;
  duplicateReason?: string;
}

export interface ParseExcelResult {
  success: boolean;
  books?: ParsedBookRow[];
  totalCount?: number;
  duplicateCount?: number;
  newCount?: number;
  error?: string;
}

export interface ConfirmImportBook {
  title: string;
  author: string;
  publisher?: string;
  category?: string;
  isbn?: string;
  call_number?: string;
  published_year?: string;
}

export interface ConfirmImportResult {
  success: boolean;
  count?: number;
  metadataCount?: number;
  startAccession?: string;
  endAccession?: string;
  error?: string;
}

/**
 * Safely extracts clean text from various ExcelJS cell value structures
 * (plain string, number, formula result, hyperlink, rich text, Date).
 */
function getCellValueAsString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("text" in obj && typeof obj.text === "string") {
      return obj.text.trim();
    }
    if ("result" in obj && obj.result !== undefined) {
      return String(obj.result).trim();
    }
    if ("richText" in obj && Array.isArray(obj.richText)) {
      return obj.richText
        .map((item: { text?: string }) => item.text || "")
        .join("")
        .trim();
    }
  }
  return String(value).trim();
}

/**
 * 1. Parse Excel Action (No DB Insert Yet):
 * Reads ONLY the first worksheet of the uploaded Excel file.
 * Checks for duplicates against existing Book_Metadata records (Title & ISBN).
 * Returns array of parsed books with isDuplicate flags for UI preview.
 */
export async function parseExcelFile(formData: FormData): Promise<ParseExcelResult> {
  try {
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return { success: false, error: "Please select an Excel (.xlsx) file to upload." };
    }

    // Load file into ExcelJS workbook
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    // Read ONLY the first worksheet
    const sheet = workbook.worksheets[0] || workbook.getWorksheet(1);
    if (!sheet) {
      return { success: false, error: "The uploaded Excel file contains no worksheets." };
    }

    // 1. Detect headers on Row 1 (with fallback to Row 2 if Row 1 has a sheet title)
    let titleCol = -1;
    let authorCol = -1;
    let publisherCol = -1;
    let categoryCol = -1;
    let isbnCol = -1;
    let callNumberCol = -1;
    let yearCol = -1;
    let headerRowIndex = 1;

    const scanHeaders = (rowNum: number) => {
      let found = false;
      const row = sheet.getRow(rowNum);
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const text = getCellValueAsString(cell.value)
          .toLowerCase()
          .replace(/[\r\n\t_]/g, " ")
          .trim();
        if (!text) return;

        if (text.includes("title")) {
          titleCol = colNumber;
          found = true;
        } else if (text.includes("author")) {
          authorCol = colNumber;
          found = true;
        } else if (text.includes("publisher")) {
          publisherCol = colNumber;
          found = true;
        } else if (
          text.includes("category") ||
          text.includes("genre") ||
          text.includes("subject")
        ) {
          categoryCol = colNumber;
          found = true;
        } else if (text.includes("isbn")) {
          isbnCol = colNumber;
          found = true;
        } else if (
          text.includes("call number") ||
          text.includes("call no") ||
          text.includes("call#") ||
          text.includes("callnum")
        ) {
          callNumberCol = colNumber;
          found = true;
        } else if (
          text.includes("year") ||
          text.includes("pub year") ||
          text.includes("copyright") ||
          text.includes("date")
        ) {
          yearCol = colNumber;
          found = true;
        }
      });
      return found;
    };

    scanHeaders(1);
    if (titleCol === -1) {
      if (scanHeaders(2)) {
        headerRowIndex = 2;
      }
    }

    if (titleCol === -1) {
      return {
        success: false,
        error: "Could not find a 'Title' column header in the first worksheet. Please ensure Row 1 has headers.",
      };
    }

    // 2. Query Book_Metadata table to get existing Titles and ISBNs for duplicate detection
    const { data: existingRecords, error: dbError } = await supabase
      .from("Book_Metadata")
      .select("title, isbn");

    if (dbError) {
      return {
        success: false,
        error: `Failed to query existing library records: ${dbError.message}`,
      };
    }

    const existingIsbns = new Set<string>();
    const existingTitles = new Set<string>();

    (existingRecords || []).forEach((row) => {
      if (row.isbn) {
        existingIsbns.add(row.isbn.replace(/[-\s]/g, "").trim().toLowerCase());
      }
      if (row.title) {
        existingTitles.add(row.title.trim().toLowerCase());
      }
    });

    // In-batch tracking to also catch duplicate rows inside the same spreadsheet
    const seenBatchIsbns = new Set<string>();
    const seenBatchTitles = new Set<string>();

    const parsedBooks: ParsedBookRow[] = [];
    let duplicateCount = 0;

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= headerRowIndex) return;

      const rawTitle = titleCol !== -1 ? getCellValueAsString(row.getCell(titleCol).value).trim() : "";
      // If 'Title' is missing, skip the row
      if (!rawTitle) return;

      const rawAuthor = authorCol !== -1 ? getCellValueAsString(row.getCell(authorCol).value).trim() : "";
      const rawPublisher = publisherCol !== -1 ? getCellValueAsString(row.getCell(publisherCol).value).trim() : "";
      const rawCategory = categoryCol !== -1 ? getCellValueAsString(row.getCell(categoryCol).value).trim() : "";
      const rawCallNumber = callNumberCol !== -1 ? getCellValueAsString(row.getCell(callNumberCol).value).trim() : "";

      let rawYear = yearCol !== -1 ? getCellValueAsString(row.getCell(yearCol).value).trim() : "";
      if (rawYear) {
        const match = rawYear.match(/\b\d{4}\b/);
        if (match) rawYear = match[0];
      }

      const rawIsbn = isbnCol !== -1 ? getCellValueAsString(row.getCell(isbnCol).value).replace(/[-\s]/g, "").trim() : "";

      // Duplicate check: check ISBN and Title against database and batch
      const cleanIsbnLower = rawIsbn ? rawIsbn.toLowerCase() : "";
      const cleanTitleLower = rawTitle.toLowerCase();

      let isDuplicate = false;
      let duplicateReason = "";

      if (cleanIsbnLower && existingIsbns.has(cleanIsbnLower)) {
        isDuplicate = true;
        duplicateReason = "ISBN already in catalog";
      } else if (existingTitles.has(cleanTitleLower)) {
        isDuplicate = true;
        duplicateReason = "Title already in catalog";
      } else if (cleanIsbnLower && seenBatchIsbns.has(cleanIsbnLower)) {
        isDuplicate = true;
        duplicateReason = "Duplicate ISBN in spreadsheet";
      } else if (seenBatchTitles.has(cleanTitleLower)) {
        isDuplicate = true;
        duplicateReason = "Duplicate title in spreadsheet";
      }

      if (cleanIsbnLower) seenBatchIsbns.add(cleanIsbnLower);
      seenBatchTitles.add(cleanTitleLower);

      if (isDuplicate) {
        duplicateCount++;
      }

      parsedBooks.push({
        id: `row-${rowNumber}-${Date.now()}-${parsedBooks.length}`,
        title: rawTitle,
        author: rawAuthor || "Unknown Author",
        publisher: rawPublisher,
        category: rawCategory,
        isbn: rawIsbn,
        call_number: rawCallNumber,
        published_year: rawYear,
        isDuplicate,
        duplicateReason,
      });
    });

    if (parsedBooks.length === 0) {
      return {
        success: false,
        error: "No book rows found. Please ensure your Excel sheet has rows with book titles.",
      };
    }

    return {
      success: true,
      books: parsedBooks,
      totalCount: parsedBooks.length,
      duplicateCount,
      newCount: parsedBooks.length - duplicateCount,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error parsing Excel file.";
    console.error("parseExcelFile error:", err);
    return { success: false, error: msg };
  }
}

/**
 * 2. The Safe Database Insert Action:
 * Takes the user-selected books, assigns sequential accession numbers (WSI-XXXX),
 * generates fake ISBNs for books without an ISBN, and saves records to Supabase.
 */
export async function confirmBulkImport(booksArray: ConfirmImportBook[]): Promise<ConfirmImportResult> {
  try {
    if (!booksArray || booksArray.length === 0) {
      return { success: false, error: "No books were selected for import." };
    }

    // 1. Query Physical_Books to determine the highest existing accession number
    const { data: physicalBooks, error: fetchError } = await supabase
      .from("Physical_Books")
      .select("accession_number");

    if (fetchError) {
      return {
        success: false,
        error: `Failed to query existing accession numbers: ${fetchError.message}`,
      };
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

    let currentSeq = maxNumber;
    const timestamp = Date.now();

    // 2. Prepare metadata and physical books arrays
    // Deduplicate metadata by ISBN to avoid Postgres ON CONFLICT batch conflicts
    const metadataMap = new Map<string, Record<string, unknown>>();
    const physicalBooksToInsert: Array<{
      accession_number: string;
      isbn: string;
      call_number: string | null;
      status: string;
    }> = [];

    booksArray.forEach((book, idx) => {
      let finalIsbn = book.isbn ? book.isbn.replace(/[-\s]/g, "").trim() : "";
      if (!finalIsbn) {
        finalIsbn = `WSI-CUSTOM-${timestamp}-${idx + 1}`;
      }

      if (!metadataMap.has(finalIsbn)) {
        metadataMap.set(finalIsbn, {
          isbn: finalIsbn,
          title: book.title.trim(),
          author: book.author?.trim() || "Unknown Author",
          category: book.category?.trim() || null,
          publisher: book.publisher?.trim() || null,
          published_year: book.published_year?.trim() || null,
          cover_url: finalIsbn.startsWith("WSI-CUSTOM-")
            ? null
            : `https://covers.openlibrary.org/b/isbn/${finalIsbn}-L.jpg`,
        });
      }

      currentSeq++;
      const accessionNumber = `WSI-${String(currentSeq).padStart(4, "0")}`;

      physicalBooksToInsert.push({
        accession_number: accessionNumber,
        isbn: finalIsbn,
        call_number: book.call_number?.trim() || null,
        status: "Available",
      });
    });

    const metadataArray = Array.from(metadataMap.values());
    const BATCH_SIZE = 100;

    // 3. Batch Upsert into Book_Metadata
    for (let i = 0; i < metadataArray.length; i += BATCH_SIZE) {
      const batch = metadataArray.slice(i, i + BATCH_SIZE);
      let { error: metaError } = await supabase
        .from("Book_Metadata")
        .upsert(batch, { onConflict: "isbn" });

      // Fallback: If DB schema uses 'publication_year' instead of 'published_year'
      if (
        metaError &&
        (metaError.message.includes("published_year") || metaError.message.includes("schema cache"))
      ) {
        const fallbackBatch = batch.map((item) => {
          const copy = { ...item };
          copy.publication_year = copy.published_year;
          delete copy.published_year;
          return copy;
        });
        const retry = await supabase
          .from("Book_Metadata")
          .upsert(fallbackBatch, { onConflict: "isbn" });
        metaError = retry.error;
      }

      if (metaError) {
        return {
          success: false,
          error: `Failed to insert book metadata: ${metaError.message}`,
        };
      }
    }

    // 4. Batch Insert into Physical_Books
    for (let i = 0; i < physicalBooksToInsert.length; i += BATCH_SIZE) {
      const batch = physicalBooksToInsert.slice(i, i + BATCH_SIZE);
      const { error: physError } = await supabase
        .from("Physical_Books")
        .insert(batch);

      if (physError) {
        return {
          success: false,
          error: `Failed to insert physical book copies: ${physError.message}`,
        };
      }
    }

    // Revalidate paths for instant UI sync
    revalidatePath("/admin");
    revalidatePath("/admin/cataloging");
    revalidatePath("/admin/inventory");
    revalidatePath("/");

    return {
      success: true,
      count: physicalBooksToInsert.length,
      metadataCount: metadataArray.length,
      startAccession: `WSI-${String(maxNumber + 1).padStart(4, "0")}`,
      endAccession: `WSI-${String(currentSeq).padStart(4, "0")}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error importing selected books.";
    console.error("confirmBulkImport error:", err);
    return { success: false, error: msg };
  }
}
