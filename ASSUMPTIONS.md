# Assumptions and Implementation Decisions

This document records decisions made where the assignment brief leaves implementation details open. It also records how the explicit business and UI requirements are handled.

## 1. Student identity

- A student is identified by the `X-Student-Id` request header. The UI asks for the student's birth registration number and uses it as this identifier.
- The value must contain exactly 17 ASCII digits, matching the 17-digit birth-registration-number requirement in the brief.
- The browser stores the entered value in local storage on that device so a refresh or browser restart does not lose the student's application history.
- This value is an identifier, not authentication. The brief explicitly says login is not required; possession of the number alone must not be treated as secure proof of identity in a production system.

## 2. Classes, shifts, and identifiers

- Each class record represents one admission group, including one shift. For example, `Class 6 - Morning Shift` and `Class 6 - Day Shift` are separate records with independent seat capacities.
- Class IDs use the `c_` prefix and application/hold IDs use the `h_` prefix, followed by a GUID without separators. The prefixes follow the examples in the brief; the exact ID format is an implementation choice.
- Class names and total seat counts are supplied by the school-admin UI. The API validates that a class has a non-empty, usable name and a positive seat capacity.

## 3. Hold lifetime and expiration

- A newly created hold expires at `CreatedAt + HOLD_DURATION_SECONDS`.
- `HOLD_DURATION_SECONDS` is read from backend configuration. The default is 600 seconds (10 minutes). A missing, invalid, or non-positive value falls back to 600 seconds; a configured value is limited to a maximum of 86,400 seconds (24 hours) to avoid accidentally reserving seats for an excessive period.
- Application timestamps are stored and compared in UTC.
- A hosted background worker checks for expired holds every second and changes overdue `HELD` applications to `EXPIRED`. Expiration is also applied during relevant API operations, so a seat does not depend on a student making another request to become available after the deadline.
- The API returns an expired status when an individual hold is fetched after its deadline. The confirm endpoint cannot confirm an expired hold and returns HTTP 409 after persisting the `EXPIRED` state.
- The UI counts down locally using the server-provided `expiresAt` value. When the countdown reaches zero, it displays `EXPIRED`, disables the fee-confirmation action, and refreshes the application data.

## 4. Duplicate applications and cancellation

- A student may have no more than one `HELD` or `CONFIRMED` application for a given class at a time. This means a student cannot hold a second seat in that class while an earlier hold or confirmed admission exists.
- An `EXPIRED` or `CANCELLED` application remains in the student's history but does not block a later application, provided a seat is available.
- A student cannot confirm or cancel another student's application. For an application that belongs to another student, the API returns 404 rather than exposing its details.
- Cancelling a `HELD` application changes it to `CANCELLED`; the seat is released. DELETE is idempotent for an already `EXPIRED` or `CANCELLED` application and returns HTTP 204.
- A `CONFIRMED` application cannot be cancelled through the supplied endpoint and returns HTTP 409. The brief does not define a post-confirmation cancellation or refund workflow.
- Repeated confirmation of the same application is idempotent and returns `CONFIRMED` without counting the seat again.

## 5. Seat allocation and concurrency

- A seat is occupied when its application status is `HELD` and its expiration time is still in the future, or when its status is `CONFIRMED`.
- Seat counts are calculated from application records. `availableSeats` is `totalSeats - heldSeats - confirmedSeats`.
- Creating a hold, confirming a hold, and cancelling a hold take a PostgreSQL row lock on the relevant class row inside a database transaction. This serializes seat-changing operations for that class across independent API processes connected to the same database; an in-memory application lock would not provide this guarantee.
- A PostgreSQL partial unique index on `(ClassId, StudentId)` for `HELD` and `CONFIRMED` provides a database-level duplicate-application guard in addition to the service-level check.
- Seat counters are not maintained as mutable, denormalized values; they are derived from the application records.
- For the optional multi-process bonus, the repository provides a Compose profile that starts a second API process against the same PostgreSQL database and a script that splits concurrent requests between the two API ports. The expected result is that successful holds never exceed the class capacity. The demonstration script must be run in the target Docker environment before claiming that the bonus has been verified.

## 6. School-admin access and payment

- The brief requires class creation from a school-admin UI but does not define an admin login, role, or authentication contract. The class-management screen and class-creation endpoint are therefore available without authentication for this take-home scope. This is a documented scope assumption, not a production security recommendation.
- The `Pay admission fee` action simulates a successful payment and confirms the hold. No payment gateway or real money movement is integrated because the brief explicitly says a real payment gateway is not required.

## 7. API contract and HTTP behaviour

- The API uses the specified base URL, `http://localhost:8080`, and exposes the eight paths exactly as written in the assignment, without an additional `/api` prefix.
- `X-Student-Id` is required for `POST /classes/{classId}/holds`, `POST /holds/{holdId}/confirm`, `DELETE /holds/{holdId}`, and `GET /me/holds`.
- `GET /holds/{holdId}` does not require `X-Student-Id` because the assignment's endpoint contract does not specify that header for this route.
- The API preserves the request and response field names shown in the assignment. Additional response fields may be added only when useful; the specified fields must not be removed or renamed.
- Invalid input returns a 4xx response with a readable error payload. Expected business conflicts, such as no available seats, an expired hold, or a duplicate active application, return HTTP 409. Unexpected server errors return a generic 500 response; technical details are logged server-side and are not exposed to the browser.

## 8. UI behaviour required by the brief

- Normal school-admin and guardian workflows are available through the React UI; users are not expected to use Postman or access the database directly.
- The class list refreshes automatically every four seconds so seat availability changes appear without a manual page reload.
- The student's application list refreshes automatically every three seconds. The hold countdown updates every second.
- When a hold expires, the UI shows `EXPIRED` without requiring a page reload and disables the `Pay admission fee` action.
- The student's entered registration number is retained in local storage so the student's applications can be restored after a page refresh or browser restart on the same device.
- Loading, empty, and error states are presented in the UI. Recoverable API errors include a readable message and a retry path rather than leaving the user on a blank page.

## 9. Database initialization and persistence

- The API applies the checked-in, versioned EF Core migration at startup after PostgreSQL becomes healthy.
- Docker Compose uses a named PostgreSQL volume. Application data is retained across container restarts and `docker compose down` followed by `docker compose up`; removing the volume with `docker compose down -v` is destructive and deletes the database data.
- The admin endpoints should be protected by authentication and authorization before a real school deploys this application.

## 10. Tests and submission decisions

- The backend test project includes API tests for class creation, repeated-confirm idempotency, 17-digit student ID validation, and concurrent seat allocation. The concurrency test sends simultaneous requests to a class with a limited capacity and checks that successful holds do not exceed that capacity.
- Frontend automated tests cover the student-number validation and countdown-formatting helpers. These tests and the optional multi-process demonstration must be executed in an environment with the required .NET, Node.js, and Docker tooling before their results are reported as passing.
- The final project is intended for a public GitHub repository with meaningful commit history. The confidential assignment PDF must not be committed or shared publicly.
