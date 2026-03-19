"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { hasSupabaseConfig } from "@/lib/env"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { AuthFormState } from "@/lib/types"

function getAuthCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "").trim()

  if (!email || !password) {
    return {
      error: "Заполните email и пароль.",
    }
  }

  return { email, password }
}

export async function loginAction(
  _: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!hasSupabaseConfig()) {
    return {
      message: "Supabase не настроен. Заполните .env.local по .env.example.",
    }
  }

  const credentials = getAuthCredentials(formData)
  if ("error" in credentials) {
    return { message: credentials.error }
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword(credentials)

  if (error) {
    return {
      message: "Не удалось войти. Проверьте email, пароль и настройки Supabase Auth.",
    }
  }

  revalidatePath("/", "layout")
  redirect("/dashboard")
}

export async function registerAction(
  _: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!hasSupabaseConfig()) {
    return {
      message: "Supabase не настроен. Заполните .env.local по .env.example.",
    }
  }

  const credentials = getAuthCredentials(formData)
  if ("error" in credentials) {
    return { message: credentials.error }
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.signUp(credentials)

  if (error) {
    return {
      message: "Не удалось создать аккаунт. Проверьте настройки Supabase Auth.",
    }
  }

  if (!data.session) {
    return {
      message:
        "Аккаунт создан. Если в проекте включено подтверждение email, подтвердите почту и войдите.",
    }
  }

  revalidatePath("/", "layout")
  redirect("/dashboard")
}

export async function logoutAction() {
  if (hasSupabaseConfig()) {
    const supabase = await createServerSupabaseClient()
    await supabase.auth.signOut()
    revalidatePath("/", "layout")
  }

  redirect("/login")
}
