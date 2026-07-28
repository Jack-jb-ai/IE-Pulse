# Attachment Feature – Frontend Changes

## Objective

Update the frontend to use the pre-created `user_exam_answer` records returned by the backend.

---

# 1. Start / Retake Module Flow

Current flow:

```
POST /modules/{module_id}/attempts/start

↓

GET /attempts/{attempt_id}/questions
```

No flow change is required.

The backend will now automatically create answer shells during attempt creation.

---

# 2. Store Answer Information

Update the frontend question model to include the answer object returned by the backend.

Required fields:

* `answerId`
* `selectedAnswer`
* `isAnswered`
* `isAttached`

Store this information together with each question in frontend state.

---

# 3. Save Answer

## Endpoint

```
POST /attempts/{attempt_id}/questions/{question_id}/answer
```

After the user selects an answer:

* Call the Save Answer API.
* Update frontend state using the returned response.
* Preserve the returned `answerId`.

Do not generate or manage `answerId` on the frontend.

---

# 4. Attachment Upload

When uploading attachments:

* Retrieve the stored `answerId` from the current question.
* Pass the existing `answerId` into the attachment upload API.

No dependency on the **Next** button should remain.

---

# Expected Flow

```
Start Module

↓

Backend creates attempt

↓

Backend creates answer shells

↓

Frontend loads questions

↓

Question already contains answerId

↓

User selects answer

↓

Save Answer API updates existing shell

↓

Frontend keeps answerId

↓

Attachment Upload API uses answerId
```

The frontend should treat `answerId` as part of the question state for the duration of the attempt.
