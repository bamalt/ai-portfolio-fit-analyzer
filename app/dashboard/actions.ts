"use server"

import { revalidatePath } from "next/cache"

import {
  generateCandidateEvaluation,
  generateDecision,
  previewVacancyAnalysis,
} from "@/lib/ai"
import { hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/env"
import { collectGithubDigest } from "@/lib/github"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ActionResult, CandidateEvaluationResult, CriterionInput } from "@/lib/types"

function formatErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message
    if (typeof message === "string" && message.trim()) {
      return message
    }
  }

  return fallback
}

function clampWeight(value: number) {
  return Math.max(1, Math.min(5, Math.round(value || 0)))
}

function normalizeCriteria(criteria: CriterionInput[]) {
  return criteria
    .map((criterion) => ({
      ...criterion,
      title: criterion.title.trim(),
      description: criterion.description.trim(),
      weight: clampWeight(criterion.weight),
      evidenceRules: criterion.evidenceRules.map((rule) => rule.trim()).filter(Boolean),
    }))
    .filter((criterion) => criterion.title && criterion.description)
}

async function requireUser() {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase не настроен. Заполните .env.local.")
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Сессия не найдена. Войдите заново.")
  }

  return { supabase, user }
}

async function getJobContext(jobId: string, userId: string) {
  const { supabase } = await requireUser()

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single()

  if (jobError || !job) {
    throw new Error(formatErrorMessage(jobError, "Вакансия не найдена."))
  }

  const { data: criteriaRows, error: criteriaError } = await supabase
    .from("job_criteria")
    .select("*")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .order("position", { ascending: true })

  if (criteriaError) {
    throw new Error(
      formatErrorMessage(criteriaError, "Не удалось загрузить критерии вакансии.")
    )
  }

  return {
    job,
    criteria: (criteriaRows ?? []).map((criterion) => ({
      id: String(criterion.id),
      title: String(criterion.title),
      description: String(criterion.description),
      weight: Number(criterion.weight),
      kind: String(criterion.kind) as CriterionInput["kind"],
      evidenceRules: Array.isArray(criterion.evidence_rules)
        ? (criterion.evidence_rules as string[])
        : [],
    })),
  }
}

async function persistCandidateAnalysis({
  candidateId,
  jobId,
  candidateName,
  githubUrl,
  coverLetterText,
  criteriaVersion,
  criteria,
  jobTitle,
  jobDescription,
}: {
  candidateId: string
  jobId: string
  candidateName: string
  githubUrl: string
  coverLetterText: string
  criteriaVersion: number
  criteria: CriterionInput[]
  jobTitle: string
  jobDescription: string
}) {
  const { supabase, user } = await requireUser()

  await supabase
    .from("candidates")
    .update({
      status: "analyzing",
      analysis_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", candidateId)
    .eq("user_id", user.id)

  try {
    const githubDigest = await collectGithubDigest(githubUrl)
    const report = await generateCandidateEvaluation({
      candidateName,
      githubDigest,
      criteria,
      jobTitle,
      jobDescription,
      coverLetterText,
      criteriaVersion,
    })

    await supabase.from("candidate_sources").upsert(
      {
        candidate_id: candidateId,
        job_id: jobId,
        user_id: user.id,
        source_type: githubDigest.sourceType,
        source_url: githubDigest.normalizedUrl,
        repo_snapshot_json: githubDigest,
        detected_stack: githubDigest.detectedStack,
        activity_summary: githubDigest.activitySummary,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "candidate_id" }
    )

    await supabase.from("candidate_reports").upsert(
      {
        candidate_id: candidateId,
        job_id: jobId,
        user_id: user.id,
        criteria_version: criteriaVersion,
        overall_score: report.overallScore,
        summary: report.summary,
        strengths: report.strengths,
        gaps: report.gaps,
        recommendations: report.recommendations,
        criteria_breakdown: report.criteriaBreakdown,
        analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "candidate_id" }
    )

    await supabase
      .from("candidates")
      .update({
        status: "ready",
        overall_score: report.overallScore,
        analysis_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", candidateId)
      .eq("user_id", user.id)

    return report
  } catch (error) {
    const message =
      formatErrorMessage(error, "Не удалось проанализировать кандидата.")

    await supabase
      .from("candidates")
      .update({
        status: "failed",
        overall_score: null,
        analysis_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", candidateId)
      .eq("user_id", user.id)

    throw error
  }
}

function isStructuredOutputError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("LLM вернул невалидный structured output")
}

export async function previewJobCriteriaAction(input: {
  title: string
  description: string
}): Promise<ActionResult<{ requirements: string[]; criteria: CriterionInput[] }>> {
  if (!input.title.trim() || !input.description.trim()) {
    return {
      ok: false,
      message: "Введите название вакансии и полный текст описания.",
    }
  }

  try {
    const analysis = await previewVacancyAnalysis({
      title: input.title.trim(),
      description: input.description.trim(),
    })

    return {
      ok: true,
      data: {
        requirements: analysis.requirements,
        criteria: normalizeCriteria(analysis.criteria),
      },
    }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось проанализировать текст вакансии.",
    }
  }
}

export async function createJobAction(input: {
  title: string
  description: string
  criteria: CriterionInput[]
}): Promise<ActionResult<{ jobId: string }>> {
  try {
    const { supabase, user } = await requireUser()
    const title = input.title.trim()
    const description = input.description.trim()
    const criteria = normalizeCriteria(input.criteria)

    if (!title || !description || !criteria.length) {
      return {
        ok: false,
        message: "Для сохранения вакансии нужны заголовок, текст и хотя бы один критерий.",
      }
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        user_id: user.id,
        title,
        description,
        status: "ready",
        criteria_version: 1,
        analysis_error: null,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (jobError || !job) {
      throw new Error(formatErrorMessage(jobError, "Не удалось сохранить вакансию."))
    }

    const insertCriteria = criteria.map((criterion, index) => ({
      user_id: user.id,
      job_id: job.id,
      title: criterion.title,
      description: criterion.description,
      weight: criterion.weight,
      kind: criterion.kind,
      evidence_rules: criterion.evidenceRules,
      position: index,
      updated_at: new Date().toISOString(),
    }))

    const { error: criteriaError } = await supabase
      .from("job_criteria")
      .insert(insertCriteria)

    if (criteriaError) {
      throw new Error(
        formatErrorMessage(criteriaError, "Не удалось сохранить критерии вакансии.")
      )
    }

    revalidatePath("/dashboard")
    return { ok: true, data: { jobId: String(job.id) } }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось создать вакансию.",
    }
  }
}

export async function updateJobDetailsAction(input: {
  jobId: string
  title: string
  description: string
}): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser()
    const title = input.title.trim()
    const description = input.description.trim()

    if (!input.jobId || !title || !description) {
      return {
        ok: false,
        message: "Для сохранения вакансии нужны название и полный текст.",
      }
    }

    const { error } = await supabase
      .from("jobs")
      .update({
        title,
        description,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.jobId)
      .eq("user_id", user.id)

    if (error) {
      throw new Error(
        formatErrorMessage(error, "Не удалось сохранить изменения вакансии.")
      )
    }

    revalidatePath("/dashboard")
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось сохранить изменения вакансии.",
    }
  }
}

export async function updateCriteriaAction(input: {
  jobId: string
  criteria: CriterionInput[]
}): Promise<ActionResult<{ criteriaVersion: number }>> {
  try {
    const { supabase, user } = await requireUser()
    const criteria = normalizeCriteria(input.criteria)

    if (!criteria.length) {
      return { ok: false, message: "Нужен хотя бы один критерий." }
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, criteria_version")
      .eq("id", input.jobId)
      .eq("user_id", user.id)
      .single()

    if (jobError || !job) {
      throw new Error(formatErrorMessage(jobError, "Вакансия не найдена."))
    }

    const nextVersion = Number(job.criteria_version ?? 1) + 1

    const { error: deleteError } = await supabase
      .from("job_criteria")
      .delete()
      .eq("job_id", input.jobId)
      .eq("user_id", user.id)

    if (deleteError) {
      throw new Error(
        formatErrorMessage(deleteError, "Не удалось обновить старые критерии.")
      )
    }

    const { error: insertError } = await supabase.from("job_criteria").insert(
      criteria.map((criterion, index) => ({
        user_id: user.id,
        job_id: input.jobId,
        title: criterion.title,
        description: criterion.description,
        weight: criterion.weight,
        kind: criterion.kind,
        evidence_rules: criterion.evidenceRules,
        position: index,
        updated_at: new Date().toISOString(),
      }))
    )

    if (insertError) {
      throw new Error(
        formatErrorMessage(insertError, "Не удалось сохранить новые критерии.")
      )
    }

    const { error: jobUpdateError } = await supabase
      .from("jobs")
      .update({
        criteria_version: nextVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.jobId)
      .eq("user_id", user.id)

    if (jobUpdateError) {
      throw new Error(
        formatErrorMessage(jobUpdateError, "Не удалось обновить версию критериев.")
      )
    }

    revalidatePath("/dashboard")
    return { ok: true, data: { criteriaVersion: nextVersion } }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось сохранить изменения критериев.",
    }
  }
}

export async function createCandidateAction(
  formData: FormData
): Promise<ActionResult<{ jobId: string; candidateId: string }>> {
  let candidateId = ""

  try {
    const { supabase, user } = await requireUser()
    const jobId = String(formData.get("jobId") ?? "").trim()
    const name = String(formData.get("name") ?? "").trim()
    const githubUrl = String(formData.get("githubUrl") ?? "").trim()
    const portfolioUrl = String(formData.get("portfolioUrl") ?? "").trim()
    const coverLetterText = String(formData.get("coverLetterText") ?? "").trim()
    const coverLetterFile = formData.get("coverLetterFile")

    if (!jobId || !name || !githubUrl) {
      return {
        ok: false,
        message: "Для кандидата обязательны имя, вакансия и GitHub-ссылка.",
      }
    }

    const { job, criteria } = await getJobContext(jobId, user.id)

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .insert({
        user_id: user.id,
        job_id: jobId,
        name,
        github_url: githubUrl,
        portfolio_url: portfolioUrl || null,
        cover_letter_text: coverLetterText || null,
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (candidateError || !candidate) {
      throw new Error(formatErrorMessage(candidateError, "Не удалось создать кандидата."))
    }

    candidateId = String(candidate.id)

    if (coverLetterFile instanceof File && coverLetterFile.size > 0) {
      if (!hasSupabaseAdminConfig()) {
        throw new Error(
          "Для загрузки файла нужен SUPABASE_SERVICE_ROLE_KEY."
        )
      }

      const safeName = coverLetterFile.name.replace(/\s+/g, "-").toLowerCase()
      const storagePath = `${user.id}/${candidateId}/${safeName}`
      const adminClient = createSupabaseAdminClient()
      const { error: uploadError } = await adminClient.storage
        .from("candidate-files")
        .upload(storagePath, coverLetterFile, {
          upsert: true,
          contentType: coverLetterFile.type || undefined,
        })

      if (uploadError) {
        throw new Error(
          formatErrorMessage(
            uploadError,
            "Не удалось сохранить файл сопроводительного письма."
          )
        )
      }

      await supabase
        .from("candidates")
        .update({
          cover_letter_file_path: storagePath,
          updated_at: new Date().toISOString(),
        })
        .eq("id", candidateId)
        .eq("user_id", user.id)
    }

    await persistCandidateAnalysis({
      candidateId,
      jobId,
      candidateName: name,
      githubUrl,
      coverLetterText,
      criteriaVersion: Number(job.criteria_version ?? 1),
      criteria,
      jobTitle: String(job.title),
      jobDescription: String(job.description),
    })

    revalidatePath("/dashboard")
    return { ok: true, data: { jobId, candidateId } }
  } catch (error) {
    if (candidateId && hasSupabaseConfig()) {
      const { supabase, user } = await requireUser()
      await supabase
        .from("candidates")
        .update({
          status: "failed",
          analysis_error:
            error instanceof Error ? error.message : "Не удалось создать кандидата.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", candidateId)
        .eq("user_id", user.id)
    }

    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось создать кандидата.",
    }
  }
}

export async function chooseWinnerAction(
  jobId: string
): Promise<ActionResult<{ winnerCandidateId: string }>> {
  try {
    const { supabase, user } = await requireUser()
    const { job, criteria } = await getJobContext(jobId, user.id)
    const criteriaVersion = Number(job.criteria_version ?? 1)

    const { data: candidateRows, error: candidatesError } = await supabase
      .from("candidates")
      .select("*")
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })

    if (candidatesError) {
      throw new Error(
        formatErrorMessage(candidatesError, "Не удалось загрузить кандидатов вакансии.")
      )
    }

    if (!candidateRows?.length) {
      return {
        ok: false,
        message: "Для выбора лучшего кандидата нужен хотя бы один кандидат.",
      }
    }

    const candidateIds = candidateRows.map((candidate) => String(candidate.id))
    const { data: reportRows } = await supabase
      .from("candidate_reports")
      .select("*")
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .in("candidate_id", candidateIds)

    const reportsByCandidate = new Map(
      (reportRows ?? []).map((report) => [String(report.candidate_id), report])
    )

    for (const candidate of candidateRows) {
      const report = reportsByCandidate.get(String(candidate.id))
      const isStale =
        !report || Number(report.criteria_version ?? 0) !== criteriaVersion

      if (isStale) {
        try {
          await persistCandidateAnalysis({
            candidateId: String(candidate.id),
            jobId,
            candidateName: String(candidate.name),
            githubUrl: String(candidate.github_url),
            coverLetterText: String(candidate.cover_letter_text ?? ""),
            criteriaVersion,
            criteria,
            jobTitle: String(job.title),
            jobDescription: String(job.description),
          })
        } catch (error) {
          if (isStructuredOutputError(error)) {
            throw new Error(
              `Не удалось пересчитать кандидата "${String(candidate.name)}": LLM вернул невалидный structured output.`
            )
          }

          throw error
        }
      }
    }

    const { data: freshReportsRows, error: freshReportsError } = await supabase
      .from("candidate_reports")
      .select("*")
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .in("candidate_id", candidateIds)

    if (freshReportsError || !freshReportsRows?.length) {
      throw new Error("Не удалось подготовить отчеты кандидатов для сравнения.")
    }

    const reportsMap = new Map(
      freshReportsRows.map((report) => [String(report.candidate_id), report])
    )

    const reportsInput = candidateRows
      .map((candidate) => {
        const report = reportsMap.get(String(candidate.id))
        if (!report) {
          return null
        }

        return {
          id: String(candidate.id),
          name: String(candidate.name),
          report: {
            overallScore: Number(report.overall_score ?? 0),
            summary: String(report.summary ?? ""),
            strengths: Array.isArray(report.strengths)
              ? (report.strengths as string[])
              : [],
            gaps: Array.isArray(report.gaps) ? (report.gaps as string[]) : [],
            recommendations: Array.isArray(report.recommendations)
              ? (report.recommendations as string[])
              : [],
            criteriaBreakdown: Array.isArray(report.criteria_breakdown)
              ? (report.criteria_breakdown as CandidateEvaluationResult["criteriaBreakdown"])
              : [],
            criteriaVersion: Number(report.criteria_version ?? criteriaVersion),
          },
        }
      })
      .filter(Boolean) as Array<{
      id: string
      name: string
      report: CandidateEvaluationResult
    }>

    if (!reportsInput.length) {
      throw new Error("Нет готовых отчетов для сравнения.")
    }

    let decision

    try {
      decision = await generateDecision({
        jobTitle: String(job.title),
        criteria,
        candidates: reportsInput,
      })
    } catch (error) {
      if (isStructuredOutputError(error)) {
        throw new Error(
          "Не удалось выбрать лучшего кандидата: LLM вернул невалидный structured output на шаге финального сравнения."
        )
      }

      throw error
    }

    await supabase.from("decision_runs").insert({
      user_id: user.id,
      job_id: jobId,
      winner_candidate_id: decision.winnerCandidateId,
      status: "ready",
      summary: decision.summary,
      ranked_candidates: decision.rankedCandidates,
      created_at: new Date().toISOString(),
    })

    revalidatePath("/dashboard")
    return { ok: true, data: { winnerCandidateId: decision.winnerCandidateId } }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось выбрать лучшего кандидата.",
    }
  }
}

export async function deleteCandidateAction(input: {
  candidateId: string
}): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser()

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("id, cover_letter_file_path")
      .eq("id", input.candidateId)
      .eq("user_id", user.id)
      .single()

    if (candidateError || !candidate) {
      throw new Error(
        formatErrorMessage(candidateError, "Кандидат не найден.")
      )
    }

    if (candidate.cover_letter_file_path && hasSupabaseAdminConfig()) {
      const adminClient = createSupabaseAdminClient()
      await adminClient.storage
        .from("candidate-files")
        .remove([String(candidate.cover_letter_file_path)])
    }

    const { error } = await supabase
      .from("candidates")
      .delete()
      .eq("id", input.candidateId)
      .eq("user_id", user.id)

    if (error) {
      throw new Error(
        formatErrorMessage(error, "Не удалось удалить кандидата.")
      )
    }

    revalidatePath("/dashboard")
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось удалить кандидата.",
    }
  }
}

export async function deleteJobAction(input: {
  jobId: string
}): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser()

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", input.jobId)
      .eq("user_id", user.id)
      .single()

    if (jobError || !job) {
      throw new Error(formatErrorMessage(jobError, "Вакансия не найдена."))
    }

    if (hasSupabaseAdminConfig()) {
      const { data: candidateRows } = await supabase
        .from("candidates")
        .select("cover_letter_file_path")
        .eq("job_id", input.jobId)
        .eq("user_id", user.id)

      const storagePaths = (candidateRows ?? [])
        .map((candidate) => String(candidate.cover_letter_file_path ?? "").trim())
        .filter(Boolean)

      if (storagePaths.length) {
        const adminClient = createSupabaseAdminClient()
        await adminClient.storage.from("candidate-files").remove(storagePaths)
      }
    }

    const { error } = await supabase
      .from("jobs")
      .delete()
      .eq("id", input.jobId)
      .eq("user_id", user.id)

    if (error) {
      throw new Error(formatErrorMessage(error, "Не удалось удалить вакансию."))
    }

    revalidatePath("/dashboard")
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось удалить вакансию.",
    }
  }
}
