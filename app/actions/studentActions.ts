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

export interface GetStudentsResult {
  success: boolean;
  students: Student[];
  error?: string;
}

/**
 * Register a new student:
 * Accepts FormData with fullName, gradeLevel, address, and an optional photo File.
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
    const address = (formData.get("address") || "") as string;
    const photoEntry = formData.get("photo");

    const trimmedName = fullName.trim();
    const trimmedGrade = gradeLevel.trim();
    const cleanAddress = address?.trim() || null;

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
      // In case a direct photo URL string was provided
      const directUrl = formData.get("photo_url") || formData.get("photoUrl");
      if (typeof directUrl === "string" && directUrl.trim()) {
        publicPhotoUrl = directUrl.trim();
      }
    }

    // 4. Insert student record into Students table
    let insertResult = await supabase
      .from("Students")
      .insert({
        library_id: newLibraryId,
        full_name: trimmedName,
        grade_level: trimmedGrade,
        address: cleanAddress,
        photo_url: publicPhotoUrl,
      })
      .select()
      .single();

    // Fallback: in case database migration hasn't added address/photo_url columns yet
    if (
      insertResult.error &&
      (insertResult.error.message.includes("address") ||
        insertResult.error.message.includes("photo_url"))
    ) {
      console.warn(
        "Students table missing address/photo_url columns. Fallback to basic insert."
      );
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
        address: cleanAddress,
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
