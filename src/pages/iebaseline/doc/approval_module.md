
# Approval Module Architecture Overview (Simplified)

## 1. Purpose

The Approval Module introduces an approval workflow for checklist-based assessments.

Unlike a traditional examination system, the approver is allowed to modify a learner's answers based on the actual business scenario before making the final approval decision.

This simplified design intentionally removes answer revision history to keep the implementation maintainable.

---

## 2. Design Principles

- One exam attempt has one approval request.
- Approval is only triggered when `module_master.approval_required = true`.
- Once submitted, learners cannot modify their answers.
- The assigned approver may edit `user_exam_answer.selected_answer` directly.
- The existing scoring engine remains unchanged.
- Scores are hidden until the approval workflow is completed.
- Module Owner (`module_master.owner_user_id`) is the default approver.

---

## 3. Workflow

```text
Learner completes checklist
        ↓
Submit
        ↓
Validate answers & attachments
        ↓
Approval Required?
        ├── No
        │      ↓
        │  Calculate Score
        │  Show Result
        │
        └── Yes
               ↓
        Create approval_request
        result_status = PENDING
        Lock learner answers
        Send approver email
               ↓
        Approver reviews checklist
               ↓
      (Optional) Modify answers
               ↓
      Approve / Reject
               ↓
      Recalculate score
               ↓
 Update result_status
               ↓
 Send learner email
```

---

## 4. Database Design

### approval_request

| Column | Description |
|--------|-------------|
| approval_id | Primary Key |
| attempt_id | FK → user_exam_attempt.attempt_id |
| assigned_to | FK → user_master.user_id |
| status | PENDING / IN_PROGRESS / APPROVED / REJECTED / CANCELLED |
| remarks | Reviewer comments |
| created_at | Record creation time |
| updated_at | Last update time |
| completed_at | Approval completion time |

One approval request is created for one exam attempt.

---

## 5. Result Status

`user_exam_attempt.result_status`

Possible values:

- PENDING
- IN_PROGRESS
- APPROVED
- REJECTED
- CANCELLED

Typical flow:

| Action | Result Status |
|--------|---------------|
| Learner submits | PENDING |
| Reviewer starts review | IN_PROGRESS |
| Reviewer approves | APPROVED |
| Reviewer rejects | REJECTED |
| Workflow cancelled | CANCELLED |

---

## 6. Permissions

### Learner

Can:

- Submit checklist
- View approval status
- View reviewer remarks
- View final score

Cannot:

- Edit answers after submission.

### Approver

Can:

- Review assigned submissions
- Download attachments
- Modify learner answers
- Leave remarks
- Approve
- Reject

---

## 7. Approval Module

Navigation:

```text
Approval Module
├── My Submissions
└── Approval Inbox
```

Routes:

```text
/ietools/iebaseline/approvals/my-submissions
/ietools/iebaseline/approvals/inbox
/ietools/iebaseline/approvals/{approvalId}/review
```

---

## 8. Review Page

The review page reuses the existing Review Module UI.

Additional functions:

- Review learner answers
- Review attachments
- Modify answers directly
- Enter reviewer remarks
- Approve
- Reject

No answer revision history is maintained.

The value inside `user_exam_answer.selected_answer` is always treated as the latest authoritative answer for scoring.

---

## 9. Score Handling

### Approval Not Required

- Calculate score
- Show score immediately

### Approval Required

- Hide score after learner submission
- Approver may modify answers
- Score is recalculated using the updated answers
- Final score is displayed only after approval or rejection

---

## 10. Email Notifications

### Approver Notification

Triggered immediately after learner submission.

Contains:

- Learner
- Module
- Review link

### Learner Notification

Triggered after approval or rejection.

Contains:

- Final status
- Reviewer remarks
- Result link

---

## 11. Future Enhancements

Potential future improvements:

- Multi-level approval
- Approval delegation
- Reminder emails
- Escalation workflow
- Approval dashboard
- Analytics
- SLA monitoring

---

## 12. Final Design Summary

The simplified Approval Module intentionally prioritizes maintainability over detailed audit history.

Key decisions:

- Single `approval_request` table.
- No `user_exam_answer_revision` table.
- No original-answer tracking.
- Learner answers become read-only after submission.
- Approver edits answers directly.
- Existing scoring engine remains unchanged.
- One approval request per attempt.
- Final score is released only after the approval workflow is completed.
