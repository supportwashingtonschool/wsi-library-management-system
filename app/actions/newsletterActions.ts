"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export interface Newsletter {
  id: string;
  title: string;
  issue_label: string;
  description: string | null;
  pdf_url: string;
  cover_url: string | null;
  page_count: number;
  is_featured: boolean;
  published_at: string;
  created_at: string;
}

/**
 * Attempts to ensure that the public 'newsletters' bucket exists.
 */
async function ensureNewslettersBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (buckets && !buckets.some((b) => b.name === "newsletters" || b.id === "newsletters")) {
      await supabase.storage.createBucket("newsletters", { public: true });
    }
  } catch (err) {
    // Gracefully ignore if permissions do not allow list/create
    console.warn("Notice verifying 'newsletters' storage bucket:", err);
  }
}

/**
 * Helper to extract the relative storage path inside 'newsletters' bucket from a public URL.
 */
function extractStoragePath(publicUrl: string): string | null {
  try {
    const marker = "/newsletters/";
    const idx = publicUrl.indexOf(marker);
    if (idx !== -1) {
      return decodeURIComponent(publicUrl.substring(idx + marker.length));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch all newsletters ordered by featured status first, then newest published date.
 */
export async function getNewsletters(): Promise<{
  success: boolean;
  newsletters: Newsletter[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("Newsletters")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("published_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      if (error.message?.includes("public.Newsletters") || error.code === "PGRST205") {
        return {
          success: false,
          newsletters: [],
          error:
            "TABLE_NOT_FOUND: The 'Newsletters' table has not been created in Supabase yet. Please run the migration script in your Supabase SQL Editor.",
        };
      }
      return { success: false, newsletters: [], error: error.message };
    }

    return { success: true, newsletters: data || [] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load newsletters.";
    return { success: false, newsletters: [], error: msg };
  }
}

/**
 * Fetch the currently featured newsletter (or newest published newsletter if none explicitly marked).
 */
export async function getFeaturedNewsletter(): Promise<Newsletter | null> {
  try {
    // 1. Check for explicit is_featured = true
    const { data: featured, error: featErr } = await supabase
      .from("Newsletters")
      .select("*")
      .eq("is_featured", true)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!featErr && featured) {
      return featured;
    }

    // 2. Fallback to the latest published issue
    const { data: newest } = await supabase
      .from("Newsletters")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return newest || null;
  } catch (err) {
    console.error("Error retrieving featured newsletter:", err);
    return null;
  }
}

/**
 * Publish a new newsletter.
 * Accepts FormData with title, issue_label, description, page_count, is_featured, pdf file, and auto-generated cover file.
 */
export async function createNewsletter(
  formData: FormData
): Promise<{ success: boolean; newsletter?: Newsletter; error?: string }> {
  try {
    await ensureNewslettersBucket();

    const title = ((formData.get("title") || "") as string).trim();
    const issueLabel = (
      (formData.get("issue_label") || formData.get("issueLabel") || "") as string
    ).trim();
    const description = ((formData.get("description") || "") as string).trim() || null;
    const pageCountRaw = (formData.get("page_count") || formData.get("pageCount") || "1") as string;
    const pageCount = parseInt(pageCountRaw, 10) || 1;

    const isFeaturedInput =
      formData.get("is_featured") === "true" ||
      formData.get("is_featured") === "on" ||
      formData.get("isFeatured") === "true";

    const pdfEntry = formData.get("pdf");
    const coverEntry = formData.get("cover");

    if (!title) {
      return { success: false, error: "Newsletter title is required." };
    }
    if (!issueLabel) {
      return {
        success: false,
        error: "Issue or period label is required (e.g., 'October 2026' or 'Vol. 1').",
      };
    }

    const isPdfFile =
      pdfEntry &&
      typeof pdfEntry === "object" &&
      "size" in pdfEntry &&
      (pdfEntry as File).size > 0 &&
      "arrayBuffer" in pdfEntry;

    if (!isPdfFile) {
      return {
        success: false,
        error: "A valid PDF newsletter file is required.",
      };
    }

    const pdfFile = pdfEntry as File;
    const safePdfName = (pdfFile.name || "newsletter.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
    const pdfStoragePath = `pdfs/${Date.now()}-${safePdfName}`;
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());

    const { error: pdfUploadErr } = await supabase.storage
      .from("newsletters")
      .upload(pdfStoragePath, pdfBuffer, {
        contentType: pdfFile.type || "application/pdf",
        upsert: false,
      });

    if (pdfUploadErr) {
      console.error("PDF upload error:", pdfUploadErr);
      return {
        success: false,
        error: `Failed to upload PDF file: ${pdfUploadErr.message}. Ensure the 'newsletters' bucket exists in Supabase Storage.`,
      };
    }

    const { data: pdfUrlData } = supabase.storage
      .from("newsletters")
      .getPublicUrl(pdfStoragePath);
    const pdfUrl = pdfUrlData.publicUrl;

    // Upload Cover Thumbnail if provided
    let coverUrl: string | null = null;
    const isCoverFile =
      coverEntry &&
      typeof coverEntry === "object" &&
      "size" in coverEntry &&
      (coverEntry as File).size > 0 &&
      "arrayBuffer" in coverEntry;

    if (isCoverFile) {
      const coverFile = coverEntry as File;
      const coverStoragePath = `covers/${Date.now()}-cover.jpg`;
      const coverBuffer = Buffer.from(await coverFile.arrayBuffer());

      const { error: coverUploadErr } = await supabase.storage
        .from("newsletters")
        .upload(coverStoragePath, coverBuffer, {
          contentType: coverFile.type || "image/jpeg",
          upsert: false,
        });

      if (!coverUploadErr) {
        const { data: coverUrlData } = supabase.storage
          .from("newsletters")
          .getPublicUrl(coverStoragePath);
        coverUrl = coverUrlData.publicUrl;
      } else {
        console.warn("Cover image upload notice:", coverUploadErr.message);
      }
    }

    // Determine featured status
    const { count } = await supabase
      .from("Newsletters")
      .select("*", { count: "exact", head: true });

    const shouldBeFeatured = isFeaturedInput || count === 0;

    if (shouldBeFeatured) {
      // Unset previous featured flags
      await supabase
        .from("Newsletters")
        .update({ is_featured: false })
        .neq("id", "00000000-0000-0000-0000-000000000000");
    }

    const { data, error: insertError } = await supabase
      .from("Newsletters")
      .insert({
        title,
        issue_label: issueLabel,
        description,
        pdf_url: pdfUrl,
        cover_url: coverUrl,
        page_count: pageCount,
        is_featured: shouldBeFeatured,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
      return {
        success: false,
        error: `Failed to save newsletter: ${insertError.message}. Make sure the Newsletters table migration has been executed in Supabase.`,
      };
    }

    revalidatePath("/");
    revalidatePath("/newsletters");
    revalidatePath("/admin/newsletters");

    return {
      success: true,
      newsletter: data,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: msg };
  }
}

/**
 * Update newsletter metadata or replace its PDF / cover thumbnail.
 */
export async function updateNewsletter(
  id: string,
  formData: FormData
): Promise<{ success: boolean; newsletter?: Newsletter; error?: string }> {
  try {
    const cleanId = id.trim();
    if (!cleanId) {
      return { success: false, error: "Newsletter ID is required." };
    }

    const title = ((formData.get("title") || "") as string).trim();
    const issueLabel = (
      (formData.get("issue_label") || formData.get("issueLabel") || "") as string
    ).trim();
    const description = ((formData.get("description") || "") as string).trim() || null;
    const pageCountRaw = (formData.get("page_count") || formData.get("pageCount") || "") as string;
    const isFeaturedVal = formData.get("is_featured");
    const isFeatured =
      isFeaturedVal === "true" || isFeaturedVal === "on" || formData.get("isFeatured") === "true";

    if (!title) {
      return { success: false, error: "Newsletter title is required." };
    }
    if (!issueLabel) {
      return { success: false, error: "Issue label is required." };
    }

    const updatePayload: Record<string, string | number | boolean | null> = {
      title,
      issue_label: issueLabel,
      description,
    };

    if (pageCountRaw) {
      const parsedCount = parseInt(pageCountRaw, 10);
      if (!isNaN(parsedCount) && parsedCount > 0) {
        updatePayload.page_count = parsedCount;
      }
    }

    // If new PDF is attached
    const pdfEntry = formData.get("pdf");
    if (
      pdfEntry &&
      typeof pdfEntry === "object" &&
      "size" in pdfEntry &&
      (pdfEntry as File).size > 0 &&
      "arrayBuffer" in pdfEntry
    ) {
      const pdfFile = pdfEntry as File;
      const safePdfName = (pdfFile.name || "newsletter.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
      const pdfStoragePath = `pdfs/${Date.now()}-${safePdfName}`;
      const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());

      const { error: pdfUploadErr } = await supabase.storage
        .from("newsletters")
        .upload(pdfStoragePath, pdfBuffer, {
          contentType: pdfFile.type || "application/pdf",
          upsert: false,
        });

      if (pdfUploadErr) {
        return { success: false, error: `Failed to upload replacement PDF: ${pdfUploadErr.message}` };
      }

      const { data: pdfUrlData } = supabase.storage
        .from("newsletters")
        .getPublicUrl(pdfStoragePath);
      updatePayload.pdf_url = pdfUrlData.publicUrl;
    }

    // If new Cover is attached
    const coverEntry = formData.get("cover");
    if (
      coverEntry &&
      typeof coverEntry === "object" &&
      "size" in coverEntry &&
      (coverEntry as File).size > 0 &&
      "arrayBuffer" in coverEntry
    ) {
      const coverFile = coverEntry as File;
      const coverStoragePath = `covers/${Date.now()}-cover.jpg`;
      const coverBuffer = Buffer.from(await coverFile.arrayBuffer());

      const { error: coverUploadErr } = await supabase.storage
        .from("newsletters")
        .upload(coverStoragePath, coverBuffer, {
          contentType: coverFile.type || "image/jpeg",
          upsert: false,
        });

      if (!coverUploadErr) {
        const { data: coverUrlData } = supabase.storage
          .from("newsletters")
          .getPublicUrl(coverStoragePath);
        updatePayload.cover_url = coverUrlData.publicUrl;
      }
    }

    if (isFeatured) {
      // Unset previous featured flags
      await supabase
        .from("Newsletters")
        .update({ is_featured: false })
        .neq("id", cleanId);
      updatePayload.is_featured = true;
    }

    const { data, error: updateError } = await supabase
      .from("Newsletters")
      .update(updatePayload)
      .eq("id", cleanId)
      .select()
      .single();

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath("/");
    revalidatePath("/newsletters");
    revalidatePath("/admin/newsletters");

    return { success: true, newsletter: data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update newsletter.";
    return { success: false, error: msg };
  }
}

/**
 * Set a specific newsletter as the featured issue.
 */
export async function setFeaturedNewsletter(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanId = id.trim();
    if (!cleanId) {
      return { success: false, error: "Newsletter ID is required." };
    }

    // Unset all featured
    await supabase
      .from("Newsletters")
      .update({ is_featured: false })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    // Set target issue as featured
    const { error } = await supabase
      .from("Newsletters")
      .update({ is_featured: true })
      .eq("id", cleanId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/");
    revalidatePath("/newsletters");
    revalidatePath("/admin/newsletters");

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to set featured newsletter.";
    return { success: false, error: msg };
  }
}

/**
 * Delete a newsletter and remove its associated files from Supabase Storage.
 */
export async function deleteNewsletter(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanId = id.trim();
    if (!cleanId) {
      return { success: false, error: "Newsletter ID is required." };
    }

    // Fetch existing newsletter record to get file URLs and featured state
    const { data: item } = await supabase
      .from("Newsletters")
      .select("pdf_url, cover_url, is_featured")
      .eq("id", cleanId)
      .maybeSingle();

    if (item) {
      const filesToDelete: string[] = [];
      if (item.pdf_url) {
        const pdfPath = extractStoragePath(item.pdf_url);
        if (pdfPath) filesToDelete.push(pdfPath);
      }
      if (item.cover_url) {
        const coverPath = extractStoragePath(item.cover_url);
        if (coverPath) filesToDelete.push(coverPath);
      }

      if (filesToDelete.length > 0) {
        await supabase.storage.from("newsletters").remove(filesToDelete);
      }
    }

    const { error: deleteError } = await supabase
      .from("Newsletters")
      .delete()
      .eq("id", cleanId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    // If the deleted newsletter was the featured one, auto-promote the most recent remaining issue
    if (item?.is_featured) {
      const { data: newest } = await supabase
        .from("Newsletters")
        .select("id")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (newest) {
        await supabase
          .from("Newsletters")
          .update({ is_featured: true })
          .eq("id", newest.id);
      }
    }

    revalidatePath("/");
    revalidatePath("/newsletters");
    revalidatePath("/admin/newsletters");

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete newsletter.";
    return { success: false, error: msg };
  }
}
