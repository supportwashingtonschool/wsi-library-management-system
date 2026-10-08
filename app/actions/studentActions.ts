"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export interface Student {
  library_id: string;
  full_name: string;
  grade_level: string;
  address?: string | null;
  photo_url?: string | null;
  created_at?: string;
}

export interface RegisterStudentResult {
  success: boolean;
  student?: Student;
  error?: string;
}

export interface UpdateStudentResult {
  success: boolean;
  student?: Student;
  error?: string;
}

export interface DeleteStudentResult {
  success: boolean;
  error?: string;
}

export interface GetStudentsResult {
  success: boolean;
  students: Student[];
  error?: string;
}

/**
 * Register a new student:
 * Accepts FormData with fullName, gradeLevel, and an optional photo File.
 * (Address has been completely removed)
 * Uploads compressed photo to 'student-photos' bucket in Supabase Storage if provided.
 * Generates next sequential library_id (e.g. 'WSI-LRC-S-0001').
 * Inserts student record into Students table.
 */
export async function registerStudent(
  formData: FormData
): Promise<RegisterStudentResult> {
  try {
    const fullName = (formData.get("fullName") || formData.get("full_name") || "") as string;
    const gradeLevel = (formData.get("gradeLevel") || formData.get("grade_level") || "") as string;
    const photoEntry = formData.get("photo");

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
          // Parse both new WSI-LRC-S-XXXX and legacy WSI-S-XXXX
          const match = item.library_id.match(/^(?:WSI-LRC-S-|WSI-S-)(\d+)$/i);
          if (match) {
            const parsed = parseInt(match[1], 10);
            if (!isNaN(parsed) && parsed > maxNum) {
              maxNum = parsed;
            }
          }
        }
      }
    }

    // 2. Generate next sequential Library ID in WSI-LRC-S-XXXX format
    const nextSeq = maxNum + 1;
    const newLibraryId = `WSI-LRC-S-${String(nextSeq).padStart(4, "0")}`;

    // 3. Storage Upload Logic: If photo File exists, upload to 'student-photos' bucket
    let publicPhotoUrl: string | null = null;

    const isFile =
      photoEntry &&
      typeof photoEntry === "object" &&
      "size" in photoEntry &&
      (photoEntry as File).size > 0 &&
      "arrayBuffer" in photoEntry;

    if (isFile) {
      try {
        const photoFile = photoEntry as File;
        const originalName = photoFile.name || "photo.jpg";
        const dotIndex = originalName.lastIndexOf(".");
        const ext = dotIndex !== -1 ? originalName.substring(dotIndex + 1).toLowerCase() : "jpg";
        const fileName = `${Date.now()}.${ext}`;

        const arrayBuffer = await photoFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await supabase.storage
          .from("student-photos")
          .upload(fileName, buffer, {
            contentType: photoFile.type || "image/jpeg",
            upsert: false,
          });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          return {
            success: false,
            error: `Failed to upload student photo: ${uploadError.message}. Make sure the 'student-photos' bucket exists and is public in Supabase Storage.`,
          };
        }

        const { data: publicUrlData } = supabase.storage
          .from("student-photos")
          .getPublicUrl(fileName);

        publicPhotoUrl = publicUrlData.publicUrl;
      } catch (uploadErr) {
        const msg =
          uploadErr instanceof Error
            ? uploadErr.message
            : "Unknown error during photo upload";
        return {
          success: false,
          error: `Storage upload failed: ${msg}`,
        };
      }
    } else {
      const directUrl = formData.get("photo_url") || formData.get("photoUrl");
      if (typeof directUrl === "string" && directUrl.trim()) {
        publicPhotoUrl = directUrl.trim();
      }
    }

    // 4. Insert student record into Students table (without address)
    let insertResult = await supabase
      .from("Students")
      .insert({
        library_id: newLibraryId,
        full_name: trimmedName,
        grade_level: trimmedGrade,
        photo_url: publicPhotoUrl,
      })
      .select()
      .single();

    // Fallback: in case photo_url column hasn't been added yet
    if (insertResult.error && insertResult.error.message.includes("photo_url")) {
      console.warn("Students table missing photo_url column. Fallback to basic insert.");
      insertResult = await supabase
        .from("Students")
        .insert({
          library_id: newLibraryId,
          full_name: trimmedName,
          grade_level: trimmedGrade,
        })
        .select()
        .single();
    }

    if (insertResult.error) {
      return {
        success: false,
        error: `Failed to register student: ${insertResult.error.message}`,
      };
    }

    // Revalidate dashboard and students pages for live data
    revalidatePath("/admin");
    revalidatePath("/admin/students");

    return {
      success: true,
      student: insertResult.data || {
        library_id: newLibraryId,
        full_name: trimmedName,
        grade_level: trimmedGrade,
        photo_url: publicPhotoUrl,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "An unexpected error occurred while registering the student.";
    return { success: false, error: message };
  }
}

/**
 * Update an existing student's details:
 * Updates fullName and gradeLevel.
 * If a new photo File is provided, uploads it to 'student-photos' bucket and updates photo_url.
 * If no photo is provided, keeps existing photo_url.
 */
export async function updateStudent(
  libraryId: string,
  formData: FormData
): Promise<UpdateStudentResult> {
  try {
    const cleanId = libraryId.trim();
    if (!cleanId) {
      return { success: false, error: "Student Library ID is required." };
    }

    const fullName = (formData.get("fullName") || formData.get("full_name") || "") as string;
    const gradeLevel = (formData.get("gradeLevel") || formData.get("grade_level") || "") as string;
    const photoEntry = formData.get("photo");

    const trimmedName = fullName.trim();
    const trimmedGrade = gradeLevel.trim();

    if (!trimmedName) {
      return { success: false, error: "Student full name is required." };
    }
    if (!trimmedGrade) {
      return { success: false, error: "Grade level or section is required." };
    }

    const updatePayload: { full_name: string; grade_level: string; photo_url?: string } = {
      full_name: trimmedName,
      grade_level: trimmedGrade,
    };

    // If new photo File is provided, upload it to 'student-photos'
    const isFile =
      photoEntry &&
      typeof photoEntry === "object" &&
      "size" in photoEntry &&
      (photoEntry as File).size > 0 &&
      "arrayBuffer" in photoEntry;

    if (isFile) {
      try {
        const photoFile = photoEntry as File;
        const originalName = photoFile.name || "photo.jpg";
        const dotIndex = originalName.lastIndexOf(".");
        const ext = dotIndex !== -1 ? originalName.substring(dotIndex + 1).toLowerCase() : "jpg";
        const fileName = `${Date.now()}.${ext}`;

        const arrayBuffer = await photoFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await supabase.storage
          .from("student-photos")
          .upload(fileName, buffer, {
            contentType: photoFile.type || "image/jpeg",
            upsert: false,
          });

        if (uploadError) {
          console.error("Storage upload error during student update:", uploadError);
          return {
            success: false,
            error: `Failed to upload new photo: ${uploadError.message}`,
          };
        }

        const { data: publicUrlData } = supabase.storage
          .from("student-photos")
          .getPublicUrl(fileName);

        updatePayload.photo_url = publicUrlData.publicUrl;
      } catch (uploadErr) {
        const msg =
          uploadErr instanceof Error
            ? uploadErr.message
            : "Unknown error during photo upload";
        return {
          success: false,
          error: `Storage upload failed: ${msg}`,
        };
      }
    }

    const { data, error } = await supabase
      .from("Students")
      .update(updatePayload)
      .eq("library_id", cleanId)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: `Failed to update student: ${error.message}`,
      };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/students");

    return {
      success: true,
      student: data,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update student.";
    return { success: false, error: message };
  }
}

/**
 * Delete a student by Library ID.
 */
export async function deleteStudent(libraryId: string): Promise<DeleteStudentResult> {
  try {
    const cleanId = libraryId.trim();
    if (!cleanId) {
      return { success: false, error: "Student Library ID is required." };
    }

    // Check for active loans
    const { data: loans, error: checkLoansErr } = await supabase
      .from("Loans")
      .select("id, status")
      .eq("student_id", cleanId);

    if (checkLoansErr) {
      console.warn("Could not check student loans before deletion:", checkLoansErr.message);
    } else if (loans && loans.length > 0) {
      const activeLoans = loans.filter((l) => l.status === "active" || l.status === "overdue");
      if (activeLoans.length > 0) {
        return {
          success: false,
          error: `Cannot delete student: this student has ${activeLoans.length} active or overdue book loan(s). Please return the books first.`,
        };
      }
    }

    const { error } = await supabase
      .from("Students")
      .delete()
      .eq("library_id", cleanId);

    if (error) {
      return {
        success: false,
        error: `Failed to delete student: ${error.message}`,
      };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/students");

    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to delete student.";
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
