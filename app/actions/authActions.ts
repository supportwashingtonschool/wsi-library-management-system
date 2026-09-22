"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export interface AuthResponse {
  error?: string;
}

/**
 * Sign in a user with email and password.
 * On success, redirects to /admin.
 * On failure, returns an error message.
 */
export async function login(formData: FormData): Promise<AuthResponse | void> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Please provide both email and password." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/admin");
}

/**
 * Sign out the currently authenticated user and redirect to /login.
 */
export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
