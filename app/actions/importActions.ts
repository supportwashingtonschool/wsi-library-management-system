"use server";

import ExcelJS from "exceljs";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export interface BulkImportResult {
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
 * Server Action: bulkImportBooks
 * Parses an uploaded .xlsx file with messy legacy data across all sheets,
 * auto-assigns sequential accession numbers (WSI-XXXX) starting from the highest existing,
 * generates pseudo-ISBNs for missing ISBNs, and batch-inserts records into Supabase.
 */
export async function bulkImportBooks(formData: FormData): Promise<BulkImportResult> {
  try {
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return { success: false, error: "Please select an Excel (.xlsx) file to upload." };
    }

    // 1. Convert File to buffer and parse with ExcelJS
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    // 2. Query Physical_Books to determine the highest existing accession number
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

    // 3. Arrays to collect records
    // Use a Map for Book_Metadata keyed by ISBN to deduplicate metadata and prevent Postgres ON CONFLICT batch errors
    const metadataMap = new Map<string, Record<string, unknown>>();
    const physicalBooksToInsert: Array<{
      accession_number: string;
      isbn: string;
      call_number: string | null;
      status: string;
    }> = [];

    let rowCounter = 0;
    const timestamp = Date.now();

    // 4. Iterate through EVERY worksheet to handle messy multi-sheet legacy files
    workbook.eachSheet((sheet) => {
      let titleCol = -1;
      let authorCol = -1;
      let isbnCol = -1;
      let categoryCol = -1;
      let callNumberCol = -1;
      let publisherCol = -1;
      let yearCol = -1;
      let headerRowIndex = 1;

      // Helper to scan a row for header columns
      const scanRowForHeaders = (rowNum: number) => {
        let matched = false;
        const row = sheet.getRow(rowNum);
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const val = getCellValueAsString(cell.value)
            .toLowerCase()
            .replace(/[\r\n\t_]/g, " ")
            .trim();
          if (!val) return;

          if (val.includes("title")) {
            titleCol = colNumber;
            matched = true;
          } else if (val.includes("author")) {
            authorCol = colNumber;
            matched = true;
          } else if (val.includes("isbn")) {
            isbnCol = colNumber;
            matched = true;
          } else if (
            val.includes("category") ||
            val.includes("genre") ||
            val.includes("subject")
          ) {
            categoryCol = colNumber;
            matched = true;
          } else if (
            val.includes("call number") ||
            val.includes("call no") ||
            val.includes("call#") ||
            val.includes("callnum")
          ) {
            callNumberCol = colNumber;
            matched = true;
          } else if (val.includes("publisher")) {
            publisherCol = colNumber;
            matched = true;
          } else if (
            val.includes("year") ||
            val.includes("pub year") ||
            val.includes("copyright") ||
            val.includes("date")
          ) {
            yearCol = colNumber;
            matched = true;
          }
        });
        return matched;
      };

      // Check Row 1 for headers; fallback to Row 2 if Row 1 has a sheet title/banner
      scanRowForHeaders(1);
      if (titleCol === -1) {
        if (scanRowForHeaders(2)) {
          headerRowIndex = 2;
        }
      }

      // If this sheet has no Title column, skip to next sheet
      if (titleCol === -1) {
        return;
      }

      // Iterate through the sheet rows
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= headerRowIndex) return;

        const rawTitle = titleCol !== -1 ? getCellValueAsString(row.getCell(titleCol).value).trim() : "";
        // Skip row if Title is missing
        if (!rawTitle) return;

        rowCounter++;

        // ISBN logic: extract or generate pseudo-ISBN
        let rawIsbn = isbnCol !== -1 ? getCellValueAsString(row.getCell(isbnCol).value).replace(/[-\s]/g, "").trim() : "";
        if (!rawIsbn) {
          rawIsbn = `WSI-CUSTOM-${timestamp}-${rowCounter}`;
        }

        const rawAuthor = authorCol !== -1 ? getCellValueAsString(row.getCell(authorCol).value).trim() : "";
        const rawCategory = categoryCol !== -1 ? getCellValueAsString(row.getCell(categoryCol).value).trim() : "";
        const rawCallNumber = callNumberCol !== -1 ? getCellValueAsString(row.getCell(callNumberCol).value).trim() : "";
        const rawPublisher = publisherCol !== -1 ? getCellValueAsString(row.getCell(publisherCol).value).trim() : "";

        let rawYear = yearCol !== -1 ? getCellValueAsString(row.getCell(yearCol).value).trim() : "";
        if (rawYear) {
          const match = rawYear.match(/\b\d{4}\b/);
          if (match) {
            rawYear = match[0];
          }
        }

        // Construct Book_Metadata object (store in deduplicated map)
        if (!metadataMap.has(rawIsbn)) {
          metadataMap.set(rawIsbn, {
            isbn: rawIsbn,
            title: rawTitle,
            author: rawAuthor || "Unknown Author",
            category: rawCategory || null,
            publisher: rawPublisher || null,
            published_year: rawYear || null,
            cover_url: rawIsbn.startsWith("WSI-CUSTOM-")
              ? null
              : `https://covers.openlibrary.org/b/isbn/${rawIsbn}-L.jpg`,
          });
        }

        // Increment accession number for each physical copy
        currentSeq++;
        const accessionNumber = `WSI-${String(currentSeq).padStart(4, "0")}`;

        // Construct Physical_Books object
        physicalBooksToInsert.push({
          accession_number: accessionNumber,
          isbn: rawIsbn,
          call_number: rawCallNumber || null,
          status: "Available",
        });
      });
    });

    if (physicalBooksToInsert.length === 0) {
      return {
        success: false,
        error:
          "No valid book rows found in the uploaded file. Please make sure the sheet has a 'Title' column header.",
      };
    }

    const metadataArray = Array.from(metadataMap.values());
    const BATCH_SIZE = 100;

    // 5. Batch Upsert into Book_Metadata
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
          error: `Failed to insert book metadata (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${metaError.message}`,
        };
      }
    }

    // 6. Batch Insert into Physical_Books
    for (let i = 0; i < physicalBooksToInsert.length; i += BATCH_SIZE) {
      const batch = physicalBooksToInsert.slice(i, i + BATCH_SIZE);
      const { error: physError } = await supabase
        .from("Physical_Books")
        .insert(batch);

      if (physError) {
        return {
          success: false,
          error: `Failed to insert physical book copies (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${physError.message}`,
        };
      }
    }

    // Revalidate library paths so dashboard, cataloging, and inventory update immediately
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
    const errorMsg = err instanceof Error ? err.message : "Unknown error occurred during bulk import.";
    console.error("bulkImportBooks error:", err);
    return { success: false, error: errorMsg };
  }
}
