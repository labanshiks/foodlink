# FoodLink

FoodLink is a complete three-tier surplus-food donation coordination web application. Donor organisations publish food that would otherwise go to waste, recipient organisations request collection, and administrators oversee platform activity. The project supports UN Sustainable Development Goal 2 (Zero Hunger) and Goal 12 (Responsible Consumption and Production).

## Technology and architecture

- React 18, Vite, React Router, Bootstrap, and Axios
- Node.js and Express REST API with JWT authentication and role authorization
- Prisma ORM with MySQL
- bcrypt password hashing and hashed, time-limited password-reset tokens

```text
React browser client
        |
        | Axios / JSON / Bearer JWT
        v
Express REST API
        |
        | Prisma ORM
        v
MySQL database
```

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

Create the frontend environment file:

```bash
cd client
copy .env.example .env
```

On macOS or Linux, use `cp .env.example .env`. The default development value is:

```dotenv
VITE_API_URL=http://localhost:5000/api
```

Create the local database and a dedicated application account while logged into MySQL as an administrator:

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
PASSWORD_RESET_EXPIRES_MINUTES=30
PASSWORD_RESET_DELIVERY_MODE="none"
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

The frontend uses the API URL from `VITE_API_URL`; production deployments should set this to the deployed API base URL rather than editing source files.

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

## Donation API

Public endpoints:

```text
GET /api/categories
GET /api/donations
GET /api/donations/:id
```

The public category endpoint returns only active categories and exposes only `id`, `name`, `description`, and `active`. Administrators continue to use `/api/admin/categories` to see active and inactive categories with usage counts.

Authenticated `DONOR` endpoints:

```text
GET   /api/donations/mine
POST  /api/donations
PUT   /api/donations/:id
PATCH /api/donations/:id/cancel
```

Public browsing supports:

```text
/api/donations?city=Nairobi
/api/donations?category=1
/api/donations?search=bread
/api/donations?title=meals
/api/donations?sort=expiry_asc
/api/donations?sort=expiry_desc
```

Public listings contain only `AVAILABLE` donations with `expiresAt` greater than or equal to the current request time. Expiration is calculated during the query; there is no `EXPIRED` status or background job.

Donation ownership always comes from the authenticated user. Client-supplied `donorId`, `donor_id`, `status`, IDs, or timestamp fields are rejected. New donations always start as `AVAILABLE`.

Cancellation is the donation delete operation for CRUD purposes. It changes the status to `CANCELLED` without deleting the database row, is idempotent when repeated, and removes the donation from public listings. The donor `/mine` endpoint retains cancelled and expired history.

With the API running, exercise the complete donation CRUD and public browsing flow:

```bash
cd server
npm run donation:smoke
```

The donation smoke script removes all temporary records after verification.

## Reservation and collection API

Authenticated `RECIPIENT` endpoints:

```text
POST  /api/donations/:id/reservations
GET   /api/reservations/mine
PATCH /api/reservations/:id/cancel
```

Authenticated `DONOR` endpoints:

```text
GET   /api/donations/:id/reservations
PATCH /api/reservations/:id/approve
PATCH /api/reservations/:id/reject
PATCH /api/donations/:id/collected
```

Reservation and donation ownership comes only from the authenticated user. Approval atomically changes one reservation to `APPROVED`, rejects competing pending reservations, and changes the donation to `RESERVED`. Collection atomically changes that reservation to `COMPLETED` and its donation to `COLLECTED`.

Cancelling an available donation atomically changes its pending reservations to `REJECTED`. Recipient-initiated cancellation uses `CANCELLED` and is limited to the recipient's own pending reservation.

With the API running, exercise the live request, listing, approval, and collection workflow:

```bash
cd server
npm run reservation:smoke
```

The reservation smoke script removes all temporary users, organisations, donations, and reservations after verification.

## Role-based dashboard API

All active authenticated roles use one endpoint:

```text
GET /api/dashboard
```

The API determines the dashboard from the authenticated user's role. Donor metrics are scoped to donations they own and reservation requests on those donations. Recipient metrics are scoped to their reservations. Administrator metrics aggregate platform users, organisations, donations, reservations, and categories.

Expired available donations are derived with `status = AVAILABLE` and `expiresAt` earlier than the request time. Dashboard reporting never changes donation rows or introduces an `EXPIRED` status.

With the API running, verify all three dashboard roles using temporary data:

```bash
cd server
npm run dashboard:smoke
```

The dashboard smoke script removes its temporary users, organisations, donations, and reservations after verification.

## Administration API

All administration endpoints require an authenticated `ADMIN` account.

```text
GET   /api/admin/users
PATCH /api/admin/users/:id/status
GET   /api/admin/organisations
GET   /api/admin/categories
POST  /api/categories
PUT   /api/categories/:id
PATCH /api/categories/:id/status
GET   /api/admin/donations
PATCH /api/admin/donations/:id/cancel
```

User listings support role, status, and name/email search filters. Organisation listings support role, city, and search filters. Donation listings support status, city, category, donor, expiry, search, and ordering filters.

Categories are enabled or disabled without deleting rows, preserving donation history. Administrative donation cancellation is logical, is limited to `AVAILABLE` donations, and atomically rejects pending reservation requests with an administration reason.

With the API running, exercise the complete backend administration flow:

```bash
cd server
npm run admin:smoke
```

The administration smoke script removes all temporary records after verification.

## Password reset API

Public endpoints:

```text
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

Forgot-password responses are identical for existing, missing, active, and suspended accounts. Existing accounts receive a cryptographically random 32-byte token; MySQL stores only its SHA-256 hash. Tokens expire after `PASSWORD_RESET_EXPIRES_MINUTES` (30 minutes by default), and a newer request retires older unused tokens.

Successful reset atomically replaces the bcrypt password hash, consumes the selected token, and retires other unused tokens for that user. A consumed or expired token cannot be reused.

Production must use `PASSWORD_RESET_DELIVERY_MODE=none`; a future email provider should receive the raw token directly from the delivery helper and send a reset URL without persisting the token. Automated tests use an in-process development sink. The live smoke test explicitly starts a non-production API with `PASSWORD_RESET_DELIVERY_MODE=response`, which returns a same-shaped development-only header for existing and nonexistent addresses while leaving the JSON response generic.

With that controlled development mode enabled on the API, run:

```bash
cd server
npm run password-reset:smoke
```

The password-reset smoke script removes its temporary user, organisation, and reset-token records afterward.

## React application

The browser application provides these public routes:

```text
/
/donations
/donations/:id
/login
/register
/forgot-password
/reset-password
```

Authenticated donor routes are `/dashboard`, `/my-donations`, `/donations/new`, `/donations/:id/edit`, `/donations/:id/requests`, and `/profile`. Recipient routes are `/dashboard`, `/my-reservations`, and `/profile`. Administration routes begin with `/admin` and cover users, organisations, categories, and donations.

The JWT is stored in browser local storage for this academic demonstration. Axios adds it to API requests automatically. At startup, the authentication provider verifies the token with `/api/auth/me`; invalid or expired tokens are removed. Roles are taken only from the verified API user, and route guards redirect unauthenticated or wrong-role navigation. Backend authentication and authorization remain authoritative.

The interface uses a responsive Bootstrap navbar, grid, cards, table wrappers, forms, status badges, loading indicators, empty states, validation messages, and confirmation prompts. An `AVAILABLE` donation whose `expiresAt` is in the past is displayed as `EXPIRED` without changing its database status.

For a local password-reset demonstration, start the backend with `NODE_ENV=development` and `PASSWORD_RESET_DELIVERY_MODE=response`. The API then exposes `X-FoodLink-Development-Reset-Token` through CORS and the forgot-password page shows a labelled development link. Production startup rejects response delivery and never exposes the raw token.

## Roles

- **DONOR:** maintains an organisation profile, creates and manages donations, reviews requests, and completes collection.
- **RECIPIENT:** maintains an organisation profile, browses donations, requests collection, and tracks or cancels pending reservations.
- **ADMIN:** views platform metrics and manages users, categories, organisations, and inappropriate available listings.

## Quality checks

Frontend checks:

```bash
cd client
npm run lint
npm run build
```

Backend regression and database checks:

```bash
cd server
npm test
npx prisma validate
npm run db:check
npm run db:verify
```

With a development API and frontend running at the URLs in `API_URL` and `FRONTEND_URL`, execute the cleanup-safe final integration scenario:

```bash
cd server
npm run full-stack:smoke
```

## Demonstration workflow

1. Green Spoon Restaurant logs in as a donor and creates **Surplus Chicken and Rice Meals** in Nairobi, with 25 meals available during a collection window covering approximately 4:00 PM to 7:00 PM.
2. Hope Community Centre logs in as a recipient, filters Nairobi listings, opens the donation, and requests collection around 4:30 PM.
3. The donor opens the listing's requests and approves Hope Community Centre. FoodLink reserves the donation and rejects other pending requests.
4. The donor marks collection complete. The donation becomes `COLLECTED` and the approved reservation becomes `COMPLETED` atomically.
5. The administrator reviews updated dashboard totals, users, organisations, categories, and donations.

Demo user passwords should be supplied only through local development configuration. The seeded administrator email and password come from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`; no real credentials belong in source control.
