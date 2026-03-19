"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  FileTextIcon,
  LoaderCircleIcon,
  LinkIcon,
  UserIcon,
} from "lucide-react"

import { createCandidateAction } from "@/app/dashboard/actions"
import {
  Sidebar13DialogShell,
  type Sidebar13DialogStep,
} from "@/components/dashboard/sidebar-13-dialog-shell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function CreateCandidateSheet({
  open,
  onOpenChange,
  selectedJobId,
  canMutate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedJobId: string | null
  canMutate: boolean
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const steps: Sidebar13DialogStep[] = [
    {
      id: "profile",
      title: "Профиль кандидата",
      description: "Имя кандидата и связь с текущей вакансией.",
      icon: <UserIcon className="size-4" />,
      status: isPending ? "done" : "current",
    },
    {
      id: "sources",
      title: "Источники",
      description: "GitHub, портфолио и дополнительный контекст для оценки.",
      icon: <LinkIcon className="size-4" />,
      status: isPending ? "done" : "upcoming",
    },
    {
      id: "analysis",
      title: "Отчет",
      description: "Результаты будут доступны в карточке кандидата.",
      icon: <FileTextIcon className="size-4" />,
      status: isPending ? "current" : "upcoming",
    },
  ]

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      formRef.current?.reset()
      setMessage(null)
    }

    onOpenChange(nextOpen)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!formRef.current) {
      return
    }

    const formData = new FormData(formRef.current)
    setMessage(null)

    startTransition(async () => {
      const result = await createCandidateAction(formData)

      if (!result.ok || !result.data) {
        setMessage(result.message ?? "Не удалось создать кандидата.")
        return
      }

      onOpenChange(false)
      router.replace(
        `/dashboard?job=${result.data.jobId}&candidate=${result.data.candidateId}`
      )
      router.refresh()
    })
  }

  const footer = (
    <div className="flex justify-end">
      <Button
        type="submit"
        form="create-candidate-form"
        className="rounded-md"
        disabled={isPending || !selectedJobId || !canMutate}
      >
        {isPending ? (
          <>
            <LoaderCircleIcon className="size-4 animate-spin" />
            Анализируем...
          </>
        ) : (
          "Сохранить кандидата"
        )}
      </Button>
    </div>
  )

  return (
    <Sidebar13DialogShell
      open={open}
      onOpenChange={handleOpenChange}
      title="Новый кандидат"
      description="Привяжите кандидата к вакансии и добавьте ссылки на профиль."
      steps={steps}
      footer={footer}
    >
      <form
        id="create-candidate-form"
        ref={formRef}
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        <input type="hidden" name="jobId" value={selectedJobId ?? ""} />

        {!canMutate ? (
          <Alert className="rounded-md">
            <AlertDescription>
              В демо-режиме создание кандидатов отключено. Подключите Supabase и
              LLM для live flow.
            </AlertDescription>
          </Alert>
        ) : null}

        {!selectedJobId ? (
          <Alert className="rounded-md">
            <AlertDescription>
              Сначала выберите вакансию, затем добавляйте кандидата.
            </AlertDescription>
          </Alert>
        ) : null}

        {message ? (
          <Alert className="rounded-md">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-2">
          <label htmlFor="candidate-name" className="text-sm font-medium">
            Имя кандидата
          </label>
          <Input
            id="candidate-name"
            name="name"
            placeholder="Например: Алексей"
            className="rounded-md"
            required
            disabled={isPending}
          />
        </div>

        <div className="grid gap-2">
          <label htmlFor="github-url" className="text-sm font-medium">
            GitHub ссылка
          </label>
          <Input
            id="github-url"
            name="githubUrl"
            placeholder="https://github.com/user/repo или https://github.com/user"
            className="rounded-md"
            required
            disabled={isPending}
          />
        </div>

        <div className="grid gap-2">
          <label htmlFor="cover-letter-text" className="text-sm font-medium">
            Сопроводительное письмо
          </label>
          <Textarea
            id="cover-letter-text"
            name="coverLetterText"
            placeholder="Добавьте краткий контекст: что важно подсветить в анализе."
            className="min-h-44 rounded-md"
            disabled={isPending}
          />
        </div>
      </form>
    </Sidebar13DialogShell>
  )
}
