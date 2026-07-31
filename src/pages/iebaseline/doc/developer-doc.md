# IE Baseline Developer Live Doc

This is the coding-agent source of truth for the current IE Baseline frontend.
It maps the live pages, user-facing features, frontend API calls, and known
backend endpoints that are not wired into the UI yet.

Base frontend API prefix:

```text
/ietools/iebaseline/api
```

In development, Vite rewrites that prefix to:

```text
/api/iebaseline
```

The frontend resolves the active learner through `useIEBaselineCurrentUser`.
Normal runs use AD email plus `POST /users/resolve-current`; staging can set
`VITE_IEBASELINE_USER_ID_OVERRIDE` to use a temporary DB user ID explicitly.

## Route Map

| Route | Page | Purpose |
| --- | --- | --- |
| `/iebaseline` | `IEBaseline.tsx` | Learner dashboard for assigned modules |
| `/iebaseline/module/:moduleId` | `ModuleOverview.tsx` | Module overview and checklist entry |
| `/iebaseline/module/:moduleId/results` | `FinalResults.tsx` | Final submitted/completed attempt results |
| `/iebaseline/assign` | `AssignModules.tsx` | User/module assignment management |
| `/iebaseline/edit` | `IEBaselineEdit.tsx` | Legacy/mock module management landing page |
| `/iebaseline/admin/:moduleId` | `ModuleAdmin.tsx` | Legacy/mock module editor |
| `/iebaseline/developer-docs` | `DeveloperDocs.tsx` | In-app developer reference |

## Pages And Features

### Learner Dashboard

File: `src/pages/iebaseline/IEBaseline.tsx`

Features:

* Loads learner profile and assignments from the home API.
* Shows assigned modules with progress, status, owner, assignee, assigned date,
  updated date, and question count.
* Expands each assigned module row for module details.
* Navigates to `/iebaseline/module/:moduleId`.

API calls:

* `GET /home?user_id={user_id}`

Actions and triggers:

| Trigger | Condition | Result | API impact |
| --- | --- | --- | --- |
| Module name link | Every assigned module row | Routes to `/iebaseline/module/{module_id}` | No direct call; target page calls `GET /home` |
| Start Module / Continue Module / Review Material | Label is derived from assignment status and progress | Routes to `/iebaseline/module/{module_id}` | No direct call; target page calls `GET /home` |
| Accordion row expand | Every assignment row | Expands local module details | No API call |

### Module Overview

File: `src/pages/iebaseline/ModuleOverview.tsx`

Features:

* Reads `moduleId` from the route.
* Loads home assignments and finds the matching module assignment.
* Shows module metadata, progress, status, question count, owner, assignee, and
  dates.
* Starts an exam modal for incomplete modules.
* Lets completed modules open review mode, retake, or view final results.

API calls:

* `GET /home?user_id={user_id}`
* Delegates exam behavior to `components/ExamModal.tsx`.

Actions and triggers:

| Trigger | Condition | Result | API impact |
| --- | --- | --- | --- |
| Start Module | Assignment is not `Completed` | Sets `activeExam = "start"` and opens `ExamModal` | Indirectly calls `POST /modules/{module_id}/attempts/start`, then `GET /attempts/{attempt_id}/questions` |
| Review Module | Assignment is `Completed` | Sets `activeExam = "review"` and opens `ExamModal` in review-only mode | Indirectly calls `GET /modules/{module_id}/attempts` and `GET /attempts/{attempt_id}/questions` |
| View Result | Assignment is `Completed` | Routes to `/iebaseline/module/{module_id}/results` | Target page calls `GET /home` and `GET /modules/{module_id}/attempts` |
| Retake Module | Assignment is `Completed` | Sets `activeExam = "retake"` and opens `ExamModal` | Indirectly calls `POST /modules/{module_id}/attempts/start`, then `GET /attempts/{attempt_id}/questions` |
| Back to Dashboard | Loaded module overview page | Routes to `/iebaseline` | No direct call; dashboard calls `GET /home` |

### Exam Modal

File: `src/pages/iebaseline/components/ExamModal.tsx`

Features:

* Starts or resumes the active module attempt.
* Loads attempt history for review mode.
* Loads questions and saved answers for the active attempt.
* Saves answer selections.
* Clears answers when the selected answer is removed.
* Submits the attempt and navigates to final results.
* Supports review-only display of a completed/submitted attempt.

API calls:

* `POST /modules/{module_id}/attempts/start`
* `GET /modules/{module_id}/attempts?user_id={user_id}`
* `GET /attempts/{attempt_id}/questions`
* `PUT /attempts/{attempt_id}/questions/{question_id}/answer`
* `DELETE /attempts/{attempt_id}/questions/{question_id}/answer`
* `POST /attempts/{attempt_id}/submit`

Actions and triggers:

| Trigger | Condition | Result | API impact |
| --- | --- | --- | --- |
| Answer option select | User is taking the checklist | Updates selected answer local state | No immediate API call until save/clear logic runs |
| Save/change answer | User selects a non-empty answer | Persists answer and updates cached progress | `PUT /attempts/{attempt_id}/questions/{question_id}/answer` |
| Clear answer | Current selected answer is cleared | Removes the saved answer and updates cached progress | `DELETE /attempts/{attempt_id}/questions/{question_id}/answer` |
| Finish / Submit checklist | User submits the checklist | Submits attempt, invalidates related queries, routes to final results | `POST /attempts/{attempt_id}/submit` |
| Close modal | Modal controls are used | Closes the modal and returns to module overview | No API call |

### Final Results

File: `src/pages/iebaseline/FinalResults.tsx`

Features:

* Reads `moduleId` from the route.
* Loads the learner home data for module/user context.
* Loads attempt history and selects the latest submitted or completed attempt.
* Can use submit result passed through navigation state as an immediate fallback.
* Shows result status, score, attempt number, answered question count, learner
  details, and completion date.

API calls:

* `GET /home?user_id={user_id}`
* `GET /modules/{module_id}/attempts?user_id={user_id}`

Actions and triggers:

| Trigger | Condition | Result | API impact |
| --- | --- | --- | --- |
| Return to Module | Top and bottom result page controls | Routes to `/iebaseline/module/{moduleId}` | No direct call; target page calls `GET /home` |

### Assign Modules

File: `src/pages/iebaseline/AssignModules.tsx`

Features:

* Loads all assignable users.
* Loads all modules available for assignment.
* Loads selected user's assigned module IDs.
* Tracks draft assignment changes locally.
* Applies assignment changes through the update API.
* Invalidates user, selected user module, and home queries after save.

API calls:

* `GET /users`
* `GET /modules`
* `GET /users/{user_id}/modules`
* `PUT /users/{user_id}/modules`

Actions and triggers:

| Trigger | Condition | Result | API impact |
| --- | --- | --- | --- |
| Manage user | Each user row | Sets `selectedUser` and enables selected user modules query | `GET /users/{user_id}/modules` |
| Module checkbox | User is selected and modules are loaded | Adds/removes `module_id` in local draft state | No immediate API call |
| Reset | Unsaved assignment changes exist | Restores draft IDs from loaded assignments | No API call |
| Remove selected | Draft assignments are not empty | Clears all draft selected module IDs | No immediate API call |
| Apply changes / Confirm apply | Unsaved assignment changes exist | Saves sorted `module_ids` and invalidates related queries | `PUT /users/{user_id}/modules` |
| Back to Users | A user is selected | Clears selected user and draft state | No API call |

### Edit And Admin

Files:

* `src/pages/iebaseline/IEBaselineEdit.tsx`
* `src/pages/iebaseline/ModuleAdmin.tsx`

Features:

* These pages still use the hardcoded `MODULES` export from
  `IEBaseline.tsx`.
* The edit page lists mock modules and links to admin edit routes.
* The admin page renders a mock form for general metadata, instructor details,
  visuals, syllabus content, quiz content, and media.
* Save/create/upload controls are currently visual only.

API calls:

* None.

Actions and triggers:

| Trigger | Condition | Result | API impact |
| --- | --- | --- | --- |
| Create New Module | Visible on `/iebaseline/edit` | Visual-only button today | No API call |
| Module name / pencil edit | Each hardcoded `MODULES` row | Routes to `/iebaseline/admin/{module.id}` | No API call |
| Save Changes | Visible on `/iebaseline/admin/:moduleId` | Visual-only button today | No API call |
| Upload / Add / Delete controls | Mock admin form sections | Visual-only controls today | No API call |

## Active Frontend API Call Map

| Method | Frontend path | Wrapper | Used by | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/home?user_id=...` | `ieBaselineApi.home.get` | Dashboard, module overview, final results | Load learner profile and assigned modules |
| GET | `/users` | `ieBaselineApi.users.list` | Assign modules | Load assignable users |
| GET | `/modules` | `ieBaselineApi.modules.list` | Assign modules | Load modules available for assignment |
| GET | `/users/{user_id}/modules` | `ieBaselineApi.users.modules.get` | Assign modules | Load selected user's module IDs |
| PUT | `/users/{user_id}/modules` | `ieBaselineApi.users.modules.update` | Assign modules | Replace selected user's module assignments |
| POST | `/modules/{module_id}/attempts/start` | `ieBaselineApi.modules.attempts.start` | Exam modal | Start or resume an attempt |
| GET | `/modules/{module_id}/attempts?user_id=...` | `ieBaselineApi.modules.attempts.list` | Exam modal, final results | Load attempt history |
| GET | `/attempts/{attempt_id}` | `ieBaselineApi.attempts.get` | Available wrapper, no current call site | Load one attempt |
| GET | `/attempts/{attempt_id}/questions` | `ieBaselineApi.attempts.questions.get` | Exam modal | Load attempt questions and saved answers |
| PUT | `/attempts/{attempt_id}/questions/{question_id}/answer` | `ieBaselineApi.attempts.questions.saveAnswer` | Exam modal | Save selected answer |
| DELETE | `/attempts/{attempt_id}/questions/{question_id}/answer` | `ieBaselineApi.attempts.questions.clearAnswer` | Exam modal | Clear selected answer |
| POST | `/attempts/{attempt_id}/submit` | `ieBaselineApi.attempts.submit` | Exam modal | Submit and score attempt |

## Data Flow

```text
Learner dashboard
  -> GET /home
  -> module row opens /iebaseline/module/:moduleId

Module overview
  -> GET /home
  -> Start/Review/Retake opens ExamModal

ExamModal
  -> POST /modules/:moduleId/attempts/start
  -> GET /attempts/:attemptId/questions
  -> PUT or DELETE answer
  -> POST /attempts/:attemptId/submit
  -> navigate /iebaseline/module/:moduleId/results

Final results
  -> GET /home
  -> GET /modules/:moduleId/attempts
  -> display latest submitted/completed attempt

Assign modules
  -> GET /users
  -> GET /modules
  -> GET /users/:userId/modules
  -> PUT /users/:userId/modules
  -> invalidate related IE Baseline queries
```

## Not Wired Yet

These backend or documented capabilities are not active frontend behavior yet:

* Attachment upload/list/download/delete APIs from `api-reference.md`.
* Required attachment UI and validation behavior described in
  `attachment_feature.md`.
* Legacy module-name checklist endpoint:
  `GET /api/iebaseline/modules/{moduleName}/questions`.
* Admin create/edit/save module APIs. The current edit/admin pages still use
  the hardcoded `MODULES` array.
* Real media upload behavior in `ModuleAdmin.tsx`.

When adding new frontend integrations, update this file, the in-app developer
page, and `src/pages/iebaseline/api.ts` together.
