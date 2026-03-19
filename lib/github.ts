import { Buffer } from "node:buffer"

import { getGithubToken } from "@/lib/env"
import type { GithubDigest, GithubRepoSummary } from "@/lib/types"

type GithubRepoRef =
  | { type: "repo"; owner: string; repo: string; normalizedUrl: string }
  | { type: "profile"; username: string; normalizedUrl: string }

type GithubRepositoryResponse = {
  name: string
  full_name: string
  description: string | null
  html_url: string
  topics?: string[]
  default_branch: string | null
  updated_at: string | null
  fork?: boolean
  languages_url: string
}

type GithubContentItem = {
  name: string
  type: "file" | "dir"
}

type GithubCommit = {
  commit: {
    message: string
  }
}

function parseGithubUrl(input: string): GithubRepoRef {
  let url: URL

  try {
    url = new URL(input)
  } catch {
    throw new Error("Укажите валидную GitHub-ссылку.")
  }

  if (!["github.com", "www.github.com"].includes(url.hostname)) {
    throw new Error("Поддерживаются только ссылки с github.com.")
  }

  const parts = url.pathname.split("/").filter(Boolean)

  if (parts.length === 1) {
    return {
      type: "profile",
      username: parts[0],
      normalizedUrl: `https://github.com/${parts[0]}`,
    }
  }

  if (parts.length >= 2) {
    return {
      type: "repo",
      owner: parts[0],
      repo: parts[1].replace(/\.git$/, ""),
      normalizedUrl: `https://github.com/${parts[0]}/${parts[1].replace(/\.git$/, "")}`,
    }
  }

  throw new Error("Не удалось определить профиль или репозиторий по GitHub-ссылке.")
}

async function fetchGithub<T>(input: string) {
  const token = getGithubToken()
  const url = input.startsWith("http") ? input : `https://api.github.com${input}`

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "ai-portfolio-fit-analyzer",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  })

  if (response.status === 404) {
    throw new Error("GitHub-источник не найден или репозиторий приватный.")
  }

  if (!response.ok) {
    throw new Error(`GitHub API вернул ошибку ${response.status}.`)
  }

  return (await response.json()) as T
}

function decodeReadme(content?: string) {
  if (!content) {
    return ""
  }

  return Buffer.from(content.replace(/\n/g, ""), "base64")
    .toString("utf-8")
    .slice(0, 4000)
}

function detectStack({
  languages,
  topics,
  rootFiles,
  readme,
}: {
  languages: string[]
  topics: string[]
  rootFiles: string[]
  readme: string
}) {
  const haystack = `${languages.join(" ")} ${topics.join(" ")} ${rootFiles.join(" ")} ${readme}`.toLowerCase()
  const stack = new Set<string>()

  if (haystack.includes("next")) stack.add("Next.js")
  if (haystack.includes("react")) stack.add("React")
  if (haystack.includes("typescript") || haystack.includes("tsconfig")) stack.add("TypeScript")
  if (haystack.includes("tailwind")) stack.add("Tailwind CSS")
  if (haystack.includes("supabase")) stack.add("Supabase")
  if (haystack.includes("docker")) stack.add("Docker")
  if (haystack.includes("postgres")) stack.add("PostgreSQL")
  if (haystack.includes("python")) stack.add("Python")
  if (haystack.includes("fastapi")) stack.add("FastAPI")
  if (haystack.includes("node")) stack.add("Node.js")

  return [...stack]
}

async function fetchRepoSummary(owner: string, repo: string) {
  const repoMeta = await fetchGithub<GithubRepositoryResponse>(
    `/repos/${owner}/${repo}`
  )
  const languagesMap = await fetchGithub<Record<string, number>>(
    repoMeta.languages_url
  )

  let rootContents: GithubContentItem[] = []
  try {
    rootContents = await fetchGithub<GithubContentItem[]>(
      `/repos/${owner}/${repo}/contents`
    )
  } catch {
    rootContents = []
  }

  let readmeExcerpt = ""
  try {
    const readme = await fetchGithub<{ content?: string }>(
      `/repos/${owner}/${repo}/readme`
    )
    readmeExcerpt = decodeReadme(readme.content)
  } catch {
    readmeExcerpt = ""
  }

  return {
    name: repoMeta.name,
    fullName: repoMeta.full_name,
    description: repoMeta.description ?? "",
    url: repoMeta.html_url,
    languages: Object.keys(languagesMap),
    topics: repoMeta.topics ?? [],
    updatedAt: repoMeta.updated_at,
    rootFiles: rootContents.filter((item) => item.type === "file").map((item) => item.name),
    readmeExcerpt,
    defaultBranch: repoMeta.default_branch,
  } satisfies GithubRepoSummary
}

async function fetchRecentCommits(owner: string, repo: string) {
  try {
    const commits = await fetchGithub<GithubCommit[]>(
      `/repos/${owner}/${repo}/commits?per_page=5`
    )
    return commits.map((commit) => commit.commit.message).filter(Boolean)
  } catch {
    return []
  }
}

function summarizeRepos(repos: GithubRepoSummary[], commitsByRepo: Record<string, string[]>) {
  const detectedStack = new Set<string>()
  const notes = new Set<string>()

  repos.forEach((repo) => {
    detectStack({
      languages: repo.languages,
      topics: repo.topics,
      rootFiles: repo.rootFiles,
      readme: repo.readmeExcerpt,
    }).forEach((item) => detectedStack.add(item))

    if (repo.description) {
      notes.add(`Описание ${repo.name}: ${repo.description}`)
    }
    if (repo.readmeExcerpt) {
      notes.add(`README ${repo.name}: ${repo.readmeExcerpt.slice(0, 220)}`)
    }
    if (repo.rootFiles.length) {
      notes.add(`Файлы ${repo.name}: ${repo.rootFiles.slice(0, 8).join(", ")}`)
    }
    const commits = commitsByRepo[repo.fullName]
    if (commits?.length) {
      notes.add(`Последние коммиты ${repo.name}: ${commits.join(" | ")}`)
    }
  })

  return {
    detectedStack: [...detectedStack],
    notes: [...notes],
  }
}

export async function collectGithubDigest(input: string): Promise<GithubDigest> {
  const normalized = parseGithubUrl(input)

  if (normalized.type === "repo") {
    const repo = await fetchRepoSummary(normalized.owner, normalized.repo)
    const commits = await fetchRecentCommits(normalized.owner, normalized.repo)
    const summary = summarizeRepos([repo], { [repo.fullName]: commits })

    return {
      sourceType: "repo",
      normalizedUrl: normalized.normalizedUrl,
      detectedStack: summary.detectedStack,
      activitySummary: commits.length
        ? "Репозиторий выглядит активным: есть недавние коммиты."
        : "Недавняя активность по коммитам не обнаружена.",
      summary:
        repo.description ||
        repo.readmeExcerpt.slice(0, 280) ||
        "Публичный GitHub-репозиторий без явного описания.",
      repos: [repo],
      notes: summary.notes,
    }
  }

  const reposResponse = await fetchGithub<GithubRepositoryResponse[]>(
    `/users/${normalized.username}/repos?sort=updated&per_page=6`
  )
  const repos = reposResponse.filter((repo) => !repo.fork).slice(0, 3)

  if (!repos.length) {
    throw new Error("У GitHub-профиля не найдено подходящих публичных репозиториев.")
  }

  const repoSummaries = await Promise.all(
    repos.map((repo) => fetchRepoSummary(normalized.username, repo.name))
  )
  const commitsEntries = await Promise.all(
    repoSummaries.map(async (repo) => [
      repo.fullName,
      await fetchRecentCommits(normalized.username, repo.name),
    ])
  )
  const commitsByRepo = Object.fromEntries(commitsEntries)
  const summary = summarizeRepos(repoSummaries, commitsByRepo)

  return {
    sourceType: "profile",
    normalizedUrl: normalized.normalizedUrl,
    detectedStack: summary.detectedStack,
    activitySummary: `Для профиля взяты ${repoSummaries.length} самых свежих non-fork репозиториев.`,
    summary:
      repoSummaries.map((repo) => repo.description).filter(Boolean).join(" ") ||
      `Профиль ${normalized.username} с набором активных публичных репозиториев.`,
    repos: repoSummaries,
    notes: summary.notes,
  }
}
