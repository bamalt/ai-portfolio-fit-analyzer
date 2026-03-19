"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { updateCriteriaAction } from "@/app/dashboard/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type { CriterionInput } from "@/lib/types"

function normalizeCriteriaForCompare(criteria: CriterionInput[]) {
  return JSON.stringify(
    criteria.map((criterion) => ({
      title: criterion.title.trim(),
      description: criterion.description.trim(),
      weight: Number(criterion.weight),
      kind: criterion.kind,
      evidenceRules: criterion.evidenceRules.map((rule) => rule.trim()),
    }))
  )
}

export function CriteriaEditor({
  jobId,
  criteria,
  canMutate,
}: {
  jobId: string
  criteria: CriterionInput[]
  canMutate: boolean
}) {
  const router = useRouter()
  const [draft, setDraft] = useState(criteria)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setDraft(criteria)
  }, [criteria])

  const hasUnsavedChanges =
    normalizeCriteriaForCompare(draft) !== normalizeCriteriaForCompare(criteria)

  function updateCriterion(index: number, patch: Partial<CriterionInput>) {
    setDraft((current) =>
      current.map((criterion, currentIndex) =>
        currentIndex === index ? { ...criterion, ...patch } : criterion
      )
    )
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const result = await updateCriteriaAction({ jobId, criteria: draft })

      if (!result.ok) {
        setMessage(result.message ?? "Не удалось сохранить критерии.")
        return
      }

      setMessage("Критерии сохранены. Существующие отчеты теперь будут считаться устаревшими.")
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Критерий</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead className="w-20">Вес</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {draft.map((criterion, index) => (
              <TableRow key={criterion.id ?? `${criterion.title}-${index}`}>
                <TableCell className="align-top">
                  <Input
                    value={criterion.title}
                    onChange={(event) =>
                      updateCriterion(index, { title: event.target.value })
                    }
                    className="rounded-md"
                    disabled={!canMutate || isPending}
                  />
                </TableCell>
                <TableCell className="align-top">
                  <Textarea
                    value={criterion.description}
                    onChange={(event) =>
                      updateCriterion(index, { description: event.target.value })
                    }
                    className="min-h-24 rounded-md"
                    disabled={!canMutate || isPending}
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
                    disabled={!canMutate || isPending}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Любое изменение критериев поднимает версию оценки. Следующий decision
          run автоматически переоценит устаревшие отчеты кандидатов.
        </p>
        <Button
          type="button"
          onClick={handleSave}
          className="rounded-md"
          disabled={!canMutate || isPending || !hasUnsavedChanges}
        >
          {isPending ? "Сохраняем..." : "Сохранить критерии"}
        </Button>
      </div>
    </div>
  )
}
