"use client"

import type { CSSProperties, ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type StepStatus = "upcoming" | "current" | "done"

export interface Sidebar13DialogStep {
  id: string
  title: string
  description: string
  icon: ReactNode
  status: StepStatus
}

const statusLabels: Record<StepStatus, string> = {
  upcoming: "Далее",
  current: "Текущий",
  done: "Готово",
}

export function Sidebar13DialogShell({
  open,
  onOpenChange,
  title,
  description,
  steps,
  footer,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  steps: Sidebar13DialogStep[]
  footer?: ReactNode
  children: ReactNode
}) {
  const activeStep =
    steps.find((step) => step.status === "current") ??
    steps.find((step) => step.status === "done") ??
    steps[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[min(88svh,760px)] max-h-[calc(100svh-2rem)] gap-0 overflow-hidden rounded-md border p-0 ring-1 ring-border/80 md:max-w-5xl">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          {description}
        </DialogDescription>

        <SidebarProvider
          defaultOpen
          className="size-full min-h-0 items-start overflow-hidden"
          style={
            {
              "--sidebar-width": "17rem",
            } as CSSProperties
          }
        >
          <Sidebar collapsible="none" className="hidden h-full border-r md:flex">
            <SidebarHeader className="gap-1 border-b px-4 py-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/55">
                Workflow
              </div>
              <div className="text-sm font-semibold text-sidebar-foreground">
                {title}
              </div>
              <div className="text-xs leading-5 text-sidebar-foreground/70">
                {description}
              </div>
            </SidebarHeader>

            <SidebarContent>
              <SidebarGroup className="p-2">
                <SidebarGroupLabel>Шаги</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {steps.map((step) => (
                      <SidebarMenuItem key={step.id}>
                        <SidebarMenuButton
                          type="button"
                          isActive={step.status === "current"}
                          className="h-auto items-start gap-3 rounded-md px-3 py-3"
                        >
                          <div className="mt-0.5 text-sidebar-foreground/70">
                            {step.icon}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium">
                                {step.title}
                              </span>
                              <Badge
                                variant="outline"
                                className="rounded-sm px-1.5 py-0 text-[10px] font-medium"
                              >
                                {statusLabels[step.status]}
                              </Badge>
                            </div>
                            <p className="text-xs leading-5 whitespace-normal text-sidebar-foreground/60">
                              {step.description}
                            </p>
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            {footer ? (
              <>
                <SidebarSeparator />
                <SidebarFooter className="px-4 py-3">{footer}</SidebarFooter>
              </>
            ) : null}
          </Sidebar>

          <SidebarInset className="h-full min-w-0 min-h-0 shadow-none md:m-0 md:rounded-none">
            <div className="flex h-full min-h-0 flex-col">
              <header className="border-b px-5 py-4 md:hidden">
                <div className="space-y-1">
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Workflow
                  </div>
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="text-sm text-muted-foreground">
                    {activeStep?.title}
                  </div>
                </div>
              </header>

              <div
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5"
                )}
              >
                {children}
              </div>

              {footer ? (
                <div className="border-t px-5 py-4 md:hidden">{footer}</div>
              ) : null}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}
