# FoodLink

FoodLink is a three-tier surplus-food donation coordination web application. The repository currently contains the project foundation, MySQL database, backend authentication and authorization, and organisation profiles completed through Milestone 4.

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
JWT_SECRET="replace_with_at_least_32_random_characters"
JWT_EXPIRES_IN="1h"
SEED_ADMIN_EMAIL="admin@foodlink.local"
SEED_ADMIN_PASSWORD="replace_with_a_strong_development_password"
```

Use a cryptographically random JWT secret containing at least 32 characters. The administrator password must contain at least 12 characters. Keep `server/.env` local and never commit it.

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

## Authentication API

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

Registration accepts `DONOR` and `RECIPIENT` only and requires this JSON structure:

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "phoneNumber": "+254700000000",
  "password": "StrongPass123",
  "role": "DONOR",
  "organisationName": "Example Restaurant",
  "organisationType": "Restaurant",
  "organisationDescription": "Optional description",
  "address": "Example Road",
  "city": "Nairobi",
  "organisationContactPhone": "+254700000001"
}
```

Passwords must contain 8–72 characters, including an uppercase letter, lowercase letter, and number. Passwords are stored as bcrypt hashes using 12 rounds.

Successful login returns a signed bearer token. Send it to protected endpoints as:

```text
Authorization: Bearer <token>
```

JWTs expire according to `JWT_EXPIRES_IN`, which defaults to one hour. Logout is stateless: the client removes its token, and the server does not maintain a token denylist.

Run the authentication integration tests:

```bash
cd server
npm test
```

With the API running, exercise login, current-user lookup, and logout over HTTP:

```bash
npm run auth:smoke
```

## Organisation profile API

Authenticated `DONOR` and `RECIPIENT` users can manage only the organisation linked to their account:

```text
GET /api/organisations/me
PUT /api/organisations/me
```

The update endpoint requires this JSON structure:

```json
{
  "name": "Example Restaurant",
  "organisationType": "Restaurant",
  "description": "Optional description or null",
  "address": "Example Road",
  "city": "Nairobi",
  "contactPhone": "+254700000001"
}
```

Ownership is always taken from the verified JWT user. Client-supplied `id`, `userId`, or `user_id` fields are ignored and cannot select another organisation. Administrators receive `403 Forbidden` because admin accounts do not have organisations.

With the API running, exercise registration, login, organisation retrieval, and organisation update over HTTP:

```bash
cd server
npm run organisation:smoke
```

The smoke script deletes its temporary donor and organisation records after verification.
