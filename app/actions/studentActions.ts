"use server";

import { supabase } from "@/lib/supabase";

export interface Student {
  library_id: string;
  full_name: string;
  grade_level: string;
  created_at?: string;
}

export interface RegisterStudentResult {
  success: boolean;
  student?: Student;
  error?: string;
}

export interface GetStudentsResult {
  success: boolean;
  students: Student[];
  error?: string;
}

/**
 * Register a new student:
 * Queries Students table for highest library_id (e.g. 'WSI-S-0001'),
 * increments it sequentially, and inserts the new student.
 */
export async function registerStudent(
  fullName: string,
  gradeLevel: string
): Promise<RegisterStudentResult> {
  try {
    const trimmedName = fullName.trim();
    const trimmedGrade = gradeLevel.trim();

    if (!trimmedName) {
      return { success: false, error: "Student full name is required." };
    }
    if (!trimmedGrade) {
      return { success: false, error: "Grade level or section is required." };
    }

    // 1. Query existing students to determine highest sequential ID
    const { data: existingStudents, error: fetchError } = await supabase
      .from("Students")
      .select("library_id");

    if (fetchError) {
      return {
        success: false,
        error: `Failed to query existing students: ${fetchError.message}`,
      };
    }

    let maxNum = 0;
    if (existingStudents && existingStudents.length > 0) {
      for (const item of existingStudents) {
        if (item.library_id) {
          const match = item.library_id.match(/^WSI-S-(\d+)$/i);
          if (match) {
            const parsed = parseInt(match[1], 10);
            if (!isNaN(parsed) && parsed > maxNum) {
              maxNum = parsed;
            }
          }
        }
      }
    }

    // 2. Generate next sequential Library ID (e.g. WSI-S-0001)
    const nextSeq = maxNum + 1;
    const newLibraryId = `WSI-S-${String(nextSeq).padStart(4, "0")}`;

    // 3. Insert student record into Students table
    const { data: insertedData, error: insertError } = await supabase
      .from("Students")
      .insert({
        library_id: newLibraryId,
        full_name: trimmedName,
        grade_level: trimmedGrade,
      })
      .select()
      .single();

    if (insertError) {
      return {
        success: false,
        error: `Failed to register student: ${insertError.message}`,
      };
    }

    return {
      success: true,
      student: insertedData || {
        library_id: newLibraryId,
        full_name: trimmedName,
        grade_level: trimmedGrade,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred while registering the student.";
    return { success: false, error: message };
  }
}

/**
 * Fetch all students ordered by newest first.
 */
export async function getStudents(): Promise<GetStudentsResult> {
  try {
    const { data, error } = await supabase
      .from("Students")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, students: [], error: error.message };
    }

    return { success: true, students: data || [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load students.";
    return { success: false, students: [], error: message };
  }
}
