"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Settings2Icon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"

import { deleteJobAction } from "@/app/dashboard/actions"
import { logoutAction } from "@/app/auth-actions"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenu,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarRail,
} from "@/components/ui/sidebar"
import type { DashboardJob } from "@/lib/types"

export function AppSidebar({
  jobs,
  selectedJobId,
  onCreateJob,
  onOpenJobSettings,
  mode,
  userEmail,
  canMutate,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  jobs: DashboardJob[]
  selectedJobId: string | null
  onCreateJob: () => void
  onOpenJobSettings: (jobId: string) => void
  mode: "live" | "demo"
  userEmail: string | null
  canMutate: boolean
}) {
  const router = useRouter()
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null)
  const [isDeletingJob, startDeletingJob] = useTransition()

  function handleDeleteJob(jobId: string, jobTitle: string) {
    const confirmed = window.confirm(`Удалить вакансию "${jobTitle}" со всеми кандидатами и отчетами?`)

    if (!confirmed) {
      return
    }

    setDeletingJobId(jobId)

    startDeletingJob(async () => {
      const result = await deleteJobAction({ jobId })

      setDeletingJobId(null)

      if (!result.ok) {
        window.alert(result.message ?? "Не удалось удалить вакансию.")
        return
      }

      if (selectedJobId === jobId) {
        router.replace("/dashboard")
      }

      router.refresh()
    })
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader className="border-b px-3 py-3">
        <Button
          type="button"
          className="rounded-md"
          onClick={onCreateJob}
          disabled={!canMutate}
        >
          Создать вакансию
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Список вакансий</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {jobs.length ? (
                jobs.map((job) => (
                  <SidebarMenuItem key={job.id}>
                    <SidebarMenuButton
                      className="pr-14"
                      isActive={job.id === selectedJobId}
                      render={<Link href={`/dashboard?job=${job.id}`} />}
                    >
                      <div className="flex min-w-0 flex-col items-start">
                        <span className="truncate font-medium">{job.title}</span>
                        <span className="text-xs text-sidebar-foreground/60">
                          {job.candidates.length} кандидатов
                        </span>
                      </div>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      type="button"
                      className="right-7"
                      aria-label="Настройки вакансии"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        onOpenJobSettings(job.id)
                      }}
                      disabled={!canMutate}
                    >
                      <Settings2Icon />
                    </SidebarMenuAction>
                    <SidebarMenuAction
                      type="button"
                      aria-label="Удалить вакансию"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        handleDeleteJob(job.id, job.title)
                      }}
                      disabled={!canMutate || isDeletingJob || deletingJobId === job.id}
                    >
                      <Trash2Icon />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))
              ) : (
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    Нет вакансий
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <div className="rounded-md border bg-sidebar-accent/30 px-3 py-2 text-xs text-sidebar-foreground/70">
          {userEmail ?? "Не авторизован"}
        </div>
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="outline"
            className="w-full rounded-md"
            disabled={mode === "demo"}
          >
            Выйти
          </Button>
        </form>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
