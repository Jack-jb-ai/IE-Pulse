# Attachment & `user_exam_answer` Linkage Implementation

> **Scope:** Frontend & Backend
> **Status:** V1 Design
> **Objective:** Link uploaded attachments to the corresponding `user_exam_answer` record and enforce required attachment validation before a checklist attempt can be finalized.

---

# Background

Questions in `baseline_checklist` may require supporting evidence.

```text
attachment_requirement = 'required'
```

For these questions:

* The frontend should display an attachment upload section.
* Uploaded attachments must be linked to the corresponding `user_exam_answer`.
* The checklist cannot be finalized until every required question has at least one uploaded attachment.

---

# Database Changes

## `user_exam_answer`

Add a new column:

```sql
is_attached BOOLEAN NOT NULL DEFAULT FALSE
```

Purpose:

* Quick status indicating whether the current answer has at least one uploaded attachment.
* Updated only by the backend attachment APIs.
* The attachment relationship remains the source of truth.

---

## `module_attachment`

Add:

```text
user_exam_answer_id
```

Relationship:

```text
user_exam_answer (1)
        │
        ├───────────────< module_attachment (Many)
                                │
                                └── attachment_master
```

One `user_exam_answer` may contain multiple uploaded attachments.

This table records which saved answer each uploaded attachment belongs to.

---

# Frontend Tasks

## 1. Display Attachment Section

Display the attachment section only when:

```text
attachment_requirement == "required"
```

The attachment section should:

* Display existing uploaded attachments. 
  - Use attachment_master.original_file_name for UI(when displaying to user.)
  - Backend(GET attachment API) should contains 'attachment_unq_id' for DELETE API. 
* Allow upload.
* Allow removal.
* Operate independently from the "Next Question" button.

---

## 2. Upload Attachment

When the user uploads a file:

1. Call the existing attachment **POST** API.
2. Wait for a successful response.
3. Refresh the attachment list.

The frontend must **not** update `is_attached` directly.

All database updates are handled by the backend.

---

## 3. Remove Attachment

When the user removes an attachment:

1. Call the existing attachment **DELETE** API.
2. Wait for success.
3. Refresh the attachment list.

Again, the frontend must not directly modify `is_attached`.

---

## 4. Next Question

No change.

Current behavior remains:

* Validate that an answer has been selected.
* Save/update the answer.
* Navigate to the next question.

Required attachments should **not** block moving to the next question.

Users may return later using Previous navigation.

---

# Backend Tasks

## Attachment Upload API

Update the existing Upload Attachment API.

Current upload flow should additionally perform:

```text
Save physical file
        │
Insert attachment metadata
        │
Insert module_attachment record
        │
Update user_exam_answer.is_attached = TRUE
        │
Return success
```

### Important

`is_attached` should only become `TRUE` after **all upload-related operations have completed successfully**.

If any upload step fails:

* Do not update `is_attached`.
* Return an error.

The existing database transaction should continue protecting all related database operations.

---

## Attachment Delete API

Update the existing Delete Attachment API.

After removing an attachment:

Do **not** immediately set:

```text
is_attached = FALSE
```

Instead:

1. Check whether any attachment records still exist for the same `user_exam_answer`.
2. If attachments remain:

```text
is_attached = TRUE
```

3. If no attachments remain:

```text
is_attached = FALSE
```

This is required because one answer may contain multiple uploaded attachments.

---

# Finish Checklist Validation

The Finish Checklist process should perform one additional backend validation before finalizing the attempt.

## Validation

For the current attempt:

1. Find every question where:

```text
baseline_checklist.attachment_requirement = 'required'
```

2. Join against the user's current attempt and saved answers.

3. Verify:

```text
user_exam_answer.is_attached == TRUE
```

for every required question.

---

## Validation Failure

If any required question is missing an attachment:

* Do not finalize the checklist.
* Return an error response.
* Return enough information for the frontend to identify the missing questions.

Suggested response:

```json
{
    "success": false,
    "code": "REQUIRED_ATTACHMENTS_MISSING",
    "message": "Required attachments are missing.",
    "missing_questions": [
        {
            "question_id": 10,
            "question_no": 4
        }
    ]
}
```

---

# Frontend Finish Checklist

When the Finish Checklist button is clicked:

1. Call the backend Finish Checklist API.
2. Wait for the backend response.

If validation fails:

* Do not finalize the checklist.
* Display a popup/dialog.
* Explain why submission failed.
* Show which questions still require attachments.
* Allow the user to navigate back to those questions.

---

# Notes

* `Next Question` should **not** validate required attachments.
* Required attachment validation happens only during **Finish Checklist**.
* `is_attached` is maintained only by the backend.
* `module_attachment` now links uploaded files to the corresponding `user_exam_answer`.
* One `user_exam_answer` may have multiple attachments.
* Deleting one attachment must not automatically set `is_attached = FALSE`; the backend must first verify whether other attachments still exist for the same `user_exam_answer`.
* Existing attachment upload/delete APIs should be extended rather than replaced.
* Existing database transactions should continue to wrap all related database updates performed by the attachment APIs.
