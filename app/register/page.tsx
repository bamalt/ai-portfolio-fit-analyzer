import { LoginForm } from "@/components/login-form"
import { hasSupabaseConfig } from "@/lib/env"

export default function RegisterPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-muted/30 p-4 md:p-6">
      <div className="w-full max-w-sm">
        <LoginForm mode="register" isConfigured={hasSupabaseConfig()} />
      </div>
    </div>
  )
}
