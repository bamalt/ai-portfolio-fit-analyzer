import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"
import { z } from "zod"

import { getLlmConfig } from "@/lib/env"
import type {
  CandidateEvaluationResult,
  CriterionInput,
  DecisionResult,
  GithubDigest,
  VacancyAnalysisResult,
} from "@/lib/types"

const criterionKindSchema = z.enum([
  "stack",
  "architecture",
  "product",
  "quality",
  "domain",
  "communication",
])

function hasAtMostThreeWords(value: string) {
  return value
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean).length <= 3
}

function hasNoLineBreaks(value: string) {
  return !/[\r\n]/.test(value)
}

const criterionSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .refine(hasNoLineBreaks, "Criterion title must stay on one line.")
      .refine(hasAtMostThreeWords, "Criterion title must contain at most 3 words.")
      .refine((value) => !/[0-9]/.test(value), "Criterion title must not contain numbering.")
      .refine((value) => !value.endsWith(":"), "Criterion title must not end with a colon."),
    description: z
      .string()
      .trim()
      .min(12)
      .max(220)
      .refine(hasNoLineBreaks, "Criterion description must stay on one line."),
    weight: z.number().min(1).max(5),
    kind: criterionKindSchema,
    evidenceRules: z
      .array(
        z
          .string()
          .trim()
          .min(2)
          .max(80)
          .refine(hasNoLineBreaks, "Evidence rule must stay on one line.")
      )
      .min(1)
      .max(4),
  })
  .strict()

const vacancySchema = z
  .object({
    requirements: z
      .array(
        z
          .string()
          .trim()
          .min(8)
          .max(180)
          .refine(hasNoLineBreaks, "Requirement must stay on one line.")
          .refine((value) => !value.endsWith(":"), "Requirement must not be a section label.")
      )
      .min(1)
      .max(10),
    criteria: z.array(criterionSchema).min(3).max(8),
  })
  .strict()
  .superRefine((value, ctx) => {
    const normalizedTitles = new Set<string>()

    value.criteria.forEach((criterion, index) => {
      const key = criterion.title.toLowerCase()

      if (normalizedTitles.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["criteria", index, "title"],
          message: "Criterion titles must be unique.",
        })
        return
      }

      normalizedTitles.add(key)
    })
  })

const candidateSchema = z
  .object({
    overallScore: z.number().min(0).max(100),
    summary: z.string().trim().min(12).max(400),
    strengths: z.array(z.string().trim().min(4).max(220)).min(1).max(6),
    gaps: z.array(z.string().trim().min(4).max(220)).min(1).max(6),
    recommendations: z.array(z.string().trim().min(4).max(220)).min(1).max(6),
    criteriaBreakdown: z.array(
      z
        .object({
          criterionTitle: z.string().trim().min(2).max(40),
          score: z.number().min(0).max(5),
          evidence: z.array(z.string().trim().min(1).max(120)).min(1).max(5),
          reasoning: z.string().trim().min(8).max(280),
          confidence: z.enum(["low", "medium", "high"]),
        })
        .strict()
    ),
    criteriaVersion: z.number().min(1),
  })
  .strict()

const decisionSchema = z
  .object({
    winnerCandidateId: z.string().trim().min(1),
    summary: z.string().trim().min(12).max(400),
    rankedCandidates: z
      .array(
        z
          .object({
            candidateId: z.string().trim().min(1),
            score: z.number().min(0).max(100),
            rationale: z.string().trim().min(4).max(280),
          })
          .strict()
      )
      .min(1),
  })
  .strict()

function createLlmClient() {
  const { apiKey, baseURL } = getLlmConfig()

  return new OpenAI({
    apiKey,
    baseURL,
  })
}

function buildResponsesInput(system: string, prompt: string) {
  return [
    {
      type: "message" as const,
      role: "system" as const,
      content: [{ type: "input_text" as const, text: system }],
    },
    {
      type: "message" as const,
      role: "user" as const,
      content: [{ type: "input_text" as const, text: prompt }],
    },
  ]
}

function formatLlmError(error: unknown) {
  if (error instanceof z.ZodError) {
    return "LLM вернул невалидный structured output. Повторите анализ."
  }

  if (error instanceof Error && error.message.trim()) {
    try {
      const parsed = JSON.parse(error.message)

      if (Array.isArray(parsed)) {
        return "LLM вернул невалидный structured output. Повторите анализ."
      }
    } catch {
      // ignore non-JSON error messages
    }

    return error.message
  }

  return "LLM request failed."
}

async function callStructuredModel<T>({
  schemaName,
  system,
  prompt,
  schema,
}: {
  schemaName: string
  system: string
  prompt: string
  schema: z.ZodType<T>
}): Promise<T> {
  const client = createLlmClient()
  const { model } = getLlmConfig()

  try {
    const response = await client.responses.parse({
      model,
      temperature: 0,
      max_output_tokens: 4096,
      input: buildResponsesInput(system, prompt),
      text: {
        format: zodTextFormat(schema, schemaName),
      },
    })

    if (!response.output_parsed) {
      throw new Error("LLM returned an empty structured response.")
    }

    return response.output_parsed
  } catch (error) {
    throw new Error(formatLlmError(error))
  }
}

function validateCandidateEvaluation(
  result: CandidateEvaluationResult,
  expectedCriteria: CriterionInput[],
  expectedCriteriaVersion: number
) {
  if (result.criteriaVersion !== expectedCriteriaVersion) {
    throw new Error("LLM returned an invalid criteriaVersion.")
  }

  const expectedTitles = new Set(
    expectedCriteria.map((criterion) => criterion.title.trim().toLowerCase())
  )
  const actualTitles = new Set(
    result.criteriaBreakdown.map((item) => item.criterionTitle.trim().toLowerCase())
  )

  if (actualTitles.size !== expectedTitles.size) {
    throw new Error("LLM returned incomplete criteriaBreakdown.")
  }

  for (const title of expectedTitles) {
    if (!actualTitles.has(title)) {
      throw new Error("LLM returned criteriaBreakdown that does not match vacancy criteria.")
    }
  }

  return result
}

function validateDecisionResult(
  result: DecisionResult,
  candidateIds: string[]
) {
  const validIds = new Set(candidateIds)
  const rankedIds = result.rankedCandidates.map((candidate) => candidate.candidateId)
  const uniqueRankedIds = new Set(rankedIds)

  if (!validIds.has(result.winnerCandidateId)) {
    throw new Error("LLM returned winnerCandidateId that is not present in the candidate list.")
  }

  if (rankedIds.length !== candidateIds.length || uniqueRankedIds.size !== candidateIds.length) {
    throw new Error("LLM returned an invalid ranked candidate list.")
  }

  for (const candidateId of rankedIds) {
    if (!validIds.has(candidateId)) {
      throw new Error("LLM returned rankedCandidates with unknown candidate IDs.")
    }
  }

  return result
}

export async function previewVacancyAnalysis(input: {
  title: string
  description: string
}): Promise<VacancyAnalysisResult> {
  return await callStructuredModel({
    schemaName: "vacancy_analysis",
    system:
      "Ты анализируешь текст вакансии и формируешь только структурированный результат для оценки кандидатов. Возвращай строго по схеме. Не используй заголовки разделов как требования. Не копируй целые абзацы. Названия критериев должны быть простыми, однозначными и короткими: максимум 2-3 слова.",
    prompt: `Проанализируй вакансию и верни JSON с двумя полями: requirements и criteria.

Правила:
- requirements: краткие, конкретные требования или ожидания из вакансии;
- criteria: критерии оценки кандидата, выведенные по смыслу текста вакансии;
- title у каждого criteria: максимум 2-3 слова;
- title должен быть уникальным и понятным без номера, без двоеточия и без длинной цитаты из вакансии;
- description: коротко объясни, что именно оценивается;
- evidenceRules: 1-4 коротких сигнала, каждый до 5 слов;
- не добавляй критерии, которых нет в тексте вакансии;
- не возвращай заголовки секций, маркеры списков и служебные фразы.

Заголовок вакансии:
${input.title}

Текст вакансии:
${input.description}`,
    schema: vacancySchema,
  })
}

export async function generateCandidateEvaluation(input: {
  candidateName: string
  githubDigest: GithubDigest
  criteria: CriterionInput[]
  jobTitle: string
  jobDescription: string
  coverLetterText: string
  criteriaVersion: number
}): Promise<CandidateEvaluationResult> {
  const result = await callStructuredModel({
    schemaName: "candidate_evaluation",
    system:
      "Ты оцениваешь кандидата относительно конкретной вакансии. Возвращай строго структурированный отчет по схеме. Оценивай только по переданным критериям и evidence из digest/письма.",
    prompt: `Верни отчет по кандидату.

Правила:
- overallScore: итог 0..100;
- criteriaBreakdown: один элемент на каждый переданный критерий, без пропусков и без лишних критериев;
- criterionTitle в criteriaBreakdown должен точно совпадать с title входного критерия;
- score: 0..5;
- evidence: короткие, конкретные подтверждения;
- reasoning: краткое объяснение оценки;
- strengths, gaps, recommendations: практичные и без воды;
- criteriaVersion должен быть равен ${input.criteriaVersion}.

Вакансия:
${input.jobTitle}

Описание вакансии:
${input.jobDescription}

Критерии:
${JSON.stringify(input.criteria)}

Кандидат:
${input.candidateName}

GitHub digest:
${JSON.stringify(input.githubDigest)}

Сопроводительное письмо:
${input.coverLetterText || "Нет письма"}`,
    schema: candidateSchema,
  })

  return validateCandidateEvaluation(result, input.criteria, input.criteriaVersion)
}

export async function generateDecision(input: {
  jobTitle: string
  criteria: CriterionInput[]
  candidates: Array<{
    id: string
    name: string
    report: CandidateEvaluationResult
  }>
}): Promise<DecisionResult> {
  const result = await callStructuredModel({
    schemaName: "decision_result",
    system:
      "Ты выбираешь лучшего кандидата по готовым отчетам. Возвращай строго структурированный результат. Не придумывай кандидатов, не меняй их id и ранжируй только тех, кто передан во входе.",
    prompt: `Верни итог сравнения кандидатов.

Правила:
- winnerCandidateId должен быть одним из переданных candidate id;
- rankedCandidates должен содержать всех кандидатов ровно по одному разу;
- summary должен кратко объяснять решение в одном абзаце;
- rationale в rankedCandidates должно быть коротким: 1 короткое предложение;
- не меняй candidateId;
- score бери из готовых отчетов, не придумывай новую шкалу.

Вакансия:
${input.jobTitle}

Критерии:
${JSON.stringify(input.criteria)}

Кандидаты и их отчеты:
${JSON.stringify(input.candidates)}`,
    schema: decisionSchema,
  })

  return validateDecisionResult(
    result,
    input.candidates.map((candidate) => candidate.id)
  )
}
