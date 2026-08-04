# Backend Request: Add Exam Question Number

## Goal

Add a stored exam-facing question number for IE Baseline checklist questions so submit validation can identify missing required attachments with the actual module question number.

The current `baseline_checklist.question_no` value should remain unchanged. It comes from source checklist data and is not unique enough for this UI purpose.

## Database Request

Add a new column:

```sql
baseline_checklist.question_num INTEGER
```

Populate `question_num` independently inside each `module_id` partition. Use `baseline_checklist.id ASC` only to determine row order; do not copy `id` into `question_num`.

Backfill rule:

```sql
ROW_NUMBER() OVER (
  PARTITION BY module_id
  ORDER BY id ASC
)
```

Expected numbering:

```text
module_id | question_num
1         | 1
1         | 2
1         | 3
2         | 1
2         | 2
2         | 3
```

Recommended constraints after backfill:

```sql
question_num IS NOT NULL
UNIQUE (module_id, question_num)
```

## Import Behavior

When checklist rows are imported from CSV, assign `question_num` according to the inserted row order within each module. The existing import behavior inserts questions in CSV order, so the resulting `baseline_checklist.id ASC` order should remain the source of truth for numbering.

Keep `question_no` unchanged for compatibility and source-data traceability.

## API Response Request

Update submit validation errors from:

```text
POST /api/iebaseline/attempts/{attempt_id}/submit
```

Return `question_num` in each validation question item for both:

- `UNANSWERED_QUESTIONS`
- `REQUIRED_ATTACHMENTS_MISSING`

Example:

```json
{
  "detail": {
    "success": false,
    "code": "REQUIRED_ATTACHMENTS_MISSING",
    "message": "Required attachments are missing.",
    "missing_questions": [
      {
        "question_id": 10,
        "question_no": "4",
        "question_num": 7
      }
    ]
  }
}
```

Keep returning `question_no` during the transition so older frontend builds continue to work.

## Behavior That Must Not Change

- Required attachments should still block submit when `attachment_requirement = 'required'` and `user_exam_answer.is_attached` is not true.
- Required attachment validation should still be skipped when the saved answer leading label is `NA` or `N/A`.
- Existing scoring, attempt completion, and assignment status behavior should remain unchanged.
