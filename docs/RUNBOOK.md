# Runbook

## Назначение

Этот runbook нужен для быстрого запуска, проверки и деплоя `AI Portfolio Fit Analyzer`.

Он покрывает:

- локальный запуск;
- подключение `Supabase`;
- подключение `OpenAI API compatible` провайдера;
- smoke-check основного сценария;
- деплой на `Vercel`;
- типовые проблемы и способы диагностики.

## 1. Что должно быть готово

Перед стартом у вас должны быть:

- `Node.js 25+`
- `npm 11+`
- проект `Supabase Cloud`
- любой `OpenAI API compatible` провайдер
- опционально `GITHUB_TOKEN` для более стабильных лимитов GitHub API

## 2. Быстрый локальный запуск

### Шаг 1. Установка зависимостей

```bash
npm install
```

### Шаг 2. Создание env

```bash
cp .env.example .env.local
```

### Шаг 3. Заполнение `.env.local`

Минимальный набор:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=
```

Опционально:

```bash
GITHUB_TOKEN=
```

### Шаг 4. Применение схемы в Supabase

Откройте SQL Editor в Supabase и выполните содержимое файла:

[supabase/migrations/001_initial_schema.sql](../supabase/migrations/001_initial_schema.sql)

Это создаст:

- таблицы `jobs`, `job_criteria`, `candidates`, `candidate_sources`, `candidate_reports`, `decision_runs`
- RLS policy
- bucket `candidate-files`

### Шаг 5. Запуск приложения

```bash
npm run dev
```

Откройте:

```text
http://localhost:3000
```

## 3. Режимы работы

### Demo mode

Если env не заполнен, приложение поднимется в demo-режиме.

Что это значит:

- интерфейс работает;
- есть демо-данные;
- создание вакансий и кандидатов отключено;
- можно проверить UX и общую структуру продукта.

### Live mode

Если `Supabase` и `LLM` настроены, приложение работает в live-режиме.

Что включается:

- регистрация и вход;
- сохранение вакансий;
- сохранение кандидатов;
- GitHub analysis;
- AI analysis;
- выбор лучшего кандидата.

## 4. Настройка Supabase

### Auth

Нужен только `email + password`.

Рекомендуемые настройки:

- включить Email provider
- отключить OAuth-провайдеры, если они не нужны
- при желании отключить обязательное email-confirmation для локального MVP, чтобы входить сразу после регистрации

### Storage

Bucket:

- `candidate-files`

Назначение:

- хранение вложений сопроводительных писем

### Database

Все таблицы уже заложены в SQL migration.

Модель рассчитана на:

- один workspace на пользователя;
- vacancy-driven evaluation;
- один актуальный report на кандидата;
- историю decision runs.

## 5. Настройка LLM

Провайдер должен быть `OpenAI API compatible`.

Обязательные параметры:

- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`

Как используется LLM:

- анализ текста вакансии;
- генерация candidate report;
- финальный decision flow для выбора лучшего кандидата.

Поведение при проблемах с LLM:

- если LLM не настроен, приложение не сможет выполнять live analysis;
- demo-режим остается доступным;
- если provider возвращает невалидный structured output, live flow завершится ошибкой без эвристических fallback-веток.

## 6. GitHub analysis

Поддерживаются ссылки вида:

- `https://github.com/user/repo`
- `https://github.com/user`

Что делает сервис:

- не клонирует репозиторий;
- не запускает код;
- собирает публичный digest через GitHub API;
- для профиля берет ограниченный набор свежих non-fork репозиториев.

Если есть `GITHUB_TOKEN`, стабильность выше.

Без него возможны:

- rate limit;
- ошибки на публичном API;
- более хрупкое поведение при серии запусков.

## 7. Smoke-check после запуска

После настройки live-режима пройдите этот сценарий:

1. Откройте `/register`
2. Создайте аккаунт
3. Войдите в приложение
4. Создайте вакансию
5. Дождитесь AI-анализа критериев
6. Сохраните вакансию
7. Добавьте кандидата с GitHub-ссылкой
8. Дождитесь candidate report
9. Нажмите `Выбрать лучшего`
10. Убедитесь, что decision result сохранился и отображается в интерфейсе

Ожидаемый результат:

- данные переживают refresh;
- вакансия видна в sidebar;
- кандидат появляется в списке;
- отчет доступен в модалке кандидата;
- кнопка финального выбора создает decision result.

## 8. Проверки качества

Проверенные команды:

```bash
npm run lint
npm run build
```

Ожидаемый результат:

- `lint` завершается без ошибок;
- `build` завершается без ошибок.

## 9. Деплой на Vercel

### Шаг 1. Подключение репозитория

Подключите репозиторий к `Vercel`.

### Шаг 2. Переменные окружения

Добавьте в `Vercel Project Settings`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`
- `GITHUB_TOKEN` опционально

### Шаг 3. Build settings

Для текущего проекта достаточно стандартных настроек `Next.js`.

### Шаг 4. Проверка после деплоя

Проверьте:

- открывается `/login`
- проходит регистрация
- создается вакансия
- проходит GitHub analysis
- создается candidate report
- работает `Выбрать лучшего`

## 10. Частые проблемы

### Приложение открывается в demo-режиме

Проверьте:

- существует ли `.env.local`
- заполнены ли `NEXT_PUBLIC_SUPABASE_URL`
- заполнены ли `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- заполнены ли `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`

### Регистрация не работает

Проверьте:

- включен ли Email provider в Supabase Auth
- не требует ли проект подтверждение email
- правильно ли переданы `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Не создается кандидат

Проверьте:

- валидна ли GitHub-ссылка
- доступен ли публично профиль или репозиторий
- не уперлись ли вы в rate limit GitHub API
- задан ли `GITHUB_TOKEN`

### Не проходит AI-анализ

Проверьте:

- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`
- действительно ли провайдер совместим с OpenAI API

### Не загружается файл сопроводительного письма

Проверьте:

- создан ли bucket `candidate-files`
- задан ли `SUPABASE_SERVICE_ROLE_KEY`
- разрешает ли Supabase Storage запись в bucket

## 11. Что смотреть при отладке

Главные точки в коде:

- [app/dashboard/actions.ts](../app/dashboard/actions.ts)
- [lib/ai.ts](../lib/ai.ts)
- [lib/github.ts](../lib/github.ts)
- [lib/dashboard.ts](../lib/dashboard.ts)
- [lib/supabase/server.ts](../lib/supabase/server.ts)

## 12. Definition of Ready для показа проекта

Проект считается готовым к показу, если:

- `npm run lint` зеленый
- `npm run build` зеленый
- live env заполнен
- в Supabase применена SQL schema
- можно пройти полный сценарий от логина до выбора лучшего кандидата
- UI выглядит как плотный cold SaaS tool, а не как шаблонный landing page
