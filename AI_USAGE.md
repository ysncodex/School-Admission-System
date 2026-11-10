# AI Usage Disclosure

AI assistance was used during the development of this take-home project. This disclosure identifies the tool used, the parts where it assisted, the omissions found during review, and the verification still required.

## 1. AI tool used

- **ChatGPT (OpenAI):** used for requirements analysis, architecture planning, code scaffolding and drafting, frontend implementation assistance, Docker configuration, documentation, and test-case design.

## 2. Areas where AI assistance was used

- Breaking down the supplied School Admission System assignment into backend, frontend, business-rule, testing, Docker, and submission tasks.
- Drafting the .NET 10 / ASP.NET Core Web API, Entity Framework Core, and PostgreSQL structure.
- Drafting the reservation workflow, PostgreSQL row-locking approach, partial unique index, and hold-expiration worker.
- Drafting React + TypeScript screens, request helpers, student-number validation, polling, countdown display, and error states.
- Drafting Dockerfiles, Docker Compose configuration, the multi-process verification script, README.md, ASSUMPTIONS.md, and automated test scaffolding.

## 3. Omissions found during review and how they were detected

- **UI acceptance criteria were not fully recorded in the first assumptions draft.** The initial documentation focused on API and database decisions but did not explicitly list all of the UI behaviours required by the assignment, including automatic seat-count refresh, expiry display without a page reload, disabling the fee action after expiry, restoring the student's applications after refresh, and showing readable error states. I detected this by comparing the draft line by line with the UI requirements on page 4 of the assignment. I added these behaviours to the revised `ASSUMPTIONS.md` and checked the frontend source for the corresponding polling, countdown, local-storage, and error-state logic. This was a documentation omission; it is not a claim that a runtime defect was found.
- **The first AI-usage draft did not explain any AI omissions or how they were checked.** I detected that disclosure gap by reviewing the submission checklist on page 5, which specifically asks for the AI tool, the parts where it was used, and where AI made mistakes and how those were identified. I added this section and described the confirmed documentation omission rather than inventing an unverified code defect.
- **Generated source code is not the same as a verified build.** The generation environment did not have the .NET SDK or Docker installed, and frontend dependency installation could not be completed there. I detected this by checking the available toolchain and attempting the relevant validation steps. Therefore, I have not represented `dotnet test`, `docker compose up`, the multi-process demonstration, or the frontend production build as successfully executed in that environment. These checks must be run locally before final submission. No additional functional AI-generated defect is claimed here without a reproducible test result.

## 4. Human review and responsibility

- I am responsible for reviewing the generated code, understanding the reservation and concurrency logic, checking that the implementation matches the assignment's exact API contract, and running the required tests.
- I will correct any compiler, test, or runtime issue found during local verification and update this disclosure with the actual issue and correction when one is confirmed.
- I will not describe a test as passing unless I have run it and observed the result. I should be able to explain the architecture, assumptions, concurrency protection, and test results during an interview.
