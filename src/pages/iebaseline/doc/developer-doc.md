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
There is no hardcoded fallback learner ID.

## Current User Resolution

File: `src/pages/iebaseline/useIEBaselineCurrentUser.ts`

Normal behavior:

* Reads AD profile data from `useCurrentUser()`.
* Requires `user.email` as the unique lookup/create key.
* Calls `POST /users/resolve-current` with `name`, `email`, `position`, and
  `department`.
* Returns the backend `user_master.user_id` as `ieBaselineUserId`.
* Blocks learner API calls until `ieBaselineUserId` is available.

Staging override behavior:

* If `VITE_IEBASELINE_USER_ID_OVERRIDE` is set to a valid positive integer, the
  hook returns that value as `ieBaselineUserId`.
* The override skips `POST /users/resolve-current`.
* The override does not require AD email and suppresses current-user lookup
  errors.
* Use this only for temporary staging users already present in `user_master`.

CLI examples:

```powershell
$env:VITE_IEBASELINE_USER_ID_OVERRIDE='4'
npm run dev
```

```powershell
$env:VITE_IEBASELINE_USER_ID_OVERRIDE='4'
npm run build:iebaseline
```

## Route Map

| Route | Page | Purpose |
| --- | --- | --- |
| `/iebaseline` | `IEBaseline.tsx` | Learner dashboard for assigned modules |
| `/iebaseline/module/:moduleId` | `ModuleOverview.tsx` | Module overview and checklist entry |
| `/iebaseline/module/:moduleId/results` | `FinalResults.tsx` | Final submitted/completed attempt results |
| `/iebaseline/assign` | `AssignModules.tsx` | User/module assignment management |
| `/iebaseline/approvals/my-submissions` | `Approvals.tsx` | Learner approval request history |
| `/iebaseline/approvals/inbox` | `Approvals.tsx` | Approver inbox for assigned checklist reviews |
| `/iebaseline/approvals/:approvalId/review` | `ApprovalReviewRoute` in `Approvals.tsx` | Full-screen approver review workflow |
| `/iebaseline/users` | `UserManagement.tsx` | Create, update, and delete `user_master` records |
| `/iebaseline/edit` | `IEBaselineEdit.tsx` | Legacy/mock module management landing page |
| `/iebaseline/admin/:moduleId` | `ModuleAdmin.tsx` | Legacy/mock module editor |
| `/iebaseline/developer-docs` | `DeveloperDocs.tsx` | In-app developer reference |

## Pages And Features

### Learner Dashboard

File: `src/pages/iebaseline/IEBaseline.tsx`

Features:

* Loads learner profile and assignments from the home API.
* Resolves the active learner through `useIEBaselineCurrentUser` before calling
  learner-specific APIs.
* Shows assigned modules with progress, status, owner, assignee, assigned date,
  updated date, and question count.
* Expands each assigned module row for module details.
* Navigates to `/iebaseline/module/:moduleId`.

API calls:

* `POST /users/resolve-current`
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
* Resolves the active learner through `useIEBaselineCurrentUser`.
* Loads home assignments and finds the matching module assignment.
* Shows module metadata, progress, status, question count, owner, assignee, and
  dates.
* Starts an exam modal for incomplete modules.
* Lets completed modules open review mode, retake, or view final results.

API calls:

* `POST /users/resolve-current`
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
* Uses the resolved `userId` passed from `ModuleOverview`.
* Loads attempt history for review mode.
* Loads questions and saved answers for the active attempt.
* Saves answer selections.
* Clears answers when the selected answer is removed.
* Lists, uploads, removes, and downloads answer attachments for optional or
  required attachment questions.
* Submits the attempt and navigates to final results.
* Supports review-only display of a completed/submitted attempt.
* Supports approval review mode when passed `approvalId`; this mode loads the
  approval review payload, allows the assigned approver to edit selected
  answers, shows attachments read-only, captures reviewer remarks, and submits
  approve/reject decisions.

API calls:

* `POST /modules/{module_id}/attempts/start`
* `GET /modules/{module_id}/attempts?user_id={user_id}`
* `GET /attempts/{attempt_id}/questions`
* `PUT /attempts/{attempt_id}/questions/{question_id}/answer`
* `DELETE /attempts/{attempt_id}/questions/{question_id}/answer`
* `GET /modules/{module_id}/attachments?user_id={user_id}&answer_id={answer_id}`
* `POST /modules/{module_id}/attachments`
* `DELETE /modules/{module_id}/attachments/{attachment_unq_id}?user_id={user_id}`
* `GET /attachments/{attachment_unq_id}/download?user_id={user_id}`
* `POST /attempts/{attempt_id}/submit`
* Approval mode only:
  * `GET /approvals/{approval_id}/review?reviewer_user_id={user_id}`
  * `POST /approvals/{approval_id}/start`
  * `PUT /approvals/{approval_id}/answers/{answer_id}`
  * `POST /approvals/{approval_id}/decision`

Notification emails are backend-owned. The frontend does not build recipient
email addresses, email subjects, or email bodies, and it does not call the
manual notification endpoint in the normal approval workflow. Approval request,
approved, and rejected emails are sent by the backend after successful submit
and decision commits.

Actions and triggers:

| Trigger | Condition | Result | API impact |
| --- | --- | --- | --- |
| Answer option select | User is taking the checklist | Updates selected answer local state | No immediate API call until save/clear logic runs |
| Save/change answer | User selects a non-empty answer | Persists answer and updates cached progress | `PUT /attempts/{attempt_id}/questions/{question_id}/answer` |
| Clear answer | Current selected answer is cleared | Removes the saved answer and updates cached progress | `DELETE /attempts/{attempt_id}/questions/{question_id}/answer` |
| Upload attachment | Question has an optional or required attachment section and an `answerId` exists | Uploads evidence and refreshes attachment/question state | `POST /modules/{module_id}/attachments` |
| Remove attachment | Attachment exists and the attempt is editable | Deletes evidence and refreshes attachment/question state | `DELETE /modules/{module_id}/attachments/{attachment_unq_id}` |
| Download attachment | Attachment exists | Opens backend download URL using the resolved `user_id` | `GET /attachments/{attachment_unq_id}/download` |
| Finish / Submit checklist | User submits the checklist | Submits attempt, invalidates related queries, routes to final results | `POST /attempts/{attempt_id}/submit` |
| Approval review open | `approvalId` is provided and review data loads with status `PENDING` | Marks the request as actively reviewed | `POST /approvals/{approval_id}/start` |
| Approval answer change | Assigned approver changes a selected answer in a non-terminal approval | Updates the authoritative submitted answer and cached progress | `PUT /approvals/{approval_id}/answers/{answer_id}` |
| Approve / Reject | Assigned approver submits a decision for a non-terminal approval | Recalculates score on the backend, stores remarks, invalidates approval/attempt/home queries | `POST /approvals/{approval_id}/decision` |
| Close modal | Modal controls are used | Closes the modal and returns to module overview | No API call |

### Final Results

File: `src/pages/iebaseline/FinalResults.tsx`

Features:

* Reads `moduleId` from the route.
* Resolves the active learner through `useIEBaselineCurrentUser`.
* Loads the learner home data for module/user context.
* Loads attempt history and selects the latest submitted or completed attempt.
* Can use submit result passed through navigation state as an immediate fallback.
* Shows result status, score, attempt number, answered question count, learner
  details, and completion date.
* Treats `PENDING` and `IN_PROGRESS` approval results as waiting for approval;
  the score remains hidden while the backend returns `score = null`.

API calls:

* `POST /users/resolve-current`
* `GET /home?user_id={user_id}`
* `GET /modules/{module_id}/attempts?user_id={user_id}`

Actions and triggers:

| Trigger | Condition | Result | API impact |
| --- | --- | --- | --- |
| Return to Module | Top and bottom result page controls | Routes to `/iebaseline/module/{moduleId}` | No direct call; target page calls `GET /home` |

### Approvals

File: `src/pages/iebaseline/Approvals.tsx`

Features:

* Resolves the active IE Baseline user through `useIEBaselineCurrentUser`.
* Provides two route-backed tabs:
  * My Submissions for approval requests created from the current learner's
    submitted attempts.
  * Approval Inbox for approval requests assigned to the current user.
* Inbox filter defaults to actionable requests by showing `PENDING` and
  `IN_PROGRESS`; explicit status filters are available for all approval states.
* Approval rows show module name, learner, approver, attempt number, approval
  status, submitted/completed dates, remarks, and score when released.
* Inbox rows link to `/iebaseline/approvals/:approvalId/review`.
* Submission rows link to the module result page.
* The review route mounts `ExamModal` in approval mode with the resolved
  reviewer user ID and the route `approvalId`.

API calls:

* `POST /users/resolve-current`
* `GET /approvals/my-submissions?user_id={user_id}`
* `GET /approvals/inbox?approver_user_id={user_id}`
* `GET /approvals/inbox?approver_user_id={user_id}&status={status}`
* Delegates review behavior to `components/ExamModal.tsx`.

Actions and triggers:

| Trigger | Condition | Result | API impact |
| --- | --- | --- | --- |
| My Submissions tab | Current user is resolved | Lists approval requests submitted by the current learner | `GET /approvals/my-submissions` |
| Approval Inbox tab | Current user is resolved | Lists approval requests assigned to the current reviewer | `GET /approvals/inbox` |
| Inbox status filter | Inbox tab is active | Refetches or locally filters approval requests by selected status | `GET /approvals/inbox` with optional `status` |
| Review | Approval inbox row | Routes to full-screen approval review | Target route calls `GET /approvals/{approval_id}/review` |
| Result | My Submissions row | Routes to the module result page | Target page calls `GET /home` and `GET /modules/{module_id}/attempts` |

### Assign Modules

File: `src/pages/iebaseline/AssignModules.tsx`

Features:

* Resolves the current IE Baseline user for `assignee_id`.
* Loads all assignable users.
* Loads all modules available for assignment.
* Loads selected user's assigned module IDs.
* Tracks draft assignment changes locally.
* Applies assignment changes through the update API.
* Invalidates user, selected user module, and home queries after save.

API calls:

* `POST /users/resolve-current`
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

### User Management

File: `src/pages/iebaseline/UserManagement.tsx`

Features:

* Uses Create User, Update User, and Delete User tabs inside one route.
* Creates `user_master` rows through the dedicated create API.
* Searches users by name, WD ID, and email for update/delete selection.
* Loads one full user profile before editing so email, department, role, and
  `reports_to` are preserved.
* Uses a searchable `reports_to` selector and excludes the edited user from
  manager results.
* Loads role options from the backend and falls back to seeded role labels if
  roles are unavailable.
* Previews related record counts and blocking reasons before delete
  confirmation.
* Invalidates IE Baseline user search/list queries after create, update, and
  delete.

API calls:

* `GET /users/search?q=...`
* `GET /users/{user_id}`
* `POST /users/create`
* `PUT /users/{user_id}`
* `DELETE /users/{user_id}`
* `GET /users/{user_id}/delete-preview`
* `GET /roles`

Actions and triggers:

| Trigger | Condition | Result | API impact |
| --- | --- | --- | --- |
| Create user | Name is present and no create request is pending | Submits a normalized user payload, clears the form on success, and refreshes user queries | `POST /users/create` |
| Select user to update | User searches by name, WD ID, or email in the Update User tab | Sets selected user and loads the full profile into the edit form | `GET /users/search`, then `GET /users/{user_id}` |
| Reports To selector | Available in Create User and Update User forms | Stores the selected manager `user_id` in `reports_to` or clears it to `null` | `GET /users/search` with optional `exclude_user_id` |
| Save changes | Update user is selected, name is present, and profile loading is complete | Saves the full user payload and refreshes user queries | `PUT /users/{user_id}` |
| Select user to delete | User searches by name, WD ID, or email in the Delete User tab | Sets selected user and loads delete impact data | `GET /users/search`, then `GET /users/{user_id}/delete-preview` |
| Delete user / Confirm delete | Requires confirmation in the Delete User tab | Deletes the selected user, clears selection on success, and refreshes user queries | `DELETE /users/{user_id}` |

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
| POST | `/users/resolve-current` | `users.resolveCurrent` | Dashboard, module overview, final results, assign modules | Resolve AD/staging current user to `user_master.user_id` |
| GET | `/home?user_id=...` | `ieBaselineApi.home.get` | Dashboard, module overview, final results | Load learner profile and assigned modules |
| GET | `/users` | `ieBaselineApi.users.list` | Assign modules | Load assignable users |
| GET | `/users/search?q=...` | `ieBaselineApi.users.search` | User Management | Search users by name, WD ID, or email |
| GET | `/users/{user_id}` | `ieBaselineApi.users.get` | User Management | Load one full user profile |
| POST | `/users/create` | `ieBaselineApi.users.create` | User Management | Create a `user_master` row |
| PUT | `/users/{user_id}` | `ieBaselineApi.users.update` | User Management | Update a `user_master` row |
| DELETE | `/users/{user_id}` | `ieBaselineApi.users.remove` | User Management | Delete a `user_master` row |
| GET | `/users/{user_id}/delete-preview` | `ieBaselineApi.users.deletePreview` | User Management | Preview related records before delete |
| GET | `/roles` | `ieBaselineApi.roles.list` | User Management | Load role dropdown options |
| GET | `/modules` | `ieBaselineApi.modules.list` | Assign modules | Load modules available for assignment |
| GET | `/users/{user_id}/modules` | `ieBaselineApi.users.modules.get` | Assign modules | Load selected user's module IDs |
| PUT | `/users/{user_id}/modules` | `ieBaselineApi.users.modules.update` | Assign modules | Replace selected user's module assignments |
| POST | `/modules/{module_id}/attempts/start` | `ieBaselineApi.modules.attempts.start` | Exam modal | Start or resume an attempt |
| GET | `/modules/{module_id}/attempts?user_id=...` | `ieBaselineApi.modules.attempts.list` | Exam modal, final results | Load attempt history |
| GET | `/attempts/{attempt_id}` | `ieBaselineApi.attempts.get` | Available wrapper, no current call site | Load one attempt |
| GET | `/attempts/{attempt_id}/questions` | `ieBaselineApi.attempts.questions.get` | Exam modal | Load attempt questions and saved answers |
| PUT | `/attempts/{attempt_id}/questions/{question_id}/answer` | `ieBaselineApi.attempts.questions.saveAnswer` | Exam modal | Save selected answer |
| DELETE | `/attempts/{attempt_id}/questions/{question_id}/answer` | `ieBaselineApi.attempts.questions.clearAnswer` | Exam modal | Clear selected answer |
| GET | `/modules/{module_id}/attachments?user_id=...&answer_id=...` | `ieBaselineApi.modules.attachments.list` | Exam modal | List evidence files for one answer |
| POST | `/modules/{module_id}/attachments` | `ieBaselineApi.modules.attachments.upload` | Exam modal | Upload evidence and set `uploadedBy` |
| DELETE | `/modules/{module_id}/attachments/{attachment_unq_id}?user_id=...` | `ieBaselineApi.modules.attachments.remove` | Exam modal | Remove evidence for one answer |
| GET | `/attachments/{attachment_unq_id}/download?user_id=...` | `ieBaselineApi.modules.attachments.downloadUrl` | Exam modal | Build attachment download URL |
| POST | `/attempts/{attempt_id}/submit` | `ieBaselineApi.attempts.submit` | Exam modal | Submit and score attempt |
| GET | `/approvals/my-submissions?user_id=...` | `ieBaselineApi.approvals.listMySubmissions` | Approvals | List approval requests submitted by the current learner |
| GET | `/approvals/inbox?approver_user_id=...` | `ieBaselineApi.approvals.listInbox` | Approvals | List approval requests assigned to the current approver |
| POST | `/approvals/{approval_id}/start` | `ieBaselineApi.approvals.start` | Approval review | Mark a pending approval as in progress |
| GET | `/approvals/{approval_id}/review?reviewer_user_id=...` | `ieBaselineApi.approvals.getReview` | Approval review | Load approval metadata, attempt metadata, progress, questions, and answers |
| PUT | `/approvals/{approval_id}/answers/{answer_id}` | `ieBaselineApi.approvals.updateAnswer` | Approval review | Let the assigned approver update an authoritative submitted answer |
| POST | `/approvals/{approval_id}/decision` | `ieBaselineApi.approvals.decision` | Approval review | Approve or reject, store remarks, and release final score/status |

Notification endpoint note: `POST /notifications/send-email` is intentionally
not wrapped in `ieBaselineApi` for v1 because approval notification emails are
sent automatically by the backend. Add a wrapper only if a future manual resend
UI is required.

## Data Flow

```text
Learner dashboard
  -> useIEBaselineCurrentUser
  -> POST /users/resolve-current unless staging override is set
  -> GET /home
  -> module row opens /iebaseline/module/:moduleId

Module overview
  -> useIEBaselineCurrentUser
  -> GET /home
  -> Start/Review/Retake opens ExamModal

ExamModal
  -> receives resolved userId from ModuleOverview
  -> POST /modules/:moduleId/attempts/start
  -> GET /attempts/:attemptId/questions
  -> GET /modules/:moduleId/attachments when needed
  -> POST or DELETE attachments when needed
  -> PUT or DELETE answer
  -> POST /attempts/:attemptId/submit
  -> navigate /iebaseline/module/:moduleId/results

Final results
  -> useIEBaselineCurrentUser
  -> GET /home
  -> GET /modules/:moduleId/attempts
  -> display latest submitted/completed attempt
  -> show approval waiting state while resultStatus is PENDING or IN_PROGRESS

Assign modules
  -> useIEBaselineCurrentUser for assignee_id
  -> GET /users
  -> GET /modules
  -> GET /users/:userId/modules
  -> PUT /users/:userId/modules
  -> invalidate related IE Baseline queries

User Management
  -> GET /roles
  -> GET /users/search for user and reports_to selectors
  -> GET /users/:userId before update
  -> POST /users/create or PUT /users/:userId
  -> GET /users/:userId/delete-preview before delete
  -> DELETE /users/:userId after confirmation
  -> invalidate user search/list queries

Approvals
  -> useIEBaselineCurrentUser
  -> GET /approvals/my-submissions for learner history
  -> GET /approvals/inbox for assigned reviewer work
  -> /iebaseline/approvals/:approvalId/review opens ExamModal approval mode
  -> GET /approvals/:approvalId/review
  -> POST /approvals/:approvalId/start when status is PENDING
  -> PUT /approvals/:approvalId/answers/:answerId when reviewer edits answers
  -> POST /approvals/:approvalId/decision
  -> invalidate approval, home, attempt, and review queries

Notifications
  -> backend sends approval request email after submit commit
  -> backend sends approved/rejected email after decision commit
  -> frontend shows submit/decision outcome only and does not block on email delivery
```

## Not Wired Yet

These backend or documented capabilities are not active frontend behavior yet:

* Manual notification resend endpoint:
  `POST /api/iebaseline/notifications/send-email`. Backend automatic approval
  emails are the v1 behavior, so no frontend resend UI or API wrapper is wired.
* Legacy module-name checklist endpoint:
  `GET /api/iebaseline/modules/{moduleName}/questions`.
* Admin create/edit/save module APIs. The current edit/admin pages still use
  the hardcoded `MODULES` array.
* Real media upload behavior in `ModuleAdmin.tsx`.

When adding new frontend integrations, update this file, the in-app developer
page, and `src/pages/iebaseline/api.ts` together.
