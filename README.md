# FoodLink

FoodLink is a three-tier surplus-food donation coordination web application. The repository currently contains the Milestone 1 foundation and the Milestone 2 MySQL database schema, migration, and development seed data.

## Prerequisites

- Node.js 20 or later
- npm
- MySQL 8

## Project structure

```text
foodlink/
|-- client/   React + Vite + Bootstrap
|-- server/   Express + Prisma + MySQL
|-- docs/     Architecture, ERD, and screenshot placeholders
|-- PROJECT_SPEC.md
`-- README.md
```

## Setup

Install dependencies in each application:

```bash
cd client
npm install

cd ../server
npm install
```

Create the backend environment file:

```bash
cd server
copy .env.example .env
```

On macOS or Linux, use `cp .env.example .env` instead. Create the local database and a dedicated application account while logged into MySQL as an administrator:

```sql
CREATE DATABASE foodlink CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'foodlink_user'@'localhost' IDENTIFIED BY 'choose_a_strong_password';
GRANT ALL PRIVILEGES ON foodlink.* TO 'foodlink_user'@'localhost';
FLUSH PRIVILEGES;
```

Edit `server/.env` and replace `change_me` in `DATABASE_URL` with the password you selected. URL-encode special characters used in the username or password. Also set the development administrator credentials:

```dotenv
SEED_ADMIN_EMAIL="admin@foodlink.local"
SEED_ADMIN_PASSWORD="replace_with_a_strong_development_password"
```

The administrator password must contain at least 12 characters. Keep `server/.env` local and never commit it.

Apply the existing migrations and seed the development data:

```bash
cd server
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
```

## Development

Start the frontend:

```bash
cd client
npm run dev
```

Start the backend in another terminal:

```bash
cd server
npm run dev
```

The frontend defaults to <http://localhost:5173>. The API defaults to <http://localhost:5000>.

Check the API:

```text
GET http://localhost:5000/api/health
```

Check the backend's Prisma/MySQL connection:

```bash
cd server
npm run db:check
```

## Prisma commands

```bash
cd server
npm run prisma:validate
npm run prisma:generate
npm run prisma:seed
npm run db:verify
```

Use `npx prisma migrate dev --name <migration_name>` when creating future development migrations. Prisma's development migration command requires permission to create a temporary shadow database; applying committed migrations with `prisma migrate deploy` does not.

The seed is idempotent: it upserts the seven standard food categories and one active administrator. The administrator has no organisation, as required by the project specification.
