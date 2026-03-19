"use client"

import Link from "next/link"
import { useActionState } from "react"

import { loginAction, registerAction } from "@/app/auth-actions"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { AuthFormState } from "@/lib/types"

export function LoginForm({
  mode = "login",
  isConfigured = true,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  mode?: "login" | "register"
  isConfigured?: boolean
}) {
  const isRegister = mode === "register"
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    isRegister ? registerAction : loginAction,
    {}
  )

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="rounded-md border shadow-none">
        <CardHeader>
          <CardTitle>
            {isRegister ? "Создать аккаунт" : "Войти в рабочее пространство"}
          </CardTitle>
          <CardDescription>
            {isRegister
              ? "Только email и пароль. Без соцсетей и лишних шагов."
              : "Войдите по email и паролю, чтобы вернуться к вакансиям и отчетам."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action}>
            <FieldGroup>
              {state.message ? (
                <Field>
                  <Alert className="rounded-md">
                    <AlertDescription>{state.message}</AlertDescription>
                  </Alert>
                </Field>
              ) : null}
              {!isConfigured ? (
                <Field>
                  <Alert className="rounded-md">
                    <AlertDescription>
                      Supabase пока не настроен. Заполните `.env.local`, чтобы
                      включить реальную аутентификацию.
                    </AlertDescription>
                  </Alert>
                </Field>
              ) : null}
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@company.com"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Пароль</FieldLabel>
                <Input id="password" name="password" type="password" required />
              </Field>
              <Field>
                <Button type="submit" disabled={pending || !isConfigured}>
                  {pending
                    ? isRegister
                      ? "Создаем аккаунт..."
                      : "Входим..."
                    : isRegister
                      ? "Создать аккаунт"
                      : "Войти"}
                </Button>
                <FieldDescription className="text-center text-sm">
                  {isRegister ? (
                    <>
                      Уже есть аккаунт?{" "}
                      <Link
                        href="/login"
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        Войти
                      </Link>
                    </>
                  ) : (
                    <>
                      Нет аккаунта?{" "}
                      <Link
                        href="/register"
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        Создать
                      </Link>
                    </>
                  )}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
