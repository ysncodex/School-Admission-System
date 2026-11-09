# School Admission System

A first-come, first-served school admission portal built for the **Assistant Software Engineer take-home assignment**. School staff can publish class/shift groups, while guardians can temporarily reserve a seat and simulate admission-fee payment to confirm the application.

## Features

- Create class/shift groups with a defined seat capacity.
- View class capacity and held, confirmed, and available seat counts.
- Identify students through the `X-Student-Id` request header.
- Reserve seats temporarily on a first-come, first-served basis.
- Expire unpaid holds automatically and release their seats.
- Confirm or cancel an active hold.
- Protect seat allocation against concurrent requests using PostgreSQL transactions and row-level locking.
- Provide student and school-admin interfaces in React.
- Run the database, API, and frontend with Docker Compose.
- Verify backend behavior with integration tests and frontend behavior with Vitest.

## Technology

| Area | Technologies |
|---|---|
| Backend | C#, ASP.NET Core Web API (.NET 8+), Entity Framework Core |
| Database | PostgreSQL 16 |
| Frontend | React 18, TypeScript, Vite, TanStack Query |
| Runtime | Docker Compose, Nginx |
| Backend tests | xUnit, ASP.NET Core integration testing, Testcontainers for PostgreSQL |
| Frontend tests | Vitest |

## Run with Docker Compose

Docker Engine and the Docker Compose plugin are the only runtime prerequisites. This is the recommended way to run and review the complete project.

From the repository root, create the environment file and start the services:

```bash
cp .env.example .env
docker compose up --build
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

If `.env` already exists, skip the copy command. Docker Compose starts PostgreSQL, the backend API, and the frontend. The backend connects to PostgreSQL through the internal Docker service name. The frontend is served by Nginx.

Open the application and service endpoints:

| Service | URL |
|---|---|
| Admission portal | <http://localhost:5173> |
| Backend API | <http://localhost:8080> |
| Swagger UI | <http://localhost:8080/swagger> |
| Health check | <http://localhost:8080/health> |

The frontend's API base URL is supplied at container startup through `API_BASE_URL`. The default value is `http://localhost:8080`; it can be changed in the Compose environment without rebuilding the frontend image.

### Configuration

Set the temporary seat-hold duration in `.env`:

```env
HOLD_DURATION_SECONDS=600
```

The default is **600 seconds (10 minutes)**. Expired holds release their seats automatically.

### Stop the services

```bash
docker compose down
```

The PostgreSQL data volume is retained, so classes and applications remain when the stack is started again. To remove the database data as well, run the following destructive command:

```bash
docker compose down -v
```

### Rebuild the frontend

After changing frontend code, rebuild and recreate its container:

```powershell
docker compose up -d --build --force-recreate frontend
```

Then open <http://localhost:5173> and hard-refresh with `Ctrl+F5` if the browser still displays an older build.

## Workflows

### Student / guardian

1. Open the portal and enter the student's 17-digit birth registration number.
2. Choose a class/shift with available seats and select **Apply now**.
3. The system creates a temporary `HELD` application and displays its expiry countdown in **My applications**.
4. Select **Pay admission fee** before the hold expires. Payment is simulated; a successful action changes the application to `CONFIRMED`. No payment gateway is connected.
5. An active hold can be cancelled before confirmation, releasing the seat.

The student number is stored in the browser's local storage so the student can view their applications again after refreshing the page on the same device. It is an identifier, **not an authentication mechanism**.

### School admin

Open **School admin**, enter a class/shift name and seat capacity, and publish the class. Each class/shift is a separate admission group with its own capacity; for example, `Class 6 - Morning Shift` and `Class 6 - Day Shift` are separate records.

The assignment states that login is not required and does not define an administrator authentication contract. Accordingly, the take-home implementation leaves the admin screen and class-creation endpoint without admin authentication. This is an assignment-scope decision, **not a production security model**. A real deployment should protect administrative operations with authentication and role-based authorization.

## API contract

Base URL: <http://localhost:8080>

Requests and responses use JSON with camelCase fields, except successful `DELETE` requests, which return HTTP `204` with no response body.

| Method | Path | Required header | Description |
|---|---|---|---|
| `POST` | `/classes` | — | Create a class/shift |
| `GET` | `/classes` | — | List classes with seat counts |
| `GET` | `/classes/{classId}` | — | Get a class and its seat counts |
| `POST` | `/classes/{classId}/holds` | `X-Student-Id` | Create a temporary seat hold |
| `GET` | `/holds/{holdId}` | — | Get an application's current status |
| `POST` | `/holds/{holdId}/confirm` | `X-Student-Id` | Confirm a held application |
| `DELETE` | `/holds/{holdId}` | `X-Student-Id` | Cancel a held application |
| `GET` | `/me/holds` | `X-Student-Id` | List the identified student's applications |

### Create a class

```http
POST /classes
Content-Type: application/json
```

```json
{
  "name": "Class 6 - Morning Shift",
  "totalSeats": 120
}
```

Example response (`201 Created`):

```json
{
  "id": "c_4e6f...",
  "name": "Class 6 - Morning Shift",
  "totalSeats": 120
}
```

### Reserve a seat

```http
POST /classes/{classId}/holds
X-Student-Id: 20152691234567890
```

Example response (`201 Created`):

```json
{
  "holdId": "h_6f9a...",
  "classId": "c_4e6f...",
  "studentId": "20152691234567890",
  "status": "HELD",
  "expiresAt": "2026-11-09T10:10:00Z"
}
```

### Example class list response

```json
[
  {
    "id": "c_4e6f...",
    "name": "Class 6 - Morning Shift",
    "totalSeats": 120,
    "heldSeats": 15,
    "confirmedSeats": 80,
    "availableSeats": 25
  }
]
```

### Error responses

Errors use `application/problem+json` with a readable `detail` field. Expected responses include:

- `400 Bad Request` — invalid input, including an invalid student ID.
- `404 Not Found` — unknown class or application.
- `409 Conflict` — business conflicts such as no seats remaining, an expired hold, or a duplicate active application.

## Seat allocation and concurrency

Seat allocation is protected by a PostgreSQL transaction that acquires a `SELECT ... FOR UPDATE` lock on the selected class row. API processes sharing the same PostgreSQL database therefore coordinate through the database lock rather than relying on process-local locking.

A partial unique index on `(ClassId, StudentId)` for `HELD` and `CONFIRMED` applications also prevents a student from holding or confirming more than one active application for the same class.

A hosted worker checks for expired holds every second. The API also expires stale holds during relevant reads and before allocating a new seat. Only non-expired `HELD` applications and `CONFIRMED` applications count as occupied seats.

## Automated tests

### Backend

Prerequisites: .NET 8+ SDK and Docker running. Testcontainers starts a disposable PostgreSQL container for the integration tests.

```bash
cd backend
dotnet test SchoolAdmission.Tests/SchoolAdmission.Tests.csproj
```

The backend suite contains 10 integration tests covering class creation, invalid input, student ID validation, duplicate applications, full classes, cancellation, ownership protection, expiration, repeat-confirm idempotency, and concurrency. The concurrency test sends 60 simultaneous reservations to a class with 6 seats; exactly 6 should succeed and the remaining requests should receive HTTP `409 Conflict`.

### Frontend

```bash
cd frontend
npm install
npm test
npm run build
```

The frontend suite contains 17 tests covering student-number validation, countdown formatting, admission rendering, reservation states, and the admin view.

### Optional multi-instance concurrency demonstration

The Compose file includes a second API service under the `multi-instance` profile. Both API instances use the same PostgreSQL database.

Start the services:

```bash
docker compose --profile multi-instance up --build
```

Then, from Git Bash or WSL, run:

```bash
bash scripts/verify-multi-instance.sh
```

The script creates a test class with 8 seats and sends 80 simultaneous requests across ports `8080` and `8081`. It verifies that exactly 8 reservations return HTTP `201` and the other 72 return HTTP `409`. The test class and applications remain in the database until removed or the database volume is reset.

## Local development

The Docker workflow above is the expected assignment/demo workflow. For local development, use either an existing PostgreSQL installation or the PostgreSQL service from Docker Compose.

### Prerequisites

- .NET 8+ SDK
- Node.js 20+ and npm
- PostgreSQL 16 or compatible, unless using the Docker database

### Option A: use a local PostgreSQL instance

Create a database named `school_admission`, then set the connection string in PowerShell. Replace the placeholder with your local PostgreSQL password; do not commit credentials.

```powershell
$env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5432;Database=school_admission;Username=postgres;Password=<your-local-postgres-password>"
```

Run the backend in one terminal:

```powershell
cd backend\SchoolAdmission.Api
dotnet restore
dotnet run
```

Run the frontend in a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The local frontend defaults to the API at `http://localhost:8080`. To use a different API URL, create `frontend/.env` from `frontend/.env.example` and set `VITE_API_BASE_URL`. Open <http://localhost:5173>.

### Option B: use the Docker PostgreSQL service with local app processes

If the Compose API and frontend are running, stop them first because the local processes use the same ports. Then start only the database:

```powershell
docker compose stop backend frontend
docker compose up -d db
docker compose ps db
```

Wait until the database reports `healthy`. Set a connection string using the PostgreSQL credentials configured in `docker-compose.yml`:

```powershell
$env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5432;Database=school_admission;Username=postgres;Password=<compose-postgres-password>"
```

Start the backend and frontend using the commands in Option A. Do not run the Docker backend and local backend at the same time; both use port `8080`.

If another PostgreSQL installation already uses port `5432`, change the database port mapping in `docker-compose.yml` from `5432:5432` to `5433:5432`, restart the database, and use `Port=5433` in the local connection string.

## Repository structure

```text
school-admission-system/
├── backend/
│   ├── SchoolAdmission.Api/
│   └── SchoolAdmission.Tests/
├── frontend/
├── scripts/
├── docker-compose.yml
├── ASSUMPTIONS.md
├── AI_USAGE.md
├── .env.example
└── README.md
```

## Scope and assumptions

- Login is intentionally omitted because the assignment says it is not required.
- `X-Student-Id` identifies a student; it does not authenticate that student.
- Admission-fee payment is simulated. No payment gateway is integrated.
- Admin authentication is not implemented because the assignment does not specify an admin identity or authentication contract. Add authentication and role-based authorization before any real-world deployment.
- EF Core migrations are applied automatically so a fresh Docker environment can initialize without manual database setup.
