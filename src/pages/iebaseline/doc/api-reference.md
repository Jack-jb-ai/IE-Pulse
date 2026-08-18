# IE Baseline API Reference

This backend exposes a small FastAPI API for the IE Baseline frontend.

The parent application owns authentication. IE Baseline authorizes protected API
calls with the resolved `user_master.user_id` passed by the frontend.

## Current User Authorization Contract

The parent frontend module owns current-user discovery. It provides AD profile
details to IE Baseline, where users are identified by unique email address.

Flow:

1. Frontend calls `POST /api/iebaseline/users/resolve-current` with the current
   user's email, profile fields, optional `wd_id`, and optional manager payload.
2. The backend resolves by normalized email. If the user exists, it returns the
   existing `user_id`; if missing, it creates the `user_master` row with default
   role `1`.
3. The frontend may call `POST /api/iebaseline/users/{user_id}/sync-manager` in
   the background to link the current user to the first manager supplied by AD.
4. Subsequent APIs pass the resolved `user_id`, `uploadedBy`,
   `approver_user_id`, `reviewerUserId`, or `current_user_id` as required by
   each endpoint.

Route-level RBAC uses:

```text
user_master.role_id
  -> role_system_module_access.role_id
  -> system_module_master.system_module_id
```

Protected endpoints require the actor's role to have `can_view = true` for an
active `system_module_master.route_path`. Learner module assignment checks
remain separate and are still enforced where applicable.

Common RBAC errors:

```json
{ "detail": "current_user_id is required" }
```

```json
{ "detail": "User role is not authorized" }
```

```json
{ "detail": "User lacks system module access" }
```

Backend authorization checks compare these supplied identifiers against
`user_master.user_id`, `user_exam_attempt.user_id`,
`approval_request.assigned_to`, and route grants in
`role_system_module_access`.

Response format: endpoints return JSON.

## Coding Agent Invariants

When changing this backend, preserve these workflow invariants unless a new task
explicitly replaces them:

* Attempt start creates or backfills one `user_exam_answer` shell per module
  question in the same transaction as attempt creation/resume handling.
* `user_exam_answer` row existence does not mean a question is complete.
  Completion and progress must use `is_answered = true`.
* Question loading after attempt start should expose a usable
  `answer.answerId` for every question, so attachments can link to an answer
  before the learner clicks **Next Question**.
* Save and clear update the existing shell for `(attempt_id, question_id)`.
  They must not create a new answer row.
* Submit must reject unanswered shells before scoring. Do not mark blank/null
  shells as answered during submit.
* Required attachment validation still uses `is_attached = true` after the
  unanswered-shell check passes.

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

Authorization: uses `user_id` as the resolved IE Baseline actor and requires
access to `/iebaseline`.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved user query required |
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
      "status": "In Progress",
      "raw_status": "In Progress",
      "progress": 45,
      "assigned_at": "2026-07-22T01:00:00+00:00",
      "updated_at": "2026-07-22T01:00:00+00:00",
      "question_count": 12
    }
  ]
}
```

### Progress and Status Tracking

The home page status must be returned directly from
`user_checklist_status.status`. Progress uses the most recent exam attempt for
the assignment's `user_id` and `module_id` when the stored assignment status is
not `Not Started`.

`assignments[].progress` is a numeric percentage from `0` to `100`.

Calculation:

```text
progress = round(answered_questions / total_questions * 100)
```

Rules:

* If stored status is `Not Started`, return `progress = 0`.
* If stored status is `In Progress`, `Submitted`, `Rejected`, or `Completed`,
  calculate progress from the latest attempt.
* Approved approval-required modules no longer have an active assignment row,
  so they disappear from this assignment list. Attempt history and result detail
  endpoints continue to return the approved attempt.
* `answered_questions` must count rows in `user_exam_answer` for the latest
  attempt where `is_answered = true`.
* `total_questions` must count checklist questions in `baseline_checklist` for
  the module.
* Clamp the returned `progress` value to the range `0..100`.
* If `total_questions = 0`, return `progress = 0`.
* Saved `NA` / `N/A` answers still count as answered when
  `user_exam_answer.is_answered = true`.

### Latest Attempt Selection

When more than one `user_exam_attempt` exists for the same user and module, the
home endpoint must use the row with the highest `attempt_id`.

The latest attempt always wins for home page display, even if an older attempt
was completed.

### Status Mapping

`assignments[].status` is the stored `user_checklist_status.status` value.
`assignments[].raw_status` remains temporarily for compatibility and mirrors
`assignments[].status`.

The `checklist_status` enum is:

```sql
CREATE TYPE checklist_status AS ENUM (
    'Not Started',
    'In Progress',
    'Submitted',
    'Rejected',
    'Completed'
);
```

| Stored `user_checklist_status.status` | API `status` | `raw_status` | `progress` |
| --- | --- | --- | --- |
| `Not Started` | `Not Started` | `Not Started` | `0` |
| `In Progress` | `In Progress` | `In Progress` | Latest-attempt percentage |
| `Submitted` | `Submitted` | `Submitted` | Latest-attempt percentage |
| `Rejected` | `Rejected` | `Rejected` | Latest-attempt percentage |
| `Completed` | `Completed` | `Completed` | Latest-attempt percentage |

Frontend clients should use `assignments[].status` and `assignments[].progress`
for display.

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
| `assignments[].status` | Stored assignment workflow status: `Not Started`, `In Progress`, `Submitted`, `Rejected`, or `Completed` |
| `assignments[].raw_status` | Compatibility field mirroring `assignments[].status` |
| `assignments[].progress` | Latest-attempt completion percentage from `0` to `100` |
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

## POST /api/iebaseline/users/resolve-current

Resolves the signed-in AD user to a `user_master` row for IE Baseline learner
workflows. The operation is idempotent: repeated calls for the same normalized
email return the same `user_id`.

IE Baseline RBAC is not required for this bootstrap endpoint. The frontend
obtains AD profile details from the shared current-user lookup and posts the
selected fields here.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; no IE Baseline RBAC required |
| Parameters | None |
| Request body | JSON current-user profile |

### Example Request

```http
POST /api/iebaseline/users/resolve-current
Content-Type: application/json
```

```json
{
  "name": "Jack Goh",
  "email": "Jack_Goh@jabil.com",
  "position": "IE Engineer II",
  "department": "Industrial Engineering",
  "wd_id": 4389269,
  "manager": {
    "name": "Badrolhisham Bahari",
    "email": "BadrolHisham_Bahari@Jabil.com",
    "position": "IE Section Manager"
  }
}
```

### Success Response

Status: `200 OK`

```json
{
  "user_id": 42,
  "name": "Jack Goh",
  "position": "IE Engineer II",
  "wd_id": 4389269,
  "email": "jack_goh@jabil.com",
  "department": "Industrial Engineering",
  "role_id": 1,
  "reports_to": null,
  "created": true
}
```

### Backend Behavior

* Validate that `email` is present and non-empty.
* Normalize email with trim and lowercase before lookup.
* If the user exists, return the existing `user_id` with `created = false` and
  patch useful AD-sourced profile fields: `name`, `position`, `department`,
  `wd_id`, and `updated_at`.
* Preserve manually managed fields such as `role_id` and existing non-null
  `reports_to` for returning users.
* Do not overwrite useful stored values with null or empty current-user values.
* If the user does not exist, create a `user_master` row with default
  `role_id = 1`, `reports_to = null`, and `created = true`.
* Accept the optional `manager` payload for frontend compatibility, but do not
  link the manager in this endpoint.

### Error Responses

Status: `400 Bad Request`

```json
{
  "detail": "Email is required"
}
```

Status: `409 Conflict`

```json
{
  "detail": "wd_id already exists"
}
```

Status: `500 Internal Server Error`

```json
{
  "detail": "Database query failed"
}
```

## POST /api/iebaseline/users/{user_id}/sync-manager

Best-effort background endpoint that links a resolved current user to the first
manager supplied by AD user info. This endpoint is separate from
`resolve-current` so manager lookup and creation do not delay Home page entry.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; no IE Baseline RBAC required |
| Path parameter | `user_id`, required integer |
| Request body | JSON object with `manager` |

### Example Request

```http
POST /api/iebaseline/users/42/sync-manager
Content-Type: application/json
```

```json
{
  "manager": {
    "name": "Badrolhisham Bahari",
    "email": "BadrolHisham_Bahari@Jabil.com",
    "position": "IE Section Manager"
  }
}
```

### Success Response

Status: `200 OK`

```json
{
  "user_id": 42,
  "reports_to": 7,
  "manager_user_id": 7,
  "manager_created": false,
  "updated": true
}
```

If the current user already has `reports_to`, the endpoint returns a no-op
response with `updated = false`.

### Backend Behavior

* Validate that `user_id` exists.
* Validate that `manager.email` is present and has a basic email shape.
* If the current user's `reports_to` is already non-null, do not overwrite it.
* Find the manager by normalized email.
* If missing, create a partial manager user with `name`, normalized `email`,
  `position`, `department = null`, `wd_id = null`, `reports_to = null`, and
  `role_id = 1`.
* Update the current user's `reports_to` only when it is still null.

### Error Responses

Status: `400 Bad Request`

```json
{
  "detail": "Invalid manager email"
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

## POST /api/iebaseline/users/create

Creates a `user_master` row for User Management workflows.

IE Baseline RBAC is not required for this bootstrap/user-provisioning endpoint.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; no IE Baseline RBAC required |
| Parameters | None |
| Request body | JSON user profile |

### Example Request

```http
POST /api/iebaseline/users/create
Content-Type: application/json
```

```json
{
  "name": "Jack Goh",
  "position": "IE Engineer II",
  "wd_id": null,
  "reports_to": null,
  "email": "Jack_Goh@jabil.com",
  "department": "Industrial Engineering",
  "role_id": 1
}
```

### Success Response

Status: `200 OK`

```json
{
  "user_id": 42,
  "name": "Jack Goh",
  "position": "IE Engineer II",
  "wd_id": null,
  "email": "Jack_Goh@jabil.com",
  "department": "Industrial Engineering",
  "role_id": 1,
  "reports_to": null,
  "created": true
}
```

### Backend Behavior

* Validate that `name` is present and non-empty.
* Treat empty optional string fields as `null`.
* Default missing or null `role_id` to `1`.
* Validate that `role_id` exists in `role_master`.
* Validate that non-null `reports_to` exists in `user_master`.
* Reject duplicate non-null `email`.
* Reject duplicate non-null `wd_id`.
* Insert the user with database-managed `created_at` and `updated_at`.

### Error Responses

Status: `400 Bad Request`

```json
{
  "detail": "Name is required"
}
```

Status: `400 Bad Request`

```json
{
  "detail": "Invalid role_id"
}
```

Status: `400 Bad Request`

```json
{
  "detail": "Invalid reports_to"
}
```

Status: `409 Conflict`

```json
{
  "detail": "Email already exists"
}
```

Status: `409 Conflict`

```json
{
  "detail": "wd_id already exists"
}
```

Status: `500 Internal Server Error`

```json
{
  "detail": "Database query failed"
}
```

## PUT /api/iebaseline/users/{user_id}

Updates a `user_master` row for User Management workflows.

Authorization: requires `current_user_id` with access to `/iebaseline/users`.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved IE Baseline actor query required |
| Path parameter | `user_id`, required integer |
| Query parameter | `current_user_id`, required integer |
| Request body | JSON user profile |

### Example Request

```http
PUT /api/iebaseline/users/42?current_user_id=5
Content-Type: application/json
```

```json
{
  "name": "Jack Goh",
  "position": "IE Engineer III",
  "wd_id": 12345,
  "reports_to": 7,
  "email": "Jack_Goh@jabil.com",
  "department": "Industrial Engineering",
  "role_id": 2
}
```

### Success Response

Status: `200 OK`

```json
{
  "user_id": 42,
  "name": "Jack Goh",
  "position": "IE Engineer III",
  "wd_id": 12345,
  "email": "Jack_Goh@jabil.com",
  "department": "Industrial Engineering",
  "role_id": 2,
  "reports_to": 7,
  "created": false
}
```

### Backend Behavior

* Validate that `user_id` exists.
* Validate that `name` is present and non-empty.
* Treat empty optional string fields as `null`.
* Default missing or null `role_id` to `1`.
* Validate that `role_id` exists in `role_master`.
* Validate that non-null `reports_to` exists in `user_master` and is not the
  same as `user_id`.
* Reject duplicate non-null `email` owned by another user.
* Reject duplicate non-null `wd_id` owned by another user.
* Update database-managed `updated_at`.

### Error Responses

Status: `400 Bad Request`

```json
{
  "detail": "Name is required"
}
```

Status: `400 Bad Request`

```json
{
  "detail": "Invalid role_id"
}
```

Status: `400 Bad Request`

```json
{
  "detail": "Invalid reports_to"
}
```

Status: `404 Not Found`

```json
{
  "detail": "User not found"
}
```

Status: `409 Conflict`

```json
{
  "detail": "Email already exists"
}
```

Status: `409 Conflict`

```json
{
  "detail": "wd_id already exists"
}
```

Status: `500 Internal Server Error`

```json
{
  "detail": "Database query failed"
}
```

## DELETE /api/iebaseline/users/{user_id}

Deletes a `user_master` row for User Management workflows.

Authorization: requires `current_user_id` with access to `/iebaseline/users`.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved IE Baseline actor query required |
| Path parameter | `user_id`, required integer |
| Query parameter | `current_user_id`, required integer |
| Request body | None |

### Example Request

```http
DELETE /api/iebaseline/users/42?current_user_id=5
```

### Success Response

Status: `200 OK`

```json
{
  "deleted": true,
  "user_id": 42
}
```

### Backend Behavior

* Validate that `user_id` exists.
* Delete the user and allow database constraints to cascade or clear related
  records where configured.
* Return `409 Conflict` if related records prevent deletion, such as uploaded
  attachment metadata that references the user.

### Error Responses

Status: `404 Not Found`

```json
{
  "detail": "User not found"
}
```

Status: `409 Conflict`

```json
{
  "detail": "User cannot be deleted because related records exist"
}
```

Status: `500 Internal Server Error`

```json
{
  "detail": "Database query failed"
}
```

## GET /api/iebaseline/users/search

Searches users for User Management selectors, approval delegation, and
`reports_to` dropdowns. This endpoint is intended to avoid fetching every user
record when the frontend only needs a searchable pick list.

Authorization: requires `current_user_id` with access to either
`/iebaseline/users` or `/iebaseline/approvals/:approvalId/review`.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved IE Baseline actor query required |
| Query parameter | `q`, optional string |
| Query parameter | `limit`, optional integer, defaults to `25` |
| Query parameter | `exclude_user_id`, optional integer |
| Query parameter | `role_id`, optional integer |
| Query parameter | `current_user_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/users/search?q=jack&limit=25&exclude_user_id=42&current_user_id=5
```

```http
GET /api/iebaseline/users/search?q=alex&limit=25&role_id=2&current_user_id=5
```

### Success Response

Status: `200 OK`

```json
[
  {
    "user_id": 7,
    "name": "Jane Tan",
    "position": "Manager",
    "wd_id": 12345,
    "email": "Jane_Tan@jabil.com",
    "department": "Industrial Engineering",
    "role_id": 2,
    "role_name": "admin",
    "reports_to": null,
    "reports_to_name": null,
    "assigned_module_count": 3
  }
]
```

### Backend Behavior

* Search case-insensitively across `name`, `wd_id::text`, and `email`.
* Exclude `exclude_user_id` when supplied. This prevents assigning a user as
  their own manager in Update User.
* Filter to `user_master.role_id = role_id` when supplied. Approval delegation
  uses `role_id=2` to show only admin users.
* Order by best match, then `name`, then `user_id`.
* Return at most `limit` rows.

### Error Response

Status: `500 Internal Server Error`

```json
{
  "detail": "Database query failed"
}
```

## GET /api/iebaseline/users/{user_id}

Fetches one full `user_master` profile for User Management update and delete
workflows.

Authorization: requires `current_user_id` with access to `/iebaseline/users`.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved IE Baseline actor query required |
| Path parameter | `user_id`, required integer |
| Query parameter | `current_user_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/users/42?current_user_id=5
```

### Success Response

Status: `200 OK`

```json
{
  "user_id": 42,
  "name": "Jack Goh",
  "position": "IE Engineer II",
  "wd_id": 12345,
  "email": "Jack_Goh@jabil.com",
  "department": "Industrial Engineering",
  "role_id": 1,
  "role_name": "user",
  "reports_to": 7,
  "reports_to_name": "Jane Tan",
  "assigned_module_count": 3
}
```

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

## GET /api/iebaseline/roles

Fetches role options for User Management.

Authorization: requires `current_user_id` with access to `/iebaseline/users`.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved IE Baseline actor query required |
| Query parameter | `current_user_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/roles?current_user_id=5
```

### Success Response

Status: `200 OK`

```json
[
  { "role_id": 1, "role_name": "user" },
  { "role_id": 2, "role_name": "admin" },
  { "role_id": 3, "role_name": "dev" },
  { "role_id": 4, "role_name": "dev/admin" }
]
```

### Error Response

Status: `500 Internal Server Error`

```json
{
  "detail": "Database query failed"
}
```

## GET /api/iebaseline/users/{user_id}/delete-preview

Previews whether a user can be deleted and which related records may block the
delete.

Authorization: requires `current_user_id` with access to `/iebaseline/users`.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved IE Baseline actor query required |
| Path parameter | `user_id`, required integer |
| Query parameter | `current_user_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/users/42/delete-preview?current_user_id=5
```

### Success Response

Status: `200 OK`

```json
{
  "user_id": 42,
  "can_delete": false,
  "blocking_reasons": [
    "User has uploaded attachment metadata"
  ],
  "related_counts": {
    "assigned_modules": 3,
    "exam_attempts": 2,
    "uploaded_attachments": 1,
    "direct_reports": 4
  }
}
```

### Backend Behavior

* Return `can_delete = false` when known related records are expected to make
  `DELETE /api/iebaseline/users/{user_id}` return `409 Conflict`.
* Include counts for assignments, attempts, uploaded attachments, and direct
  reports where available.
* Treat direct reports as non-blocking if deleting this user only sets their
  `reports_to` to `null`.

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

Authorization: requires `current_user_id` with access to `/iebaseline/users`.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved IE Baseline actor query required |
| Query parameter | `current_user_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/users?current_user_id=5
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

Authorization: requires `current_user_id` with access to `/iebaseline/assign`.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved IE Baseline actor query required |
| Query parameter | `current_user_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/modules?current_user_id=5
```

### Success Response

Status: `200 OK`

```json
[
  {
    "module_id": 3,
    "module_name": "Order to Cash",
    "description": "Billing controls",
    "approval_required": true,
    "approvalRequired": true,
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
| `approval_required` | Stored module approval flag |
| `approvalRequired` | Camel-case alias for frontend approval routing |
| `owner_name` | Module owner, or `null` |
| `question_count` | Number of checklist questions for this module |

### Error Response

Status: `500 Internal Server Error`

```json
{
  "detail": "Database query failed"
}
```

## GET /api/iebaseline/users/{user_id}/system-modules

Returns active IE Baseline system routes that the resolved user's role can view.
The frontend uses this response for sidebar visibility and direct route blocking.

Authorization: validates that `user_id` exists and has a valid role.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; IE Baseline user already resolved |
| Path parameter | `user_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/users/1/system-modules
```

### Success Response

Status: `200 OK`

```json
{
  "user_id": 1,
  "role_id": 2,
  "modules": [
    {
      "system_module_id": 1,
      "module_code": "EDIT_MODULES",
      "module_name": "Edit Modules",
      "module_description": "Create, edit, and maintain baseline exam modules.",
      "route_path": "/iebaseline/edit",
      "can_view": true,
      "is_active": true
    }
  ]
}
```

For a valid user with no access rows, return:

```json
{
  "user_id": 1,
  "role_id": 1,
  "modules": []
}
```

### Backend Behavior

* Join `user_master` to `role_system_module_access` by `role_id`.
* Join to `system_module_master` by `system_module_id`.
* Include only `role_system_module_access.can_view = true`.
* Include only `system_module_master.is_active = true`.
* Return modules ordered by `system_module_id`.
* Return snake_case field names.

### Error Responses

Status: `404 Not Found`

```json
{
  "detail": "User not found"
}
```

Status: `403 Forbidden`

```json
{
  "detail": "User role is not authorized"
}
```

Status: `500 Internal Server Error`

```json
{
  "detail": "Database query failed"
}
```

## GET /api/iebaseline/users/{user_id}/modules

Fetches a user and the module IDs currently assigned to them.

Authorization: requires `current_user_id` with access to `/iebaseline/assign`.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved IE Baseline actor query required |
| Path parameter | `user_id`, required integer |
| Query parameter | `current_user_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/users/1/modules?current_user_id=5
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

Authorization: requires `current_user_id` with access to `/iebaseline/assign`.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved IE Baseline actor query required |
| Path parameter | `user_id`, required integer |
| Query parameter | `current_user_id`, required integer |
| Request body | JSON object |

### Example Request

```http
PUT /api/iebaseline/users/1/modules?current_user_id=5
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
* Insert missing `user_checklist_status` rows with default `Not Started`.
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
| Authentication | Main application authentication; resolved IE Baseline actor query required |
| Path parameter | `module_id`, required integer |
| Query parameter | `current_user_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/modules/3/questions?current_user_id=1
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
| Authentication | Main application authentication; resolved learner query/body required |
| Path parameter | `module_id`, required integer |
| Request body | JSON object with `userId` |

The learner user ID is the resolved IE Baseline actor. The backend checks that
the actor can view `/iebaseline/module/:moduleId`, then separately checks that
the learner is assigned to the requested module.

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
  `attemptNo`, `attemptStatus: "In Progress"`, and `lastSavedAt: null`.
* Set `user_checklist_status.status` to `In Progress` in the same transaction
  as start/resume.
* After selecting or creating the editable attempt, insert missing
  `user_exam_answer` shells for every `baseline_checklist` row in the module.
  This must be idempotent, for example using
  `ON CONFLICT (attempt_id, question_id) DO NOTHING`.
* Shell values are `selected_answer = NULL`, `is_answered = FALSE`,
  `is_attached = FALSE`, scoring fields null, and timestamps set.
* The start action is the attempt creation boundary. Do not wait for the first
  saved answer before inserting `user_exam_attempt` or answer shells.
* Do not reuse `Completed` or `Submitted` attempts for editable starts. Those
  attempts remain available for read-only review through attempt history and
  attempt questions.
* Do not use start to continue a rejected attempt. A rejected continue flow
  should select the latest rejected `attemptId` from attempt history, then use
  the attempt-scoped question, answer, attachment, and submit endpoints for that
  same attempt.
* Require an active `user_checklist_status` row for the learner and module before
  creating or resuming an editable attempt.
* Reject editable starts while a submitted attempt for the same learner/module
  is still waiting for approval with result status `PENDING` or `IN_PROGRESS`.
* After an attempt is `REJECTED`, keep the assignment active with status
  `Rejected` and allow the learner to edit and resubmit the same attempt.
* After an attempt is `APPROVED`, delete the active assignment row for that
  learner/module. Starts are only allowed again if a later workflow explicitly
  reassigns the module.

### Success Response

Status: `200 OK`

```json
{
  "attempt": {
    "attemptId": 15,
    "moduleId": 3,
    "attemptNo": 2,
    "attemptStatus": "In Progress",
    "resultStatus": "PENDING",
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

After a valid attempt start, every question should have an `answer.answerId`.
If `answerId` is null for an in-progress attempt, treat that as a shell creation
or backfill bug, not as normal unanswered state.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved IE Baseline actor query required |
| Path parameter | `attempt_id`, required integer |
| Query parameter | `current_user_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/attempts/15/questions?current_user_id=1
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
      "attachmentRequirement": "required",
      "attachmentInstruction": "Upload the signed checklist or supporting evidence for this item.",
      "attachmentApprovalRequired": false,
      "answer": {
        "answerId": 5001,
        "selectedAnswer": null,
        "isAnswered": false,
        "isAttached": false,
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

Questions with `attachmentRequirement: "required"` should display the frontend
attachment section and use `attachmentInstruction` from
`baseline_checklist.attachment_instruction` as the required evidence helper text.
If that value is blank or null, the frontend may fall back to its default required
attachment copy. `answer.isAttached` is maintained by the backend attachment APIs
and indicates whether that saved answer currently has evidence linked. Attachment
upload should use `answer.answerId`; it should not wait for the answer save
endpoint.

## PUT /api/iebaseline/attempts/{attempt_id}/questions/{question_id}/answer

Updates one answer shell for an in-progress attempt.

The frontend treats this endpoint as a forward-navigation save, not an
autosave. Selecting or changing an option in the UI is local state only. The
frontend sends this request only when the learner clicks **Next Question** or
when **Finish Checklist** saves the final answer before submit.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved IE Baseline actor query required |
| Path parameter | `attempt_id`, required integer |
| Path parameter | `question_id`, required integer |
| Query parameter | `current_user_id`, required integer |
| Request body | JSON object with `selectedAnswer` |

The backend trims whitespace from `selectedAnswer`. `null`, empty, or
whitespace-only values are treated as not answered.

### Backend Behavior

* Validate that `current_user_id` has access to `/iebaseline/module/:moduleId`.
* Validate that `current_user_id` owns the attempt.
* Validate that the attempt exists and is still editable.
* Learner editability is determined from `user_checklist_status.status`, not
  from `user_exam_attempt.result_status`.
* Only assignments with status `In Progress` may be saved by the learner.
  `result_status = IN_PROGRESS` means an approver is actively reviewing and
  must not unlock learner editing.
* Validate that the question belongs to the attempt's module.
* Locate the existing `user_exam_answer` shell by `(attempt_id, question_id)`.
* If the shell does not exist, return a clear error such as
  `"Answer shell not found"`; do not create a replacement row here.
* If the learner changes an answer within the same attempt, update that same
  row.
* Update answer/progress fields only, including `selectedAnswer`, `isAnswered`,
  `answerId`, answered count, progress percentage, and `lastSavedAt`.
* Do not calculate scoring, correctness, final score, result status, completion
  timestamps, or assignment completion in this endpoint.

### Example Request

```http
PUT /api/iebaseline/attempts/15/questions/25/answer?current_user_id=1
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
  "answerId": 5001,
  "selectedAnswer": "Yes",
  "isAnswered": true,
  "isAttached": false,
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

```json
{
  "detail": "Answer shell not found"
}
```

## DELETE /api/iebaseline/attempts/{attempt_id}/questions/{question_id}/answer

Clears one saved answer for an editable attempt.

Learner editability follows the same rule as save: the active assignment must
have `user_checklist_status.status = 'In Progress'` or `Rejected`. Do not treat
`user_exam_attempt.result_status = 'IN_PROGRESS'` as learner-editable; that
state belongs to approver review.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved IE Baseline actor query required |
| Path parameter | `attempt_id`, required integer |
| Path parameter | `question_id`, required integer |
| Query parameter | `current_user_id`, required integer |
| Request body | None |

### Success Response

Status: `200 OK`

The response shape is the same as save answer.

### Example Request

```http
DELETE /api/iebaseline/attempts/15/questions/25/answer?current_user_id=1
```

```json
{
  "attemptId": 15,
  "questionId": 25,
  "answerId": 5001,
  "selectedAnswer": null,
  "isAnswered": false,
  "isAttached": false,
  "answeredQuestions": 12,
  "totalQuestions": 20,
  "progressPercentage": 60,
  "lastSavedAt": "2026-07-22T13:40:00+08:00"
}
```

## POST /api/iebaseline/attempts/{attempt_id}/submit

Submits an attempt. For modules that do not require approval, this endpoint
triggers backend scoring immediately. For modules where
`module_master.approval_required = true`, this endpoint creates an approval
request and hides the score until the reviewer completes the workflow.

The frontend treats this endpoint as the scoring trigger. The backend remains
authoritative for all correctness, per-question points, final score, completion
status, and assignment status updates.

Before calling submit, the frontend saves the current final answer with
`PUT /api/iebaseline/attempts/{attempt_id}/questions/{question_id}/answer`.
For non-approval modules, this submit endpoint is the only learner endpoint that
should calculate scoring or complete the attempt. For approval-required modules,
scoring is deferred to the approval decision endpoint.

Submit is not a fallback save. The backend must reject any shell that still has
`is_answered = false`; the oldest unanswered shell is the checkpoint the
frontend should return to.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved IE Baseline actor query required |
| Path parameter | `attempt_id`, required integer |
| Query parameter | `current_user_id`, required integer |
| Request body | None |

### Example Request

```http
POST /api/iebaseline/attempts/15/submit?current_user_id=1
```

### Backend Behavior

* Validate that `current_user_id` has access to `/iebaseline/module/:moduleId`.
* Validate that `current_user_id` owns the attempt.
* Reject attempts whose active assignment status is neither `In Progress` nor
  `Rejected`. `Rejected` means the learner may correct and resubmit the same
  attempt. `user_exam_attempt.result_status = IN_PROGRESS` is reviewer review
  state and must not make a submitted attempt learner-editable.
* Reject unanswered shells before required attachment validation.

### Success Response

Status: `200 OK`

The response shape is the same attempt/progress wrapper returned by start.
For modules with `approval_required = false`, the attempt is updated to:

| Field | Value |
| --- | --- |
| `attemptStatus` | `Completed` |
| `resultStatus` | `PENDING`, unless the backend has a configured pass/fail rule |
| `score` | Percentage score from `0` to `100` |
| `correctAnswers` | `0` for configurable scoring modules without a correct-answer key |
| `submittedAt` | Current timestamp |
| `completedAt` | Current timestamp |

For modules with `approval_required = true`, the attempt is updated to:

| Field | Value |
| --- | --- |
| `attemptStatus` | `Submitted` |
| `resultStatus` | `PENDING` |
| `score` | `null` |
| `correctAnswers` | `0` |
| `submittedAt` | Current timestamp |
| `completedAt` | `null` until approval decision |

Example non-approval response:

```json
{
  "attempt": {
    "attemptId": 15,
    "moduleId": 3,
    "attemptNo": 1,
    "attemptStatus": "Completed",
    "resultStatus": "PENDING",
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

Example approval-required response:

```json
{
  "attempt": {
    "attemptId": 15,
    "moduleId": 3,
    "attemptNo": 1,
    "attemptStatus": "Submitted",
    "resultStatus": "PENDING",
    "answeredQuestions": 20,
    "totalQuestions": 20,
    "correctAnswers": 0,
    "score": null,
    "progressPercentage": 100,
    "startedAt": "2026-07-22T13:00:00+08:00",
    "lastSavedAt": "2026-07-22T14:00:00+08:00",
    "submittedAt": "2026-07-22T14:00:00+08:00",
    "completedAt": null
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

* Validate attempt ownership/editability. Learner editability comes from
  `user_checklist_status.status IN ('In Progress', 'Rejected')`, not from
  `user_exam_attempt.result_status`.
* Validate that all answer shells for the attempt have `is_answered = true`.
  Reject before scoring when any shell is still false.
* Validate required attachments after unanswered-shell validation. Questions
  with a saved leading answer label of `NA` or `N/A` are treated as not
  applicable and do not require attachments, including descriptive values such
  as `NA - No machine needed for this product`.
* Calculate scores in one transaction only when module approval is not required.
* If module approval is required, create one `approval_request` for the attempt
  and leave score fields hidden until final decision. If the same attempt was
  previously rejected, reuse its existing approval request by setting it back to
  `PENDING`, updating the assigned approver, and clearing prior remarks and
  completion timestamp.
* Assign the approval request to `module_master.owner_user_id`; if the owner is
  null, fallback to `user_checklist_status.assignee_id`.
* Load answer options from the module's configured `scoring_metric_id`.
* Never hardcode answer values such as `Yes`, `No`, or `Partial`.
* Match scoring options against the selected answer's leading label before `-`
  when checklist options store descriptive labels such as `Yes - ...`.
* Calculate each answer using `baseline_checklist.available_points * scoring_metric_option.score_multiplier`.
* Treat unmatched saved selections as `0` awarded score against the question's available points.
* Treat selected options with `scoring_metric_option.is_applicable = false` as excluded from scoring.
  These rows remain answered, but store `score_awarded` and `maximum_score` as `null`.
* Store `is_correct`, `score_awarded`, and `maximum_score` on `user_exam_answer`.
* Keep `is_correct` as `null` for modules that do not have a configured correct-answer key.
* Store `score`, `correct_answers`, `submitted_at`, and `completed_at` on
  `user_exam_attempt` for non-approval modules and approval final decisions.
* Store `correct_answers` as `0` when scoring is numeric-only.
* For non-approval modules, set `user_checklist_status.status` to `Completed`
  on submit.
* For approval-required modules, set `user_checklist_status.status` to
  `Submitted` on submit. On reviewer decision, delete the active assignment row
  after `APPROVED`, or set it to `Rejected` after `REJECTED` so the learner can
  retry by editing and resubmitting the same attempt.
* Assignment cleanup must not delete `user_exam_attempt`, `user_exam_answer`,
  approval request, or attachment history.
* For approval-required modules, set `resultStatus` to `PENDING` on submit and
  to `APPROVED` or `REJECTED` on decision.

### Frontend Save Timing Contract

The backend should expect this request sequence from the current frontend:

* Selecting or changing an answer option sends no API request.
* Clicking **Next Question** sends exactly one save request for the current
  question before advancing.
* Clicking **Finish Checklist** sends one save request for the final question,
  then sends this submit request.
* If submit returns `UNANSWERED_QUESTIONS`, navigate back to the returned
  unanswered question instead of treating the attempt as complete.
* Closing the modal or browser does not save unsaved local selection changes.
* Reopening an unfinished module resumes from the latest saved `In Progress`
  attempt and saved `user_exam_answer` rows.
* Continuing a rejected module opens the latest rejected attempt and reuses its
  saved `user_exam_answer` rows so prior rejected answers are prefilled and can
  be corrected in place.

### Final Results Page Contract

After a successful submit, the frontend redirects learners to:

```text
/ietools/iebaseline/attempts/{attempt_id}/results
```

The page shows the selected attempt's score, completion timestamp, result, and
question-level saved answers/scores. The backend remains authoritative for
`resultStatus`.

Current frontend behavior:

* Uses the `attempt` returned by this submit endpoint for immediate rendering.
* Refetches `GET /api/iebaseline/attempts/{attempt_id}/questions` so refreshes
  and direct links can load the exact selected attempt and its saved answers.
* The legacy `/ietools/iebaseline/module/{module_id}/results` route may still
  recover the latest submitted/completed module attempt through
  `GET /api/iebaseline/modules/{module_id}/attempts?user_id={user_id}`, but new
  navigation should prefer the attempt-specific route.
* Calls `GET /api/iebaseline/home?user_id={user_id}` for user and module
  display context. The backend contract path is `/api/iebaseline/home`; the
  frontend may call it through a mounted/proxied path such as
  `/ietools/iebaseline/api/home`.
* Uses `user.name` for the display name and `user.position` for the role/title
  when available. Module label comes from the attempt/detail payload first,
  falling back to active assignment context only when that assignment still
  exists.
* Displays pending status when the backend returns `resultStatus: "PENDING"`.
* Does not calculate pass/fail from `score` in React.
* If the backend returns `attemptStatus: "Submitted"` and `score: null`, the
  result is waiting for approval and the frontend should show approval status
  rather than a final score.
* Back buttons navigate to the previous in-app route when available and fall
  back to `/ietools/iebaseline` on direct entry.

Future backend requirement:

* When pass/fail rules are configured, return the configured result status
  consistently from both this submit endpoint and the
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

Status: `400 Bad Request`

```json
{
  "detail": {
    "success": false,
    "code": "UNANSWERED_QUESTIONS",
    "message": "All questions must be answered before submit.",
    "unanswered_questions": [
      {
        "question_id": 25,
        "question_no": "10"
      }
    ]
  }
}
```

Status: `400 Bad Request`

```json
{
  "detail": {
    "success": false,
    "code": "REQUIRED_ATTACHMENTS_MISSING",
    "message": "Required attachments are missing.",
    "missing_questions": [
      {
        "question_id": 10,
        "question_no": "4"
      }
    ]
  }
}
```

## GET /api/iebaseline/attempts

Lists attempts for one user, optionally filtered by module.

Status: **Backend change requested**

This endpoint backs the frontend Previous Attempts page. It must not require an
active `user_checklist_status` row, because approved modules intentionally
disappear from the active assignment dashboard.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved learner query required |
| Query parameter | `user_id`, required integer |
| Query parameter | `module_id`, optional integer |
| Request body | None |

### Example Requests

```http
GET /api/iebaseline/attempts?user_id=1
GET /api/iebaseline/attempts?user_id=1&module_id=3
```

### Success Response

Status: `200 OK`

```json
{
  "attempts": [
    {
      "attemptId": 15,
      "moduleId": 3,
      "moduleName": "Order to Cash",
      "attemptNo": 2,
      "attemptStatus": "Completed",
      "resultStatus": "APPROVED",
      "answeredQuestions": 20,
      "totalQuestions": 20,
      "correctAnswers": 0,
      "score": 72.5,
      "progressPercentage": 100,
      "startedAt": "2026-08-05T09:00:00+08:00",
      "lastSavedAt": "2026-08-05T10:20:00+08:00",
      "submittedAt": "2026-08-05T10:00:00+08:00",
      "completedAt": "2026-08-05T10:20:00+08:00"
    }
  ]
}
```

## GET /api/iebaseline/modules/{module_id}/attempts

Lists attempts for one user/module.

Status: **Implemented**

This endpoint remains available for module-scoped review flows and the legacy
module results route. New attempt result navigation should use
`/iebaseline/attempts/{attempt_id}/results` and
`GET /api/iebaseline/attempts/{attempt_id}/questions`.

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
| Authentication | Main application authentication; resolved learner query required |
| Path parameter | `module_id`, required integer |
| Query parameter | `user_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/modules/3/attempts?user_id=1
```

The `user_id` query value is the resolved IE Baseline actor. The backend checks
that the actor can view `/iebaseline/module/:moduleId/results`.

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
      "resultStatus": "PENDING",
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

## Approval Module

Approval APIs use the current IE Baseline identity contract. The frontend first
resolves or creates a `user_master` record using the current user's email, then
passes the resolved user ID to these endpoints. Learner APIs use `user_id`.
Reviewer APIs use `approver_user_id`, `reviewer_user_id`, or `reviewerUserId`.
The backend checks those actor IDs against route-level RBAC before loading or
mutating approval data.

Scores are hidden while approval status is `PENDING` or `IN_PROGRESS`. Scores
are returned after `APPROVED`, `REJECTED`, or `CANCELLED`.

### GET /api/iebaseline/approvals/my-submissions

Lists approval requests for attempts submitted by one learner.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved user query required |
| Query parameter | `user_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/approvals/my-submissions?user_id=1
```

### Success Response

Status: `200 OK`

```json
{
  "approvals": [
    {
      "approvalId": 7,
      "attemptId": 15,
      "moduleId": 3,
      "moduleName": "Order to Cash",
      "attemptNo": 1,
      "learner": { "userId": 1, "name": "Jane Tan" },
      "approver": { "userId": 5, "name": "Alex Lee" },
      "status": "PENDING",
      "attemptStatus": "Submitted",
      "resultStatus": "PENDING",
      "remarks": null,
      "score": null,
      "submittedAt": "2026-08-05T10:00:00+08:00",
      "createdAt": "2026-08-05T10:00:01+08:00",
      "updatedAt": "2026-08-05T10:00:01+08:00",
      "completedAt": null,
      "attemptCompletedAt": null
    }
  ]
}
```

### GET /api/iebaseline/approvals/inbox

Lists approval requests assigned to one reviewer.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved approver query required |
| Query parameter | `approver_user_id`, required integer |
| Query parameter | `status`, optional one of `PENDING`, `IN_PROGRESS`, `APPROVED`, `REJECTED`, `CANCELLED` |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/approvals/inbox?approver_user_id=5&status=PENDING
```

The success response shape is the same as `my-submissions`.

### POST /api/iebaseline/approvals/{approval_id}/start

Marks a pending approval as actively being reviewed.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; reviewer body field required |
| Path parameter | `approval_id`, required integer |
| Request body | JSON object with `reviewerUserId` |

```json
{
  "reviewerUserId": 5
}
```

### Success Response

Status: `200 OK`

```json
{
  "approval": {
    "approvalId": 7,
    "attemptId": 15,
    "assignedTo": 5,
    "status": "IN_PROGRESS",
    "remarks": null,
    "createdAt": "2026-08-05T10:00:01+08:00",
    "updatedAt": "2026-08-05T10:05:00+08:00",
    "completedAt": null
  }
}
```

### POST /api/iebaseline/approvals/{approval_id}/delegate

Reassigns an active approval request to another admin user.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; reviewer body field required |
| Path parameter | `approval_id`, required integer |
| Request body | JSON object with `reviewerUserId` and `delegateToUserId` |

```json
{
  "reviewerUserId": 5,
  "delegateToUserId": 9
}
```

Validation:

* `reviewerUserId` must match the current `approval_request.assigned_to`.
* Approval status must not be `APPROVED`, `REJECTED`, or `CANCELLED`.
* `delegateToUserId` must exist in `user_master`.
* `delegateToUserId` must have `role_id = 2`.

### Success Response

Status: `200 OK`

```json
{
  "approval": {
    "approvalId": 7,
    "attemptId": 15,
    "assignedTo": 9,
    "status": "PENDING",
    "remarks": null,
    "createdAt": "2026-08-05T10:00:01+08:00",
    "updatedAt": "2026-08-18T10:30:00+08:00",
    "completedAt": null
  }
}
```

### Backend Behavior

* Updates `approval_request.assigned_to` to `delegateToUserId`.
* Updates `approval_request.updated_at`.
* Sends a best-effort `APPROVAL_REQUEST` notification to the delegated admin
  after the database update succeeds.

### GET /api/iebaseline/approvals/{approval_id}/review

Returns approval metadata, attempt metadata, progress, and checklist questions
using the existing review question response shape.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; reviewer query required |
| Path parameter | `approval_id`, required integer |
| Query parameter | `reviewer_user_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/approvals/7/review?reviewer_user_id=5
```

### Success Response

Status: `200 OK`

```json
{
  "approval": {},
  "attempt": {},
  "progress": {},
  "questions": []
}
```

### PUT /api/iebaseline/approvals/{approval_id}/answers/{answer_id}

Lets the assigned reviewer modify a submitted answer directly. The answer must
belong to the approval's attempt. Editing a pending approval automatically moves
it to `IN_PROGRESS`.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; reviewer body field required |
| Path parameter | `approval_id`, required integer |
| Path parameter | `answer_id`, required integer |
| Request body | JSON object with `reviewerUserId` and `selectedAnswer` |

```json
{
  "reviewerUserId": 5,
  "selectedAnswer": "Partial"
}
```

### Success Response

Status: `200 OK`

The response shape is the same as learner answer save.

```json
{
  "attemptId": 15,
  "questionId": 25,
  "answerId": 5001,
  "selectedAnswer": "Partial",
  "isAnswered": true,
  "isAttached": false,
  "answeredQuestions": 20,
  "totalQuestions": 20,
  "progressPercentage": 100,
  "lastSavedAt": "2026-08-05T10:10:00+08:00"
}
```

### POST /api/iebaseline/approvals/{approval_id}/decision

Completes the approval. The backend recalculates score from the current
authoritative answers, updates the attempt result status, stores reviewer
remarks, releases the final score, and updates active assignment access. An
approved decision deletes the matching `user_checklist_status` row for the
learner/module; a rejected decision keeps the row active with status `Rejected`.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; reviewer body field required |
| Path parameter | `approval_id`, required integer |
| Request body | JSON object with `reviewerUserId`, `decision`, and optional `remarks` |

`decision` must be `APPROVED` or `REJECTED`.

```json
{
  "reviewerUserId": 5,
  "decision": "APPROVED",
  "remarks": "Approved after evidence review."
}
```

### Success Response

Status: `200 OK`

```json
{
  "approval": {
    "approvalId": 7,
    "attemptId": 15,
    "assignedTo": 5,
    "status": "APPROVED",
    "remarks": "Approved after evidence review.",
    "createdAt": "2026-08-05T10:00:01+08:00",
    "updatedAt": "2026-08-05T10:20:00+08:00",
    "completedAt": "2026-08-05T10:20:00+08:00"
  },
  "attempt": {
    "attemptId": 15,
    "moduleId": 3,
    "attemptNo": 1,
    "attemptStatus": "Completed",
    "resultStatus": "APPROVED",
    "answeredQuestions": 20,
    "totalQuestions": 20,
    "correctAnswers": 0,
    "score": 72.5,
    "progressPercentage": 100,
    "startedAt": "2026-08-05T09:00:00+08:00",
    "lastSavedAt": "2026-08-05T10:20:00+08:00",
    "submittedAt": "2026-08-05T10:00:00+08:00",
    "completedAt": "2026-08-05T10:20:00+08:00"
  },
  "progress": {
    "answeredQuestions": 20,
    "totalQuestions": 20,
    "progressPercentage": 100,
    "lastSavedAt": "2026-08-05T10:20:00+08:00"
  }
}
```

### Approval Error Responses

Common approval errors:

```json
{ "detail": "User not found" }
```

```json
{ "detail": "Approval not found" }
```

```json
{ "detail": "User is not assigned to this approval" }
```

```json
{ "detail": "Approval is already completed" }
```

## Notification Module

Notification APIs send backend-rendered email through the corporate SMTP server.
Approval workflows already send notifications automatically after successful
database commits, so manual sends are optional.

### POST /api/iebaseline/notifications/send-email

Sends one approval notification email. This endpoint intentionally does not use
route-level RBAC or `current_user_id`, but it applies minimum protection by
requiring `senderUserId` to exist in `user_master`.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication |
| Route RBAC | None |
| Request body | JSON object |

```json
{
  "senderUserId": 5,
  "recipientUserId": 1,
  "purpose": "APPROVAL_REQUEST",
  "approvalId": 7,
  "context": {}
}
```

Supported `purpose` values:

```text
APPROVAL_REQUEST
APPROVAL_APPROVED
APPROVAL_REJECTED
```

Validation:

* `senderUserId` is required and must exist in `user_master`.
* `recipientUserId` is required, must exist in `user_master`, and must have a non-empty `email`.
* `approvalId` is required for approval purposes.
* For approval purposes, the backend loads approval, module, learner, approver, and email data from trusted tables.
* `context` is reserved for optional future placeholders and cannot override authoritative approval data.

### Success Response

Status: `200 OK`

```json
{
  "success": true,
  "message": "Email successfully sent",
  "purpose": "APPROVAL_REQUEST",
  "senderUserId": 5,
  "recipientUserId": 1
}
```

### Error Responses

```json
{ "detail": "senderUserId is required" }
```

```json
{ "detail": "Sender user not found" }
```

```json
{ "detail": "Recipient email is required" }
```

## Module Attachments

Module attachments are stored on the backend machine under the `.env`
`ATTACHMENT_FOLDER` path. PostgreSQL stores metadata and relationships only.
The physical stored filename is derived from PostgreSQL's generated
`attachment_unq_id`, using `{attachmentUnqId}{fileExtension}`.

The parent application owns authentication. Attachment APIs use the resolved IE
Baseline actor from `uploadedBy` or `user_id`. The backend checks route-level
RBAC and also allows access only when `user_checklist_status` links that user to
the module.

Allowed filename extensions:

```text
.jpg, .jpeg, .png, .txt, .pdf, .docx, .xlsx, .pptx, .csv
```

The backend checks the uploaded filename extension before saving the file. If
the extension is not accepted, the API returns:

```json
{
  "detail": "file type not accepted"
}
```

### POST /api/iebaseline/modules/{module_id}/attachments

Uploads one attachment for a module.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; uploader field required |
| Path parameter | `module_id`, required integer |
| Request body | `multipart/form-data` |
| Required form field | `file`, uploaded file |
| Required form field | `uploadedBy`, integer user ID |
| Required form field | `answerId`, integer `user_exam_answer.answer_id` |
| Optional form field | `displayOrder`, integer, default `0` |

Do not manually set `Content-Type` when using browser `FormData`; the browser
must set the multipart boundary.

### Example Request

```javascript
const formData = new FormData();
formData.append("file", file);
formData.append("uploadedBy", String(userId));
formData.append("answerId", String(answerId));
formData.append("displayOrder", "0");

await fetch(`/api/iebaseline/modules/${moduleId}/attachments`, {
  method: "POST",
  body: formData,
});
```

### Success Response

Status: `200 OK`

```json
{
  "attachment": {
    "id": 15,
    "attachmentUnqId": "3a83398f-9f4a-453d-89a4-708e20f8f851",
    "moduleId": 3,
    "answerId": 501,
    "originalFileName": "manual.pdf",
    "mimeType": "application/pdf",
    "fileExtension": ".pdf",
    "fileSizeBytes": 2839102,
    "displayOrder": 0,
    "uploadedBy": 1,
    "createdAt": "2026-07-27T11:30:00+08:00",
    "downloadUrl": "/api/iebaseline/attachments/3a83398f-9f4a-453d-89a4-708e20f8f851/download"
  }
}
```

### GET /api/iebaseline/modules/{module_id}/attachments

Lists attachments for one module.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved user query required |
| Path parameter | `module_id`, required integer |
| Query parameter | `user_id`, required integer |
| Query parameter | `answer_id`, optional integer filter |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/modules/3/attachments?user_id=1&answer_id=501
```

### Success Response

Status: `200 OK`

```json
{
  "attachments": [
    {
      "id": 15,
      "attachmentUnqId": "3a83398f-9f4a-453d-89a4-708e20f8f851",
      "moduleId": 3,
      "answerId": 501,
      "originalFileName": "manual.pdf",
      "mimeType": "application/pdf",
      "fileExtension": ".pdf",
      "fileSizeBytes": 2839102,
      "displayOrder": 0,
      "uploadedBy": 1,
      "createdAt": "2026-07-27T11:30:00+08:00",
      "downloadUrl": "/api/iebaseline/attachments/3a83398f-9f4a-453d-89a4-708e20f8f851/download"
    }
  ]
}
```

### GET /api/iebaseline/attachments/{attachment_unq_id}/download

Downloads one attachment through the backend.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved user query required |
| Path parameter | `attachment_unq_id`, required UUID |
| Query parameter | `user_id`, required integer |
| Request body | None |

### Example Request

```http
GET /api/iebaseline/attachments/3a83398f-9f4a-453d-89a4-708e20f8f851/download?user_id=1
```

The response body is the file content. The backend sets the download filename
from `attachment_master.original_file_name`.

### DELETE /api/iebaseline/modules/{module_id}/attachments/{attachment_unq_id}

Removes an attachment link from a module. If the attachment is no longer linked
to any module, the backend also removes the metadata row and local file.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved user query required |
| Path parameter | `module_id`, required integer |
| Path parameter | `attachment_unq_id`, required UUID |
| Query parameter | `user_id`, required integer |
| Request body | None |

### Example Request

```http
DELETE /api/iebaseline/modules/3/attachments/3a83398f-9f4a-453d-89a4-708e20f8f851?user_id=1
```

### Success Response

Status: `200 OK`

```json
{
  "deleted": true,
  "attachmentUnqId": "3a83398f-9f4a-453d-89a4-708e20f8f851"
}
```

### Error Responses

```json
{
  "detail": "Module not found"
}
```

```json
{
  "detail": "User not found"
}
```

```json
{
  "detail": "User lacks module access"
}
```

```json
{
  "detail": "Attachment not found"
}
```

## Current / Legacy: GET /api/iebaseline/modules/{moduleName}/questions

Fetches baseline checklist questions for a specific module from the
`baseline_checklist` database table.

Results are ordered by `question_no` and then `id`.

### Request

| Item | Value |
| --- | --- |
| Authentication | Main application authentication; resolved IE Baseline actor query required |
| Path parameter | `moduleName`, required string |
| Query parameter | `current_user_id`, required integer |
| Request body | None |

`moduleName` is the module name to search for, such as `Order to Cash`.

### Example Request

```http
GET /api/iebaseline/modules/Order%20to%20Cash/questions?current_user_id=1
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
