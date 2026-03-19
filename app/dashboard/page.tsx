import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { getDashboardState } from "@/lib/dashboard"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const state = await getDashboardState(searchParams)

  if (state.needsAuth) {
    redirect("/login")
  }

  return <DashboardShell state={state} />
}
