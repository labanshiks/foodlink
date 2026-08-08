# FoodLink Project Specification

## 1. Project Overview

**Project Name:** FoodLink  
**Project Type:** Web Application Development Assignment  
**Primary Goal:** Build a web-based platform that connects food donors with recipient organisations so surplus food can be listed, reserved, collected, and tracked.

FoodLink addresses two United Nations Sustainable Development Goals:

- SDG 2: Zero Hunger
- SDG 12: Responsible Consumption and Production

The application should remain practical, realistic, and suitable for a beginner-to-intermediate Master's-level Web Applications and Development class.

The final solution must be easy to explain during a project defence. Avoid unnecessary complexity, hidden abstractions, and features that make the system difficult to defend.

---

## 2. Problem Statement

Restaurants, hotels, supermarkets, bakeries, event organisers, and similar organisations sometimes have safe surplus food that goes to waste because there is no structured way to connect the food with organisations that need it.

Charities, shelters, schools, food banks, and community organisations often depend on donations but lack visibility into what food is available, where it is located, and when it must be collected.

FoodLink will provide a web platform where donors publish surplus food listings, recipient organisations browse and reserve available donations, and administrators oversee platform activity.

---

## 3. Project Objectives

The system should:

1. Reduce avoidable food waste.
2. Connect food donors with recipient organisations.
3. Provide visibility into available food donations.
4. Support donation reservation and collection workflows.
5. Maintain historical records of donations and reservations.
6. Provide administrators with oversight of users, organisations, categories, and donations.
7. Demonstrate secure authentication, authorization, CRUD operations, database integration, responsive design, and REST API architecture.

---

## 4. Agreed Technology Stack

### Frontend

- React
- Vite
- React Router
- Bootstrap
- Axios

### Backend

- Node.js
- Express.js

### Database

- MySQL

### Database Access

- Prisma ORM

### Authentication and Security

- JSON Web Tokens
- bcrypt
- Role-based authorization
- Password reset tokens
- Input validation

### API Style

- REST API
- JSON request and response payloads

### Development and Testing

- Postman
- Git
- GitHub
- Draw.io for diagrams

---

## 5. Architecture

FoodLink will use a three-tier architecture.

```text
React Frontend
      |
      | REST API / JSON / JWT
      v
Node.js + Express API
      |
      | Prisma ORM
      v
MySQL Database
```

### Frontend Responsibilities

The React frontend is responsible for:

- Rendering pages and components
- Navigation
- Forms
- Client-side validation
- Calling REST endpoints
- Displaying API responses
- Managing authenticated user state
- Hiding or showing navigation based on role
- Protecting routes at the UI level

### Backend Responsibilities

The Express backend is responsible for:

- Authentication
- Authorization
- Role enforcement
- Input validation
- Business logic
- Resource ownership checks
- Database operations
- REST responses
- Error handling

### Data Tier Responsibilities

MySQL stores persistent data for:

- Users
- Organisations
- Food categories
- Donations
- Reservations
- Password reset tokens

### Backend Request Flow

```text
HTTP Request
    |
    v
Express Route
    |
    v
Authentication Middleware
    |
    v
Role / Permission Check
    |
    v
Validation
    |
    v
Controller
    |
    v
Service / Business Logic
    |
    v
Prisma
    |
    v
MySQL
```

---

## 6. User Roles

The system will support three roles.

### 6.1 Donor

A donor may represent:

- Restaurant
- Hotel
- Supermarket
- Bakery
- Event organiser
- Similar food-producing organisation

A donor should be able to:

- Register
- Login and logout
- Reset a forgotten password
- Maintain an organisation profile
- Create a food donation
- View their donations
- Edit their own donations
- Cancel their own donations
- View reservation requests
- Approve or reject reservation requests
- Mark a reserved donation as collected
- View donation history
- View donor dashboard statistics

### 6.2 Recipient

A recipient may represent:

- Charity
- Shelter
- Community centre
- Food bank
- School
- Similar receiving organisation

A recipient should be able to:

- Register
- Login and logout
- Reset a forgotten password
- Maintain an organisation profile
- Browse available donations
- Search and filter donations
- View donation details
- Submit a reservation request
- Cancel their own pending reservation
- View reservation status
- View collection history
- View recipient dashboard statistics

### 6.3 Administrator

An administrator should be able to:

- Login and logout
- View platform statistics
- View registered users
- Activate or suspend users
- View organisations
- Manage food categories
- View donations
- Cancel inappropriate donation listings

Administrator registration must not be publicly available.

---

## 7. Core Functional Requirements

### FR01: User Registration

The system shall allow donor and recipient users to register.

Registration should collect:

- First name
- Last name
- Email
- Phone number
- Password
- Account type
- Organisation name
- Organisation type
- Organisation description
- Address
- City
- Organisation contact phone

Registration should create both:

- A user record
- An organisation record

### FR02: Authentication

The system shall:

- Allow login using email and password
- Allow logout
- Issue an authentication token
- Return the authenticated user profile
- Protect private routes
- Reject suspended users from protected functionality

### FR03: Password Management

The system shall:

- Hash passwords before storage
- Never store passwords in plain text
- Support forgotten-password requests
- Generate a time-limited reset token
- Store only a hash of the reset token
- Allow a valid reset token to set a new password
- Prevent reuse of a consumed reset token

Real email delivery is not required for the first working version.

A development fallback may expose the reset link or token in a safe development-only manner.

### FR04: Organisation Management

Donor and recipient users shall:

- View their organisation profile
- Update their own organisation profile

Users must not edit another user's organisation.

### FR05: Food Category Management

Administrators shall:

- View categories
- Create categories
- Edit categories
- Enable or disable categories

Categories linked to existing donations should be disabled instead of deleted.

Suggested seed categories:

- Prepared Meals
- Fresh Produce
- Bakery
- Dairy
- Dry Foods
- Beverages
- Other

### FR06: Donation Management

Donors shall be able to create donation listings with:

- Title
- Food category
- Description
- Quantity
- Quantity unit
- Available collection time
- Expiry date and time
- Collection address
- City
- Collection instructions

Image upload is optional and should not be part of the first implementation milestone.

A donor shall be able to:

- Create a donation
- View a donation
- Edit their own donation
- Cancel their own donation
- View all of their donations

### FR07: Browse Donations

Public users and recipients shall be able to:

- View available donations
- Search by title
- Filter by food category
- Filter by city
- Sort by expiry time
- Open a donation details page

Only active, unexpired, available donations should appear in normal browsing results.

### FR08: Reservation Management

Recipients shall be able to:

- Submit a reservation request
- Add an optional message
- Provide a proposed collection time
- View their reservations
- Cancel their own pending reservations

Donors shall be able to:

- View reservation requests for their own donations
- Approve a request
- Reject a request

### FR09: Collection Completion

When an approved donation is collected:

- Donation status changes to `COLLECTED`
- Approved reservation status changes to `COMPLETED`

The two changes should be handled together as one business operation.

### FR10: Donation History

Donors should see:

- Active donations
- Reserved donations
- Collected donations
- Cancelled donations

Recipients should see:

- Pending reservations
- Approved reservations
- Rejected reservations
- Cancelled reservations
- Completed collections

### FR11: Administration

Administrators shall be able to:

- View users
- Activate users
- Suspend users
- View organisations
- View donations
- Cancel inappropriate donations
- Manage food categories

### FR12: Dashboards

#### Donor Dashboard

Show:

- Active donations
- Pending reservation requests
- Reserved donations
- Completed donations

#### Recipient Dashboard

Show:

- Available donations
- Pending reservations
- Approved reservations
- Completed collections

#### Admin Dashboard

Show:

- Total users
- Donor count
- Recipient count
- Available donations
- Reserved donations
- Completed donations

---

## 8. Non-Functional Requirements

### 8.1 Security

The system should:

- Hash passwords
- Protect private routes
- Verify JWTs
- Enforce role-based authorization
- Validate inputs
- Enforce resource ownership
- Reject unauthorized requests at the backend
- Use time-limited password reset tokens
- Keep credentials in environment variables

### 8.2 Usability

The interface should:

- Be responsive
- Work on desktop and mobile screens
- Provide clear navigation
- Use consistent styling
- Show useful success messages
- Show useful error messages
- Show empty states where appropriate
- Show loading states during API operations

### 8.3 Maintainability

The codebase should separate:

- Routes
- Controllers
- Services
- Middleware
- Validation
- Database access
- React pages
- React reusable components
- API service calls

### 8.4 Data Integrity

The database should use:

- Primary keys
- Foreign keys
- Unique constraints
- Required fields
- Application validation for business constraints

---

## 9. Core Business Rules

### BR01

Only users with the `DONOR` role may create donations.

### BR02

Only users with the `RECIPIENT` role may submit reservation requests.

### BR03

Only donations with status `AVAILABLE` and an expiry time in the future may accept reservations.

### BR04

A donor may edit or cancel only their own donation.

### BR05

A donor may approve or reject only reservations linked to their own donation.

### BR06

A recipient may cancel only their own reservation.

### BR07

Donation quantity must be greater than zero.

### BR08

Donation expiry time must be later than its availability time.

### BR09

Only one reservation may be approved for a donation.

When one reservation becomes `APPROVED`:

- Donation becomes `RESERVED`
- Other pending reservations for the same donation become `REJECTED`

### BR10

When collection is completed:

- Donation becomes `COLLECTED`
- Approved reservation becomes `COMPLETED`

### BR11

Expired donations must not appear in available donation listings.

Do not create a scheduled background job in the first implementation.

Treat a donation as expired when:

```text
expires_at < current date/time
```

### BR12

Suspended users must not access protected system functionality.

### BR13

Frontend route restrictions are not sufficient for security.

The backend must independently enforce authentication, role checks, and resource ownership.

---

## 10. Database Design

Use six core tables.

### 10.1 users

| Column | Type | Constraint |
|---|---|---|
| id | INT | Primary key, auto increment |
| first_name | VARCHAR(50) | Required |
| last_name | VARCHAR(50) | Required |
| email | VARCHAR(255) | Required, unique |
| password_hash | VARCHAR(255) | Required |
| phone_number | VARCHAR(30) | Required |
| role | ENUM | DONOR, RECIPIENT, ADMIN |
| status | ENUM | ACTIVE, SUSPENDED |
| created_at | DATETIME | Required |
| updated_at | DATETIME | Required |

### 10.2 organisations

| Column | Type | Constraint |
|---|---|---|
| id | INT | Primary key, auto increment |
| user_id | INT | Foreign key, unique |
| name | VARCHAR(150) | Required |
| organisation_type | VARCHAR(100) | Required |
| description | TEXT | Optional |
| address | VARCHAR(255) | Required |
| city | VARCHAR(100) | Required |
| contact_phone | VARCHAR(30) | Required |
| created_at | DATETIME | Required |
| updated_at | DATETIME | Required |

Relationship:

```text
User 1 ---- 0..1 Organisation
```

An administrator does not require an organisation.

### 10.3 food_categories

| Column | Type | Constraint |
|---|---|---|
| id | INT | Primary key, auto increment |
| name | VARCHAR(100) | Required, unique |
| description | TEXT | Optional |
| active | BOOLEAN | Required |
| created_at | DATETIME | Required |
| updated_at | DATETIME | Required |

### 10.4 donations

| Column | Type | Constraint |
|---|---|---|
| id | INT | Primary key, auto increment |
| donor_id | INT | Foreign key to users.id |
| category_id | INT | Foreign key to food_categories.id |
| title | VARCHAR(150) | Required |
| description | TEXT | Required |
| quantity | DECIMAL(10,2) | Required |
| quantity_unit | VARCHAR(30) | Required |
| available_from | DATETIME | Required |
| expires_at | DATETIME | Required |
| collection_address | VARCHAR(255) | Required |
| city | VARCHAR(100) | Required |
| collection_instructions | TEXT | Optional |
| image_url | VARCHAR(500) | Optional |
| status | ENUM | AVAILABLE, RESERVED, COLLECTED, CANCELLED |
| created_at | DATETIME | Required |
| updated_at | DATETIME | Required |

Relationships:

```text
User 1 ---- N Donations
FoodCategory 1 ---- N Donations
```

### 10.5 reservations

| Column | Type | Constraint |
|---|---|---|
| id | INT | Primary key, auto increment |
| donation_id | INT | Foreign key to donations.id |
| recipient_id | INT | Foreign key to users.id |
| message | TEXT | Optional |
| requested_collection_time | DATETIME | Required |
| status | ENUM | PENDING, APPROVED, REJECTED, CANCELLED, COMPLETED |
| donor_response | TEXT | Optional |
| created_at | DATETIME | Required |
| updated_at | DATETIME | Required |

Relationships:

```text
Donation 1 ---- N Reservations
User 1 ---- N Reservations
```

### 10.6 password_reset_tokens

| Column | Type | Constraint |
|---|---|---|
| id | INT | Primary key, auto increment |
| user_id | INT | Foreign key to users.id |
| token_hash | VARCHAR(255) | Required |
| expires_at | DATETIME | Required |
| used_at | DATETIME | Optional |
| created_at | DATETIME | Required |

Relationship:

```text
User 1 ---- N PasswordResetTokens
```

---

## 11. ERD Relationship Summary

```text
USERS
  |
  | 1
  |
  | 0..1
  v
ORGANISATIONS


USERS
  |
  | 1
  |
  | N
  v
DONATIONS
  |
  | N
  |
  | 1
  v
FOOD_CATEGORIES


DONATIONS
  |
  | 1
  |
  | N
  v
RESERVATIONS
  ^
  | N
  |
  | 1
USERS


USERS
  |
  | 1
  |
  | N
  v
PASSWORD_RESET_TOKENS
```

Foreign key mapping:

```text
organisations.user_id -> users.id

donations.donor_id -> users.id

donations.category_id -> food_categories.id

reservations.donation_id -> donations.id

reservations.recipient_id -> users.id

password_reset_tokens.user_id -> users.id
```

---

## 12. REST API Specification

Base API path:

```text
/api
```

### 12.1 Authentication

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register donor or recipient |
| POST | `/api/auth/login` | Public | Login |
| POST | `/api/auth/logout` | Authenticated | Logout |
| GET | `/api/auth/me` | Authenticated | Return current user |
| POST | `/api/auth/forgot-password` | Public | Request password reset |
| POST | `/api/auth/reset-password` | Public | Reset password |

### 12.2 Organisation

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/organisations/me` | Donor/Recipient | View own organisation |
| PUT | `/api/organisations/me` | Donor/Recipient | Update own organisation |

### 12.3 Food Categories

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/categories` | Public | List active categories |
| POST | `/api/categories` | Admin | Create category |
| PUT | `/api/categories/:id` | Admin | Update category |
| PATCH | `/api/categories/:id/status` | Admin | Enable or disable category |

### 12.4 Donations

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/donations` | Public | Browse available donations |
| GET | `/api/donations/:id` | Public | View donation |
| GET | `/api/donations/mine` | Donor | View own donations |
| POST | `/api/donations` | Donor | Create donation |
| PUT | `/api/donations/:id` | Donor | Edit own donation |
| PATCH | `/api/donations/:id/cancel` | Donor | Cancel own donation |
| PATCH | `/api/donations/:id/collected` | Donor | Mark collection complete |

Supported browsing query parameters should include:

```text
/api/donations?city=Nairobi&category=3&search=bread
```

Sorting by expiry time should also be supported.

### 12.5 Reservations

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/donations/:id/reservations` | Recipient | Request donation |
| GET | `/api/reservations/mine` | Recipient | View own reservations |
| GET | `/api/donations/:id/reservations` | Donor | View requests for own donation |
| PATCH | `/api/reservations/:id/approve` | Donor | Approve reservation |
| PATCH | `/api/reservations/:id/reject` | Donor | Reject reservation |
| PATCH | `/api/reservations/:id/cancel` | Recipient | Cancel own reservation |

### 12.6 Dashboard

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/dashboard` | Authenticated | Return role-specific dashboard metrics |

### 12.7 Administration

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/admin/users` | Admin | View users |
| PATCH | `/api/admin/users/:id/status` | Admin | Activate or suspend user |
| GET | `/api/admin/organisations` | Admin | View organisations |
| GET | `/api/admin/donations` | Admin | View donations |
| PATCH | `/api/admin/donations/:id/cancel` | Admin | Cancel listing |

---

## 13. Frontend Pages and Routes

### Public Routes

| Route | Page |
|---|---|
| `/` | Home |
| `/donations` | Browse Donations |
| `/donations/:id` | Donation Details |
| `/login` | Login |
| `/register` | Register |
| `/forgot-password` | Forgot Password |
| `/reset-password` | Reset Password |

### Donor Routes

| Route | Page |
|---|---|
| `/dashboard` | Donor Dashboard |
| `/my-donations` | My Donations |
| `/donations/new` | Create Donation |
| `/donations/:id/edit` | Edit Donation |
| `/donations/:id/requests` | Reservation Requests |
| `/profile` | Organisation Profile |

### Recipient Routes

| Route | Page |
|---|---|
| `/dashboard` | Recipient Dashboard |
| `/donations` | Browse Donations |
| `/my-reservations` | My Reservations |
| `/profile` | Organisation Profile |

### Admin Routes

| Route | Page |
|---|---|
| `/admin` | Admin Dashboard |
| `/admin/users` | User Management |
| `/admin/organisations` | Organisation Management |
| `/admin/categories` | Food Category Management |
| `/admin/donations` | Donation Management |

---

## 14. Navigation Rules

### Public Navigation

```text
FoodLink | Home | Browse Donations | Login | Register
```

### Donor Navigation

```text
FoodLink | Dashboard | My Donations | Add Donation | Profile | Logout
```

### Recipient Navigation

```text
FoodLink | Dashboard | Browse Donations | My Reservations | Profile | Logout
```

### Administrator Navigation

```text
FoodLink | Dashboard | Users | Organisations | Categories | Donations | Logout
```

---

## 15. Route Protection

Use three route classes.

### Public

Accessible without authentication.

### Protected

Requires an authenticated user.

### Role Protected

Requires authentication and a specific role.

Examples:

```text
/donations/new -> DONOR

/my-reservations -> RECIPIENT

/admin/users -> ADMIN
```

Frontend protection is for navigation and user experience.

Backend authorization remains mandatory.

---

## 16. Suggested Project Folder Structure

```text
foodlink/
|
|-- client/
|-- server/
|-- docs/
|   |-- architecture/
|   |-- erd/
|   `-- screenshots/
|
|-- README.md
`-- PROJECT_SPEC.md
```

### React Frontend

```text
client/
|
|-- public/
`-- src/
    |-- assets/
    |-- components/
    |-- pages/
    |   |-- auth/
    |   |-- donor/
    |   |-- recipient/
    |   |-- admin/
    |   `-- public/
    |
    |-- layouts/
    |-- services/
    |-- context/
    |-- hooks/
    |-- routes/
    |-- utils/
    |-- App.jsx
    `-- main.jsx
```

### Express Backend

```text
server/
|
|-- prisma/
|-- src/
|   |-- config/
|   |-- controllers/
|   |-- middleware/
|   |-- routes/
|   |-- services/
|   |-- validators/
|   |-- utils/
|   `-- app/
|
|-- .env
|-- .env.example
|-- package.json
`-- server entry point
```

Exact file names may be selected during implementation as long as the architecture stays consistent and readable.

---

## 17. Main Application Workflow

The primary demo scenario should follow this sequence:

```text
Donor registers
    |
    v
Donor logs in
    |
    v
Donor creates donation
    |
    v
Donation = AVAILABLE
    |
    v
Recipient browses donation
    |
    v
Recipient submits reservation
    |
    v
Reservation = PENDING
    |
    v
Donor reviews request
    |
    +-------------------+
    |                   |
    v                   v
APPROVE              REJECT
    |                   |
    v                   v
Reservation           Reservation
= APPROVED            = REJECTED
    |
    v
Donation = RESERVED
    |
    v
Food collected
    |
    v
Donation = COLLECTED
Reservation = COMPLETED
```

---

## 18. Demonstration Scenario

Use realistic demonstration data.

### Donor

```text
Organisation: Green Spoon Restaurant
Role: DONOR
City: Nairobi
```

### Donation

```text
Title: Surplus Chicken and Rice Meals
Category: Prepared Meals
Quantity: 25 portions
Available From: 4:00 PM
Collection Deadline: 7:00 PM
Location: Westlands, Nairobi
Status: AVAILABLE
```

### Recipient

```text
Organisation: Hope Community Centre
Role: RECIPIENT
City: Nairobi
```

Demonstrate:

1. Donor creates donation.
2. Recipient browses donations.
3. Recipient filters for Nairobi.
4. Recipient opens donation.
5. Recipient requests collection.
6. Donor views request.
7. Donor approves request.
8. Donation changes to `RESERVED`.
9. Donor marks donation as collected.
10. Donation changes to `COLLECTED`.
11. Reservation changes to `COMPLETED`.
12. Admin dashboard reflects updated totals.

---

## 19. Implementation Milestones

Codex should work milestone by milestone.

Do not implement all milestones in one uncontrolled pass.

### Milestone 1: Project Foundation

Tasks:

- Initialize Git repository
- Create `client`
- Create `server`
- Initialize React with Vite
- Initialize Express
- Install Bootstrap
- Install Prisma
- Configure Prisma for MySQL
- Configure environment variables
- Add `.env.example`
- Add `.gitignore`
- Verify React starts
- Verify Express starts
- Verify Express can reach MySQL

Do not implement business features during this milestone.

### Milestone 2: Database

Tasks:

- Define Prisma models
- Add enums
- Define relations
- Create migration
- Apply migration
- Verify tables in MySQL
- Seed food categories
- Seed one admin account

### Milestone 3: Authentication

Tasks:

- Registration
- Password hashing
- Login
- JWT generation
- JWT verification middleware
- Current user endpoint
- Role middleware
- Suspended-user handling
- Logout behavior
- Postman testing

### Milestone 4: Organisation Profiles

Tasks:

- View own organisation
- Update own organisation
- Ownership checks
- React profile page

### Milestone 5: Donation CRUD

Tasks:

- Create donation
- View donation
- Edit own donation
- Cancel own donation
- List donor donations
- Public available-donation listing
- Search
- Category filter
- City filter
- Expiry filtering
- Sort by expiry

### Milestone 6: Reservation Workflow

Tasks:

- Request reservation
- View recipient reservations
- View donor reservation requests
- Approve reservation
- Reject reservation
- Cancel reservation
- Reject competing pending reservations after approval
- Set donation to `RESERVED`
- Mark donation as `COLLECTED`
- Set approved reservation to `COMPLETED`
- Test the full workflow

### Milestone 7: Dashboards

Tasks:

- Donor metrics
- Recipient metrics
- Admin metrics
- Dashboard cards
- Recent activity where practical

### Milestone 8: Administration

Tasks:

- View users
- Activate users
- Suspend users
- View organisations
- Manage categories
- View donations
- Cancel inappropriate donations

### Milestone 9: Password Reset

Tasks:

- Forgot-password request
- Generate reset token
- Hash token before storage
- Token expiry
- Reset password
- Mark token used
- Development fallback for reset link

### Milestone 10: UI Cleanup and Final Testing

Tasks:

- Responsive Bootstrap layout
- Loading indicators
- Empty states
- Validation messages
- Confirmation prompts
- Status badges
- Error handling
- 404 page
- End-to-end manual testing
- Postman validation
- README updates

---

## 20. Priority Levels

### P1: Submission Critical

- Database
- Registration
- Login
- JWT authentication
- Role authorization
- Donation CRUD
- Browse donations
- Reservations
- Reservation approval
- Collection completion
- Password reset

### P2: Important

- Organisation profiles
- Admin management
- Dashboards
- Search and filtering

### P3: Optional

Do not start until all P1 functionality works.

- Charts
- Image upload
- Audit history
- Real email delivery

---

## 21. Features Explicitly Out of Scope

Do not implement these unless the specification is intentionally revised later:

- Payments
- Live GPS tracking
- Real-time chat
- Delivery management
- Mobile app
- Recommendation algorithms
- Government identity verification
- Complex food safety certification
- External map integration
- Real-time notifications
- Background job infrastructure
- Microservices

Keep location handling to text-based address and city fields.

---

## 22. Optional Features After Core Completion

Only consider these after all P1 and P2 features are stable.

### Donation Images

Add one optional image per donation.

### Dashboard Charts

Add one or two simple charts using existing dashboard data.

### Audit History

Optional table:

```text
donation_status_history
```

Possible fields:

- id
- donation_id
- changed_by
- previous_status
- new_status
- created_at

### Real Email Delivery

Add email delivery for password reset only if time allows.

---

## 23. Error Handling Expectations

The API should return consistent JSON error responses.

At minimum handle:

- Invalid login
- Duplicate email
- Missing required data
- Invalid IDs
- Resource not found
- Unauthorized request
- Forbidden request
- Attempt to modify another user's resource
- Expired donation
- Invalid reservation state
- Invalid donation state
- Suspended account
- Unexpected server error

Do not expose stack traces or secrets to the frontend.

---

## 24. Validation Expectations

Validate at least:

### Registration

- Required names
- Valid email
- Unique email
- Password minimum length
- Valid role
- Required organisation information

### Donation

- Required title
- Required category
- Positive quantity
- Required quantity unit
- Valid availability time
- Valid expiry time
- Expiry later than availability
- Required collection address
- Required city

### Reservation

- Valid donation
- Donation available
- Donation unexpired
- Valid proposed collection time
- Recipient role

---

## 25. Git Working Strategy

Use:

```text
main
```

with feature branches such as:

```text
feature/authentication
feature/donations
feature/reservations
feature/admin
```

Use meaningful commits.

Examples:

```text
Initialize React and Express applications

Configure Prisma with MySQL

Add FoodLink database schema

Implement user registration

Implement JWT authentication

Add donation CRUD API

Add reservation approval workflow
```

Do not commit:

- `.env`
- Database passwords
- JWT secrets
- Generated sensitive tokens

---

## 26. Documentation Requirements

Maintain:

### README.md

Should eventually include:

- Project overview
- Technology stack
- Prerequisites
- Installation instructions
- Environment variables
- Database setup
- Migration commands
- Seed commands
- Frontend startup
- Backend startup
- Default admin setup
- Demo accounts if appropriate

### docs/architecture

Store final system architecture diagram.

### docs/erd

Store final ERD.

### docs/screenshots

Store selected final UI screenshots if needed for submission or presentation.

---

## 27. Acceptance Criteria

The project is considered functionally complete when all of the following work.

### Authentication

- Donor registers successfully
- Recipient registers successfully
- Password is stored hashed
- User logs in successfully
- Invalid login is rejected
- Protected routes reject unauthenticated requests
- Role restrictions work
- Suspended users lose protected access
- Password reset works

### Organisations

- User views their organisation
- User updates their organisation
- User cannot edit another organisation

### Donations

- Donor creates donation
- Donor views own donations
- Donor edits own donation
- Donor cancels own donation
- Donor cannot edit another donor's donation
- Public user browses available donations
- Expired donations are excluded
- Search works
- Category filter works
- City filter works

### Reservations

- Recipient requests an available donation
- Donor sees the request
- Donor approves a request
- Donation becomes reserved
- Competing pending requests are rejected
- Recipient sees approval
- Recipient cancels their own pending request
- Donor completes collection
- Donation becomes collected
- Approved reservation becomes completed

### Administration

- Admin views users
- Admin suspends user
- Admin reactivates user
- Admin views organisations
- Admin manages categories
- Admin views donations
- Admin cancels an inappropriate donation

### UI

- Main pages are responsive
- Navigation changes by role
- Loading states exist
- Errors are shown clearly
- Empty states are readable
- Main workflow is easy to demonstrate

---

## 28. Codex Working Rules

Codex should follow these rules throughout the project.

1. Read this specification before making changes.
2. Treat this document as the source of truth.
3. Do not change architecture or scope silently.
4. If a design change is necessary, explain why before making it.
5. Work one milestone at a time.
6. Do not start a later milestone before the current milestone is tested.
7. Keep code readable and beginner-to-intermediate friendly.
8. Avoid unnecessary abstractions.
9. Avoid adding libraries without a clear reason.
10. Keep business logic in the backend.
11. Enforce authorization in the backend even when the frontend hides restricted actions.
12. Use environment variables for secrets.
13. Never hard-code passwords, JWT secrets, or database credentials.
14. Run relevant checks after each milestone.
15. Report files created or changed after each milestone.
16. Report manual setup steps required from the user.
17. Stop after the requested milestone unless explicitly instructed to continue.
18. Keep the README current as setup requirements change.
19. Prefer clear naming over clever naming.
20. Keep the project easy to explain during an academic defence.

---

## 29. First Codex Instruction

Use the following as the first instruction after placing this file in the project root:

```text
Read PROJECT_SPEC.md completely before making changes.

You are implementing the FoodLink web application described in the specification.

Treat PROJECT_SPEC.md as the source of truth.

Do not change the agreed architecture or scope without explaining why.

Start with Milestone 1 only:

- initialize the project structure
- initialize the React frontend using Vite
- initialize the Express backend
- install and configure Bootstrap
- install and configure Prisma for MySQL
- configure environment variables
- create .env.example
- configure .gitignore
- verify the frontend starts successfully
- verify the backend starts successfully
- verify the backend can connect to MySQL

Do not implement authentication, database models, donation features, reservation features, dashboards, or administration yet.

After completing the milestone:

1. run the relevant checks
2. summarize the files created or changed
3. explain any manual setup steps I must perform
4. report any errors or assumptions
5. stop before starting Milestone 2
```

---

## 30. Defence Preparation Guidance

The implementation should make it easy to explain:

- Why React was used for the frontend
- Why Express was used for the REST API
- Why MySQL was selected
- What Prisma ORM does
- Difference between authentication and authorization
- Why backend authorization is still required when React protects routes
- Why users and organisations are stored separately
- Why one donation may have several reservation requests
- Why only one reservation may become approved
- How foreign keys maintain relationships
- How passwords are protected
- How password reset tokens are protected
- Why expired donations are determined using `expires_at`
- Why the service layer contains business rules
- How donation status and reservation status move through the workflow

The final application should favor clear implementation choices over advanced techniques that make the project harder to defend.

---

## 31. Final Scope Statement

FoodLink is a role-based surplus-food donation coordination web application built using React, Node.js, Express, Prisma, and MySQL.

The core academic value of the project comes from demonstrating:

- Modern frontend development
- REST API design
- Database modeling
- Authentication
- Authorization
- CRUD operations
- Relational data
- Business workflow management
- Responsive UI design
- Secure password handling
- Administrative functionality

The primary success criterion is a stable end-to-end workflow from donation creation through reservation approval and collection completion.
