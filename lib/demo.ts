import type { DashboardState } from "@/lib/types"

const demoState: DashboardState = {
  mode: "demo",
  needsAuth: false,
  canMutate: false,
  isConfigured: false,
  configurationIssues: [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "LLM_BASE_URL",
    "LLM_API_KEY",
    "LLM_MODEL",
  ],
  userEmail: "demo@portfolio-fit.local",
  jobs: [
    {
      id: "job-demo-1",
      userId: "demo-user",
      title: "Frontend Product Engineer",
      description:
        "Нужен инженер, который быстро собирает продуктовые интерфейсы, умеет работать с AI-потоками и доводить идеи до внятного SaaS-результата.",
      status: "ready",
      criteriaVersion: 2,
      analysisError: null,
      createdAt: new Date("2026-03-19T08:00:00.000Z").toISOString(),
      updatedAt: new Date("2026-03-19T09:30:00.000Z").toISOString(),
      criteria: [
        {
          id: "crit-1",
          title: "Product UX",
          description: "Показывает способность собирать плотные понятные интерфейсы.",
          weight: 5,
          kind: "product",
          evidenceRules: ["UI-компоненты", "layout", "forms", "states"],
        },
        {
          id: "crit-2",
          title: "Frontend stack",
          description:
            "Есть явные сигналы по React, TypeScript и современному frontend toolchain.",
          weight: 4,
          kind: "stack",
          evidenceRules: ["react", "typescript", "next", "tailwind"],
        },
        {
          id: "crit-3",
          title: "Delivery signal",
          description:
            "Репозиторий выглядит как доведенный продукт, а не как черновой эксперимент.",
          weight: 4,
          kind: "quality",
          evidenceRules: ["readme", "deploy", "ci", "env"],
        },
      ],
      candidates: [
        {
          id: "cand-demo-1",
          jobId: "job-demo-1",
          name: "bamalt / ai-portfolio-fit-analyzer",
          githubUrl: "https://github.com/bamalt/ai-portfolio-fit-analyzer",
          portfolioUrl: "https://github.com/bamalt",
          coverLetterText:
            "Делаю продуктовые MVP быстро, с упором на ясность интерфейса и продуманную структуру.",
          coverLetterFilePath: null,
          status: "ready",
          overallScore: 86,
          analysisError: null,
          createdAt: new Date("2026-03-19T09:31:00.000Z").toISOString(),
          source: {
            id: "source-demo-1",
            candidateId: "cand-demo-1",
            sourceType: "repo",
            sourceUrl: "https://github.com/bamalt/ai-portfolio-fit-analyzer",
            repoSnapshotJson: {
              sourceType: "repo",
              normalizedUrl: "https://github.com/bamalt/ai-portfolio-fit-analyzer",
              detectedStack: ["Next.js", "React", "TypeScript", "Supabase"],
              activitySummary: "Репозиторий обновлялся недавно и выглядит как активный MVP.",
              summary:
                "Есть явный сигнал по Next.js, React, shadcn/ui и продуктовой упаковке.",
              repos: [],
              notes: [
                "README и docs оформлены как продуктовый репозиторий.",
                "Есть акцент на UI, flows и AI integration.",
              ],
            },
            detectedStack: ["Next.js", "React", "TypeScript", "Supabase"],
            activitySummary: "Репозиторий активный, структура аккуратная.",
          },
          report: {
            id: "report-demo-1",
            candidateId: "cand-demo-1",
            jobId: "job-demo-1",
            overallScore: 86,
            summary:
              "Сильный signal по продуктовой упаковке и современному frontend стеку.",
            strengths: [
              "Интерфейс и flows сформулированы как продукт, а не как набор экранов.",
              "Стек явно считывается из репозитория.",
            ],
            gaps: [
              "Нужно больше доказательств реального продакшен-цикла и эксплуатации.",
            ],
            recommendations: [
              "Показать деплой и пройти happy path сквозным демо.",
              "Добавить один тестовый сценарий, который подтверждает надежность.",
            ],
            criteriaBreakdown: [
              {
                criterionId: "crit-1",
                criterionTitle: "Product UX",
                score: 5,
                evidence: ["Плотный layout", "явные empty/loading states"],
                reasoning: "Репозиторий показывает продуктовый подход к интерфейсу.",
                confidence: "high",
              },
              {
                criterionId: "crit-2",
                criterionTitle: "Frontend stack",
                score: 5,
                evidence: ["Next.js", "React", "TypeScript", "shadcn/ui"],
                reasoning: "Ключевой стек присутствует явно и последовательно.",
                confidence: "high",
              },
              {
                criterionId: "crit-3",
                criterionTitle: "Delivery signal",
                score: 3,
                evidence: ["Документация", "архитектурный план"],
                reasoning:
                  "Сигнал хороший, но нужно подкрепить его рабочим деплоем и тестом.",
                confidence: "medium",
              },
            ],
            criteriaVersion: 2,
            analyzedAt: new Date("2026-03-19T09:32:00.000Z").toISOString(),
          },
        },
      ],
      latestDecision: {
        id: "decision-demo-1",
        jobId: "job-demo-1",
        winnerCandidateId: "cand-demo-1",
        status: "ready",
        summary:
          "Кандидат выбран как лучший за счет сильного frontend/product signal и ясного MVP execution.",
        rankedCandidates: [
          {
            candidateId: "cand-demo-1",
            score: 86,
            rationale: "Лучший баланс UX, стека и продуктовой упаковки.",
          },
        ],
        error: null,
        createdAt: new Date("2026-03-19T09:33:00.000Z").toISOString(),
      },
    },
  ],
  selectedJob: null,
  selectedCandidate: null,
}

export function getDemoDashboardState(): DashboardState {
  const selectedJob = demoState.jobs[0] ?? null
  const selectedCandidate = selectedJob?.candidates[0] ?? null

  return {
    ...demoState,
    selectedJob,
    selectedCandidate,
  }
}
