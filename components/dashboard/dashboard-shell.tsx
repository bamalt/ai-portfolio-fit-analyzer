"use client"

import { StarIcon, Trash2Icon } from "lucide-react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import {
  chooseWinnerAction,
  deleteCandidateAction,
} from "@/app/dashboard/actions"
import { AppSidebar } from "@/components/app-sidebar"
import { CandidateDetailsDialog } from "@/components/dashboard/candidate-details-dialog"
import { CreateCandidateSheet } from "@/components/dashboard/create-candidate-sheet"
import { CreateJobSheet } from "@/components/dashboard/create-job-sheet"
import { JobSettingsDialog } from "@/components/dashboard/job-settings-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { DashboardState } from "@/lib/types"

function buildCandidateHref(jobId: string, candidateId: string) {
  return `/dashboard?job=${jobId}&candidate=${candidateId}`
}

export function DashboardShell({ state }: { state: DashboardState }) {
  const router = useRouter()
  const [jobSheetOpen, setJobSheetOpen] = useState(false)
  const [jobSettingsId, setJobSettingsId] = useState<string | null>(null)
  const [candidateSheetOpen, setCandidateSheetOpen] = useState(false)
  const [decisionMessage, setDecisionMessage] = useState<string | null>(null)
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null)
  const [isChoosingWinner, startChoosingWinner] = useTransition()

  const { selectedJob, selectedCandidate } = state
  const jobSettingsTarget =
    state.jobs.find((job) => job.id === jobSettingsId) ?? null

  function handleChooseWinner() {
    if (!selectedJob) {
      return
    }

    setDecisionMessage(null)

    startChoosingWinner(async () => {
      const result = await chooseWinnerAction(selectedJob.id)

      if (!result.ok || !result.data) {
        setDecisionMessage(result.message ?? "Не удалось завершить подбор.")
        return
      }

      router.replace(buildCandidateHref(selectedJob.id, result.data.winnerCandidateId))
      router.refresh()
    })
  }

  function closeCandidateDialog() {
    if (!selectedJob) {
      return
    }

    router.replace(`/dashboard?job=${selectedJob.id}`)
    router.refresh()
  }

  function openCandidateDialog(candidateId: string) {
    if (!selectedJob) {
      return
    }

    router.replace(buildCandidateHref(selectedJob.id, candidateId))
    router.refresh()
  }

  function handleDeleteCandidate(candidateId: string) {
    if (!selectedJob) {
      return
    }

    const confirmed = window.confirm("Удалить кандидата и его отчет?")
    if (!confirmed) {
      return
    }

    setDecisionMessage(null)
    setDeletingCandidateId(candidateId)

    startChoosingWinner(async () => {
      const result = await deleteCandidateAction({ candidateId })

      setDeletingCandidateId(null)

      if (!result.ok) {
        setDecisionMessage(result.message ?? "Не удалось удалить кандидата.")
        return
      }

      if (selectedCandidate?.id === candidateId) {
        router.replace(`/dashboard?job=${selectedJob.id}`)
      }

      router.refresh()
    })
  }

  return (
    <>
      <SidebarProvider defaultOpen>
        <AppSidebar
          jobs={state.jobs}
          selectedJobId={selectedJob?.id ?? null}
          mode={state.mode}
          userEmail={state.userEmail}
          canMutate={state.canMutate}
          onCreateJob={() => setJobSheetOpen(true)}
          onOpenJobSettings={setJobSettingsId}
        />

        <SidebarInset className="border-l">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {selectedJob?.title ?? "Вакансии"}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {selectedJob
                  ? `${selectedJob.candidates.length} кандидатов • version ${selectedJob.criteriaVersion}`
                  : "Создайте первую вакансию и начните сравнивать кандидатов"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-md"
                onClick={() => setCandidateSheetOpen(true)}
                disabled={!selectedJob || !state.canMutate}
              >
                Новый кандидат
              </Button>
              <Button
                type="button"
                className="rounded-md"
                onClick={handleChooseWinner}
                disabled={!selectedJob || isChoosingWinner || !state.canMutate}
              >
                {isChoosingWinner ? "Сравниваем..." : "Выбрать лучшего"}
              </Button>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-4 p-4">
            {state.mode === "demo" ? (
              <Alert className="rounded-md">
                <AlertDescription>
                  Сейчас открыт demo-режим. Подключите `.env.local` и Supabase,
                  чтобы получить реальное сохранение, auth и live-анализ.
                </AlertDescription>
              </Alert>
            ) : null}

            {state.mode === "live" && state.configurationIssues.length > 0 ? (
              <Alert className="rounded-md">
                <AlertDescription>
                  {state.configurationIssues.join(" ")}
                </AlertDescription>
              </Alert>
            ) : null}

            {decisionMessage ? (
              <Alert className="rounded-md">
                <AlertDescription>{decisionMessage}</AlertDescription>
              </Alert>
            ) : null}

            {!selectedJob ? (
              <Card className="rounded-md border shadow-none">
                <CardHeader>
                  <CardTitle>Пока нет вакансий</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <p>
                    Создайте вакансию, получите AI-критерии, затем добавьте
                    кандидатов с GitHub-ссылками и сравните их по одной системе.
                  </p>
                  <Button
                    type="button"
                    className="rounded-md"
                    onClick={() => setJobSheetOpen(true)}
                    disabled={!state.canMutate}
                  >
                    Создать вакансию
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="rounded-md border shadow-none">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle>Кандидаты</CardTitle>
                    <Badge variant="outline" className="rounded-sm">
                      {selectedJob.candidates.length}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    {selectedJob.candidates.length ? (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Имя</TableHead>
                              <TableHead className="w-24">Score</TableHead>
                              <TableHead className="w-32">Статус</TableHead>
                              <TableHead className="w-24" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedJob.candidates.map((candidate) => {
                              const isActive = candidate.id === selectedCandidate?.id
                              const isStale =
                                candidate.report &&
                                candidate.report.criteriaVersion !==
                                  selectedJob.criteriaVersion
                              const showScore =
                                candidate.overallScore !== null &&
                                !(candidate.status === "failed" && isStale)
                              const isWinner =
                                selectedJob.latestDecision?.winnerCandidateId ===
                                candidate.id

                              return (
                                <TableRow
                                  key={candidate.id}
                                  data-state={isActive ? "selected" : undefined}
                                  className="cursor-pointer"
                                  onClick={() => openCandidateDialog(candidate.id)}
                                >
                                  <TableCell>
                                    <div className="space-y-1">
                                      <div className="font-medium">{candidate.name}</div>
                                      <div className="truncate text-xs text-muted-foreground">
                                        {candidate.githubUrl}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {showScore
                                      ? `${candidate.overallScore}/100`
                                      : "—"}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      <Badge variant="outline" className="rounded-sm">
                                        {candidate.status}
                                      </Badge>
                                      {isStale ? (
                                        <Badge variant="outline" className="rounded-sm">
                                          устарел
                                        </Badge>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center justify-end gap-1">
                                      {isWinner ? (
                                        <StarIcon className="size-4 fill-yellow-400 text-yellow-500" />
                                      ) : null}
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="rounded-sm text-muted-foreground"
                                        disabled={deletingCandidateId === candidate.id}
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          handleDeleteCandidate(candidate.id)
                                        }}
                                      >
                                        <Trash2Icon className="size-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Пока нет кандидатов. Добавьте первый GitHub-источник и
                        запустите анализ.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>

      <CreateJobSheet
        open={jobSheetOpen}
        onOpenChange={setJobSheetOpen}
        canMutate={state.canMutate}
      />
      <JobSettingsDialog
        key={jobSettingsTarget?.id ?? "job-settings"}
        open={Boolean(jobSettingsTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setJobSettingsId(null)
          }
        }}
        job={jobSettingsTarget}
        canMutate={state.canMutate}
      />
      <CreateCandidateSheet
        open={candidateSheetOpen}
        onOpenChange={setCandidateSheetOpen}
        selectedJobId={selectedJob?.id ?? null}
        canMutate={state.canMutate}
      />
      <CandidateDetailsDialog
        key={selectedCandidate?.id ?? "candidate-details"}
        open={Boolean(selectedCandidate)}
        onOpenChange={(open) => {
          if (!open) {
            closeCandidateDialog()
          }
        }}
        selectedCandidate={selectedCandidate}
        selectedJob={selectedJob}
      />
    </>
  )
}
