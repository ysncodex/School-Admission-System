# School Admission System

A first-come, first-served school admission portal built for the Assistant Software Engineer take-home assignment. The application lets school staff publish class/shift groups and lets guardians reserve a seat temporarily, then simulate fee payment to confirm admission.

## Technology

- **Backend:** C#, ASP.NET Core Web API (.NET 10 LTS), Entity Framework Core 10
- **Database:** PostgreSQL 16
- **Frontend:** React 18, TypeScript, Vite, TanStack Query
- **Runtime:** Docker Compose
- **Backend tests:** xUnit, ASP.NET Core integration testing, Testcontainers PostgreSQL
- **Frontend tests:** Vitest

## Run the entire project with Docker

Docker Engine and the Docker Compose plugin are the only runtime prerequisites.

```bash
# From the repository root
cp .env.example .env
docker compose up --build
```

Open these URLs:

| Service | URL |
|---|---|
| Admission portal | http://localhost:5173 |
| Backend API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger |
| Health check | http://localhost:8080/health |

The frontend is served through Nginx. Its API base URL is injected at container startup using `API_BASE_URL`, so it can be changed without rebuilding the frontend image. The default Compose value is `http://localhost:8080`.

To change the seat-hold duration, edit `.env`:

```env
HOLD_DURATION_SECONDS=600
```

The default is 600 seconds (10 minutes).

Stop the services:

```bash
docker compose down
```

The PostgreSQL data volume is retained. Starting the project again with `docker compose up` will preserve classes and applications. To remove the database contents as well, use `docker compose down -v` (destructive).

## Local development without Docker

### Backend

Prerequisites: .NET 10 SDK and PostgreSQL 16 or compatible.

```bash
cd backend/SchoolAdmission.Api
dotnet restore
dotnet run
```

Configure the connection string using `ConnectionStrings__DefaultConnection` or update `appsettings.json`. The API listens on `http://localhost:8080` when using the supplied launch profile.

### Frontend

Prerequisites: Node.js 20+ and npm.

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The Vite development server runs on http://localhost:5173. `VITE_API_BASE_URL` controls the API base URL for local frontend development.

## Student workflow

1. Open the portal and enter the student's 17-digit birth registration number.
2. Choose a class/shift with available seats and select **Apply now**.
3. The backend creates a temporary `HELD` application. The expiry countdown appears in **My applications**.
4. Select **Pay admission fee** before expiry. This simulates successful payment and changes the application to `CONFIRMED`; no real payment gateway is used.
5. A student can cancel an active hold before confirmation. The released seat becomes available to other applicants.

The student number is stored in browser local storage so application history remains available after refresh on that device. This is identification only, not authentication.

## School admin workflow

Open **School admin**, enter a class/shift name and seat capacity, and publish it. A class/shift is a separate admission group; for example, `Class 6 - Morning Shift` and `Class 6 - Day Shift` are separate records with separate capacities.

The assignment does not specify an admin authentication contract, so this take-home implementation keeps the admin screen open. This should be replaced with authenticated, role-protected access in a real school deployment.

## API contract

Base URL: `http://localhost:8080`

All requests and responses use JSON, except the successful DELETE response, which is HTTP 204 with no body. JSON uses camelCase fields.

| Method | Path | Header | Description |
|---|---|---|---|
| POST | `/classes` | — | Create a class/shift |
| GET | `/classes` | — | List classes with seat counts |
| GET | `/classes/{classId}` | — | Get one class and its seat counts |
| POST | `/classes/{classId}/holds` | `X-Student-Id` | Create a temporary seat hold |
| GET | `/holds/{holdId}` | — | Get an application's current status |
| POST | `/holds/{holdId}/confirm` | `X-Student-Id` | Confirm a held application |
| DELETE | `/holds/{holdId}` | `X-Student-Id` | Cancel a held application (204) |
| GET | `/me/holds` | `X-Student-Id` | List this student's applications |

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

Example response (201):

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

Example response (201):

```json
{
  "holdId": "h_6f9a...",
  "classId": "c_4e6f...",
  "studentId": "20152691234567890",
  "status": "HELD",
  "expiresAt": "2026-11-09T10:10:00Z"
}
```

### List classes

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

Errors use `application/problem+json`, with a readable `detail` field. Expected business conflicts (for example, no seats remaining, expired hold, duplicate active application) return HTTP 409. Invalid student IDs return HTTP 400. Unknown classes/applications return HTTP 404.

## Concurrency and seat safety

Seat allocation is protected by a PostgreSQL transaction and a `SELECT ... FOR UPDATE` lock on the selected class row. Every backend process sharing the same PostgreSQL database uses the same database lock, so the critical section is not limited to one API process. A partial unique index on `(ClassId, StudentId)` for `HELD` and `CONFIRMED` applications additionally prevents duplicate active applications for the same student and class.

A hosted worker expires stale holds every second. The API also expires stale holds during relevant reads and before allocating a new seat. A seat is occupied only by a non-expired `HELD` application or a `CONFIRMED` application.

## Automated tests

### Backend

Prerequisites: .NET 10 SDK and Docker running (Testcontainers starts a disposable PostgreSQL container).

```bash
cd backend
dotnet test SchoolAdmission.Tests/SchoolAdmission.Tests.csproj
```

The backend suite covers class creation, repeat-confirm idempotency, student ID validation, and a concurrency test that sends 60 simultaneous reservations to a class with 6 seats. Exactly 6 should succeed and the rest should receive HTTP 409.

### Optional multi-process concurrency demonstration

The Compose file includes a second independent API service in the `multi-instance` profile. Both API containers connect to the same PostgreSQL database:

```bash
docker compose --profile multi-instance up --build
```

In another terminal, run:

```bash
bash scripts/verify-multi-instance.sh
```

The script creates a test class with 8 seats and sends 80 simultaneous requests split across ports 8080 and 8081. It verifies that exactly 8 reservations return HTTP 201 and the other 72 return HTTP 409. The test class and applications remain in the database until manually removed or the volume is reset.

### Frontend

```bash
cd frontend
npm install
npm test
npm run build
```

The frontend suite covers student-number validation and countdown formatting.

## Repository layout

```text
school-admission-system/
├── backend/
│   ├── SchoolAdmission.Api/
│   └── SchoolAdmission.Tests/
├── frontend/
├── docker-compose.yml
├── ASSUMPTIONS.md
├── AI_USAGE.md
└── README.md
```

## GitHub submission preparation

After reviewing and running the project, create a **public** repository on your GitHub account. Do not add the assignment PDF to the repository. A component-based commit sequence is preferable to one final bulk commit:

```bash
git init -b master
git add backend/SchoolAdmission.Api backend/SchoolAdmission.Tests
git commit -m "feat: implement admission API and concurrency-safe reservations"

git add frontend
git commit -m "feat: build student admission and school admin portal"

git add docker-compose.yml backend/Dockerfile frontend/Dockerfile scripts README.md ASSUMPTIONS.md AI_USAGE.md .gitignore .dockerignore .env.example
# Include the backend/frontend .dockerignore files too.
git add backend/.dockerignore frontend/.dockerignore
git commit -m "chore: add Docker workflows, verification scripts, and project docs"

git remote add origin <your-public-github-repository-url>
git push -u origin master
```

Review the final repository and run the project again before submitting its GitHub URL through the assignment's submission link. Do not commit or share the confidential assignment PDF.

## Important scope notes

- Login is intentionally not implemented because the assignment says it is not required.
- The student registration number is an identifier, not a secure authentication factor.
- The fee payment is simulated; no payment provider is connected.
- The admin screen is not protected because the assignment does not define an admin identity or authentication flow.
- The API applies versioned EF Core migrations automatically so a fresh Docker environment starts without manual setup. Admin access should be protected with authentication and authorization in a real school deployment.
