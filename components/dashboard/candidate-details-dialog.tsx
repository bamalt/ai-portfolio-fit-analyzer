"use client"

import { useState } from "react"
import { ChevronDownIcon, StarIcon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import type { DashboardCandidate, DashboardJob } from "@/lib/types"

type Section = "general" | "report"

function scoreTone(score: number) {
  if (score >= 80) return "default"
  if (score >= 60) return "secondary"
  return "outline"
}

function scoreStars(score: number) {
  const clamped = Math.max(0, Math.min(5, Math.round(score)))
  return Array.from({ length: 5 }, (_, index) => index < clamped)
}

export function CandidateDetailsDialog({
  open,
  onOpenChange,
  selectedCandidate,
  selectedJob,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCandidate: DashboardCandidate | null
  selectedJob: DashboardJob | null
}) {
  const [section, setSection] = useState<Section>(
    selectedCandidate?.report ? "report" : "general"
  )
  const [openCriteria, setOpenCriteria] = useState<Record<string, boolean>>({})

  if (!selectedCandidate || !selectedJob) {
    return null
  }

  const isStale =
    selectedCandidate.report &&
    selectedCandidate.report.criteriaVersion !== selectedJob.criteriaVersion
  const hideStaleFailedReport =
    Boolean(isStale) && selectedCandidate.status === "failed"
  const displayReport = hideStaleFailedReport ? null : selectedCandidate.report
  const isWinner =
    selectedJob.latestDecision?.winnerCandidateId === selectedCandidate.id

  function isCriterionOpen(key: string) {
    return openCriteria[key] ?? true
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[min(88svh,760px)] max-h-[calc(100svh-2rem)] gap-0 overflow-hidden rounded-md border p-0 ring-1 ring-border/80 md:max-w-5xl">
        <DialogTitle className="sr-only">
          Кандидат {selectedCandidate.name}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Детали кандидата и отчет по анализу репозитория.
        </DialogDescription>

        <SidebarProvider
          defaultOpen
          className="size-full min-h-0 items-start overflow-hidden"
          style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
        >
          <Sidebar collapsible="none" className="hidden h-full border-r md:flex">
            <SidebarHeader className="gap-1 border-b px-4 py-4">
              <div className="text-sm font-semibold text-sidebar-foreground">
                {selectedCandidate.name}
              </div>
              <div className="truncate text-xs text-sidebar-foreground/70">
                {selectedCandidate.githubUrl}
              </div>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup className="p-2">
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        isActive={section === "general"}
                        onClick={() => setSection("general")}
                      >
                        <span>Общие</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        isActive={section === "report"}
                        onClick={() => setSection("report")}
                      >
                        <span>Отчет</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <SidebarInset className="h-full min-w-0 min-h-0 shadow-none md:m-0 md:rounded-none">
            <div className="flex h-full min-h-0 flex-col">
              <header className="border-b px-5 py-4 md:hidden">
                <div className="space-y-3">
                  <div className="text-sm font-semibold">
                    {selectedCandidate.name}
                  </div>
                  <div className="flex gap-2">
                    <Badge
                      variant={section === "general" ? "default" : "outline"}
                      className="cursor-pointer rounded-sm"
                      onClick={() => setSection("general")}
                    >
                      Общие
                    </Badge>
                    <Badge
                      variant={section === "report" ? "default" : "outline"}
                      className="cursor-pointer rounded-sm"
                      onClick={() => setSection("report")}
                    >
                      Отчет
                    </Badge>
                  </div>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pl-5 pr-8 pt-10 pb-5 [scrollbar-gutter:stable]">
                {section === "general" ? (
                  <div className="space-y-4">
                    <Card className="rounded-md border shadow-none">
                      <CardHeader className="flex flex-row items-start justify-between space-y-0">
                        <div className="space-y-1">
                          <CardTitle>{selectedCandidate.name}</CardTitle>
                          <div className="text-sm text-muted-foreground">
                            {selectedCandidate.githubUrl}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="rounded-sm">
                            {selectedCandidate.status}
                          </Badge>
                          {displayReport ? (
                            <Badge
                              variant={scoreTone(displayReport.overallScore)}
                              className="rounded-sm"
                            >
                              {displayReport.overallScore}/100
                            </Badge>
                          ) : null}
                          {isWinner ? (
                            <Badge
                              variant="outline"
                              className="rounded-sm border-yellow-300 text-yellow-700"
                            >
                              <StarIcon className="size-3 fill-yellow-400 text-yellow-500" />
                              Лучший
                            </Badge>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent className="grid gap-4 text-sm">
                        <div className="grid gap-1">
                          <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                            GitHub
                          </div>
                          <a
                            href={selectedCandidate.githubUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all text-sm text-foreground underline underline-offset-4"
                          >
                            {selectedCandidate.githubUrl}
                          </a>
                        </div>

                        {selectedCandidate.portfolioUrl ? (
                          <div className="grid gap-1">
                            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                              Дополнительная ссылка
                            </div>
                            <a
                              href={selectedCandidate.portfolioUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="break-all text-sm text-foreground underline underline-offset-4"
                            >
                              {selectedCandidate.portfolioUrl}
                            </a>
                          </div>
                        ) : null}

                        {selectedCandidate.coverLetterText ? (
                          <div className="grid gap-1">
                            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                              Сопроводительное письмо
                            </div>
                            <div className="rounded-md border px-3 py-3 whitespace-pre-wrap">
                              {selectedCandidate.coverLetterText}
                            </div>
                          </div>
                        ) : null}

                        {selectedCandidate.coverLetterFilePath ? (
                          <div className="grid gap-1">
                            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                              Файл
                            </div>
                            <div className="rounded-md border px-3 py-2">
                              {selectedCandidate.coverLetterFilePath}
                            </div>
                          </div>
                        ) : null}

                        {selectedCandidate.analysisError ? (
                          <Alert className="rounded-md">
                            <AlertDescription>
                              {selectedCandidate.analysisError}
                            </AlertDescription>
                          </Alert>
                        ) : null}
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedCandidate.analysisError ? (
                      <Alert className="rounded-md">
                        <AlertDescription>
                          {selectedCandidate.analysisError}
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    {hideStaleFailedReport ? (
                      <Alert className="rounded-md">
                        <AlertDescription>
                          Последняя попытка пересчитать кандидата под текущие
                          критерии завершилась ошибкой. Предыдущий устаревший
                          отчет скрыт.
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    {!displayReport ? (
                      <div className="text-sm text-muted-foreground">
                        Для этого кандидата пока нет готового отчета.
                      </div>
                    ) : (
                      <>
                        <Card className="rounded-md border shadow-none">
                          <CardHeader>
                            <CardTitle>Резюме</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm leading-6 text-muted-foreground">
                              {displayReport.summary}
                            </p>
                          </CardContent>
                        </Card>

                        <Card className="rounded-md border shadow-none">
                          <CardHeader>
                            <CardTitle>Разбор по критериям</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="rounded-md border">
                              {displayReport.criteriaBreakdown.map((item, index) => {
                                const criterionKey = `${item.criterionTitle}-${index}`
                                const isOpen = isCriterionOpen(criterionKey)

                                return (
                                  <Collapsible
                                    key={criterionKey}
                                    open={isOpen}
                                    onOpenChange={(open) =>
                                      setOpenCriteria((current) => ({
                                        ...current,
                                        [criterionKey]: open,
                                      }))
                                    }
                                    className="border-b last:border-b-0"
                                  >
                                    <div className="px-4 py-4">
                                      <div className="flex items-start gap-3">
                                        <div className="min-w-0 flex-1">
                                          <div className="text-sm font-medium">
                                            {item.criterionTitle} ({item.score}/5)
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                          <div className="flex items-center gap-0.5 text-muted-foreground">
                                            {scoreStars(item.score).map((filled, starIndex) => (
                                              <StarIcon
                                                key={`${criterionKey}-star-${starIndex}`}
                                                className={`size-3.5 ${filled ? "fill-yellow-400 text-yellow-500" : "fill-transparent text-muted-foreground/50"}`}
                                              />
                                            ))}
                                          </div>
                                          <CollapsibleTrigger className="flex size-7 items-center justify-center rounded-sm border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                                            <ChevronDownIcon
                                              className={`size-4 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
                                            />
                                          </CollapsibleTrigger>
                                        </div>
                                      </div>

                                      <CollapsibleContent>
                                        <div className="mt-4 space-y-3 border-t pt-4">
                                          <p className="text-sm leading-6 text-muted-foreground">
                                            {item.reasoning}
                                          </p>
                                          <div className="flex flex-wrap gap-1">
                                            {item.evidence.map((evidence) => (
                                              <Badge
                                                key={evidence}
                                                variant="outline"
                                                className="rounded-sm"
                                              >
                                                {evidence}
                                              </Badge>
                                            ))}
                                          </div>
                                        </div>
                                      </CollapsibleContent>
                                    </div>
                                  </Collapsible>
                                )
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}
