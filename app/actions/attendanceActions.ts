"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export interface AttendanceLogItem {
  id: string;
  student_id: string;
  time_in: string;
  time_out: string | null;
  book_accession?: string | null;
  book_title?: string | null;
  remarks?: string | null;
  created_at?: string;
  Students?: {
    full_name?: string | null;
    grade_level?: string | null;
    photo_url?: string | null;
  } | null;
}

export interface ScanAttendanceResult {
  success: boolean;
  action?: "TIME_IN" | "TIME_OUT";
  record?: AttendanceLogItem;
  message?: string;
  error?: string;
  durationMinutes?: number;
}

const LOCAL_FALLBACK_FILE = path.join(process.cwd(), "supabase", "attendance_logs.local.json");

/**
 * Helper to check if a Supabase error is caused by missing Attendance_Logs table.
 */
function isTableMissingError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg = "message" in err ? String((err as { message: unknown }).message) : "";
  const code = "code" in err ? String((err as { code: unknown }).code) : "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.toLowerCase().includes("attendance_logs") && msg.toLowerCase().includes("does not exist") ||
    msg.toLowerCase().includes("could not find the table")
  );
}

/**
 * Reads local fallback attendance logs.
 */
async function readLocalFallback(): Promise<AttendanceLogItem[]> {
  try {
    const raw = await fs.readFile(LOCAL_FALLBACK_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Writes local fallback attendance logs.
 */
async function writeLocalFallback(items: AttendanceLogItem[]): Promise<void> {
  try {
    await fs.mkdir(path.dirname(LOCAL_FALLBACK_FILE), { recursive: true });
    await fs.writeFile(LOCAL_FALLBACK_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write local attendance fallback:", err);
  }
}

/**
 * Helper to resolve Book Accession / Book Title from bookInput string.
 * If bookInput matches a Physical_Books accession_number, look up its title from Book_Metadata.
 */
async function resolveBookInfo(
  bookInput?: string | null
): Promise<{ accession: string | null; title: string | null }> {
  if (!bookInput || !bookInput.trim()) {
    return { accession: null, title: null };
  }
  const cleanInput = bookInput.trim();

  try {
    const { data: physBook } = await supabase
      .from("Physical_Books")
      .select("accession_number, Book_Metadata(title)")
      .ilike("accession_number", cleanInput)
      .maybeSingle();

    if (physBook) {
      const meta = physBook.Book_Metadata as { title?: string } | null;
      return {
        accession: physBook.accession_number,
        title: meta?.title || cleanInput,
      };
    }
  } catch (err) {
    console.warn("Could not check Physical_Books for accession:", err);
  }

  return { accession: null, title: cleanInput };
}

/**
 * Smart Auto-Toggle Attendance Scanner:
 * 1. Validates student exists in Students table.
 * 2. Checks if the student has an active visit (time_out IS NULL within last 24 hours).
 *    - If YES: logs TIME OUT and calculates duration.
 *    - If NO: logs TIME IN and attaches optional book read and remarks.
 */
export async function scanStudentAttendance(
  studentBarcode: string,
  bookInput?: string,
  remarks?: string
): Promise<ScanAttendanceResult> {
  try {
    const cleanId = (studentBarcode || "").trim().toUpperCase();
    if (!cleanId) {
      return { success: false, error: "Please scan or enter a Student ID barcode (e.g. WSI-LRC-S-0064)." };
    }

    // 1. Look up student in Students table
    const { data: student, error: studentErr } = await supabase
      .from("Students")
      .select("library_id, full_name, grade_level, photo_url")
      .ilike("library_id", cleanId)
      .maybeSingle();

    if (studentErr) {
      return { success: false, error: `Student lookup failed: ${studentErr.message}` };
    }
    if (!student) {
      return {
        success: false,
        error: `Student ID "${cleanId}" was not found. Please verify the ID or register the student in Student Management.`,
      };
    }

    const nowIso = new Date().toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const resolvedBook = await resolveBookInfo(bookInput);
    const cleanRemarks = remarks?.trim() || null;

    // 2. Try Supabase Attendance_Logs first
    try {
      const { data: activeLog, error: activeErr } = await supabase
        .from("Attendance_Logs")
        .select(`
          id,
          student_id,
          time_in,
          time_out,
          book_accession,
          book_title,
          remarks,
          created_at
        `)
        .ilike("student_id", student.library_id)
        .is("time_out", null)
        .gte("time_in", twentyFourHoursAgo)
        .order("time_in", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeErr) {
        if (activeLog) {
          // --- TOGGLE TIME OUT ---
          const durationMins = Math.max(
            1,
            Math.round((new Date().getTime() - new Date(activeLog.time_in).getTime()) / 60000)
          );

          const updatePayload: Record<string, unknown> = {
            time_out: nowIso,
          };
          if (resolvedBook.title && !activeLog.book_title) {
            updatePayload.book_accession = resolvedBook.accession;
            updatePayload.book_title = resolvedBook.title;
          }
          if (cleanRemarks && !activeLog.remarks) {
            updatePayload.remarks = cleanRemarks;
          }

          const { data: updated, error: updateErr } = await supabase
            .from("Attendance_Logs")
            .update(updatePayload)
            .eq("id", activeLog.id)
            .select(`
              id,
              student_id,
              time_in,
              time_out,
              book_accession,
              book_title,
              remarks,
              created_at
            `)
            .single();

          if (updateErr) {
            return { success: false, error: `Failed to record Time Out: ${updateErr.message}` };
          }

          const fullRecord: AttendanceLogItem = {
            ...updated,
            Students: student,
          };

          revalidatePath("/admin");
          return {
            success: true,
            action: "TIME_OUT",
            record: fullRecord,
            durationMinutes: durationMins,
            message: `Time Out recorded for ${student.full_name} (${student.library_id}). Duration: ${durationMins} min${durationMins === 1 ? "" : "s"}.`,
          };
        } else {
          // --- TIME IN ---
          const insertPayload = {
            student_id: student.library_id,
            time_in: nowIso,
            time_out: null,
            book_accession: resolvedBook.accession,
            book_title: resolvedBook.title,
            remarks: cleanRemarks,
          };

          const { data: created, error: insertErr } = await supabase
            .from("Attendance_Logs")
            .insert(insertPayload)
            .select(`
              id,
              student_id,
              time_in,
              time_out,
              book_accession,
              book_title,
              remarks,
              created_at
            `)
            .single();

          if (insertErr) {
            return { success: false, error: `Failed to record Time In: ${insertErr.message}` };
          }

          const fullRecord: AttendanceLogItem = {
            ...created,
            Students: student,
          };

          revalidatePath("/admin");
          return {
            success: true,
            action: "TIME_IN",
            record: fullRecord,
            message: `Time In recorded for ${student.full_name} (${student.library_id}, ${student.grade_level}). Welcome to WSI LRC!`,
          };
        }
      } else if (!isTableMissingError(activeErr)) {
        return { success: false, error: `Attendance check failed: ${activeErr.message}` };
      }
    } catch (dbErr) {
      if (!isTableMissingError(dbErr)) {
        console.error("Supabase attendance error:", dbErr);
      }
    }

    // 3. Fallback to Local Storage if Attendance_Logs table not in Supabase yet
    const localItems = await readLocalFallback();
    const activeLocalIndex = localItems.findIndex(
      (item) =>
        item.student_id.toUpperCase() === student.library_id.toUpperCase() &&
        item.time_out === null &&
        new Date(item.time_in).getTime() >= new Date(twentyFourHoursAgo).getTime()
    );

    if (activeLocalIndex !== -1) {
      // Toggle Time Out in local storage
      const active = localItems[activeLocalIndex];
      const durationMins = Math.max(
        1,
        Math.round((new Date().getTime() - new Date(active.time_in).getTime()) / 60000)
      );

      active.time_out = nowIso;
      if (resolvedBook.title && !active.book_title) {
        active.book_accession = resolvedBook.accession;
        active.book_title = resolvedBook.title;
      }
      if (cleanRemarks && !active.remarks) {
        active.remarks = cleanRemarks;
      }
      active.Students = student;

      localItems[activeLocalIndex] = active;
      await writeLocalFallback(localItems);
      revalidatePath("/admin");

      return {
        success: true,
        action: "TIME_OUT",
        record: active,
        durationMinutes: durationMins,
        message: `Time Out recorded for ${student.full_name} (${student.library_id}). Duration: ${durationMins} min${durationMins === 1 ? "" : "s"}.`,
      };
    } else {
      // Time In in local storage
      const newRecord: AttendanceLogItem = {
        id: crypto.randomUUID(),
        student_id: student.library_id,
        time_in: nowIso,
        time_out: null,
        book_accession: resolvedBook.accession,
        book_title: resolvedBook.title,
        remarks: cleanRemarks,
        created_at: nowIso,
        Students: student,
      };

      localItems.unshift(newRecord);
      await writeLocalFallback(localItems);
      revalidatePath("/admin");

      return {
        success: true,
        action: "TIME_IN",
        record: newRecord,
        message: `Time In recorded for ${student.full_name} (${student.library_id}, ${student.grade_level}). Welcome to WSI LRC!`,
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to process attendance scan.";
    console.error("Attendance scan error:", msg);
    return { success: false, error: msg };
  }
}

/**
 * Manually logs Time Out for a specific attendance record.
 */
export async function manualTimeOutAttendance(
  attendanceId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const nowIso = new Date().toISOString();

    // Try Supabase first
    try {
      const { data, error } = await supabase
        .from("Attendance_Logs")
        .update({ time_out: nowIso })
        .eq("id", attendanceId)
        .select("id, time_in")
        .maybeSingle();

      if (!error && data) {
        revalidatePath("/admin");
        return { success: true, message: "Student successfully timed out." };
      }
    } catch (dbErr) {
      if (!isTableMissingError(dbErr)) {
        console.error("Supabase manual time out error:", dbErr);
      }
    }

    // Fallback to local storage
    const items = await readLocalFallback();
    const idx = items.findIndex((it) => it.id === attendanceId);
    if (idx !== -1) {
      items[idx].time_out = nowIso;
      await writeLocalFallback(items);
      revalidatePath("/admin");
      return { success: true, message: "Student successfully timed out." };
    }

    return { success: false, error: "Attendance record not found." };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record manual time out.";
    return { success: false, error: msg };
  }
}

/**
 * Times out all remaining active visits (e.g. end-of-day sweep).
 */
export async function timeOutAllActiveAttendance(): Promise<{
  success: boolean;
  count?: number;
  message?: string;
  error?: string;
}> {
  try {
    const nowIso = new Date().toISOString();
    let updatedCount = 0;

    // Try Supabase first
    try {
      const { data, error } = await supabase
        .from("Attendance_Logs")
        .update({ time_out: nowIso })
        .is("time_out", null)
        .select("id");

      if (!error && data) {
        updatedCount = data.length;
        revalidatePath("/admin");
        return {
          success: true,
          count: updatedCount,
          message: `Closed ${updatedCount} active library visit${updatedCount === 1 ? "" : "s"}.`,
        };
      }
    } catch (dbErr) {
      if (!isTableMissingError(dbErr)) {
        console.error("Supabase timeOutAll error:", dbErr);
      }
    }

    // Fallback local storage
    const items = await readLocalFallback();
    for (const it of items) {
      if (it.time_out === null) {
        it.time_out = nowIso;
        updatedCount++;
      }
    }
    await writeLocalFallback(items);
    revalidatePath("/admin");

    return {
      success: true,
      count: updatedCount,
      message: `Closed ${updatedCount} active library visit${updatedCount === 1 ? "" : "s"}.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to time out all active visits.";
    return { success: false, error: msg };
  }
}

/**
 * Updates Book Read (accession/title) and Remarks for an existing attendance entry.
 */
export async function updateAttendanceDetails(
  attendanceId: string,
  payload: { bookInput?: string; remarks?: string }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const resolvedBook = await resolveBookInfo(payload.bookInput);
    const cleanRemarks = payload.remarks?.trim() ?? null;

    const updateFields: Record<string, unknown> = {};
    if (payload.bookInput !== undefined) {
      updateFields.book_accession = resolvedBook.accession;
      updateFields.book_title = resolvedBook.title;
    }
    if (payload.remarks !== undefined) {
      updateFields.remarks = cleanRemarks;
    }

    // Try Supabase
    try {
      const { data, error } = await supabase
        .from("Attendance_Logs")
        .update(updateFields)
        .eq("id", attendanceId)
        .select("id")
        .maybeSingle();

      if (!error && data) {
        revalidatePath("/admin");
        return { success: true, message: "Attendance details updated." };
      }
    } catch (dbErr) {
      if (!isTableMissingError(dbErr)) {
        console.error("Supabase updateAttendanceDetails error:", dbErr);
      }
    }

    // Fallback local storage
    const items = await readLocalFallback();
    const idx = items.findIndex((it) => it.id === attendanceId);
    if (idx !== -1) {
      if (payload.bookInput !== undefined) {
        items[idx].book_accession = resolvedBook.accession;
        items[idx].book_title = resolvedBook.title;
      }
      if (payload.remarks !== undefined) {
        items[idx].remarks = cleanRemarks;
      }
      await writeLocalFallback(items);
      revalidatePath("/admin");
      return { success: true, message: "Attendance details updated." };
    }

    return { success: false, error: "Record not found." };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update attendance details.";
    return { success: false, error: msg };
  }
}

/**
 * Deletes an attendance record (e.g. accidental scan).
 */
export async function deleteAttendanceLog(
  attendanceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Try Supabase
    try {
      const { error } = await supabase.from("Attendance_Logs").delete().eq("id", attendanceId);
      if (!error) {
        revalidatePath("/admin");
        return { success: true };
      }
    } catch (dbErr) {
      if (!isTableMissingError(dbErr)) {
        console.error("Supabase deleteAttendanceLog error:", dbErr);
      }
    }

    // Fallback local storage
    const items = await readLocalFallback();
    const filtered = items.filter((it) => it.id !== attendanceId);
    await writeLocalFallback(filtered);
    revalidatePath("/admin");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete attendance log.";
    return { success: false, error: msg };
  }
}

/**
 * Retrieves all attendance logs joined with student information for dashboard & PDF reports.
 */
export async function getAttendanceLogsForDashboard(): Promise<{
  success: boolean;
  logs: AttendanceLogItem[];
  error?: string;
}> {
  try {
    // Try Supabase first
    try {
      const { data, error } = await supabase
        .from("Attendance_Logs")
        .select(`
          id,
          student_id,
          time_in,
          time_out,
          book_accession,
          book_title,
          remarks,
          created_at,
          Students (
            full_name,
            grade_level,
            photo_url
          )
        `)
        .order("time_in", { ascending: false })
        .limit(200);

      if (!error && data) {
        return {
          success: true,
          logs: data as unknown as AttendanceLogItem[],
        };
      }
    } catch (dbErr) {
      if (!isTableMissingError(dbErr)) {
        console.error("Supabase getAttendanceLogsForDashboard error:", dbErr);
      }
    }

    // Fallback local storage
    const localLogs = await readLocalFallback();

    // Try joining fresh student details for local items if needed
    const studentIds = Array.from(new Set(localLogs.map((it) => it.student_id)));
    if (studentIds.length > 0) {
      const { data: students } = await supabase
        .from("Students")
        .select("library_id, full_name, grade_level, photo_url")
        .in("library_id", studentIds);

      if (students) {
        const studentMap = new Map(students.map((s) => [s.library_id.toUpperCase(), s]));
        for (const item of localLogs) {
          const matched = studentMap.get(item.student_id.toUpperCase());
          if (matched) {
            item.Students = matched;
          }
        }
      }
    }

    // Sort descending by time_in
    localLogs.sort((a, b) => new Date(b.time_in).getTime() - new Date(a.time_in).getTime());

    return {
      success: true,
      logs: localLogs,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load attendance logs.";
    return { success: false, logs: [], error: msg };
  }
}
