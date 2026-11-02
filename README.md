# CRUD API

REST API на NestJS с PostgreSQL и Kysely для работы с пользователями.

## Требования

- Node.js
- npm
- Docker и Docker Compose

## Установка

Клонируйте репозиторий:

```bash
git clone https://github.com/VidyakinDenis/crud.git
cd crud
```

Установите зависимости:

```bash
npm install --legacy-peer-deps
```

## Запуск проекта

### 1. Запуск Docker

Поднимите необходимые контейнеры:

```bash
npm run docker:up
```

### 2. Запуск миграций

Примените миграции базы данных:

```bash
npm run migrate
```

### 3. Запуск приложения

Запустите приложение в режиме разработки:

```bash
npm run start:dev
```

## Полезные команды

| Команда | Описание |
|---|---|
| `npm run docker:up` | Запуск Docker-контейнеров |
| `npm run migrate` | Применение миграций базы данных |
| `npm run start:dev` | Запуск приложения в режиме разработки |
| `npm run build` | Сборка проекта |
| `npm run test` | Запуск тестов |