export function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export function hasSupabaseAdminConfig() {
  return Boolean(hasSupabaseConfig() && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function hasLlmConfig() {
  return Boolean(
    process.env.LLM_BASE_URL &&
      process.env.LLM_API_KEY &&
      process.env.LLM_MODEL
  )
}

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error("Supabase environment variables are not configured.")
  }

  return { url, anonKey }
}

export function getSupabaseAdminConfig() {
  const { url } = getSupabaseConfig()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.")
  }

  return { url, serviceRoleKey }
}

export function getLlmConfig() {
  const baseURL = process.env.LLM_BASE_URL
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL

  if (!baseURL || !apiKey || !model) {
    throw new Error("LLM configuration is incomplete.")
  }

  return { baseURL, apiKey, model }
}

export function getGithubToken() {
  return process.env.GITHUB_TOKEN
}

export function getMissingEnv() {
  const missing: string[] = []

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL")
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY")
  }
  if (!process.env.LLM_BASE_URL) {
    missing.push("LLM_BASE_URL")
  }
  if (!process.env.LLM_API_KEY) {
    missing.push("LLM_API_KEY")
  }
  if (!process.env.LLM_MODEL) {
    missing.push("LLM_MODEL")
  }

  return missing
}
