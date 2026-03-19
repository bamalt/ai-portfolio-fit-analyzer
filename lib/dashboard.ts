import { getDemoDashboardState } from "@/lib/demo"
import { getMissingEnv, hasSupabaseConfig } from "@/lib/env"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type {
  CandidateReportRecord,
  CandidateSourceRecord,
  DashboardCandidate,
  DashboardJob,
  DashboardState,
  DecisionRunRecord,
} from "@/lib/types"

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export async function getDashboardState(searchParams: SearchParams): Promise<DashboardState> {
  const params = await searchParams
  const selectedJobId = firstValue(params.job)
  const selectedCandidateId = firstValue(params.candidate)

  if (!hasSupabaseConfig()) {
    const demo = getDemoDashboardState()
    const job = demo.jobs.find((item) => item.id === selectedJobId) ?? demo.selectedJob
    const candidate =
      job?.candidates.find((item) => item.id === selectedCandidateId) ??
      job?.candidates[0] ??
      null

    return {
      ...demo,
      selectedJob: job ?? null,
      selectedCandidate: candidate,
    }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      mode: "live",
      needsAuth: true,
      canMutate: false,
      isConfigured: true,
      configurationIssues: [],
      jobs: [],
      selectedJob: null,
      selectedCandidate: null,
      userEmail: null,
    }
  }

  const configurationIssues = getMissingEnv()

  const { data: jobsData, error: jobsError } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (jobsError) {
    const message = `Ошибка доступа к таблице jobs: ${jobsError.message}. Примените SQL из supabase/migrations/002_public_table_grants.sql.`

    console.error("[dashboard] jobs query failed", jobsError)

    return {
      mode: "live",
      needsAuth: false,
      canMutate: false,
      isConfigured: false,
      configurationIssues: [...configurationIssues, message],
      jobs: [],
      selectedJob: null,
      selectedCandidate: null,
      userEmail: user.email ?? null,
    }
  }

  const jobsRows = (jobsData ?? []) as Array<Record<string, unknown>>
  const jobIds = jobsRows.map((row) => String(row.id))

  const [criteriaRes, candidatesRes, reportsRes, sourcesRes, decisionsRes] =
    jobIds.length > 0
      ? await Promise.all([
          supabase
            .from("job_criteria")
            .select("*")
            .eq("user_id", user.id)
            .in("job_id", jobIds)
            .order("position", { ascending: true }),
          supabase
            .from("candidates")
            .select("*")
            .eq("user_id", user.id)
            .in("job_id", jobIds)
            .order("created_at", { ascending: true }),
          supabase
            .from("candidate_reports")
            .select("*")
            .eq("user_id", user.id)
            .in("job_id", jobIds),
          supabase
            .from("candidate_sources")
            .select("*")
            .eq("user_id", user.id),
          supabase
            .from("decision_runs")
            .select("*")
            .eq("user_id", user.id)
            .in("job_id", jobIds)
            .order("created_at", { ascending: false }),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ]

  const queryErrors = [
    criteriaRes.error
      ? `Ошибка доступа к job_criteria: ${criteriaRes.error.message}`
      : null,
    candidatesRes.error
      ? `Ошибка доступа к candidates: ${candidatesRes.error.message}`
      : null,
    reportsRes.error
      ? `Ошибка доступа к candidate_reports: ${reportsRes.error.message}`
      : null,
    sourcesRes.error
      ? `Ошибка доступа к candidate_sources: ${sourcesRes.error.message}`
      : null,
    decisionsRes.error
      ? `Ошибка доступа к decision_runs: ${decisionsRes.error.message}`
      : null,
  ].filter(Boolean) as string[]

  if (queryErrors.length > 0) {
    console.error("[dashboard] related queries failed", {
      criteria: criteriaRes.error,
      candidates: candidatesRes.error,
      reports: reportsRes.error,
      sources: sourcesRes.error,
      decisions: decisionsRes.error,
    })
  }

  const criteriaRows = (criteriaRes.data ?? []) as Array<Record<string, unknown>>
  const candidateRows = (candidatesRes.data ?? []) as Array<Record<string, unknown>>
  const reportRows = (reportsRes.data ?? []) as Array<Record<string, unknown>>
  const sourceRows = (sourcesRes.data ?? []) as Array<Record<string, unknown>>
  const decisionRows = (decisionsRes.data ?? []) as Array<Record<string, unknown>>

  const reportsByCandidate = new Map<string, CandidateReportRecord>()
  reportRows.forEach((row) => {
    reportsByCandidate.set(String(row.candidate_id), {
      id: String(row.id),
      candidateId: String(row.candidate_id),
      jobId: String(row.job_id),
      overallScore: Number(row.overall_score ?? 0),
      summary: String(row.summary ?? ""),
      strengths: Array.isArray(row.strengths) ? (row.strengths as string[]) : [],
      gaps: Array.isArray(row.gaps) ? (row.gaps as string[]) : [],
      recommendations: Array.isArray(row.recommendations)
        ? (row.recommendations as string[])
        : [],
      criteriaBreakdown: Array.isArray(row.criteria_breakdown)
        ? (row.criteria_breakdown as CandidateReportRecord["criteriaBreakdown"])
        : [],
      criteriaVersion: Number(row.criteria_version ?? 1),
      analyzedAt: row.analyzed_at ? String(row.analyzed_at) : null,
    })
  })

  const sourcesByCandidate = new Map<string, CandidateSourceRecord>()
  sourceRows.forEach((row) => {
    sourcesByCandidate.set(String(row.candidate_id), {
      id: String(row.id),
      candidateId: String(row.candidate_id),
      sourceType:
        String(row.source_type) === "profile" ? "profile" : "repo",
      sourceUrl: String(row.source_url ?? ""),
      repoSnapshotJson: (row.repo_snapshot_json ?? {}) as CandidateSourceRecord["repoSnapshotJson"],
      detectedStack: Array.isArray(row.detected_stack)
        ? (row.detected_stack as string[])
        : [],
      activitySummary: String(row.activity_summary ?? ""),
    })
  })

  const candidatesByJob = new Map<string, DashboardCandidate[]>()
  candidateRows.forEach((row) => {
    const candidate: DashboardCandidate = {
      id: String(row.id),
      jobId: String(row.job_id),
      name: String(row.name ?? ""),
      githubUrl: String(row.github_url ?? ""),
      portfolioUrl: row.portfolio_url ? String(row.portfolio_url) : null,
      coverLetterText: row.cover_letter_text ? String(row.cover_letter_text) : null,
      coverLetterFilePath: row.cover_letter_file_path
        ? String(row.cover_letter_file_path)
        : null,
      status: (row.status as DashboardCandidate["status"]) ?? "pending",
      overallScore:
        row.overall_score === null || row.overall_score === undefined
          ? null
          : Number(row.overall_score),
      analysisError: row.analysis_error ? String(row.analysis_error) : null,
      createdAt: String(row.created_at),
      source: sourcesByCandidate.get(String(row.id)) ?? null,
      report: reportsByCandidate.get(String(row.id)) ?? null,
    }

    const list = candidatesByJob.get(candidate.jobId) ?? []
    list.push(candidate)
    candidatesByJob.set(candidate.jobId, list)
  })

  const latestDecisionByJob = new Map<string, DecisionRunRecord>()
  decisionRows.forEach((row) => {
    const jobId = String(row.job_id)
    if (latestDecisionByJob.has(jobId)) {
      return
    }

    latestDecisionByJob.set(jobId, {
      id: String(row.id),
      jobId,
      winnerCandidateId: row.winner_candidate_id ? String(row.winner_candidate_id) : null,
      status: (row.status as DecisionRunRecord["status"]) ?? "ready",
      summary: String(row.summary ?? ""),
      rankedCandidates: Array.isArray(row.ranked_candidates)
        ? (row.ranked_candidates as DecisionRunRecord["rankedCandidates"])
        : [],
      error: row.error ? String(row.error) : null,
      createdAt: String(row.created_at),
    })
  })

  const jobs: DashboardJob[] = jobsRows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    status: (row.status as DashboardJob["status"]) ?? "ready",
    criteriaVersion: Number(row.criteria_version ?? 1),
    analysisError: row.analysis_error ? String(row.analysis_error) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
    criteria: criteriaRows
      .filter((criterion) => String(criterion.job_id) === String(row.id))
      .map((criterion) => ({
        id: String(criterion.id),
        title: String(criterion.title ?? ""),
        description: String(criterion.description ?? ""),
        weight: Number(criterion.weight ?? 3),
        kind: String(criterion.kind ?? "quality") as DashboardJob["criteria"][number]["kind"],
        evidenceRules: Array.isArray(criterion.evidence_rules)
          ? (criterion.evidence_rules as string[])
          : [],
      })),
    candidates: candidatesByJob.get(String(row.id)) ?? [],
    latestDecision: latestDecisionByJob.get(String(row.id)) ?? null,
  }))

  const selectedJob =
    jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null
  const selectedCandidate =
    selectedCandidateId && selectedJob
      ? selectedJob.candidates.find((candidate) => candidate.id === selectedCandidateId) ??
        null
      : null

  return {
    mode: "live",
    needsAuth: false,
    canMutate: queryErrors.length === 0,
    isConfigured: queryErrors.length === 0 && configurationIssues.length === 0,
    configurationIssues: [...configurationIssues, ...queryErrors],
    jobs,
    selectedJob,
    selectedCandidate,
    userEmail: user.email ?? null,
  }
}
