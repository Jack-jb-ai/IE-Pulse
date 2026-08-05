# IE Baseline Progress

## 2026-08-05 - RBAC Route Access and Approval UX Cleanup

Implemented the IE Baseline frontend RBAC pass using
`role_system_module_access` view permissions from the backend.

### Updated

- Added frontend route access handling for IE Baseline routes using the
  backend-provided system module list.
- Direct route access now checks granted `system_module_master.route_path`
  entries through `can_view` permissions.
- IE Baseline sidebar items are filtered by the same route access data.
- Added support for composite sidebar nav access, so the `Approvals` nav item
  can show when the user can access either:
  - `/iebaseline/approvals/inbox`
  - `/iebaseline/approvals/my-submissions`
- The `Approvals` sidebar item prefers Inbox when granted, otherwise falls
  back to My Submissions.
- Approval page tabs are now filtered by route access, so users without inbox
  permission no longer see the `Approval Inbox` tab.
- Approval list queries are permission-gated so denied tabs do not trigger
  their backend API calls.
- Added `current_user_id` query params to protected IE Baseline API wrappers
  that need the resolved actor ID.
- Wired the resolved IE Baseline user ID through:
  - assignment management protected calls,
  - user management protected calls,
  - learner attempt question load/save/clear/submit calls.
- Kept approval review APIs unchanged because they already pass reviewer actor
  fields.
- Removed deprecated `dev/admin` from frontend fallback roles.

### Verified

- Ran focused IE Baseline tests:

```powershell
npm test -- --run src/pages/iebaseline/access.test.ts src/pages/iebaseline/api.test.ts src/pages/iebaseline/Approvals.test.ts
```

- Result: 3 test files passed, 13 tests passed.
- Ran `npm run build:iebaseline`.
- The sandboxed test/build attempts hit the known Windows Vite `spawn EPERM`
  while loading config.
- The same commands passed when rerun with approval for Vite/Node subprocess
  spawning.

## 2026-08-05 - Approval Module Frontend

Implemented the frontend approval workflow for submitted checklist attempts
using the live backend approval APIs.

### Updated

- Added approval routes:
  - `/iebaseline/approvals/my-submissions`
  - `/iebaseline/approvals/inbox`
  - `/iebaseline/approvals/:approvalId/review`
- Added the IE Baseline sidebar item `Approvals`.
- Added `Approvals.tsx` with My Submissions and Approval Inbox views.
- Approval lists show module, learner, approver, attempt number, approval
  status, submitted/completed dates, remarks, and score when released by the
  backend.
- Inbox supports an actionable filter for `PENDING` and `IN_PROGRESS` requests,
  plus explicit status filters.
- Extended `src/pages/iebaseline/api.ts` with typed approval API wrappers for
  listing, starting review, loading review detail, updating answers, and final
  approve/reject decisions.
- Updated result status typing to support both legacy result statuses and the
  approval workflow statuses:

```text
Pending
Passed
Failed
PENDING
IN_PROGRESS
APPROVED
REJECTED
CANCELLED
```

- Extended `ExamModal` so the same question/review UI now supports:
  - learner editable attempt mode,
  - learner read-only review mode,
  - approver editable review mode.
- Approver review loads `GET /approvals/{approval_id}/review`, starts pending
  reviews with `POST /approvals/{approval_id}/start`, lets the approver edit
  selected answers, shows evidence attachments read-only, captures reviewer
  remarks, and completes the workflow with approve/reject actions.
- Updated final results so pending approval attempts show waiting-for-approval
  messaging instead of treating a hidden score as a normal scored result.

### Verified

- Functional approval workflow checks passed with the live backend.
- Ran `npm run build:iebaseline`.
- The sandboxed build hit the known Windows Vite `spawn EPERM` while loading
  config.
- The same build passed when rerun with approval for Vite/Node subprocess
  spawning.

## 2026-08-04 - Submit Validation Question Number

Updated the IE Baseline submit validation flow to use the backend-provided
exam-facing question number for missing attachment and unanswered question
dialogs.

### Updated

- Backend now supports `baseline_checklist.question_num` as the per-module
  exam question number.
- `question_num` is populated independently per `module_id`, ordered by
  `baseline_checklist.id ASC`.
- Submit validation responses can now include `question_num` for both
  `UNANSWERED_QUESTIONS` and `REQUIRED_ATTACHMENTS_MISSING`.
- Frontend validation types now accept optional `question_num`.
- The submit validation dialog now displays question labels using:

```text
question_num -> question_no -> loaded questionNo -> question_id
```

- Added `question-num-backend-request.md` as the backend handoff/reference note
  for the requested database and API behavior.

### Verified

- Ran `npm run build:iebaseline`.
- The sandboxed build hit the known Windows Vite `spawn EPERM` while loading
  config.
- The same build passed when rerun with approval for Vite/Node subprocess
  spawning.

## 2026-07-31 - User Management Frontend and Backend Contract

Implemented the IE Baseline User Management frontend and documented the
backend APIs needed for a smooth create/update/delete workflow.

### Updated

- Added `/iebaseline/users` and the IE Baseline sidebar item `User Management`.
- Added `UserManagement.tsx` with Create User, Update User, and Delete User
  tabs.
- Create and Update forms support `name`, `position`, `wd_id`, `email`,
  `department`, `role_id`, and `reports_to`.
- Added searchable user selectors for update/delete and searchable
  `reports_to` selection using name, WD ID, and email.
- Update mode excludes the edited user from the `reports_to` manager search.
- Delete mode loads a delete preview before confirmation and still handles
  backend `409 Conflict` delete failures.
- Extended `src/pages/iebaseline/api.ts` with typed wrappers for user search,
  full user profile lookup, create, update, delete, delete preview, and roles.
- Updated `/iebaseline/developer-docs` and
  `src/pages/iebaseline/doc/developer-doc.md` with the User Management route,
  page behavior, API calls, and data flow.
- Updated `src/pages/iebaseline/doc/api-reference.md` with the required
  backend contract for:
  - `GET /api/iebaseline/users/search`
  - `GET /api/iebaseline/users/{user_id}`
  - `GET /api/iebaseline/roles`
  - `GET /api/iebaseline/users/{user_id}/delete-preview`

### Backend Requirements

- Existing dedicated write APIs remain required:
  - `POST /api/iebaseline/users/create`
  - `PUT /api/iebaseline/users/{user_id}`
  - `DELETE /api/iebaseline/users/{user_id}`
- Implement server-side user search across `name`, `wd_id::text`, and `email`
  with optional `limit` and `exclude_user_id`.
- Implement full profile lookup so Update User can preserve fields that are not
  returned by the assignment-oriented `GET /users` endpoint.
- Implement roles lookup from `role_master`; the frontend has seeded fallback
  labels only for development resilience.
- Implement delete preview with related counts and blocking reasons so users can
  understand delete risk before confirmation.

### Verified

- Ran `npm run build:iebaseline`.
- The sandboxed build hit the known Windows Vite `spawn EPERM` while loading
  config.
- The same build passed when rerun with approval for Vite/Node subprocess
  spawning.

## 2026-07-31 - Removed Demo User Fallback and Added Staging Override

Removed the unsafe IE Baseline demo-user fallback and added an explicit
staging-only user ID override.

### Updated

- Removed the hardcoded user ID fallback from the IE Baseline frontend API
  client.
- IE Baseline API helpers now require explicit `userId` arguments for learner
  home, attempts, and attachment calls.
- Added `VITE_IEBASELINE_USER_ID_OVERRIDE` support in
  `useIEBaselineCurrentUser`.
- When the override is set to a valid positive integer, the hook returns that
  value as `ieBaselineUserId`, skips current-user resolution, and does not block
  on missing AD email.
- Normal behavior is unchanged when the override is absent: AD email is required
  and `POST /api/iebaseline/users/resolve-current` resolves the runtime DB user.

### Verified

- Confirmed no IE Baseline source or docs reference the removed demo-user
  constant or the old user ID fallback language.
- Ran `npm run build:iebaseline`.
- Ran `$env:VITE_IEBASELINE_USER_ID_OVERRIDE='4'; npm run build:iebaseline`.
- Both builds passed when run with approval for Vite/Node subprocess spawning.

## 2026-07-31 - Answer Shell and Attachment Frontend Wiring

Implemented the frontend side of the IE Baseline answer-shell and attachment
contracts.

### Updated

- Expanded IE Baseline frontend API types for backend-provided answer shells:
  `answerId`, `isAttached`, `attachmentRequirement`, and
  `attachmentApprovalRequired`.
- Preserved backend `answerId` and `isAttached` values after save and clear
  answer responses.
- Added defensive exam-modal handling for in-progress questions missing
  `answer.answerId`; the frontend shows an error and blocks answer controls
  instead of inventing an ID.
- Added module attachment API wrappers for list, upload, delete, and download
  URL creation.
- Added attachment UI in `ExamModal` for questions where
  `attachmentRequirement` is `required` or `optional`.
- Attachment upload now uses the current question's existing
  `answer.answerId` and operates independently from the Next Question button.
- Attachment delete refreshes the attachment list and attempt questions so
  backend-maintained `isAttached` remains authoritative.
- Finish Checklist now handles structured backend validation errors such as
  `REQUIRED_ATTACHMENTS_MISSING` and lets the learner navigate back to the
  returned questions.

### Verified

- Ran `npm run build:iebaseline`.
- The sandboxed build hit the known Windows Vite `spawn EPERM` while loading
  config.
- The same build passed when rerun with approval for Vite/Node subprocess
  spawning.

## 2026-07-31 - Current User Resolution Contract and Frontend Wiring

Replaced the learner-facing IE Baseline demo-user flow with a runtime
current-user resolution flow.

### Updated

- Added frontend support for resolving the signed-in AD user into an IE Baseline
  `user_master.user_id`.
- Added `POST /api/iebaseline/users/resolve-current` to
  `src/pages/iebaseline/doc/api-reference.md` as the backend implementation
  contract.
- Added `useIEBaselineCurrentUser`, which:
  - reads shared AD profile data from `useCurrentUser()`,
  - requires `user.email` as the lookup/create key,
  - calls `ieBaselineApi.users.resolveCurrent(...)`,
  - exposes the runtime `ieBaselineUserId`.
- Updated learner flows to use the resolved runtime user ID instead of the demo
  user ID:
  - learner home dashboard,
  - module overview,
  - final results,
  - exam start/resume/review history,
  - attachment list/upload/delete/download.
- Updated Assign Modules so `assignee_id` uses the resolved current IE Baseline
  user ID.

### Backend Requirements

- Implement `POST /api/iebaseline/users/resolve-current`.
- Look up `user_master` by `email`.
- If present, return the existing `user_id` and update only AD-sourced profile
  fields: `name`, `position`, `department`, and `updated_at`.
- If absent, insert a new user with:
  - `role_id = 1`,
  - `reports_to = null`,
  - `wd_id = null`,
  - AD-provided `name`, `email`, `position`, and `department`.
- Preserve existing `role_id`, `reports_to`, and `wd_id` for returning users.
- Make first-time user creation idempotent with the unique
  `user_master.email` constraint.

### Failure Handling

- IE Baseline waits for AD current-user data before learner API calls.
- If AD returns no email, learner flows are blocked with a clear error because
  email is the authoritative key.
- If current-user resolution fails, learner API calls are blocked and the error
  is shown in the existing IE Baseline error surfaces.

### Verified

- Ran `npm run build:iebaseline`.
- The build passed when run with approval for Vite/Node subprocess spawning.
- Confirmed learner pages and the exam modal use the runtime resolved user ID.

## 2026-07-24 - Home Page Latest Attempt Progress Contract

Updated the learner home page contract so assignment progress can reflect the
most recent attempt instead of only the stored assignment completion enum.

### Updated

- Frontend home assignment status now supports:

```text
Not Started
In Progress
Completed
```

- Frontend home assignment progress now accepts any numeric percentage from
  `0` to `100`.
- `GET /api/iebaseline/home?user_id={user_id}` is now documented to derive
  progress from the latest `user_exam_attempt` using answered rows in
  `user_exam_answer` where `is_answered = true`.
- The homepage CTA treats an `In Progress` assignment with `0%` progress as
  resumable and shows `Continue Module`.

### Backend Requirements

- Keep `user_checklist_status.status` unchanged as the raw DB enum:

```text
Incomplete
Completed
```

- Do not store `In Progress` in `user_checklist_status.status`; it is a derived
  API/frontend display label.
- The latest attempt always wins for home display, even if an older attempt was
  completed.
- Saved `NA` / `N/A` answers count toward progress when
  `user_exam_answer.is_answered = true`.

### Verified

- Ran `npm run build:iebaseline`.
- The first sandboxed build failed with the known Windows Vite `spawn EPERM`
  while loading config.
- The same build passed when rerun outside the sandbox.

## 2026-07-24 - NA Applicability Scoring Clarification

Verified the IE Baseline checklist NA / non-applicable answer behavior after
backend scoring changes.

### Confirmed

- The frontend saves the full selected option text in `selectedAnswer`, such as:
  - `Yes - Complete BOMs received and shared by customer thru Jabil EC Coordinator team.`
  - `NA - No VA needed for this product.`
- The frontend does not convert selected NA answers to `null`.
- Selected NA answers remain answered. Saved/submitted NA rows should keep
  `is_answered = true`.
- The final score remains backend-owned. The frontend uses backend `attempt.score`
  from submit/latest-result responses.

### Verified Data Issue

- A DB check found current `N/A` scoring options with:

```text
option_value = N/A
score_multiplier = 0.0000
is_applicable = true
```

- With `is_applicable = true`, selected NA answers are scored as
  `0.00 / available_points`, which lowers the final score.
- This is different from exclusion. `score_multiplier = 0` means zero credit
  when the option is still applicable.

### Required Backend/Data Fix

- For NA/N/A options that mean "not applicable", update the matching
  `scoring_metric_option` rows to:

```text
is_applicable = false
```

- After submit, excluded NA answers should store:

```text
selected_answer = "NA - ..."
is_answered = true
score_awarded = NULL
maximum_score = NULL
```

- Other zero-score options such as `No` should stay `is_applicable = true`.

### Optional DB Verification

```sql
SELECT option_value, score_multiplier, is_applicable
FROM scoring_metric_option
WHERE UPPER(REPLACE(option_value, '/', '')) = 'NA';
```

## 2026-07-22 - Home Page API Integration

The IE Baseline learner home page has been connected to the new backend home endpoint.

### Added

- Added a typed frontend API client:

```text
src/pages/iebaseline/api.ts
```

- The client calls:

```http
GET /ietools/iebaseline/api/home?user_id={user_id}
```

- The frontend now requires a resolved runtime IE Baseline user ID before
  calling the home API.
- Added Vite dev proxy support so the frontend path rewrites to the FastAPI backend:

```text
/ietools/iebaseline/api -> /api/iebaseline
```

### Updated

- Updated the home page:

```text
src/pages/iebaseline/IEBaseline.tsx
```

- The page now uses React Query to load home page data from the API.
- Personal details now render from the API where available:
  - `user.name`
  - `user.position`
  - `user.wd_id`
- Email and department still show `N/A` because the current backend response does not provide those fields.
- Assigned modules now render from `assignments` returned by the API instead of the hardcoded `MODULES` fixture.
- Assignment rows now show:
  - module name
  - progress
  - status
  - description
  - owner
  - assignee
  - assigned date
  - updated date
  - checklist question count
- Added loading, error, and empty-assignment states.

### Kept For Compatibility

- `MODULES` remains exported from `IEBaseline.tsx`.
- This is still needed by legacy pages:

```text
src/pages/iebaseline/ModuleOverview.tsx
src/pages/iebaseline/ModuleAdmin.tsx
src/pages/iebaseline/IEBaselineEdit.tsx
```

### Verified

- Ran:

```powershell
npm run build:iebaseline
```

- The first sandboxed build failed with a Windows `spawn EPERM` while Vite loaded config.
- The same build passed when rerun outside the sandbox.

### Known Limitation / Next Work

- Home page links now use numeric backend module IDs:

```text
/iebaseline/module/:moduleId
```

- `ModuleOverview.tsx` still looks up modules from the hardcoded `MODULES` fixture.
- Because of that, clicking a backend-loaded module may show "Module Not Found" until `ModuleOverview.tsx` is migrated to a backend module-detail endpoint.
- Recommended next backend/frontend contract:

```http
GET /api/iebaseline/modules/{module_id}
GET /api/iebaseline/modules/{module_id}/questions
```

## 2026-07-22 - Assign Modules Page Draft

Added the frontend assignment-management surface for IE Baseline.

### Added

- Added a new page:

```text
src/pages/iebaseline/AssignModules.tsx
```

- Added route and sidebar access:

```text
/iebaseline/assign
```

- Extended the typed frontend API client with assignment-management methods:

```http
GET /ietools/iebaseline/api/users
GET /ietools/iebaseline/api/modules
GET /ietools/iebaseline/api/users/{user_id}/modules
PUT /ietools/iebaseline/api/users/{user_id}/modules
```

### Page Behavior

- Shows the list of users from the backend.
- Opens a module-management panel when `Manage` is clicked for a user.
- Shows modules from the backend with assignment checkboxes.
- Keeps checkbox changes local until the admin confirms `Apply changes`.
- Supports clearing the selected assignment draft with `Remove selected`.
- Uses a confirmation dialog showing add, remove, and unchanged counts before sending the backend payload.

### Backend Handoff

- Documented the required backend endpoints and payloads in:

```text
src/pages/iebaseline/docs/api-reference.md
```

## 2026-07-22 - Assign Modules API Compatibility Check

The backend assignment API is now live and the frontend contract was checked against the updated API reference.

### Confirmed

- The assign modules page matches the live backend endpoints:

```http
GET /api/iebaseline/users
GET /api/iebaseline/modules
GET /api/iebaseline/users/{user_id}/modules
PUT /api/iebaseline/users/{user_id}/modules
```

- The frontend request payload already matches the backend `PUT` contract:

```json
{
  "module_ids": [3, 7, 9],
  "assignee_id": 1
}
```

- The frontend response types match the live response fields:
  - `assigned_module_ids`
  - `added_module_ids`
  - `removed_module_ids`
  - `unchanged_module_ids`

### Updated

- Cleared the local assignment draft immediately when switching users so a previous user's checkbox state is not shown while the newly selected user's assignments are loading.

## 2026-07-22 - Module Overview and Checklist Questions API Integration

Resolved the learner module navigation issue and connected the checklist modal to the new backend questions endpoint.

### Fixed

- `ModuleOverview.tsx` no longer looks up legacy mock module IDs such as `m1`, `m2`, or `m3`.
- The route remains:

```text
/iebaseline/module/:moduleId
```

- The page now fetches the learner home payload and matches the selected assignment with:

```ts
String(assignment.module_id) === moduleId
```

- This fixes the false "Module Not Found" state when clicking assigned backend modules from the home page.
- `Module Not Found` now only appears after the home API loads successfully and the numeric module ID is not assigned to the resolved learner.

### Added

- Added typed frontend support for the live module-ID questions endpoint:

```http
GET /ietools/iebaseline/api/modules/{module_id}/questions
```

- Backend route behind the Vite proxy:

```http
GET /api/iebaseline/modules/{module_id}/questions
```

- Added the `IEBaselineModuleQuestion` frontend type in:

```text
src/pages/iebaseline/api.ts
```

- Added:

```ts
ieBaselineApi.modules.questions.get(moduleId)
```

### Updated

- `ModuleOverview.tsx` now renders backend assignment fields:
  - `module_name`
  - `description`
  - `status`
  - `progress`
  - `owner_name`
  - `assigned_by`
  - `assigned_at`
  - `updated_at`
  - `question_count`
- `ExamModal.tsx` now loads checklist questions by numeric `module_id` instead of using hardcoded mock exam questions.
- The checklist modal now supports:
  - loading state
  - API error state
  - empty question list state
  - previous/next question navigation
  - local answer selection from pipe-delimited stored options such as `Yes|No|Partial|NA`
- `api-reference.md` was updated on disk to mark `GET /api/iebaseline/modules/{module_id}/questions` as the live endpoint and the old `moduleName` endpoint as legacy.

### Backend Contract Confirmed

- Backend Codex confirmed:
  - `200 OK` with `[]` if the module exists but has no checklist rows.
  - `404 {"detail": "Module not found"}` if `module_id` does not exist.
  - `500 {"detail": "Database query failed"}` on database failure.
  - Response shape matches the previous questions array and now includes `module_id`.

### Verified

- Ran:

```powershell
npm run build:iebaseline
```

- The sandboxed build failed with the known Windows Vite `spawn EPERM` while loading config.
- The same build passed when rerun outside the sandbox.

## 2026-07-23 - Mock Exam Scoring Trigger Frontend Draft

Added frontend support for backend-scored IE Baseline attempts.

### Updated

- `POST /api/iebaseline/attempts/{attempt_id}/submit` is now documented as the scoring trigger.
- Frontend attempt types now include:
  - `correctAnswers`
  - `score`
- The exam modal now treats completed/submitted attempts as read-only review sessions.
- The completed module path opens the latest completed/submitted attempt instead of starting a new attempt.
- After submit, the frontend invalidates the scored attempt questions so backend-returned `scoreAwarded` and `maximumScore` can be shown.

### Backend Handoff

- Backend should calculate authoritative scores using `available_points * score_multiplier`.
- Backend should store per-answer awarded/max points and final attempt percentage score.
- First version is score-only; frontend does not enforce pass/fail thresholds.

### Notes

- `src/pages/iebaseline/docs/` is ignored by `.gitignore`, so documentation updates in this folder are available on disk but do not appear in `git status`.
- The checklist modal currently captures answers only in local component state. Persisting checklist answers/completion will need a future backend contract.

## 2026-07-23 - Completed Review Navigation and Modal Scrolling Polish

Improved the completed-module review experience and long-question modal layout.

### Fixed

- Completed modules opened through `Review Module` can now move through questions with `Previous` and `Next Question`.
- Review navigation no longer requires the current question to have a selected answer.
- In-progress checklist behavior is unchanged: users still need to select an answer before moving forward.
- Review mode remains read-only and does not save, clear, submit, or start a new attempt.

### Updated

- The checklist modal now uses a single modal-body scroll viewport instead of separate question/answer column scroll areas.
- Question and answer content now grow to their natural height, and the modal body scrolls when content exceeds the browser window.
- Removed vertical auto-centering that could make long option sets feel clipped.
- Compact option styling was added so more `Yes`, `No`, `Partial`, `NA`, or descriptive option rows fit at normal browser zoom.

### Backend Impact

- No backend changes were required.
- The existing completed review endpoints remain sufficient:

```http
GET /api/iebaseline/modules/{module_id}/attempts
GET /api/iebaseline/attempts/{attempt_id}/questions
```

### Verified

- Ran:

```powershell
npm run build:iebaseline
```

- The sandboxed build failed with the known Windows `spawn EPERM` while Vite loaded config.
- The same build passed when rerun outside the sandbox.

## 2026-07-22 - Attempt and Answer Recording Frontend Integration

Connected the checklist modal to the backend attempt API for answer persistence, resume, and submit locking.

### Added

- Extended the typed frontend API client with attempt/answer methods:

```http
POST /ietools/iebaseline/api/modules/{module_id}/attempts/start
GET /ietools/iebaseline/api/attempts/{attempt_id}/questions
PUT /ietools/iebaseline/api/attempts/{attempt_id}/questions/{question_id}/answer
DELETE /ietools/iebaseline/api/attempts/{attempt_id}/questions/{question_id}/answer
POST /ietools/iebaseline/api/attempts/{attempt_id}/submit
GET /ietools/iebaseline/api/modules/{module_id}/attempts
```

- Added frontend types for:
  - attempt status and result status
  - attempt metadata
  - attempt progress
  - attempt questions with saved answers
  - save/clear answer responses
  - submit response

### Updated

- `ExamModal.tsx` now starts or resumes an in-progress attempt when opened.
- Questions now load from the attempt-specific questions endpoint so saved answers can be restored.
- The modal initializes local selection state from saved backend answers.
- Resume opens the first unanswered question.
- Selecting or changing an option is local UI state only and does not call the backend.
- `Next Question` saves the current answer before advancing.
- `Finish Checklist` saves the final answer once, then submits the attempt for backend scoring.
- Previous and close do not save unsaved local selection changes; reopening resumes from the latest saved backend checkpoint.
- Added saving, saved, save-failed, and retry UI states.
- Added a clear-answer action that calls the backend `DELETE` endpoint.
- Finish Checklist now calls submit and expects this phase's backend behavior:

```text
attemptStatus = "Submitted"
resultStatus = "Pending"
submittedAt = now()
```

- Scoring, correctness review, `completedAt`, and assignment completion remain deferred.

### Backend Compatibility Update

- Backend Codex confirmed the attempt API is implemented under:

```text
/api/iebaseline
```

- Because there is not yet an auth/session layer, start/resume currently requires a learner id.
- The frontend now sends the preferred body payload:

- Earlier development builds used a temporary learner ID for this request.
- Backend also supports the compatibility query form:

```http
POST /api/iebaseline/modules/{module_id}/attempts/start?user_id={user_id}
```

- If neither is provided, backend returns:

```json
{
  "detail": "userId is required"
}
```

### Backend Contract Confirmed

- Save answer payload:

```json
{
  "selectedAnswer": "Yes"
}
```

- Backend trims `selectedAnswer`.
- `null`, empty, or whitespace-only selected answers are treated as not answered.
- Save and clear responses use the same compact shape:

```json
{
  "attemptId": 15,
  "questionId": 25,
  "selectedAnswer": "Yes",
  "isAnswered": true,
  "answeredQuestions": 13,
  "totalQuestions": 20,
  "progressPercentage": 65,
  "lastSavedAt": "2026-07-22T13:30:00+08:00"
}
```

- Clear/delete returns:

```json
{
  "selectedAnswer": null,
  "isAnswered": false
}
```

- Useful backend `detail` strings include:
  - `Attempt has already been submitted`
  - `Question does not belong to this module`
  - `All required questions must be answered before submit`
  - `userId is required`

### Verified

- Ran:

```powershell
npm run build:iebaseline
```

- The sandboxed build failed with the known Windows Vite `spawn EPERM` while loading config.
- The same build passed when rerun outside the sandbox.
