# IE Baseline Table Structure

## Database Credential

- Env file: `src/pages/iebaseline/.env`
- Variable name: `DATABASE_CRED`
- Format: single-line PostgreSQL connection string

Examples:

```text
DATABASE_CRED=postgresql://user:password@host:5432/database
DATABASE_CRED=host=host dbname=database user=user password=password port=5432
```

# User Checklist Database Structure

This document describes the PostgreSQL tables used to manage users, module assignments, and checklist completion status.

## Overview

The database uses the following structures:

* `user_master`

  * Stores user information.
* `user_checklist_status`

  * Stores each user's checklist status for a module.
* `module_master`

  * Existing table that stores available modules.
* `checklist_status`

  * PostgreSQL enum used to restrict checklist status values.

---

## PostgreSQL Enum

### `checklist_status`

The `checklist_status` enum defines the allowed status values for a user's module checklist.

```sql
CREATE TYPE checklist_status AS ENUM (
    'Completed',
    'Incomplete'
);
```

Allowed values:

| Value        | Description                                      |
| ------------ | ------------------------------------------------ |
| `Completed`  | The user has completed the module checklist.     |
| `Incomplete` | The user has not completed the module checklist. |

The default status for a newly created checklist assignment is `Incomplete`.

---

## Table: `user_master`

The `user_master` table stores basic user information.

```sql
CREATE TABLE user_master (
    user_id BIGSERIAL PRIMARY KEY,

    name VARCHAR(250) NOT NULL,
    position VARCHAR(50),
    wd_id INTEGER UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Columns

| Column       | Data Type      | Constraints                         | Description                                        |
| ------------ | -------------- | ----------------------------------- | -------------------------------------------------- |
| `user_id`    | `BIGSERIAL`    | Primary key                         | Internal unique identifier for the user.           |
| `name`       | `VARCHAR(250)` | Not null                            | User's full name.                                  |
| `position`   | `VARCHAR(50)`  | Nullable                            | User's job title or position.                      |
| `wd_id`      | `INTEGER`      | Unique, nullable                    | User's Workday ID or external employee identifier. |
| `created_at` | `TIMESTAMPTZ`  | Not null, default current timestamp | Date and time when the record was created.         |
| `updated_at` | `TIMESTAMPTZ`  | Not null, default current timestamp | Date and time when the record was last updated.    |

### Notes

* `user_id` is the internal database identifier.
* `wd_id` is unique so the same Workday user cannot be registered more than once.
* `wd_id` may be null when the external employee ID is not yet available.

---

## Table: `user_checklist_status`

The `user_checklist_status` table stores the checklist status assigned to a user for a specific module.

```sql
CREATE TABLE user_checklist_status (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,
    module_id BIGINT NOT NULL,
    status checklist_status NOT NULL DEFAULT 'Incomplete',
    assignee_id BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_checklist_status_user
        FOREIGN KEY (user_id)
        REFERENCES user_master(user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_user_checklist_status_module
        FOREIGN KEY (module_id)
        REFERENCES module_master(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_user_checklist_status_assignee
        FOREIGN KEY (assignee_id)
        REFERENCES user_master(user_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT uq_user_module
        UNIQUE (user_id, module_id)
);
```

### Columns

| Column        | Data Type          | Constraints                         | Description                                               |
| ------------- | ------------------ | ----------------------------------- | --------------------------------------------------------- |
| `id`          | `BIGSERIAL`        | Primary key                         | Unique identifier for the checklist status record.        |
| `user_id`     | `BIGINT`           | Not null, foreign key               | User whose checklist progress is being tracked.           |
| `module_id`   | `BIGINT`           | Not null, foreign key               | Module assigned to the user.                              |
| `status`      | `checklist_status` | Not null, default `Incomplete`      | Current completion status of the module checklist.        |
| `assignee_id` | `BIGINT`           | Nullable, foreign key               | User responsible for assigning or managing the checklist. |
| `created_at`  | `TIMESTAMPTZ`      | Not null, default current timestamp | Date and time when the assignment was created.            |
| `updated_at`  | `TIMESTAMPTZ`      | Not null, default current timestamp | Date and time when the assignment was last updated.       |

---

## Table Relationships

### User Checklist Owner

```text
user_checklist_status.user_id
    -> user_master.user_id
```

The `user_id` identifies the user whose module checklist status is being tracked.

This relationship uses:

```sql
ON UPDATE CASCADE
ON DELETE CASCADE
```

Behavior:

* If the user's ID is updated, the related checklist records are updated.
* If the user is deleted, their checklist status records are also deleted.

---

### Checklist Module

```text
user_checklist_status.module_id
    -> module_master.id
```

The `module_id` identifies the module assigned to the user.

This relationship uses:

```sql
ON UPDATE CASCADE
ON DELETE CASCADE
```

Behavior:

* If the module ID is updated, the related checklist records are updated.
* If the module is deleted, related user checklist status records are also deleted.

---

### Checklist Assignee

```text
user_checklist_status.assignee_id
    -> user_master.user_id
```

The `assignee_id` identifies the user responsible for assigning or managing the checklist.

This relationship uses:

```sql
ON UPDATE CASCADE
ON DELETE SET NULL
```

Behavior:

* If the assignee's user ID is updated, the checklist record is updated.
* If the assignee is deleted, `assignee_id` becomes null.
* The checklist record remains available even when the original assignee no longer exists.

---

## Unique Constraint

The following constraint prevents duplicate assignments for the same user and module:

```sql
CONSTRAINT uq_user_module
    UNIQUE (user_id, module_id)
```

A user may only have one checklist status record for each module.

Valid example:

```text
User 1 + Module 1
User 1 + Module 2
User 2 + Module 1
```

Invalid example:

```text
User 1 + Module 1
User 1 + Module 1
```

The second record would violate the `uq_user_module` constraint.

---

## Relationship Diagram

```text
user_master
------------
user_id PK
name
position
wd_id
created_at
updated_at
     |
     | user_id
     | assignee_id
     v
user_checklist_status
---------------------
id PK
user_id FK
module_id FK
status
assignee_id FK
created_at
updated_at
     |
     | module_id
     v
module_master
-------------
id PK
module_name
description
owner_name
migrated_by
created_at
updated_at
```

---

## Expected Application Behavior

When creating a new module assignment:

1. Confirm that the `user_id` exists in `user_master`.
2. Confirm that the `module_id` exists in `module_master`.
3. Optionally provide an `assignee_id`.
4. Create the checklist status record.
5. Use `Incomplete` as the default status when no status is provided.

Example:

```sql
INSERT INTO user_checklist_status (
    user_id,
    module_id,
    assignee_id
)
VALUES (
    1,
    3,
    5
);
```

The inserted record will automatically receive:

```text
status = Incomplete
```

To mark the checklist as completed:

```sql
UPDATE user_checklist_status
SET
    status = 'Completed',
    updated_at = CURRENT_TIMESTAMP
WHERE user_id = 1
  AND module_id = 3;
```

---

## Important Implementation Rules

* Do not store arbitrary strings in the `status` column.
* Only use values defined by the `checklist_status` enum.
* Do not create duplicate records for the same `user_id` and `module_id`.
* Use `user_id` for the person completing the checklist.
* Use `assignee_id` for the person who assigned or manages the checklist.
* When updating a record, explicitly update `updated_at` unless an automatic database trigger is added later.
* Validate foreign key references before inserting records.


## Table - Baseline Checklist

Table name: `baseline_checklist`

| column_name | data_type | udt_name | CSV source |
|---|---|---|---|
| `id` | integer | int4 | Database generated |
| `module_id` | bigint | int8 | References `module_master.id` |
| `module_name` | character varying | varchar | `file_name`, `module_name` |
| `category` | character varying | varchar | `Categories`, `categories`, `category` |
| `keyword` | text | text | `Key Word`, `key word`, `keyword` |
| `ibpm_l2` | character varying | varchar | `IBPM L2`, `IBPM_L2` |
| `ibpm_l3` | character varying | varchar | `IBPM L3`, `IBPM_L3` |
| `risk` | character varying | varchar | `risk` |
| `question_no` | character varying | varchar | `question_no`, `Question #` |
| `question` | text | text | `Criteria Description`, `criteria_description`, `question` |
| `options` | text | text | Combined from `Yes`, `No`, `Partial`, `NA`; fallback: `options` |
| `reference` | text | text | `reference`, `Additional Information / Procedure & Documentation Reference` |
| `memo` | text | text | `memo`, `notes`, `question notes`, `remarks` |
| `available_points` | numeric(10,2) | numeric(10,2) | `Available Points`, `available points`, `available_points` |

## Table - Module Master

Table name: `module_master`

This table is the master list for baseline checklist modules. Each module name is stored once here, and `baseline_checklist.module_id` points to the matching master record.

| column_name | data_type | udt_name | notes |
|---|---|---|---|
| `id` | bigint | int8 | Primary key, generated by `BIGSERIAL` |
| `module_name` | character varying | varchar | Required, unique module name |
| `description` | text | text | Optional module description |
| `owner_name` | character varying | varchar | Optional module owner |
| `migrated_by` | character varying | varchar | Optional migration owner or script/user name |
| `created_at` | timestamp with time zone | timestamptz | Required, defaults to `CURRENT_TIMESTAMP` |
| `updated_at` | timestamp with time zone | timestamptz | Required, defaults to `CURRENT_TIMESTAMP` |

## Table Relationship

`module_master` has a one-to-many relationship with `baseline_checklist`:

```text
module_master.id 1 ---- many baseline_checklist.module_id
```

- `module_master.module_name` is unique and should represent the canonical module name.
- `baseline_checklist.module_id` is the foreign key used for joins and referential integrity.
- `baseline_checklist.module_name` may still exist for CSV/import compatibility, but new code should prefer joining through `module_id`.
- The foreign key uses `ON UPDATE CASCADE`, so changes to `module_master.id` cascade to checklist rows.
- The foreign key uses `ON DELETE RESTRICT`, so a module cannot be deleted while checklist rows reference it.

Example join:

```sql
SELECT
  bc.id,
  mm.module_name,
  bc.category,
  bc.keyword,
  bc.question_no,
  bc.question
FROM baseline_checklist bc
JOIN module_master mm ON mm.id = bc.module_id;
```

## Migration SQL

Create the module master table:

```sql
CREATE TABLE module_master (
  id BIGSERIAL PRIMARY KEY,
  module_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  owner_name VARCHAR(255),
  migrated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Add the foreign key from `baseline_checklist` to `module_master`:

```sql
ALTER TABLE baseline_checklist
ADD COLUMN module_id BIGINT;

ALTER TABLE baseline_checklist
ADD CONSTRAINT fk_baseline_checklist_module
FOREIGN KEY (module_id)
REFERENCES module_master(id)
ON UPDATE CASCADE
ON DELETE RESTRICT;
```

# User Exam Attempt and Answer Structure

This section describes the PostgreSQL tables used to track checklist attempts, autosaved user answers, progress, scoring, and completion results.

## Overview

The exam-related database structure uses the following tables:

* `user_checklist_status`

  * Represents a module assigned to a user.
  * Stores the overall assignment status.

* `user_exam_attempt`

  * Represents one attempt by a user to complete a module checklist.
  * Stores progress, score, result, and attempt timestamps.

* `user_exam_answer`

  * Stores the user's answer for each question in an attempt.
  * Supports autosave, checkpoints, resuming, and answer review.

* `baseline_checklist`

  * Stores the checklist questions.
  * Each answer references a question using `baseline_checklist.id`.

* `module_master`

  * Stores the available checklist modules.

* `user_master`

  * Stores user information.

---

## PostgreSQL Enums

### `exam_attempt_status`

The `exam_attempt_status` enum describes the lifecycle of an exam attempt.

```sql
CREATE TYPE exam_attempt_status AS ENUM (
    'Not Started',
    'In Progress',
    'Submitted',
    'Completed',
    'Abandoned'
);
```

Allowed values:

| Value         | Description                                                                  |
| ------------- | ---------------------------------------------------------------------------- |
| `Not Started` | The attempt record exists, but the user has not started answering questions. |
| `In Progress` | The user has started the checklist and may resume later.                     |
| `Submitted`   | The user has submitted the attempt for scoring or validation.                |
| `Completed`   | The attempt has been fully processed and completed.                          |
| `Abandoned`   | The attempt was stopped and should no longer be continued.                   |

---

### `exam_result_status`

The `exam_result_status` enum stores the final result of an attempt.

```sql
CREATE TYPE exam_result_status AS ENUM (
    'Pending',
    'Passed',
    'Failed'
);
```

Allowed values:

| Value     | Description                                       |
| --------- | ------------------------------------------------- |
| `Pending` | The attempt has not yet received a final result.  |
| `Passed`  | The user passed the module checklist.             |
| `Failed`  | The user did not meet the required passing score. |

---

## Supporting Constraint

The following constraint allows the database to validate that a question belongs to the supplied module.

```sql
ALTER TABLE baseline_checklist
ADD CONSTRAINT uq_baseline_checklist_id_module
UNIQUE (id, module_id);
```

This constraint is used by `user_exam_answer`.

It prevents an answer record from referencing a valid question ID together with the wrong module ID.

Example invalid relationship:

```text
question_id = 25
module_id = 3

Actual question module:
question_id = 25
module_id = 7
```

The database will reject this record.

---

# Table: `user_exam_attempt`

The `user_exam_attempt` table represents one checklist or exam attempt by a user.

A user may have multiple attempts for the same module.

```sql
CREATE TABLE user_exam_attempt (
    attempt_id BIGSERIAL PRIMARY KEY,

    user_checklist_status_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    module_id BIGINT NOT NULL,

    attempt_no INTEGER NOT NULL DEFAULT 1,

    attempt_status exam_attempt_status
        NOT NULL DEFAULT 'Not Started',

    result_status exam_result_status
        NOT NULL DEFAULT 'Pending',

    total_questions INTEGER NOT NULL DEFAULT 0,
    answered_questions INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0,

    score NUMERIC(5,2),

    started_at TIMESTAMPTZ,
    last_saved_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_exam_attempt_assignment
        FOREIGN KEY (user_checklist_status_id)
        REFERENCES user_checklist_status(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_user_exam_attempt_user
        FOREIGN KEY (user_id)
        REFERENCES user_master(user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_user_exam_attempt_module
        FOREIGN KEY (module_id)
        REFERENCES module_master(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_user_module_attempt
        UNIQUE (user_id, module_id, attempt_no),

    CONSTRAINT chk_attempt_no_positive
        CHECK (attempt_no > 0),

    CONSTRAINT chk_total_questions_nonnegative
        CHECK (total_questions >= 0),

    CONSTRAINT chk_answered_questions_nonnegative
        CHECK (answered_questions >= 0),

    CONSTRAINT chk_correct_answers_nonnegative
        CHECK (correct_answers >= 0),

    CONSTRAINT chk_answered_not_above_total
        CHECK (answered_questions <= total_questions),

    CONSTRAINT chk_correct_not_above_answered
        CHECK (correct_answers <= answered_questions),

    CONSTRAINT chk_score_range
        CHECK (score IS NULL OR score BETWEEN 0 AND 100)
);
```

## Columns

| Column                     | Data Type             | Constraints           | Description                                        |
| -------------------------- | --------------------- | --------------------- | -------------------------------------------------- |
| `attempt_id`               | `BIGSERIAL`           | Primary key           | Unique identifier for the exam attempt.            |
| `user_checklist_status_id` | `BIGINT`              | Not null, foreign key | Assignment record associated with the attempt.     |
| `user_id`                  | `BIGINT`              | Not null, foreign key | User taking the checklist.                         |
| `module_id`                | `BIGINT`              | Not null, foreign key | Module being attempted.                            |
| `attempt_no`               | `INTEGER`             | Not null, positive    | Attempt number for the user and module.            |
| `attempt_status`           | `exam_attempt_status` | Not null              | Current lifecycle status of the attempt.           |
| `result_status`            | `exam_result_status`  | Not null              | Pass, fail, or pending result.                     |
| `total_questions`          | `INTEGER`             | Not null, nonnegative | Total number of questions included in the attempt. |
| `answered_questions`       | `INTEGER`             | Not null, nonnegative | Number of questions currently answered.            |
| `correct_answers`          | `INTEGER`             | Not null, nonnegative | Number of answers marked correct.                  |
| `score`                    | `NUMERIC(5,2)`        | Nullable, 0–100       | Percentage score for the attempt.                  |
| `started_at`               | `TIMESTAMPTZ`         | Nullable              | Time when the user started the attempt.            |
| `last_saved_at`            | `TIMESTAMPTZ`         | Nullable              | Most recent checkpoint or autosave time.           |
| `submitted_at`             | `TIMESTAMPTZ`         | Nullable              | Time when the user submitted the attempt.          |
| `completed_at`             | `TIMESTAMPTZ`         | Nullable              | Time when attempt processing was completed.        |
| `created_at`               | `TIMESTAMPTZ`         | Not null              | Time when the attempt record was created.          |
| `updated_at`               | `TIMESTAMPTZ`         | Not null              | Time when the attempt record was last updated.     |

## Important Rules

* A user may have multiple attempts for the same module.
* Each attempt must have a unique `attempt_no`.
* `answered_questions` cannot exceed `total_questions`.
* `correct_answers` cannot exceed `answered_questions`.
* `score` must be between `0` and `100`.
* The backend should update `last_saved_at` whenever an answer is saved.
* The backend should update `answered_questions` after answers are inserted, updated, or cleared.

---

# Table: `user_exam_answer`

The `user_exam_answer` table stores one user's response to one checklist question during one attempt.

One row represents:

```text
One attempt
+
One question
+
One saved answer
```

```sql
CREATE TABLE user_exam_answer (
    answer_id BIGSERIAL PRIMARY KEY,

    attempt_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    module_id BIGINT NOT NULL,
    question_id INTEGER NOT NULL,

    selected_answer TEXT,

    is_answered BOOLEAN NOT NULL DEFAULT FALSE,
    is_correct BOOLEAN,

    score_awarded NUMERIC(8,2),
    maximum_score NUMERIC(8,2),

    answered_at TIMESTAMPTZ,
    last_saved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_exam_answer_attempt
        FOREIGN KEY (attempt_id)
        REFERENCES user_exam_attempt(attempt_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_user_exam_answer_user
        FOREIGN KEY (user_id)
        REFERENCES user_master(user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_user_exam_answer_module
        FOREIGN KEY (module_id)
        REFERENCES module_master(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_user_exam_answer_question_module
        FOREIGN KEY (question_id, module_id)
        REFERENCES baseline_checklist(id, module_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_attempt_question
        UNIQUE (attempt_id, question_id),

    CONSTRAINT chk_score_awarded_nonnegative
        CHECK (
            score_awarded IS NULL
            OR score_awarded >= 0
        ),

    CONSTRAINT chk_maximum_score_nonnegative
        CHECK (
            maximum_score IS NULL
            OR maximum_score >= 0
        ),

    CONSTRAINT chk_score_not_above_maximum
        CHECK (
            score_awarded IS NULL
            OR maximum_score IS NULL
            OR score_awarded <= maximum_score
        )
);
```

## Columns

| Column            | Data Type      | Constraints           | Description                                             |
| ----------------- | -------------- | --------------------- | ------------------------------------------------------- |
| `answer_id`       | `BIGSERIAL`    | Primary key           | Unique identifier for the answer record.                |
| `attempt_id`      | `BIGINT`       | Not null, foreign key | Attempt containing this answer.                         |
| `user_id`         | `BIGINT`       | Not null, foreign key | User who submitted the answer.                          |
| `module_id`       | `BIGINT`       | Not null, foreign key | Module containing the question.                         |
| `question_id`     | `INTEGER`      | Not null, foreign key | References `baseline_checklist.id`.                     |
| `selected_answer` | `TEXT`         | Nullable              | Answer selected or entered by the user.                 |
| `is_answered`     | `BOOLEAN`      | Not null              | Indicates whether the question currently has an answer. |
| `is_correct`      | `BOOLEAN`      | Nullable              | Indicates whether the saved answer is correct.          |
| `score_awarded`   | `NUMERIC(8,2)` | Nullable, nonnegative | Score awarded for this answer.                          |
| `maximum_score`   | `NUMERIC(8,2)` | Nullable, nonnegative | Maximum possible score for this question.               |
| `answered_at`     | `TIMESTAMPTZ`  | Nullable              | Time when the question was answered.                    |
| `last_saved_at`   | `TIMESTAMPTZ`  | Not null              | Most recent autosave time for the answer.               |
| `created_at`      | `TIMESTAMPTZ`  | Not null              | Time when the answer record was created.                |
| `updated_at`      | `TIMESTAMPTZ`  | Not null              | Time when the answer record was last updated.           |

## Important Rules

* Each attempt may only have one answer row per question.
* Saving the same question again must update the existing row.
* An answer must reference a question belonging to the supplied module.
* Deleting an attempt automatically deletes its saved answers.
* The backend should derive `user_id` and `module_id` from the attempt where possible.
* The frontend should not be trusted to provide authoritative ownership values.
* `is_correct` may remain null until the attempt is submitted or evaluated.
* `selected_answer` may be null when the user clears an answer.
* When an answer is cleared, `is_answered` should be set to false.

---

# Indexes

The following indexes improve common lookup, autosave, resume, reporting, and scoring queries.

```sql
CREATE INDEX idx_user_exam_attempt_user
    ON user_exam_attempt(user_id);

CREATE INDEX idx_user_exam_attempt_module
    ON user_exam_attempt(module_id);

CREATE INDEX idx_user_exam_attempt_assignment
    ON user_exam_attempt(user_checklist_status_id);

CREATE INDEX idx_user_exam_attempt_status
    ON user_exam_attempt(attempt_status);

CREATE INDEX idx_user_exam_answer_attempt
    ON user_exam_answer(attempt_id);

CREATE INDEX idx_user_exam_answer_user
    ON user_exam_answer(user_id);

CREATE INDEX idx_user_exam_answer_module
    ON user_exam_answer(module_id);

CREATE INDEX idx_user_exam_answer_question
    ON user_exam_answer(question_id);
```

---

# Table Relationships

## Assignment to Attempt

```text
user_checklist_status.id
    -> user_exam_attempt.user_checklist_status_id
```

One user-module assignment may have multiple exam attempts.

```text
user_checklist_status 1 ---- many user_exam_attempt
```

Deleting the assignment deletes its related attempts.

Because answer rows belong to attempts, deleting the assignment also indirectly deletes the related answers.

---

## User to Attempt

```text
user_master.user_id
    -> user_exam_attempt.user_id
```

One user may have many exam attempts.

```text
user_master 1 ---- many user_exam_attempt
```

---

## Module to Attempt

```text
module_master.id
    -> user_exam_attempt.module_id
```

One module may have attempts from many users.

```text
module_master 1 ---- many user_exam_attempt
```

A module cannot be deleted while attempt records reference it.

---

## Attempt to Answer

```text
user_exam_attempt.attempt_id
    -> user_exam_answer.attempt_id
```

One attempt may contain many answer records.

```text
user_exam_attempt 1 ---- many user_exam_answer
```

Deleting an attempt automatically deletes all answers belonging to that attempt.

---

## Question to Answer

```text
baseline_checklist.id
    -> user_exam_answer.question_id
```

One checklist question may appear in many users' attempts.

```text
baseline_checklist 1 ---- many user_exam_answer
```

The actual foreign key uses both `question_id` and `module_id`:

```text
baseline_checklist (id, module_id)
    -> user_exam_answer (question_id, module_id)
```

This ensures the answer's question belongs to the correct module.

---

# Relationship Diagram

```text
user_master
------------
user_id PK
name
position
wd_id
    |
    | user_id
    v

user_checklist_status
---------------------
id PK
user_id FK
module_id FK
status
assignee_id FK
    |
    | user_checklist_status_id
    v

user_exam_attempt
-----------------
attempt_id PK
user_checklist_status_id FK
user_id FK
module_id FK
attempt_no
attempt_status
result_status
total_questions
answered_questions
correct_answers
score
started_at
last_saved_at
submitted_at
completed_at
    |
    | attempt_id
    v

user_exam_answer
----------------
answer_id PK
attempt_id FK
user_id FK
module_id FK
question_id FK
selected_answer
is_answered
is_correct
score_awarded
maximum_score
answered_at
last_saved_at
    |
    | question_id + module_id
    v

baseline_checklist
------------------
id PK
module_id FK
question
options
reference
memo
```

---

# Expected Application Flow

## Starting a Module

When a user clicks **Start Course** or **Start Checklist**:

1. Confirm that the user has a `user_checklist_status` assignment.
2. Check for an existing `In Progress` attempt.
3. Resume the existing attempt when one is available.
4. Otherwise, create a new `user_exam_attempt`.
5. Calculate the next `attempt_no`.
6. Count the questions for the selected module.
7. Set `attempt_status` to `In Progress`.
8. Set `started_at` to the current timestamp.
9. Return the new or existing `attempt_id` to the frontend.

---

## Saving an Answer

The frontend should save an answer whenever the user:

* Selects an option.
* Changes an option.
* Clicks Next.
* Navigates to another question.
* Pauses or exits the checklist.

The backend should use an upsert operation.

```sql
INSERT INTO user_exam_answer (
    attempt_id,
    user_id,
    module_id,
    question_id,
    selected_answer,
    is_answered,
    answered_at,
    last_saved_at
)
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (attempt_id, question_id)
DO UPDATE SET
    selected_answer = EXCLUDED.selected_answer,
    is_answered = TRUE,
    answered_at = CURRENT_TIMESTAMP,
    last_saved_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP;
```

Parameter meanings:

| Parameter | Description     |
| --------- | --------------- |
| `$1`      | Attempt ID      |
| `$2`      | User ID         |
| `$3`      | Module ID       |
| `$4`      | Question ID     |
| `$5`      | Selected answer |

The backend should preferably retrieve `user_id` and `module_id` from `user_exam_attempt` instead of accepting them directly from the frontend.

---

## Clearing an Answer

When a user removes a previously selected answer:

```sql
UPDATE user_exam_answer
SET
    selected_answer = NULL,
    is_answered = FALSE,
    is_correct = NULL,
    score_awarded = NULL,
    last_saved_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE attempt_id = $1
  AND question_id = $2;
```

---

## Saving Progress

After saving or clearing an answer, update the attempt progress.

```sql
UPDATE user_exam_attempt attempt
SET
    answered_questions = progress.answered_questions,
    last_saved_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP,
    attempt_status = 'In Progress'
FROM (
    SELECT
        attempt_id,
        COUNT(*) FILTER (
            WHERE is_answered = TRUE
        ) AS answered_questions
    FROM user_exam_answer
    WHERE attempt_id = $1
    GROUP BY attempt_id
) progress
WHERE attempt.attempt_id = progress.attempt_id;
```

The application may also calculate progress dynamically instead of storing it.

Progress percentage:

```text
answered_questions / total_questions * 100
```

Example:

```text
answered_questions = 13
total_questions = 20
progress = 65%
```

---

## Resuming an Attempt

To resume a checklist:

1. Find the latest attempt with status `In Progress`.
2. Load all questions for the attempt's module.
3. Load existing answers using `attempt_id`.
4. Merge the saved answers into the question response.
5. Return the current progress.
6. Open the first unanswered question, or restore the last visited question if frontend navigation state is stored separately.

Example query:

```sql
SELECT
    attempt.attempt_id,
    attempt.user_id,
    attempt.module_id,
    attempt.attempt_no,
    attempt.attempt_status,
    attempt.total_questions,
    attempt.answered_questions,
    attempt.last_saved_at
FROM user_exam_attempt attempt
WHERE attempt.user_id = $1
  AND attempt.module_id = $2
  AND attempt.attempt_status = 'In Progress'
ORDER BY attempt.attempt_no DESC
LIMIT 1;
```

---

## Loading Questions and Saved Answers

```sql
SELECT
    checklist.id AS question_id,
    checklist.module_id,
    checklist.question_no,
    checklist.question,
    checklist.options,
    checklist.reference,
    checklist.memo,

    answer.answer_id,
    answer.selected_answer,
    COALESCE(answer.is_answered, FALSE) AS is_answered,
    answer.is_correct,
    answer.score_awarded,
    answer.maximum_score,
    answer.last_saved_at

FROM baseline_checklist checklist

LEFT JOIN user_exam_answer answer
    ON answer.question_id = checklist.id
   AND answer.module_id = checklist.module_id
   AND answer.attempt_id = $1

WHERE checklist.module_id = $2

ORDER BY
    checklist.question_no,
    checklist.id;
```

---

## Submitting an Attempt

When the user submits:

1. Confirm that the attempt exists.
2. Confirm that the attempt belongs to the authenticated user.
3. Confirm that all required questions have been answered.
4. Calculate correctness and scores.
5. Update each `user_exam_answer`.
6. Calculate the final attempt score.
7. Update `user_exam_attempt`.
8. Update `user_checklist_status` when the attempt is completed or passed.

Example attempt update:

```sql
UPDATE user_exam_attempt
SET
    attempt_status = 'Completed',
    result_status = $2,
    correct_answers = $3,
    score = $4,
    submitted_at = CURRENT_TIMESTAMP,
    completed_at = CURRENT_TIMESTAMP,
    last_saved_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE attempt_id = $1;
```

Example assignment update:

```sql
UPDATE user_checklist_status
SET
    status = 'Completed',
    updated_at = CURRENT_TIMESTAMP
WHERE id = (
    SELECT user_checklist_status_id
    FROM user_exam_attempt
    WHERE attempt_id = $1
);
```

The application must define whether `user_checklist_status.status` becomes `Completed` when:

* The attempt is submitted.
* The attempt is fully processed.
* The user passes.
* The user completes all questions regardless of pass or fail.

The selected business rule should be applied consistently by the backend.

---

# Suggested Backend API Responsibilities

## Start or Resume Attempt

```text
POST /api/iebaseline/modules/:moduleId/attempts/start
```

Responsibilities:

* Validate the authenticated user.
* Validate the module assignment.
* Resume an existing in-progress attempt when appropriate.
* Otherwise create a new attempt.
* Return attempt metadata and progress.

---

## Get Attempt

```text
GET /api/iebaseline/attempts/:attemptId
```

Responsibilities:

* Validate attempt ownership.
* Return attempt status, score, progress, and timestamps.

---

## Get Questions and Answers

```text
GET /api/iebaseline/attempts/:attemptId/questions
```

Responsibilities:

* Load questions belonging to the attempt's module.
* Join existing saved answers.
* Return progress and question data.

---

## Save Answer

```text
PUT /api/iebaseline/attempts/:attemptId/questions/:questionId/answer
```

Example request:

```json
{
  "selectedAnswer": "Yes"
}
```

Responsibilities:

* Validate attempt ownership.
* Confirm the attempt is editable.
* Confirm the question belongs to the attempt module.
* Insert or update the answer.
* Update attempt progress.
* Return the saved answer and updated progress.

Example response:

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

---

## Clear Answer

```text
DELETE /api/iebaseline/attempts/:attemptId/questions/:questionId/answer
```

Responsibilities:

* Validate attempt ownership.
* Clear the selected answer.
* Set `is_answered` to false.
* Recalculate progress.

---

## Submit Attempt

```text
POST /api/iebaseline/attempts/:attemptId/submit
```

Responsibilities:

* Validate attempt ownership.
* Validate required answers.
* Calculate the result.
* Save question scores.
* Save the final attempt score.
* Mark the attempt completed.
* Update the assignment status.

---

## Get Attempt History

```text
GET /api/iebaseline/modules/:moduleId/attempts
```

Responsibilities:

* Return the authenticated user's attempt history.
* Include attempt number, status, result, score, and timestamps.

---

# Suggested Frontend Behavior

The frontend should:

1. Request an attempt when the user clicks Start.
2. Store the returned `attempt_id`.
3. Load questions and existing answers.
4. Save each answer individually.
5. Display a saving indicator during the request.
6. Display a saved indicator after success.
7. Retry or show an error if autosave fails.
8. Calculate progress using the backend response.
9. Allow the user to leave and resume later.
10. Submit the attempt only through the submit endpoint.

The frontend should not:

* Calculate authoritative scores.
* Decide whether an answer is correct.
* Trust a module ID supplied independently from the attempt.
* Update assignment completion status directly.
* Create multiple in-progress attempts accidentally.
* Send `user_id` as the source of truth.

Authentication should determine the current user.

---

# Implementation Notes for Coding Agents

* Use database transactions when submitting and scoring an attempt.
* Validate that `attempt_id`, `user_id`, `module_id`, and `question_id` belong together.
* Do not trust ownership information received from the frontend.
* Use `ON CONFLICT (attempt_id, question_id)` for autosave.
* Use parameterized SQL queries.
* Do not build SQL using string concatenation.
* Update `updated_at` explicitly unless database triggers are added.
* Do not allow answers to be changed after completion unless the business rules explicitly support reopening attempts.
* Prevent multiple simultaneous `In Progress` attempts for the same user and module at the application layer.
* Consider adding a partial unique index later if the database must enforce one active attempt.
* Use `attempt_id` as the main key for loading, saving, submitting, and resuming an exam.
* Use `question_id` to reference `baseline_checklist.id`.
* Use `module_id` for reporting and to validate question-module consistency.

---

# Optional Future Improvements

The current structure supports future additions such as:

* Passing score configuration per module.
* Question weighting.
* Partial-credit answers.
* Manual manager review.
* Reviewer comments.
* Attempt expiration.
* Time limits.
* Certificates.
* Question snapshots.
* Randomized question order.
* Audit logs.
* Per-question answer history.
* One-active-attempt database enforcement.
* Automatic timestamp triggers.
* Dashboard reporting and analytics.


---

# Scoring Configuration Structure

This section describes the database objects used to support configurable scoring rules for each checklist module.

Instead of hardcoding answer scores (for example Yes = 1, No = 0), each module references a scoring metric that defines the available answer options and how each option contributes to the final score.

This allows different checklist modules to use different scoring schemes without requiring application code changes.

## Overview

The scoring configuration uses the following structures:

* `baseline_checklist`

  * Stores the maximum available points for each checklist question.

* `module_master`

  * References the scoring metric used by the module.

* `scoring_metric`

  * Stores reusable scoring schemes.

* `scoring_metric_option`

  * Stores all selectable options and their score multipliers for a scoring scheme.

---

## Table: `baseline_checklist`

### New Column

| Column | Data Type | Constraints | Description |
|----------|-----------|-------------|-------------|
| `available_points` | `NUMERIC(10,2)` | Not null, default `1`, value >= 0 | Maximum score available for this checklist question before multipliers are applied. |

### Notes

* Existing questions default to **1 point**.
* Different questions may be assigned different weights.
* The final awarded score is calculated by multiplying `available_points` with the selected option's `score_multiplier`.
* `is_applicable = true` means the selected option is included in scoring and contributes to `maximum_score`.
* `is_applicable = false` means the selected option is excluded from scoring and its available points are not included in the final denominator.
* `score_multiplier = 0` with `is_applicable = true` means zero credit, not exclusion.

Example:

| available_points | Selected Option | Multiplier | is_applicable | Stored Score |
|-----------------|----------------|-----------:|---------------|--------------|
| 1 | Yes | 1.0 | true | 1.0 / 1.0 |
| 1 | Partial | 0.5 | true | 0.5 / 1.0 |
| 1 | No | 0.0 | true | 0.0 / 1.0 |
| 5 | Partial | 0.5 | true | 2.5 / 5.0 |
| 5 | N/A | 0.0 | false | NULL / NULL |

Warning: rows such as `"N/A" 0.0000 true` are scored as `0.00 / available_points`.
That lowers the final score. If `N/A` or `NA - ...` means the question is not
applicable, the matching `scoring_metric_option` row must use
`is_applicable = false`.

---

# Table: `scoring_metric`

The `scoring_metric` table stores reusable scoring configurations.

Each module references one scoring metric.

Example scoring metrics:

| Metric Name |
|--------------|
| Standard Yes / No |
| Yes / Partial / No |
| Five Level Audit |
| Pass / Fail |
| Compliance Rating |

## Columns

| Column | Data Type | Constraints | Description |
|----------|-----------|-------------|-------------|
| `scoring_metric_id` | `BIGSERIAL` | Primary key | Unique identifier of the scoring metric. |
| `metric_name` | `VARCHAR(255)` | Not null, unique | Human-readable name of the scoring metric. |
| `description` | `TEXT` | Nullable | Optional description explaining the scoring method. |
| `created_at` | `TIMESTAMPTZ` | Default current timestamp | Record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | Default current timestamp | Record update timestamp. |

### Notes

* Scoring metrics are reusable.
* Multiple modules may share the same scoring metric.
* Business users can create new scoring schemes without changing application logic.

---

# Table: `scoring_metric_option`

The `scoring_metric_option` table stores every selectable answer option belonging to a scoring metric.

Each option specifies the score multiplier that should be applied to a question's available points.

Example:

```
Metric:
Yes / Partial / No

Options:

Yes
Partial
No
```

## Columns

| Column | Data Type | Constraints | Description |
|----------|-----------|-------------|-------------|
| `scoring_metric_option_id` | `BIGSERIAL` | Primary key | Unique option identifier. |
| `scoring_metric_id` | `BIGINT` | Foreign key | Parent scoring metric. |
| `option_value` | `VARCHAR(255)` | Not null | Display value shown to users. |
| `score_multiplier` | `NUMERIC(10,4)` | >= 0 | Multiplier applied to the question's available points. |
| `is_applicable` | `BOOLEAN` | Default TRUE | Indicates whether this option contributes to scoring. `true` includes the question in `maximum_score`; `false` excludes it and stores null answer scores. |
| `created_at` | `TIMESTAMPTZ` | Default current timestamp | Record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | Default current timestamp | Record update timestamp. |

### Example

| Option | Multiplier | is_applicable | Meaning |
|---------|-----------:|---------------|---------|
| Yes | 1.0000 | true | Full credit |
| Partial | 0.5000 | true | Partial credit |
| No | 0.0000 | true | Zero credit, still scored |
| N/A | 0.0000 | false | Excluded from scoring |

### Notes

* `score_multiplier` may be greater than 1 if bonus scoring is desired.
* `is_applicable` allows options such as "N/A" to exist without affecting score calculations.
* For submitted `N/A` answers, `user_exam_answer.is_answered` should remain `true`; only `score_awarded` and `maximum_score` become `NULL` when `is_applicable = false`.
* Each option must be unique within the same scoring metric.

---

# Module Scoring Relationship

Each module references exactly one scoring metric.

```
module_master.scoring_metric_id
    ->
scoring_metric.scoring_metric_id
```

Relationship:

```
scoring_metric
       1
       |
       |
      many
scoring_metric_option

module_master
      many
       |
       |
       1
scoring_metric
```

This design allows:

* One scoring metric to be reused by many modules.
* Different modules to use different answer options.
* New scoring systems to be introduced without modifying application code.

---

# Score Calculation

The backend should calculate the awarded score using the following formula:

```
Awarded Score =
available_points
×
score_multiplier
```

If the selected option has `is_applicable = false`, the backend stores `NULL`
for both `score_awarded` and `maximum_score` on `user_exam_answer`. The final
attempt percentage excludes that question because totals sum only non-null
scored values.

Example:

Question:

```
Available Points = 5
```

Selected Answer:

```
Partial
Multiplier = 0.50
```

Result:

```
Awarded Score = 2.5
```

---

# Example Flow

When loading a checklist:

1. Load the selected module.
2. Read the module's `scoring_metric_id`.
3. Load all scoring options belonging to the metric.
4. Display those options to the user.
5. When an answer is submitted:
   * Read the question's `available_points`.
   * Read the selected option's `score_multiplier`.
   * Calculate the awarded score.
6. Sum all awarded scores to produce the module's final score.

---

# Relationship Diagram

```text
module_master
-------------
id PK
module_name
scoring_metric_id FK
        |
        |
        v

scoring_metric
--------------
scoring_metric_id PK
metric_name
description
        |
        |
        v

scoring_metric_option
---------------------
scoring_metric_option_id PK
scoring_metric_id FK
option_value
score_multiplier
is_applicable

baseline_checklist
------------------
id PK
module_id FK
question
available_points
```

---

# Important Implementation Rules

* Every module should reference a scoring metric.
* Every scoring metric must contain at least one scoring option.
* The backend should never hardcode answer values such as "Yes", "No", or "Partial".
* Available answer options should always be loaded from `scoring_metric_option`.
* Scores should always be calculated using `available_points × score_multiplier`.
* New scoring systems should be added by inserting database records instead of changing application code.

## Import Script

Script:

```text
src/pages/iebaseline/scripts/import_hla_baseline_checklist.py
```

The importer reads all direct `*.csv` files from:

```text
src/pages/iebaseline/csv/hla_baseline_checklist/
```

The CSV filename without extension becomes `module_name`.

Run these commands from the repo root:

```powershell
cd C:\Python\VSCode_Workplace\jdoc_retreival\IE-Pulse
```

Preview the folder mapping before writing to the database:

```powershell
py -3 src\pages\iebaseline\scripts\import_hla_baseline_checklist.py --dry-run
```

Insert rows into `baseline_checklist`:

```powershell
py -3 src\pages\iebaseline\scripts\import_hla_baseline_checklist.py
```

Import from a different CSV folder:

```powershell
py -3 src\pages\iebaseline\scripts\import_hla_baseline_checklist.py --csv-dir path\to\csv_folder --dry-run
py -3 src\pages\iebaseline\scripts\import_hla_baseline_checklist.py --csv-dir path\to\csv_folder
```

Use a different env file or table name if needed:

```powershell
py -3 src\pages\iebaseline\scripts\import_hla_baseline_checklist.py --env-path src\pages\iebaseline\.env --table baseline_checklist --dry-run
```

Show all available script options:

```powershell
py -3 src\pages\iebaseline\scripts\import_hla_baseline_checklist.py --help
```

The script inserts into `baseline_checklist` by default and reads `DATABASE_CRED` from `src/pages/iebaseline/.env`.

Before inserting each CSV file, the script deletes existing rows with the same `module_name`, then inserts the fresh CSV rows.
