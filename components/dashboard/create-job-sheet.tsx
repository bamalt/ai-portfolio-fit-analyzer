"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  FileTextIcon,
  LoaderCircleIcon,
  ListChecksIcon,
  SparklesIcon,
} from "lucide-react"

import {
  createJobAction,
  previewJobCriteriaAction,
} from "@/app/dashboard/actions"
import {
  Sidebar13DialogShell,
  type Sidebar13DialogStep,
} from "@/components/dashboard/sidebar-13-dialog-shell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type { CriterionInput } from "@/lib/types"

type Step = "draft" | "analyzing" | "review"

export function CreateJobSheet({
  open,
  onOpenChange,
  canMutate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  canMutate: boolean
}) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [requirements, setRequirements] = useState<string[]>([])
  const [criteria, setCriteria] = useState<CriterionInput[]>([])
  const [step, setStep] = useState<Step>("draft")
  const [message, setMessage] = useState<string | null>(null)
  const [isAnalyzing, startAnalyzing] = useTransition()
  const [isSaving, startSaving] = useTransition()

  const progress = useMemo(() => {
    if (step === "analyzing" || isAnalyzing) return 62
    if (step === "review") return 100
    return 18
  }, [isAnalyzing, step])

  const steps = useMemo<Sidebar13DialogStep[]>(() => {
    return [
      {
        id: "draft",
        title: "Текст вакансии",
        description: "Название и исходный текст, из которого строится scoring.",
        icon: <FileTextIcon className="size-4" />,
        status: step === "draft" ? "current" : "done",
      },
      {
        id: "analysis",
        title: "AI-анализ",
        description: "Извлечение требований и структуры оценки по тексту вакансии.",
        icon: <SparklesIcon className="size-4" />,
        status:
          step === "analyzing"
            ? "current"
            : step === "review"
              ? "done"
              : "upcoming",
      },
      {
        id: "review",
        title: "Критерии",
        description: "Проверка и ручная правка критериев перед сохранением.",
        icon: <ListChecksIcon className="size-4" />,
        status: step === "review" ? "current" : "upcoming",
      },
    ]
  }, [step])

  function resetState() {
    setTitle("")
    setDescription("")
    setRequirements([])
    setCriteria([])
    setStep("draft")
    setMessage(null)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetState()
    }

    onOpenChange(nextOpen)
  }

  function updateCriterion(index: number, patch: Partial<CriterionInput>) {
    setCriteria((current) =>
      current.map((criterion, currentIndex) =>
        currentIndex === index ? { ...criterion, ...patch } : criterion
      )
    )
  }

  function handleAnalyze() {
    if (!title.trim() || !description.trim()) {
      setMessage("Введите название вакансии и полный текст описания.")
      return
    }

    setMessage(null)
    setStep("analyzing")

    startAnalyzing(async () => {
      const result = await previewJobCriteriaAction({ title, description })

      if (!result.ok || !result.data) {
        setMessage(result.message ?? "Не удалось проанализировать вакансию.")
        setStep("draft")
        return
      }

      setRequirements(result.data.requirements)
      setCriteria(result.data.criteria)
      setStep("review")
    })
  }

  function handleSave() {
    setMessage(null)

    startSaving(async () => {
      const result = await createJobAction({ title, description, criteria })

      if (!result.ok || !result.data) {
        setMessage(result.message ?? "Не удалось сохранить вакансию.")
        return
      }

      onOpenChange(false)
      router.replace(`/dashboard?job=${result.data.jobId}`)
      router.refresh()
    })
  }

  const footer = (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <span>Прогресс</span>
          <span>
            {step === "draft"
              ? "Шаг 1"
              : step === "analyzing"
                ? "Шаг 2"
                : "Шаг 3"}
          </span>
        </div>
        <Progress value={progress} className="h-1.5 rounded-sm" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {step === "review" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep("draft")}
            className="rounded-md"
          >
            Назад
          </Button>
        ) : (
          <div className="hidden sm:block" />
        )}

        {step === "review" ? (
          <Button
            type="button"
            className="rounded-md"
            onClick={handleSave}
            disabled={isSaving || !canMutate}
          >
            {isSaving ? (
              <>
                <LoaderCircleIcon className="size-4 animate-spin" />
                Сохраняем...
              </>
            ) : (
              "Сохранить вакансию"
            )}
          </Button>
        ) : (
          <Button
            type="button"
            className="rounded-md"
            onClick={handleAnalyze}
            disabled={isAnalyzing || isSaving || !canMutate}
          >
            {isAnalyzing ? (
              <>
                <LoaderCircleIcon className="size-4 animate-spin" />
                Анализируем...
              </>
            ) : (
              "Далее"
            )}
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <Sidebar13DialogShell
      open={open}
      onOpenChange={handleOpenChange}
      title="Новая вакансия"
      description="Соберите текст вакансии, выделите критерии и сохраните финальную систему оценки."
      steps={steps}
      footer={footer}
    >
      <div className="space-y-5">
        {!canMutate ? (
          <Alert className="rounded-md">
            <AlertDescription>
              В демо-режиме создание вакансий отключено. Подключите Supabase и
              LLM, чтобы включить live flow.
            </AlertDescription>
          </Alert>
        ) : null}

        {message ? (
          <Alert className="rounded-md">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        {step === "analyzing" ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-md border">
            <div className="flex max-w-sm flex-col items-center gap-3 text-center">
              <LoaderCircleIcon className="size-6 animate-spin text-muted-foreground" />
              <div className="space-y-1">
                <div className="text-sm font-medium">Анализируем вакансию</div>
                <p className="text-sm text-muted-foreground">
                  LLM выделяет требования и формирует критерии оценки по тексту вакансии.
                </p>
              </div>
            </div>
          </div>
        ) : step !== "review" ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label htmlFor="job-title" className="text-sm font-medium">
                Название вакансии
              </label>
              <Input
                id="job-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Например: Product Frontend Engineer"
                className="rounded-md"
                disabled={isAnalyzing || isSaving}
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="job-description" className="text-sm font-medium">
                Текст вакансии
              </label>
              <Textarea
                id="job-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Вставьте описание вакансии целиком."
                className="min-h-[320px] rounded-md"
                disabled={isAnalyzing || isSaving}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Извлеченные требования</h3>
                <Badge variant="outline" className="rounded-sm">
                  {requirements.length} требований
                </Badge>
              </div>
              <div className="grid gap-2">
                {requirements.map((requirement) => (
                  <div
                    key={requirement}
                    className="rounded-md border bg-card px-3 py-2 text-sm"
                  >
                    {requirement}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Критерии оценки</h3>
                <Badge variant="outline" className="rounded-sm">
                  Inline edit
                </Badge>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Критерий</TableHead>
                      <TableHead>Описание</TableHead>
                      <TableHead className="w-24">Вес</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {criteria.map((criterion, index) => (
                      <TableRow key={`${criterion.title}-${index}`}>
                        <TableCell className="align-top">
                          <Input
                            value={criterion.title}
                            onChange={(event) =>
                              updateCriterion(index, {
                                title: event.target.value,
                              })
                            }
                            className="rounded-md"
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Textarea
                            value={criterion.description}
                            onChange={(event) =>
                              updateCriterion(index, {
                                description: event.target.value,
                              })
                            }
                            className="min-h-24 rounded-md"
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            type="number"
                            min={1}
                            max={5}
                            value={criterion.weight}
                            onChange={(event) =>
                              updateCriterion(index, {
                                weight: Number(event.target.value || 3),
                              })
                            }
                            className="rounded-md"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </div>
    </Sidebar13DialogShell>
  )
}
