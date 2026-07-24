# IE Baseline Progress

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
GET /ietools/iebaseline/api/home?user_id=1
```

- `user_id=1` is currently the temporary demo user until authentication/current-user lookup is implemented later.
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
- `Module Not Found` now only appears after the home API loads successfully and the numeric module ID is not assigned to the demo user.

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

```json
{
  "userId": 1
}
```

- `userId=1` uses the existing `IEBASELINE_DEMO_USER_ID` temporary demo learner.
- Backend also supports the compatibility query form:

```http
POST /api/iebaseline/modules/{module_id}/attempts/start?user_id=1
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
