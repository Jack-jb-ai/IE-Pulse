# IE Baseline API Reference

This backend exposes a small FastAPI API for the IE Baseline frontend.

Authentication: no authentication is currently required for any endpoint.

Response format: endpoints return JSON.

## GET /health

Checks whether the backend process is running and can respond to requests.

### Request

| Item | Value |
| --- | --- |
| Authentication | None required |
| Parameters | None |
| Request body | None |

### Example Request

```http
GET /health
```

### Success Response

Status: `200 OK`

```json
{
  "status": "ok"
}
```

## GET /api/iebaseline/home

Fetches IE Baseline learner home page data for one user, including the user's
profile details, assigned modules, assignment status, progress, module metadata,
assignee details, and module checklist question counts.

Authentication: no authentication is currently required.

### Request

| Item | Value |
| --- | --- |
| Authentication | None required |
| Query parameter | `user_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/home?user_id=1
```

### Success Response

Status: `200 OK`

If the user exists but has no assigned modules, the API returns the user with an
empty `assignments` array.

```json
{
  "user": {
    "user_id": 1,
    "name": "Jane Tan",
    "position": "Manager",
    "wd_id": 12345
  },
  "assignments": [
    {
      "assignment_id": 10,
      "module_id": 3,
      "module_name": "Order to Cash",
      "description": "Billing controls",
      "owner_name": "Finance",
      "assigned_by": {
        "user_id": 5,
        "name": "Alex Lee"
      },
      "status": "Not Started",
      "raw_status": "Incomplete",
      "progress": 0,
      "assigned_at": "2026-07-22T01:00:00+00:00",
      "updated_at": "2026-07-22T01:00:00+00:00",
      "question_count": 12
    }
  ]
}
```

### Status Mapping

| Database `raw_status` | API `status` | `progress` |
| --- | --- | --- |
| `Incomplete` | `Not Started` | `0` |
| `Completed` | `Completed` | `100` |

The current schema cannot derive partial progress yet, so v1 only returns `0`
or `100`.

### Response Fields

| Field | Description |
| --- | --- |
| `user.user_id` | Requested user's database identifier |
| `user.name` | Requested user's name |
| `user.position` | Requested user's position, or `null` |
| `user.wd_id` | Requested user's Workday ID, or `null` |
| `assignments[].assignment_id` | Assignment row identifier |
| `assignments[].module_id` | Module identifier used for frontend navigation |
| `assignments[].module_name` | Module display name |
| `assignments[].description` | Module description, or `null` |
| `assignments[].owner_name` | Module owner, or `null` |
| `assignments[].assigned_by` | Assignee user details, or `null` |
| `assignments[].status` | Frontend status label |
| `assignments[].raw_status` | Stored checklist status from the database |
| `assignments[].progress` | Completion percentage |
| `assignments[].assigned_at` | Assignment creation timestamp |
| `assignments[].updated_at` | Assignment last update timestamp |
| `assignments[].question_count` | Number of checklist questions for the module |

### Error Responses

Status: `404 Not Found`

```json
{
  "detail": "User not found"
}
```

Status: `500 Internal Server Error`

```json
{
  "detail": "Database query failed"
}
```

## GET /api/iebaseline/users

Fetches users available for IE Baseline module assignment from `user_master`.
Results are ordered by user name and then `user_id`.

Authentication: no authentication is currently required.

### Request

| Item | Value |
| --- | --- |
| Authentication | None required |
| Parameters | None |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/users
```

### Success Response

Status: `200 OK`

```json
[
  {
    "user_id": 1,
    "name": "Jane Tan",
    "position": "Manager",
    "wd_id": 12345,
    "assigned_module_count": 3
  }
]
```

### Response Fields

| Field | Description |
| --- | --- |
| `user_id` | User's database identifier |
| `name` | User's display name |
| `position` | User's position, or `null` |
| `wd_id` | User's Workday ID, or `null` |
| `assigned_module_count` | Number of assigned modules for this user |

### Error Response

Status: `500 Internal Server Error`

```json
{
  "detail": "Database query failed"
}
```

## GET /api/iebaseline/modules

Fetches all assignable IE Baseline modules from `module_master`.
Results are ordered by module name and then `module_id`.

Authentication: no authentication is currently required.

### Request

| Item | Value |
| --- | --- |
| Authentication | None required |
| Parameters | None |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/modules
```

### Success Response

Status: `200 OK`

```json
[
  {
    "module_id": 3,
    "module_name": "Order to Cash",
    "description": "Billing controls",
    "owner_name": "Finance",
    "question_count": 12
  }
]
```

### Response Fields

| Field | Description |
| --- | --- |
| `module_id` | Module identifier from `module_master.id` |
| `module_name` | Module display name |
| `description` | Module description, or `null` |
| `owner_name` | Module owner, or `null` |
| `question_count` | Number of checklist questions for this module |

### Error Response

Status: `500 Internal Server Error`

```json
{
  "detail": "Database query failed"
}
```

## GET /api/iebaseline/users/{user_id}/modules

Fetches a user and the module IDs currently assigned to them.

Authentication: no authentication is currently required.

### Request

| Item | Value |
| --- | --- |
| Authentication | None required |
| Path parameter | `user_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/users/1/modules
```

### Success Response

Status: `200 OK`

```json
{
  "user": {
    "user_id": 1,
    "name": "Jane Tan",
    "position": "Manager",
    "wd_id": 12345
  },
  "assigned_module_ids": [3, 7, 9]
}
```

### Backend Behavior

* Confirm that `user_id` exists in `user_master`.
* Return module IDs sorted ascending.
* Return an empty `assigned_module_ids` array if the user exists but has no assignments.

### Error Responses

Status: `404 Not Found`

```json
{
  "detail": "User not found"
}
```

Status: `500 Internal Server Error`

```json
{
  "detail": "Database query failed"
}
```

## PUT /api/iebaseline/users/{user_id}/modules

Replaces a user's IE Baseline module assignments with the provided module ID set.
The API deduplicates `module_ids` and returns all module ID arrays sorted ascending.

Authentication: no authentication is currently required.

### Request

| Item | Value |
| --- | --- |
| Authentication | None required |
| Path parameter | `user_id`, required integer |
| Request body | JSON object |

### Example Request

```http
PUT /api/iebaseline/users/1/modules
Content-Type: application/json
```

```json
{
  "module_ids": [3, 7, 9],
  "assignee_id": 1
}
```

### Request Fields

| Field | Description |
| --- | --- |
| `module_ids` | Full replacement set of assigned module IDs. Duplicate IDs are allowed but are deduplicated by the API. An empty array is valid and removes all assignments. |
| `assignee_id` | User who assigned or manages the checklist. Must exist in `user_master`. |

### Success Response

Status: `200 OK`

```json
{
  "user_id": 1,
  "assigned_module_ids": [3, 7, 9],
  "added_module_ids": [9],
  "removed_module_ids": [2],
  "unchanged_module_ids": [3, 7]
}
```

### Backend Behavior

* Validate that `user_id` exists in `user_master`.
* Validate that `assignee_id` exists in `user_master`.
* Validate that every `module_id` exists in `module_master`.
* Deduplicate `module_ids` and sort response arrays ascending.
* Insert missing `user_checklist_status` rows with default `Incomplete`.
* Delete `user_checklist_status` rows for modules no longer included.
* Preserve existing rows for unchanged assignments, including their current status.
* Set `created_at` and `updated_at` when rows are inserted.
* Respect the unique constraint on `(user_id, module_id)`.

### Error Responses

Status: `400 Bad Request`

```json
{
  "detail": "Invalid module_ids"
}
```

Status: `400 Bad Request`

```json
{
  "detail": "Invalid assignee_id"
}
```

Status: `404 Not Found`

```json
{
  "detail": "User not found"
}
```

Status: `500 Internal Server Error`

```json
{
  "detail": "Database query failed"
}
```

## Backend Change Request: GET /api/iebaseline/modules/{module_id}/questions

This endpoint is requested for the next frontend checklist/questions workflow.
It should fetch baseline checklist questions by the canonical numeric module ID
instead of by module name.

### Why This Is Needed

New frontend module navigation uses `module_id`:

```text
/iebaseline/module/:moduleId
```

`module_id` is also the canonical database relationship key:

* `module_master.id`
* `baseline_checklist.module_id`
* `user_checklist_status.module_id`

Frontend checklist work should prefer this module-ID endpoint once available.
The existing name-based endpoint below can remain for compatibility, but should
be treated as legacy for new frontend work.

### Request

| Item | Value |
| --- | --- |
| Authentication | None required |
| Path parameter | `module_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/modules/3/questions
```

### Expected Backend Behavior

* Validate that `module_id` is an integer.
* Fetch rows from `baseline_checklist` where `baseline_checklist.module_id = module_id`.
* Prefer joining to `module_master` for the canonical `module_name` in the response.
* Order results by `question_no` and then `id`, matching the current name-based endpoint.
* If the module exists but has no checklist rows, return an empty array: `[]`.

### Success Response

Status: `200 OK`

Expected response shape is the same as the current name-based questions endpoint.

```json
[
  {
    "id": 1,
    "module_id": 3,
    "module_name": "Order to Cash",
    "category": "Process",
    "keyword": "Invoice",
    "ibpm_l2": "Manage Billing",
    "ibpm_l3": "Create Invoice",
    "risk": "Medium",
    "question_no": 10,
    "question": "Is invoice approval configured?",
    "options": "Yes|No",
    "reference": "REF-1",
    "memo": "Check workflow setup."
  }
]
```

### Response Fields

| Field | Description |
| --- | --- |
| `id` | Database row identifier |
| `module_id` | Module identifier from `module_master.id` |
| `module_name` | Canonical module display name |
| `category` | Question category |
| `keyword` | Keyword associated with the question |
| `ibpm_l2` | IBPM level 2 process label |
| `ibpm_l3` | IBPM level 3 process label |
| `risk` | Risk value for the question |
| `question_no` | Question ordering number |
| `question` | The checklist question text |
| `options` | Available answer options as stored in the database |
| `reference` | Reference value for the question |
| `memo` | Additional notes for the question |

### Error Responses

Status: `404 Not Found`

```json
{
  "detail": "Module not found"
}
```

Status: `500 Internal Server Error`

```json
{
  "detail": "Database query failed"
}
```

## POST /api/iebaseline/modules/{module_id}/attempts/start

Starts or resumes a user's checklist attempt for a module.

The attempt workflow returns camelCase JSON for frontend compatibility.

The frontend calls this endpoint when the learner clicks **Start Module**. A
fresh editable attempt must be recorded immediately in `user_exam_attempt` at
that point, before any answer is selected.

### Request

| Item | Value |
| --- | --- |
| Authentication | None required |
| Path parameter | `module_id`, required integer |
| Request body | JSON object with `userId` |

Because the backend currently has no authentication/session layer, the learner
user ID must be supplied by the caller.

### Example Request

```http
POST /api/iebaseline/modules/3/attempts/start
Content-Type: application/json
```

```json
{
  "userId": 1
}
```

Compatibility form:

```http
POST /api/iebaseline/modules/3/attempts/start?user_id=1
```

### Backend Behavior

* Return the existing `In Progress` attempt for the user/module when one exists.
  This preserves checkpoint resume for an unfinished checklist.
* If no `In Progress` attempt exists, create a new attempt with the next
  `attemptNo`, `attemptStatus: "In Progress"`, `lastSavedAt: null`, and no
  prefilled answer rows.
* The start action is the attempt creation boundary. Do not wait for the first
  saved answer before inserting `user_exam_attempt`.
* Do not reuse `Completed` or `Submitted` attempts for editable starts or
  retakes. Those attempts remain available for read-only review through attempt
  history and attempt questions.
* Allow a new editable attempt even when the related assignment status is
  already `Completed`.
* After `POST /api/iebaseline/attempts/{attempt_id}/submit`, the frontend may
  immediately call this start endpoint again for a retake. The backend must
  return a fresh `In Progress` attempt rather than the just-completed attempt.

### Success Response

Status: `200 OK`

```json
{
  "attempt": {
    "attemptId": 15,
    "moduleId": 3,
    "attemptNo": 2,
    "attemptStatus": "In Progress",
    "resultStatus": "Pending",
    "answeredQuestions": 0,
    "totalQuestions": 20,
    "progressPercentage": 0,
    "startedAt": "2026-07-22T14:05:00+08:00",
    "lastSavedAt": null,
    "submittedAt": null,
    "completedAt": null
  },
  "progress": {
    "answeredQuestions": 0,
    "totalQuestions": 20,
    "progressPercentage": 0,
    "lastSavedAt": null
  }
}
```

### Error Responses

```json
{
  "detail": "userId is required"
}
```

```json
{
  "detail": "User not found"
}
```

```json
{
  "detail": "Module assignment not found"
}
```

## GET /api/iebaseline/attempts/{attempt_id}/questions

Fetches all questions for an attempt and merges saved answer state into each
question.

### Request

| Item | Value |
| --- | --- |
| Authentication | None required |
| Path parameter | `attempt_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/attempts/15/questions
```

### Success Response

Status: `200 OK`

```json
{
  "attempt": {},
  "progress": {},
  "questions": [
    {
      "id": 25,
      "questionId": 25,
      "moduleId": 3,
      "moduleName": "Example Module",
      "category": null,
      "keyword": null,
      "ibpmL2": null,
      "ibpmL3": null,
      "risk": null,
      "questionNo": 1,
      "question": "Question text",
      "options": "Yes|No|N/A",
      "answerOptions": [
        {
          "optionId": 1,
          "value": "Yes",
          "scoreMultiplier": 1.0,
          "isApplicable": true
        },
        {
          "optionId": 2,
          "value": "Partial",
          "scoreMultiplier": 0.5,
          "isApplicable": true
        },
        {
          "optionId": 3,
          "value": "No",
          "scoreMultiplier": 0.0,
          "isApplicable": true
        }
      ],
      "reference": null,
      "memo": null,
      "answer": {
        "answerId": null,
        "selectedAnswer": null,
        "isAnswered": false,
        "isCorrect": null,
        "scoreAwarded": null,
        "maximumScore": null,
        "lastSavedAt": null
      }
    }
  ]
}
```

`answerOptions` is loaded from the module's configured
`scoring_metric_option` rows and ordered by `scoring_metric_option_id`.
The legacy `options` string remains in the payload for compatibility.

### Error Responses

```json
{
  "detail": "Attempt not found"
}
```

## PUT /api/iebaseline/attempts/{attempt_id}/questions/{question_id}/answer

Saves or updates one answer for an in-progress attempt.

The frontend treats this endpoint as a forward-navigation save, not an
autosave. Selecting or changing an option in the UI is local state only. The
frontend sends this request only when the learner clicks **Next Question** or
when **Finish Checklist** saves the final answer before submit.

### Request

| Item | Value |
| --- | --- |
| Authentication | None required |
| Path parameter | `attempt_id`, required integer |
| Path parameter | `question_id`, required integer |
| Request body | JSON object with `selectedAnswer` |

The backend trims whitespace from `selectedAnswer`. `null`, empty, or
whitespace-only values are treated as not answered.

### Backend Behavior

* Validate that the attempt exists and is still editable.
* Validate that the question belongs to the attempt's module.
* Upsert exactly one `user_exam_answer` row per `(attempt_id, question_id)`.
* If the learner changes an answer within the same attempt, update the existing
  row instead of inserting a duplicate row.
* Update answer/progress fields only, including `selectedAnswer`, `isAnswered`,
  answered count, progress percentage, and `lastSavedAt`.
* Do not calculate scoring, correctness, final score, result status, completion
  timestamps, or assignment completion in this endpoint.

### Example Request

```http
PUT /api/iebaseline/attempts/15/questions/25/answer
Content-Type: application/json
```

```json
{
  "selectedAnswer": "Yes"
}
```

### Success Response

Status: `200 OK`

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

### Error Responses

```json
{
  "detail": "Attempt has already been submitted"
}
```

```json
{
  "detail": "Question does not belong to this module"
}
```

## DELETE /api/iebaseline/attempts/{attempt_id}/questions/{question_id}/answer

Clears one saved answer for an in-progress attempt.

### Request

| Item | Value |
| --- | --- |
| Authentication | None required |
| Path parameter | `attempt_id`, required integer |
| Path parameter | `question_id`, required integer |
| Request body | None |

### Success Response

Status: `200 OK`

The response shape is the same as save answer.

```json
{
  "attemptId": 15,
  "questionId": 25,
  "selectedAnswer": null,
  "isAnswered": false,
  "answeredQuestions": 12,
  "totalQuestions": 20,
  "progressPercentage": 60,
  "lastSavedAt": "2026-07-22T13:40:00+08:00"
}
```

## POST /api/iebaseline/attempts/{attempt_id}/submit

Submits an attempt and triggers backend scoring.

The frontend treats this endpoint as the scoring trigger. The backend remains
authoritative for all correctness, per-question points, final score, completion
status, and assignment status updates.

Before calling submit, the frontend saves the current final answer with
`PUT /api/iebaseline/attempts/{attempt_id}/questions/{question_id}/answer`.
This submit endpoint is the only endpoint that should calculate scoring or
complete the attempt.

### Request

| Item | Value |
| --- | --- |
| Authentication | None required |
| Path parameter | `attempt_id`, required integer |
| Request body | None |

### Success Response

Status: `200 OK`

The response shape is the same attempt/progress wrapper returned by start.
The attempt is updated to:

| Field | Value |
| --- | --- |
| `attemptStatus` | `Completed` |
| `resultStatus` | `Pending`, unless the backend has a configured pass/fail rule |
| `score` | Percentage score from `0` to `100` |
| `correctAnswers` | `0` for configurable scoring modules without a correct-answer key |
| `submittedAt` | Current timestamp |
| `completedAt` | Current timestamp |

Example response:

```json
{
  "attempt": {
    "attemptId": 15,
    "moduleId": 3,
    "attemptNo": 1,
    "attemptStatus": "Completed",
    "resultStatus": "Pending",
    "answeredQuestions": 20,
    "totalQuestions": 20,
    "correctAnswers": 0,
    "score": 72.5,
    "progressPercentage": 100,
    "startedAt": "2026-07-22T13:00:00+08:00",
    "lastSavedAt": "2026-07-22T14:00:00+08:00",
    "submittedAt": "2026-07-22T14:00:00+08:00",
    "completedAt": "2026-07-22T14:00:01+08:00"
  },
  "progress": {
    "answeredQuestions": 20,
    "totalQuestions": 20,
    "progressPercentage": 100,
    "lastSavedAt": "2026-07-22T14:00:00+08:00"
  }
}
```

After submit, `GET /api/iebaseline/attempts/{attempt_id}/questions` should return
the scored answer fields for review:

```json
{
  "answer": {
    "answerId": 1001,
    "selectedAnswer": "Partial",
    "isAnswered": true,
    "isCorrect": null,
    "scoreAwarded": 2.5,
    "maximumScore": 5,
    "lastSavedAt": "2026-07-22T14:00:00+08:00"
  }
}
```

### Backend Scoring Requirements

The backend should:

* Validate attempt ownership/editability.
* Validate that all required questions have been answered.
* Calculate scores in one transaction.
* Load answer options from the module's configured `scoring_metric_id`.
* Never hardcode answer values such as `Yes`, `No`, or `Partial`.
* Match scoring options against the selected answer's leading label before `-`
  when checklist options store descriptive labels such as `Yes - ...`.
* Calculate each answer using `baseline_checklist.available_points * scoring_metric_option.score_multiplier`.
* Treat unanswered or `null` answers as `0` awarded score against the question's available points.
* Treat selected options with `scoring_metric_option.is_applicable = false` as excluded from scoring.
  These rows remain answered, but store `score_awarded` and `maximum_score` as `null`.
* Mark submitted null and non-applicable answer rows as answered after scoring.
* Store `is_correct`, `score_awarded`, and `maximum_score` on `user_exam_answer`.
* Keep `is_correct` as `null` for modules that do not have a configured correct-answer key.
* Store `score`, `correct_answers`, `submitted_at`, and `completed_at` on `user_exam_attempt`.
* Store `correct_answers` as `0` when scoring is numeric-only.
* Mark the related `user_checklist_status` row `Completed` after scoring completes.
* For now, leave `resultStatus` as `Pending` unless a backend pass/fail rule already exists.

### Frontend Save Timing Contract

The backend should expect this request sequence from the current frontend:

* Selecting or changing an answer option sends no API request.
* Clicking **Next Question** sends exactly one save request for the current
  question before advancing.
* Clicking **Finish Checklist** sends one save request for the final question,
  then sends this submit request.
* Closing the modal or browser does not save unsaved local selection changes.
* Reopening the module resumes from the latest saved `In Progress` attempt and
  saved `user_exam_answer` rows.

### Final Results Page Contract

After a successful submit, the frontend redirects learners to:

```text
/ietools/iebaseline/module/{module_id}/results
```

The page shows the submitted attempt's score, completion timestamp, and
pass/fail result. The backend remains authoritative for `resultStatus`.

Current frontend behavior:

* Uses the `attempt` returned by this submit endpoint for immediate rendering.
* Refetches `GET /api/iebaseline/modules/{module_id}/attempts?user_id={user_id}`
  so refreshes and direct links can load the latest submitted result. This
  endpoint is required for reliable Final Results page behavior outside the
  immediate post-submit navigation.
* Calls `GET /api/iebaseline/home?user_id={user_id}` for user and module
  display context. The backend contract path is `/api/iebaseline/home`; the
  frontend may call it through a mounted/proxied path such as
  `/ietools/iebaseline/api/home`.
* Uses `user.name` for the display name, `user.position` for the role/title, and
  the matching `assignments[].module_name` for the current module label.
* Displays `Pending` when the backend returns `resultStatus: "Pending"`.
* Does not calculate pass/fail from `score` in React.

Future backend requirement:

* When pass/fail rules are configured, return `resultStatus: "Passed"` or
  `resultStatus: "Failed"` consistently from both this submit endpoint and the
  module attempt-list endpoint.

### Error Responses

```json
{
  "detail": "Attempt has already been submitted"
}
```

```json
{
  "detail": "Attempt not found"
}
```

## GET /api/iebaseline/modules/{module_id}/attempts

Lists attempts for one user/module.

Status: **Implemented**

This endpoint is required by the frontend Final Results page for refresh,
direct-link, and new-tab support. Immediately after submit, the frontend can
render from the `POST /api/iebaseline/attempts/{attempt_id}/submit` response
passed through router state. That router state is memory-only and is lost when
the learner refreshes the browser, opens the results URL directly, copies the
URL into a new tab, or returns to the page later. In those cases, the frontend
only has `{module_id}` from the route and must call this endpoint with
`user_id` to recover the latest submitted result.

The frontend selects the latest attempt where `attemptStatus` is `Completed` or
`Submitted`, ordered by `completedAt`, then `submittedAt`, then `lastSavedAt`,
then `startedAt`. The frontend does not need to apply `attemptNo` as a
tie-breaker.

The backend now returns attempts in compatible order:

1. `Completed` or `Submitted` attempts first.
2. Newest `completedAt`.
3. Newest `submittedAt`.
4. Newest `lastSavedAt`.
5. Newest `startedAt`.
6. Highest `attemptNo` as a deterministic server-side final tie-breaker.

### Request

| Item | Value |
| --- | --- |
| Authentication | None required |
| Path parameter | `module_id`, required integer |
| Query parameter | `user_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/modules/3/attempts?user_id=1
```

### Success Response

Status: `200 OK`

```json
{
  "attempts": [
    {
      "attemptId": 15,
      "moduleId": 3,
      "attemptNo": 1,
      "attemptStatus": "Completed",
      "resultStatus": "Pending",
      "answeredQuestions": 20,
      "totalQuestions": 20,
      "correctAnswers": 0,
      "score": 72.5,
      "progressPercentage": 100,
      "startedAt": "2026-07-22T13:00:00+08:00",
      "lastSavedAt": "2026-07-22T14:00:00+08:00",
      "submittedAt": "2026-07-22T14:00:00+08:00",
      "completedAt": "2026-07-22T14:00:01+08:00"
    }
  ]
}
```

## Current / Legacy: GET /api/iebaseline/modules/{moduleName}/questions

Fetches baseline checklist questions for a specific module from the
`baseline_checklist` database table.

Results are ordered by `question_no` and then `id`.

### Request

| Item | Value |
| --- | --- |
| Authentication | None required |
| Path parameter | `moduleName`, required string |
| Request body | None |

`moduleName` is the module name to search for, such as `Order to Cash`.

### Example Request

```http
GET /api/iebaseline/modules/Order%20to%20Cash/questions
```

### Success Response

Status: `200 OK`

If no rows match `moduleName`, the API returns an empty array: `[]`.

```json
[
  {
    "id": 1,
    "module_name": "Order to Cash",
    "category": "Process",
    "keyword": "Invoice",
    "ibpm_l2": "Manage Billing",
    "ibpm_l3": "Create Invoice",
    "risk": "Medium",
    "question_no": 10,
    "question": "Is invoice approval configured?",
    "options": "Yes|No",
    "reference": "REF-1",
    "memo": "Check workflow setup."
  }
]
```

### Response Fields

| Field | Description |
| --- | --- |
| `id` | Database row identifier |
| `module_name` | Module the question belongs to |
| `category` | Question category |
| `keyword` | Keyword associated with the question |
| `ibpm_l2` | IBPM level 2 process label |
| `ibpm_l3` | IBPM level 3 process label |
| `risk` | Risk value for the question |
| `question_no` | Question ordering number |
| `question` | The checklist question text |
| `options` | Available answer options as stored in the database |
| `reference` | Reference value for the question |
| `memo` | Additional notes for the question |

### Error Response

Status: `500 Internal Server Error`

```json
{
  "detail": "Database query failed"
}
```
