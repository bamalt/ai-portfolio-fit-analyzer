"use client"

import { useMemo, useState, useTransition } from "react"
import {
  FileTextIcon,
  ListChecksIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"

import { updateJobDetailsAction } from "@/app/dashboard/actions"
import {
  Sidebar13DialogShell,
  type Sidebar13DialogStep,
} from "@/components/dashboard/sidebar-13-dialog-shell"
import { CriteriaEditor } from "@/components/dashboard/criteria-editor"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { DashboardJob } from "@/lib/types"

export function JobSettingsDialog({
  open,
  onOpenChange,
  job,
  canMutate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  job: DashboardJob | null
  canMutate: boolean
}) {
  const router = useRouter()
  const [title, setTitle] = useState(job?.title ?? "")
  const [description, setDescription] = useState(job?.description ?? "")
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const steps = useMemo<Sidebar13DialogStep[]>(
    () => [
      {
        id: "details",
        title: "Основное",
        description: "Название и текст вакансии, с которыми работает scoring.",
        icon: <FileTextIcon className="size-4" />,
        status: "current",
      },
      {
        id: "criteria",
        title: "Критерии",
        description: "Система оценки кандидатов по этой вакансии.",
        icon: <ListChecksIcon className="size-4" />,
        status: "current",
      },
    ],
    []
  )

  if (!job) {
    return null
  }

  const hasUnsavedChanges =
    title.trim() !== job.title || description.trim() !== job.description

  function handleSave() {
    if (!job) {
      return
    }

    setMessage(null)

    startTransition(async () => {
      const result = await updateJobDetailsAction({
        jobId: job.id,
        title,
        description,
      })

      if (!result.ok) {
        setMessage(result.message ?? "Не удалось сохранить изменения вакансии.")
        return
      }

      setMessage("Изменения вакансии сохранены.")
      router.refresh()
    })
  }

  const footer = (
    <div className="flex justify-end">
      <Button
        type="button"
        className="rounded-md"
        onClick={handleSave}
        disabled={!canMutate || isPending || !hasUnsavedChanges}
      >
        {isPending ? "Сохраняем..." : "Сохранить изменения"}
      </Button>
    </div>
  )

  return (
    <Sidebar13DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Настройки вакансии"
      description="Редактирование текста вакансии и критериев оценки."
      steps={steps}
      footer={footer}
    >
      <div className="space-y-5">
        {!canMutate ? (
          <Alert className="rounded-md">
            <AlertDescription>
              В демо-режиме редактирование вакансий отключено.
            </AlertDescription>
          </Alert>
        ) : null}

        {message ? (
          <Alert className="rounded-md">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-2">
          <label htmlFor="job-settings-title" className="text-sm font-medium">
            Название вакансии
          </label>
          <Input
            id="job-settings-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-md"
            disabled={!canMutate || isPending}
          />
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="job-settings-description"
            className="text-sm font-medium"
          >
            Текст вакансии
          </label>
          <Textarea
            id="job-settings-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-[320px] rounded-md"
            disabled={!canMutate || isPending}
          />
        </div>

        <div className="space-y-3 border-t pt-5">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Критерии оценки</h3>
            <p className="text-sm text-muted-foreground">
              Критерии редактируются отдельно и сразу помечают старые отчеты как
              устаревшие.
            </p>
          </div>
          <CriteriaEditor
            jobId={job.id}
            criteria={job.criteria}
            canMutate={canMutate}
          />
        </div>
      </div>
    </Sidebar13DialogShell>
  )
}
