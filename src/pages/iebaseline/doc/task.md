# Frontend Handoff: IE Baseline Backend RBAC

## Summary

The IE Baseline backend now enforces route-level access through
`role_system_module_access` and `system_module_master`.

The main application remains responsible for authentication. The IE Baseline
frontend should continue resolving the authenticated main-app user to one
`user_master.user_id` by email, then use that resolved IE Baseline user ID as
the API actor.

## Required Current User Flow

1. Resolve the authenticated main-app user through:

```http
POST /api/iebaseline/users/resolve-current
```

2. Use the returned `user_id` as the resolved IE Baseline actor.

3. Load viewable IE Baseline routes through:

```http
GET /api/iebaseline/users/{user_id}/system-modules
```

4. Pass the resolved actor ID as `current_user_id` to protected APIs that do not
already include a caller-shaped user field.

## System Module Response

```json
{
  "user_id": 123,
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

The frontend should continue using snake_case field names for this endpoint.

## Route And API Actor Mapping

| Frontend route | Backend access route | Actor transport |
| --- | --- | --- |
| `/iebaseline` | `/iebaseline` | `user_id` query parameter |
| `/iebaseline/module/:moduleId` | `/iebaseline/module/:moduleId` | `user_id`, `uploadedBy`, or `current_user_id` |
| `/iebaseline/module/:moduleId/results` | `/iebaseline/module/:moduleId/results` | `user_id` query parameter |
| `/iebaseline/approvals/my-submissions` | `/iebaseline/approvals/my-submissions` | `user_id` query parameter |
| `/iebaseline/approvals/inbox` | `/iebaseline/approvals/inbox` | `approver_user_id` query parameter |
| `/iebaseline/approvals/:approvalId/review` | `/iebaseline/approvals/:approvalId/review` | `reviewer_user_id` query parameter or `reviewerUserId` body field |
| `/iebaseline/users` | `/iebaseline/users` | `current_user_id` query parameter |
| `/iebaseline/assign` | `/iebaseline/assign` | `current_user_id` query parameter |

## APIs That Need `current_user_id`

Add `current_user_id={resolvedIeBaselineUserId}` to these requests:

```http
GET /api/iebaseline/modules/{module_id}/questions?current_user_id={user_id}
GET /api/iebaseline/modules/{moduleName}/questions?current_user_id={user_id}
GET /api/iebaseline/attempts/{attempt_id}/questions?current_user_id={user_id}
PUT /api/iebaseline/attempts/{attempt_id}/questions/{question_id}/answer?current_user_id={user_id}
DELETE /api/iebaseline/attempts/{attempt_id}/questions/{question_id}/answer?current_user_id={user_id}
POST /api/iebaseline/attempts/{attempt_id}/submit?current_user_id={user_id}
GET /api/iebaseline/users?current_user_id={user_id}
GET /api/iebaseline/users/search?current_user_id={user_id}
GET /api/iebaseline/roles?current_user_id={user_id}
GET /api/iebaseline/users/{target_user_id}?current_user_id={user_id}
PUT /api/iebaseline/users/{target_user_id}?current_user_id={user_id}
GET /api/iebaseline/users/{target_user_id}/delete-preview?current_user_id={user_id}
DELETE /api/iebaseline/users/{target_user_id}?current_user_id={user_id}
GET /api/iebaseline/modules?current_user_id={user_id}
GET /api/iebaseline/users/{target_user_id}/modules?current_user_id={user_id}
PUT /api/iebaseline/users/{target_user_id}/modules?current_user_id={user_id}
```

## APIs With Existing Actor Fields

These APIs already carry a caller-shaped user value and do not need a new
`current_user_id` parameter:

```http
GET /api/iebaseline/home?user_id={user_id}
POST /api/iebaseline/modules/{module_id}/attempts/start
GET /api/iebaseline/modules/{module_id}/attempts?user_id={user_id}
POST /api/iebaseline/modules/{module_id}/attachments
GET /api/iebaseline/modules/{module_id}/attachments?user_id={user_id}
GET /api/iebaseline/attachments/{attachment_unq_id}/download?user_id={user_id}
DELETE /api/iebaseline/modules/{module_id}/attachments/{attachment_unq_id}?user_id={user_id}
GET /api/iebaseline/approvals/my-submissions?user_id={user_id}
GET /api/iebaseline/approvals/inbox?approver_user_id={user_id}
POST /api/iebaseline/approvals/{approval_id}/start
GET /api/iebaseline/approvals/{approval_id}/review?reviewer_user_id={user_id}
PUT /api/iebaseline/approvals/{approval_id}/answers/{answer_id}
POST /api/iebaseline/approvals/{approval_id}/decision
```

## Important Notes

Route RBAC only checks whether the actor's role can view the route. Learner
module assignment checks remain separate and are still enforced where relevant.

Reviewer APIs still verify the reviewer matches `approval_request.assigned_to`.

V1 permissions are `can_view` only. Create, edit, and delete-specific permission
flags are not part of this contract yet.
