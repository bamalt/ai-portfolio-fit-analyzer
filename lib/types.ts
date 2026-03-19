export type CriterionKind =
  | "stack"
  | "architecture"
  | "product"
  | "quality"
  | "domain"
  | "communication"

export type Confidence = "low" | "medium" | "high"

export interface CriterionInput {
  id?: string
  title: string
  description: string
  weight: number
  kind: CriterionKind
  evidenceRules: string[]
}

export interface VacancyAnalysisResult {
  requirements: string[]
  criteria: CriterionInput[]
}

export interface CriteriaBreakdownItem {
  criterionId?: string
  criterionTitle: string
  score: number
  evidence: string[]
  reasoning: string
  confidence: Confidence
}

export interface CandidateEvaluationResult {
  overallScore: number
  summary: string
  strengths: string[]
  gaps: string[]
  recommendations: string[]
  criteriaBreakdown: CriteriaBreakdownItem[]
  criteriaVersion: number
}

export interface DecisionRankingItem {
  candidateId: string
  score: number
  rationale: string
}

export interface DecisionResult {
  winnerCandidateId: string
  summary: string
  rankedCandidates: DecisionRankingItem[]
}

export interface GithubRepoSummary {
  name: string
  fullName: string
  description: string
  url: string
  languages: string[]
  topics: string[]
  updatedAt: string | null
  rootFiles: string[]
  readmeExcerpt: string
  defaultBranch: string | null
}

export interface GithubDigest {
  sourceType: "repo" | "profile"
  normalizedUrl: string
  detectedStack: string[]
  activitySummary: string
  summary: string
  repos: GithubRepoSummary[]
  notes: string[]
}

export interface CandidateSourceRecord {
  id: string
  candidateId: string
  sourceType: "repo" | "profile"
  sourceUrl: string
  repoSnapshotJson: GithubDigest
  detectedStack: string[]
  activitySummary: string
}

export interface CandidateReportRecord extends CandidateEvaluationResult {
  id: string
  candidateId: string
  jobId: string
  analyzedAt: string | null
}

export interface DashboardCandidate {
  id: string
  jobId: string
  name: string
  githubUrl: string
  portfolioUrl: string | null
  coverLetterText: string | null
  coverLetterFilePath: string | null
  status: "pending" | "analyzing" | "ready" | "failed"
  overallScore: number | null
  analysisError: string | null
  createdAt: string
  source: CandidateSourceRecord | null
  report: CandidateReportRecord | null
}

export interface DecisionRunRecord {
  id: string
  jobId: string
  winnerCandidateId: string | null
  status: "ready" | "failed"
  summary: string
  rankedCandidates: DecisionRankingItem[]
  error: string | null
  createdAt: string
}

export interface DashboardJob {
  id: string
  userId: string
  title: string
  description: string
  status: "ready" | "failed"
  criteriaVersion: number
  analysisError: string | null
  createdAt: string
  updatedAt: string
  criteria: CriterionInput[]
  candidates: DashboardCandidate[]
  latestDecision: DecisionRunRecord | null
}

export interface DashboardState {
  mode: "live" | "demo"
  needsAuth: boolean
  canMutate: boolean
  isConfigured: boolean
  configurationIssues: string[]
  jobs: DashboardJob[]
  selectedJob: DashboardJob | null
  selectedCandidate: DashboardCandidate | null
  userEmail: string | null
}

export interface ActionResult<T = void> {
  ok: boolean
  message?: string
  data?: T
}

export interface AuthFormState {
  message?: string
}
