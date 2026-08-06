# Frontend Notification Handoff

## Summary

The backend now sends approval notification emails automatically after approval
submit and decision workflows commit successfully. The frontend may optionally
call the manual notification endpoint, but it should not build recipient email
addresses, subjects, or HTML bodies.

## Endpoint

```http
POST /api/iebaseline/notifications/send-email
```

No `current_user_id` query parameter and no IE Baseline route RBAC grant are
required. The frontend must pass a `senderUserId` that already exists in
`user_master`; this is the endpoint's minimum protection check.

## Request

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

Rules:

* Use the resolved IE Baseline `user_master.user_id` for `senderUserId`.
* Do not construct recipient email addresses in the frontend.
* Do not construct email subject or HTML in the frontend.
* For approval emails, pass the relevant `approvalId`; backend approval/module/user data is authoritative.
* Manual send is optional because normal approval workflow sends automatically.

## Response

```json
{
  "success": true,
  "message": "Email successfully sent",
  "purpose": "APPROVAL_REQUEST",
  "senderUserId": 5,
  "recipientUserId": 1
}
```

The frontend should show a non-blocking notification if manual send fails,
because the approval workflow itself does not depend on email delivery.
