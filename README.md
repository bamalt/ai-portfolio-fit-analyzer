# AI Portfolio Fit Analyzer

Плотный SaaS MVP на `Next.js + React + shadcn/ui + Supabase`, который оценивает, насколько GitHub-портфолио кандидата подходит под конкретную вакансию.

Основной продуктовый flow:

- создать вакансию;
- получить AI-критерии;
- отредактировать их inline;
- добавить кандидата с GitHub-ссылкой;
- получить отчет;
- выбрать лучшего кандидата.

## Стек

- `Next.js App Router`
- `React`
- `TypeScript`
- `shadcn/ui`
- `Supabase Auth + Postgres + Storage`
- `OpenAI API compatible` LLM provider
- `Vercel`

## Быстрый старт

1. Установите зависимости:

```bash
npm install
```

2. Создайте `.env.local` по шаблону:

```bash
cp .env.example .env.local
```

3. Заполните переменные:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`
- `GITHUB_TOKEN` опционально, но полезно для лимитов GitHub API

4. Примените SQL-схему из [supabase/migrations/001_initial_schema.sql](./supabase/migrations/001_initial_schema.sql) в вашем проекте Supabase Cloud.

5. Запустите проект:

```bash
npm run dev
```

6. Откройте `http://localhost:3000`.

## Особенности реализации

- UI собран на `login-01` и `sidebar-02` из `shadcn`.
- Стиль и плотность интерфейса зафиксированы в [AGENTS.md](./AGENTS.md).
- Scoring engine оценивает кандидатов по критериям конкретной вакансии, а не по заранее зашитому стеку.
- AI-провайдер сделан `OpenAI API compatible` и меняется через конфиг.
- Если `.env.local` не заполнен, приложение открывается в demo-режиме с read-only данными.

## Полезные документы

- [docs/PRD-ai-portfolio-fit-analyzer.md](./docs/PRD-ai-portfolio-fit-analyzer.md)
- [docs/RUNBOOK.md](./docs/RUNBOOK.md)
- [AGENTS.md](./AGENTS.md)
