"use server";

import ExcelJS from "exceljs";
import { Readable } from "node:stream";
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

export interface DetectedSheetMeta {
  sheetName: string;
  headerRowNumber: number;
  mappedColumns: Record<string, string>; // e.g. { Title: "Book Name / Title *", Author: "Writer(s) / By", ... }
  skippedBannerRows: number;
}

export interface SimulatedMetadataRow {
  isbn: string;
  title: string;
  author: string;
  category: string | null;
  publisher: string | null;
  published_year: string | null;
  cover_url: string | null;
}

export interface SimulatedPhysicalBookRow {
  accession_number: string;
  isbn: string;
  title: string;
  call_number: string | null;
  status: string;
}

export interface ParseExcelResult {
  success: boolean;
  books?: ParsedBookRow[];
  totalCount?: number;
  duplicateCount?: number;
  newCount?: number;
  detectedMeta?: DetectedSheetMeta;
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
  isDryRun?: boolean;
  count?: number;
  metadataCount?: number;
  startAccession?: string;
  endAccession?: string;
  simulatedMetadata?: SimulatedMetadataRow[];
  simulatedPhysicalBooks?: SimulatedPhysicalBookRow[];
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
 * Normalizes header cell values for fuzzy synonym matching:
 * lowercases, strips special characters, collapses whitespace.
 */
function normalizeHeader(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\r\n\t_]+/g, " ")
    .replace(/[*#()[\]:.?/\\&,;!@$%^~`'"]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type BibliographicField =
  | "title"
  | "author"
  | "publisher"
  | "category"
  | "isbn"
  | "call_number"
  | "published_year";

/**
 * Matches a normalized header string against prioritized synonym sets.
 */
function matchField(norm: string): BibliographicField | null {
  if (!norm) return null;

  // Exclude standalone item numbers / identifiers from matching as Title
  if (
    norm === "item no" ||
    norm === "item" ||
    norm === "no" ||
    norm === "id" ||
    norm === "row" ||
    norm === "num" ||
    norm === "index"
  ) {
    return null;
  }

  // 1. ISBN / Barcode / Book Code check
  if (
    norm.includes("isbn") ||
    norm.includes("barcode") ||
    norm.includes("ean") ||
    norm.includes("book code") ||
    norm.includes("standard book number")
  ) {
    return "isbn";
  }

  // 2. Title check:
  // Must match title / book name / name of book, but NOT book code / book id / book no
  if (
    (norm.includes("title") ||
      norm.includes("book name") ||
      norm.includes("name of book") ||
      norm.includes("item title") ||
      norm.includes("publication title")) &&
    !norm.includes("book code") &&
    !norm.includes("book id") &&
    !norm.includes("book no") &&
    !norm.startsWith("total ") &&
    !norm.startsWith("summary ")
  ) {
    return "title";
  }

  // 3. Author / Writer / Creator check
  if (
    norm.includes("author") ||
    norm.includes("writer") ||
    norm.includes("creator") ||
    norm.includes("written by") ||
    norm.split(" ").includes("by")
  ) {
    return "author";
  }

  // 4. Publisher / Press check
  if (
    norm.includes("publisher") ||
    norm.includes("publishing") ||
    norm.includes("published by") ||
    norm.includes("press") ||
    norm.includes("imprint")
  ) {
    return "publisher";
  }

  // 5. Category / Subject / Genre check
  if (
    norm.includes("category") ||
    norm.includes("categories") ||
    norm.includes("genre") ||
    norm.includes("subject") ||
    norm.includes("classification") ||
    norm.includes("section") ||
    norm.includes("collection") ||
    norm.includes("topic")
  ) {
    return "category";
  }

  // 6. Call Number / Dewey check
  if (
    norm.includes("call number") ||
    norm.includes("call no") ||
    norm.includes("callnum") ||
    norm.includes("dewey") ||
    norm.includes("ddc") ||
    norm.includes("shelf mark") ||
    norm.includes("location") ||
    norm.includes("class no")
  ) {
    return "call_number";
  }

  // 7. Published Year check
  if (
    norm.includes("year") ||
    norm.includes("copyright") ||
    norm.includes("pub date") ||
    norm.includes("pub date") ||
    norm.includes("date") ||
    norm.includes("edition year")
  ) {
    return "published_year";
  }

  return null;
}

interface CandidateHeader {
  sheet: ExcelJS.Worksheet;
  rowNumber: number;
  score: number;
  cols: Partial<Record<BibliographicField, number>>;
  rawHeaders: Record<string, string>;
}

/**
 * 1. Parse Excel Action (100% Read-Only, Zero DB Inserts):
 * Scans rows 1-20 across all worksheets with fuzzy synonym matching.
 * Filters out merged school banners, divider hazard rows, and repeated headers.
 * Queries Book_Metadata to flag duplicate Titles & ISBNs.
 * Returns parsed books with DetectedSheetMeta for UI preview.
 */
export async function parseExcelFile(formData: FormData): Promise<ParseExcelResult> {
  try {
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return { success: false, error: "Please select an Excel (.xlsx or .csv) file to upload." };
    }

    // Load file into ExcelJS workbook (.xlsx or .csv)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = new ExcelJS.Workbook();

    if (file.name.toLowerCase().endsWith(".csv")) {
      const stream = Readable.from(buffer);
      await workbook.csv.read(stream);
    } else {
      await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    }

    if (!workbook.worksheets || workbook.worksheets.length === 0) {
      return { success: false, error: "The uploaded file contains no readable worksheets." };
    }

    // Smart Multi-Sheet & Multi-Row Header Scanner (Rows 1–20)
    let bestCandidate: CandidateHeader | null = null;

    for (const currentSheet of workbook.worksheets) {
      const maxScanRow = Math.min(20, currentSheet.rowCount || 20);
      for (let r = 1; r <= maxScanRow; r++) {
        const row = currentSheet.getRow(r);
        const cols: Partial<Record<BibliographicField, number>> = {};
        const rawHeaders: Record<string, string> = {};

        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const rawText = getCellValueAsString(cell.value);
          const norm = normalizeHeader(rawText);
          const matched = matchField(norm);
          if (matched && !cols[matched]) {
            cols[matched] = colNumber;
            const canonicalKey =
              matched === "title"
                ? "Title"
                : matched === "author"
                ? "Author"
                : matched === "publisher"
                ? "Publisher"
                : matched === "category"
                ? "Category"
                : matched === "isbn"
                ? "ISBN"
                : matched === "call_number"
                ? "Call Number"
                : "Published Year";
            rawHeaders[canonicalKey] = rawText;
          }
        });

        if (cols.title !== undefined) {
          const score = Object.keys(cols).length;
          if (!bestCandidate || score > bestCandidate.score) {
            bestCandidate = {
              sheet: currentSheet,
              rowNumber: r,
              score,
              cols,
              rawHeaders,
            };
          }
        }
      }
    }

    if (!bestCandidate || bestCandidate.cols.title === undefined) {
      return {
        success: false,
        error:
          "Could not detect a valid 'Title' column header in any worksheet (scanned rows 1–20). Please ensure your spreadsheet has column headers.",
      };
    }

    const { sheet, rowNumber: headerRowNumber, cols, rawHeaders } = bestCandidate;
    const titleCol = cols.title!;
    const authorCol = cols.author ?? -1;
    const publisherCol = cols.publisher ?? -1;
    const categoryCol = cols.category ?? -1;
    const isbnCol = cols.isbn ?? -1;
    const callNumberCol = cols.call_number ?? -1;
    const yearCol = cols.published_year ?? -1;

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

    // In-batch tracking to catch duplicate rows inside the same spreadsheet
    const seenBatchIsbns = new Set<string>();
    const seenBatchTitles = new Set<string>();

    const parsedBooks: ParsedBookRow[] = [];
    let duplicateCount = 0;
    let skippedBannerRows = 0;

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return;

      const rawTitle = getCellValueAsString(row.getCell(titleCol).value).trim();
      if (!rawTitle) return; // Skip rows where title is empty

      const lowerTitle = rawTitle.toLowerCase();
      // Skip summary / footer rows
      if (
        lowerTitle.startsWith("total ") ||
        lowerTitle === "total" ||
        lowerTitle.startsWith("summary ")
      ) {
        return;
      }

      const rawAuthor =
        authorCol !== -1 ? getCellValueAsString(row.getCell(authorCol).value).trim() : "";
      const rawPublisher =
        publisherCol !== -1 ? getCellValueAsString(row.getCell(publisherCol).value).trim() : "";
      const rawCategory =
        categoryCol !== -1 ? getCellValueAsString(row.getCell(categoryCol).value).trim() : "";
      const rawCallNumber =
        callNumberCol !== -1 ? getCellValueAsString(row.getCell(callNumberCol).value).trim() : "";
      let rawYear =
        yearCol !== -1 ? getCellValueAsString(row.getCell(yearCol).value).trim() : "";
      if (rawYear) {
        const match = rawYear.match(/\b\d{4}\b/);
        if (match) rawYear = match[0];
      }

      const rawIsbn =
        isbnCol !== -1
          ? getCellValueAsString(row.getCell(isbnCol).value).replace(/[-\s]/g, "").trim()
          : "";

      // 1. Merged Banner Hazard Filter:
      // If 2 or more other mapped columns have the exact same string as rawTitle
      const otherValues = [rawAuthor, rawPublisher, rawCategory, rawIsbn].filter((v) => v.length > 0);
      const matchingOtherCount = otherValues.filter(
        (v) => v.toLowerCase() === lowerTitle
      ).length;
      if (matchingOtherCount >= 2) {
        skippedBannerRows++;
        return;
      }

      // 2. Section Divider Pattern:
      // Starts and ends with --- or ===, or matches /^(section|part|grade)\s+\d+/i when author/publisher/isbn are empty
      const isDividerPattern =
        /^[-=]{2,}.*[-=]{2,}$/.test(rawTitle) ||
        /^(section|part|grade)\s+\d+/i.test(rawTitle);
      if (isDividerPattern && !rawAuthor && !rawPublisher && !rawIsbn) {
        skippedBannerRows++;
        return;
      }

      // 3. Repeated Header Row Detection
      const normTitle = normalizeHeader(rawTitle);
      const normAuthor = normalizeHeader(rawAuthor);
      if (matchField(normTitle) === "title" && matchField(normAuthor) === "author") {
        return;
      }

      // Duplicate check: check ISBN and Title against database and batch
      const cleanIsbnLower = rawIsbn ? rawIsbn.toLowerCase() : "";
      const cleanTitleLower = lowerTitle;

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

    const detectedMeta: DetectedSheetMeta = {
      sheetName: sheet.name,
      headerRowNumber,
      mappedColumns: rawHeaders,
      skippedBannerRows,
    };

    return {
      success: true,
      books: parsedBooks,
      totalCount: parsedBooks.length,
      duplicateCount,
      newCount: parsedBooks.length - duplicateCount,
      detectedMeta,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error parsing Excel file.";
    console.error("parseExcelFile error:", err);
    return { success: false, error: msg };
  }
}

/**
 * 2. Bulk Import Confirmation Action (with Zero-Mutation Dry-Run Mode):
 * - Live Mode (dryRun = false):
 *   Assigns sequential WSI-XXXX accession numbers, generates fallback WSI-CUSTOM-... ISBNs,
 *   and inserts/upserts into Supabase Book_Metadata and Physical_Books.
 * - Dry-Run Mode (dryRun = true):
 *   Queries Physical_Books for real next sequential accession number, generates payloads,
 *   and returns simulated metadata and physical book copies with ZERO database writes.
 */
export async function confirmBulkImport(
  booksArray: ConfirmImportBook[],
  options?: { dryRun?: boolean }
): Promise<ConfirmImportResult> {
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
    const simulatedMetadata: SimulatedMetadataRow[] = [];
    const simulatedPhysicalBooks: SimulatedPhysicalBookRow[] = [];

    booksArray.forEach((book, idx) => {
      let finalIsbn = book.isbn ? book.isbn.replace(/[-\s]/g, "").trim() : "";
      if (!finalIsbn) {
        finalIsbn = `WSI-CUSTOM-${timestamp}-${idx + 1}`;
      }

      if (!metadataMap.has(finalIsbn)) {
        const metaPayload: SimulatedMetadataRow = {
          isbn: finalIsbn,
          title: book.title.trim(),
          author: book.author?.trim() || "Unknown Author",
          category: book.category?.trim() || null,
          publisher: book.publisher?.trim() || null,
          published_year: book.published_year?.trim() || null,
          cover_url: finalIsbn.startsWith("WSI-CUSTOM-")
            ? null
            : `https://covers.openlibrary.org/b/isbn/${finalIsbn}-L.jpg`,
        };
        metadataMap.set(finalIsbn, metaPayload as unknown as Record<string, unknown>);
        simulatedMetadata.push(metaPayload);
      }

      currentSeq++;
      const accessionNumber = `WSI-${String(currentSeq).padStart(4, "0")}`;

      physicalBooksToInsert.push({
        accession_number: accessionNumber,
        isbn: finalIsbn,
        call_number: book.call_number?.trim() || null,
        status: "Available",
      });

      simulatedPhysicalBooks.push({
        accession_number: accessionNumber,
        isbn: finalIsbn,
        title: book.title.trim(),
        call_number: book.call_number?.trim() || null,
        status: "Available",
      });
    });

    // ---------------------------------------------------------
    // ZERO-MUTATION DRY-RUN GUARD
    // ---------------------------------------------------------
    if (options?.dryRun) {
      return {
        success: true,
        isDryRun: true,
        count: simulatedPhysicalBooks.length,
        metadataCount: simulatedMetadata.length,
        startAccession: `WSI-${String(maxNumber + 1).padStart(4, "0")}`,
        endAccession: `WSI-${String(currentSeq).padStart(4, "0")}`,
        simulatedMetadata,
        simulatedPhysicalBooks,
      };
    }

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
      simulatedMetadata,
      simulatedPhysicalBooks,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error importing selected books.";
    console.error("confirmBulkImport error:", err);
    return { success: false, error: msg };
  }
}
