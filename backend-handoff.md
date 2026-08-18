# Backend Handoff

## IE Baseline Question Results XLSX Export

No backend changes required.

The `/iebaseline/attempts/:attemptId/results` page already receives the complete Question Results data from `GET /attempts/{attempt_id}/questions`. The XLSX file is generated client-side from that response using the existing frontend `exceljs` dependency.

## IE Baseline Current User Resolution And Manager Sync

Frontend change implemented: IE Baseline now sends richer current-user data from
`RetrieveUserInfoNoParam` when resolving the runtime `user_master` row.

### Current User Payload

`POST /api/iebaseline/users/resolve-current` should accept the existing fields
plus:

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

Frontend source mapping:

- `wd_id`: `RetrieveUserInfoNoParam.userNtid`, falling back to
  `RetrieveUserInfoNoParam.hc.employeeId`. Non-numeric values are sent as
  `null`.
- `manager`: only `RetrieveUserInfoNoParam.hc.managerChain[0]`.
- `manager.name`: `legalName`.
- `manager.email`: `email`.
- `manager.position`: `businessTitle`.

### Resolve-Current Backend Behavior

- Match users by normalized email.
- Create the current user if missing.
- Patch AD-owned fields for existing users when useful current-user values are
  available: `name`, `position`, `department`, and `wd_id`.
- Preserve manually managed fields such as `role_id`.
- Preserve an existing non-null `reports_to`.
- Do not overwrite useful stored values with null or empty current-user values.
- Return the resolved `user_id` as quickly as possible; manager linking should
  not delay Home page entry.

### Background Manager Sync Endpoint

Recommended endpoint:

```http
POST /api/iebaseline/users/{user_id}/sync-manager
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

Expected backend behavior:

- Treat this endpoint as best-effort and idempotent.
- Validate that `{user_id}` exists.
- If the current user's `reports_to` is already non-null, do nothing.
- If manager email is missing or invalid, do nothing or return a clear `400`.
- Find the manager by normalized email.
- If missing, create a partial manager user with:
  - `name = manager.name`
  - `email = manager.email`
  - `position = manager.position`
  - `department = null`
  - `wd_id = null`
  - `reports_to = null`
  - `role_id = 1`
- Update the current user's `reports_to` to the manager's `user_id`.

Suggested response:

```json
{
  "user_id": 42,
  "reports_to": 7,
  "manager_user_id": 7,
  "manager_created": false,
  "updated": true
}
```

### Partial Profile Completion

Manager-created users may be incomplete because manager chain data only includes
name, email, and business title. When such a user later signs in and calls
`resolve-current`, patch their full profile from their own
`RetrieveUserInfoNoParam` payload, including `wd_id`, department, and current
position, while preserving manually managed fields.

### Acceptance Scenarios

- Existing user receives `wd_id` during resolve-current.
- New user is created with `wd_id`.
- Existing user with null `reports_to` is linked by background manager sync.
- Existing user with non-null `reports_to` is not overwritten.
- Missing manager is created from `managerChain[0]` and linked.
- Partial manager-created user is completed when that manager later logs in.
- Manager sync failure does not block Home page loading.
