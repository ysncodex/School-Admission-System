# Assumptions and implementation decisions

This document records choices made where the assignment brief leaves implementation details open.

## 1. Student identity

- A student is identified by the `X-Student-Id` request header.
- The value must be exactly 17 ASCII digits, matching the birth-registration-number description in the brief.
- The browser stores the entered value in local storage on that device so a refresh or browser restart does not lose access to the student's application history. It is not treated as authentication; the brief explicitly says login is not required.

## 2. Class and application identifiers

- Class IDs use the `c_` prefix and application/hold IDs use the `h_` prefix, followed by a GUID. This follows the examples in the brief while keeping IDs opaque.
- Each class/shift is a distinct record with its own seat capacity. A school can create more than one shift for the same grade by creating separate class records.

## 3. Hold lifetime

- A newly created hold expires at `CreatedAt + HOLD_DURATION_SECONDS`.
- `HOLD_DURATION_SECONDS` is read from the backend environment; the default is 600 seconds. Values below 1 fall back to the default, and unusually large values are capped at 24 hours.
- All application timestamps are stored and compared in UTC.
- A hosted background worker checks for expired holds every second and changes `HELD` to `EXPIRED`. The API also expires stale holds during relevant reads and reservation attempts, so expiry does not depend only on the worker.
- An expired hold cannot be confirmed. The confirm endpoint responds with HTTP 409 after persisting the `EXPIRED` state.

## 4. Duplicate applications and cancellation

- A student may have at most one `HELD` or `CONFIRMED` application for a given class at a time. An expired or cancelled application does not block a later application, if seats remain.
- A student cannot confirm or cancel another student's application. For an application that belongs to another student, the API returns 404 to avoid exposing its details.
- Cancelling a `HELD` application changes it to `CANCELLED`; the seat is released. DELETE is idempotent for an already `EXPIRED` or `CANCELLED` application and returns 204.
- A `CONFIRMED` application cannot be cancelled through the supplied endpoint and returns HTTP 409.
- Repeated confirmation of the same application is idempotent and returns `CONFIRMED` without incrementing seat usage again.

## 5. Seat allocation and concurrency

- A seat is occupied when its application status is `HELD` and its expiration time is in the future, or when its status is `CONFIRMED`.
- Available seats are calculated as `TotalSeats - HeldSeats - ConfirmedSeats`.
- Every operation that allocates, confirms, or cancels a seat takes a PostgreSQL row lock on the relevant class row inside a database transaction. This serializes allocation across separate backend processes that share the same database.
- A PostgreSQL partial unique index on `(ClassId, StudentId)` for `HELD` and `CONFIRMED` provides a database-level duplicate guard as a second line of defence.
- No seat counters are stored as mutable denormalized values; they are derived from application records.

## 6. Admin access and payment

- The brief requires school-admin class creation from the UI but does not define a login, role, or authentication contract. The class-management screen is therefore available without authentication for this take-home scope. This is a documented scope assumption, not a production security recommendation.
- The “Pay admission fee” action simulates successful payment and confirms the hold. No payment gateway or real money movement is integrated, as explicitly permitted by the brief.

## 7. HTTP behaviour

- API routes are exposed at the specified paths from the base URL `http://localhost:8080` without an additional `/api` prefix.
- `GET /holds/{holdId}` does not require `X-Student-Id` because the supplied contract does not specify that header for this route. Student-specific actions and `/me/holds` do require the header.
- Invalid input returns a 4xx response with a readable Problem Details payload. Unexpected server errors return a generic 500 message; technical details are logged on the server and are not exposed to the browser.

## 8. Database initialization

- The API applies the checked-in EF Core migration automatically after PostgreSQL becomes healthy. The named Docker volume persists records across container restarts and `docker compose down` / `docker compose up`.
- The admin endpoints should be protected by authentication and authorization before a real school deploys this application.
