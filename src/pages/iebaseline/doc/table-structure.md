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

  * Stores user information, organization fields, manager relationships, and role assignment.
* `role_master`

  * Stores the available application roles.
* `system_module_master`

  * Stores application modules or screens controlled by role access.
* `role_system_module_access`

  * Stores role-level visibility permissions for system modules.
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
    'Not Started',
    'In Progress',
    'Submitted',
    'Rejected',
    'Completed'
);
```

Allowed values:

| Value        | Description                                      |
| ------------ | ------------------------------------------------ |
| `Not Started` | The user is assigned but has not started an editable attempt. |
| `In Progress` | The user has started or resumed an editable attempt. |
| `Submitted` | The learner submitted an approval-required attempt for review. |
| `Rejected` | The latest approval decision rejected the attempt and the learner can retry. |
| `Completed` | The module assignment workflow is complete. |

The default status for a newly created checklist assignment is `Not Started`.

---

## Table: `user_master`

The `user_master` table stores basic user information.

```sql
CREATE TABLE user_master (
    user_id BIGSERIAL PRIMARY KEY,

    name VARCHAR(250) NOT NULL,
    position VARCHAR(50),
    wd_id INTEGER UNIQUE,
    reports_to INTEGER,
    email VARCHAR(254),
    department VARCHAR(50),
    role_id INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_master_reports_to
        FOREIGN KEY (reports_to)
        REFERENCES user_master(user_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_user_master_role
        FOREIGN KEY (role_id)
        REFERENCES role_master(role_id),

    CONSTRAINT uq_user_master_email
        UNIQUE (email)
);
```

### Columns

| Column       | Data Type      | Constraints                         | Description                                        |
| ------------ | -------------- | ----------------------------------- | -------------------------------------------------- |
| `user_id`    | `BIGSERIAL`    | Primary key                         | Internal unique identifier for the user.           |
| `name`       | `VARCHAR(250)` | Not null                            | User's full name.                                  |
| `position`   | `VARCHAR(50)`  | Nullable                            | User's job title or position.                      |
| `wd_id`      | `INTEGER`      | Unique, nullable                    | User's Workday ID or external employee identifier. |
| `reports_to` | `INTEGER`      | Nullable, foreign key               | Manager or reporting-line user.                    |
| `email`      | `VARCHAR(254)` | Unique, nullable                    | User's email address.                              |
| `department` | `VARCHAR(50)`  | Nullable                            | User's department.                                 |
| `role_id`    | `INTEGER`      | Not null, default `1`, foreign key  | Application role assigned to the user.             |
| `created_at` | `TIMESTAMPTZ`  | Not null, default current timestamp | Date and time when the record was created.         |
| `updated_at` | `TIMESTAMPTZ`  | Not null, default current timestamp | Date and time when the record was last updated.    |

### Notes

* `user_id` is the internal database identifier.
* `wd_id` is unique so the same Workday user cannot be registered more than once.
* `wd_id` may be null when the external employee ID is not yet available.
* `reports_to` points back to another `user_master.user_id`; deleting the manager sets this value to null.
* `role_id` points to `role_master.role_id` and defaults to the seeded user role `1`.
* `email` is unique when present, preventing duplicate email addresses.

---

## Table: `role_master`

The `role_master` table stores application role names.

```sql
CREATE TABLE role_master (
    role_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);
```

Seed values:

```sql
INSERT INTO role_master (role_name)
VALUES
    ('user'),
    ('admin'),
    ('dev');
```

### Columns

| Column      | Data Type     | Constraints      | Description                          |
| ----------- | ------------- | ---------------- | ------------------------------------ |
| `role_id`   | `INTEGER`     | Primary key      | Internal unique identifier for role. |
| `role_name` | `VARCHAR(50)` | Not null, unique | Application role name.               |

### Notes

* `role_name` is unique so the same role label cannot be inserted twice.
* User records reference roles through `user_master.role_id`.
* The deprecated `dev/admin` role is removed by `migrations/20260805_remove_dev_admin_role.sql`; existing users are reassigned to `dev`.

---

## Table: `system_module_master`

The `system_module_master` table stores the application modules or screens that can be controlled through role access.

```sql
CREATE TABLE system_module_master (
    system_module_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    module_code VARCHAR(100) NOT NULL UNIQUE,
    module_name VARCHAR(150) NOT NULL,
    module_description TEXT,
    route_path VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Columns

| Column | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| `system_module_id` | `BIGINT` identity | Primary key | Internal unique identifier for the system module. |
| `module_code` | `VARCHAR(100)` | Not null, unique | Stable application code for the module or screen. |
| `module_name` | `VARCHAR(150)` | Not null | Display name for the module. |
| `module_description` | `TEXT` | Nullable | Optional description of the module. |
| `route_path` | `VARCHAR(255)` | Nullable | Frontend or API route associated with the module. |
| `is_active` | `BOOLEAN` | Not null, default `TRUE` | Whether the module should be available for access checks. |
| `created_at` | `TIMESTAMPTZ` | Not null, default current timestamp | Time when the module record was created. |
| `updated_at` | `TIMESTAMPTZ` | Not null, default current timestamp | Time when the module record was last updated. |

### Notes

* `module_code` is the stable value to use in seed data and application logic.
* `is_active = false` should normally hide or disable access to the module even if a role has an access row.
* Role visibility is granted through `role_system_module_access`.

---

## Table: `role_system_module_access`

The `role_system_module_access` table grants role-level visibility to system modules.

One row represents:

```text
One role
+
One system module
+
The role's access state for that module
```

```sql
CREATE TABLE role_system_module_access (
    role_id INTEGER NOT NULL,
    system_module_id BIGINT NOT NULL,
    can_view BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (role_id, system_module_id),

    CONSTRAINT fk_role_system_module_access_role
        FOREIGN KEY (role_id)
        REFERENCES role_master(role_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_role_system_module_access_system_module
        FOREIGN KEY (system_module_id)
        REFERENCES system_module_master(system_module_id)
        ON DELETE CASCADE
);
```

### Columns

| Column | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| `role_id` | `INTEGER` | Primary key, foreign key | Role receiving access. |
| `system_module_id` | `BIGINT` | Primary key, foreign key | System module controlled by this access row. |
| `can_view` | `BOOLEAN` | Not null, default `TRUE` | Whether the role can view the module. |
| `created_at` | `TIMESTAMPTZ` | Not null, default current timestamp | Time when the access row was created. |
| `updated_at` | `TIMESTAMPTZ` | Not null, default current timestamp | Time when the access row was last updated. |

### Notes

* The composite primary key prevents duplicate access rows for the same role and system module.
* Deleting a role cascades its module access rows.
* Deleting a system module cascades its role access rows.
* Access checks should require both `role_system_module_access.can_view = true` and `system_module_master.is_active = true`.

---

## System Module Access Migration SQL

Migration file: `migrations/20260731_system_module_access.sql`

```sql
CREATE TABLE system_module_master (
    system_module_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    module_code VARCHAR(100) NOT NULL UNIQUE,
    module_name VARCHAR(150) NOT NULL,
    module_description TEXT,
    route_path VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE role_system_module_access (
    role_id INTEGER NOT NULL,
    system_module_id BIGINT NOT NULL,
    can_view BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (role_id, system_module_id),

    CONSTRAINT fk_role_system_module_access_role
        FOREIGN KEY (role_id)
        REFERENCES role_master(role_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_role_system_module_access_system_module
        FOREIGN KEY (system_module_id)
        REFERENCES system_module_master(system_module_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_role_system_module_access_system_module_id
    ON role_system_module_access(system_module_id);
```

---

## User Role and Reporting Migration SQL

Migration file: `migrations/20260731_user_roles_and_reporting.sql`

```sql
CREATE TABLE role_master (
    role_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO role_master (role_name)
VALUES
    ('user'),
    ('admin'),
    ('dev'),
    ('dev/admin');

ALTER TABLE user_master
    ADD COLUMN reports_to INTEGER,
    ADD COLUMN email VARCHAR(254),
    ADD COLUMN department VARCHAR(50),
    ADD COLUMN role_id INTEGER NOT NULL DEFAULT 1;

ALTER TABLE user_master
    ADD CONSTRAINT fk_user_master_reports_to
        FOREIGN KEY (reports_to)
        REFERENCES user_master (user_id)
        ON DELETE SET NULL;

ALTER TABLE user_master
    ADD CONSTRAINT fk_user_master_role
        FOREIGN KEY (role_id)
        REFERENCES role_master (role_id);

ALTER TABLE user_master
    ADD CONSTRAINT uq_user_master_email UNIQUE (email);

CREATE INDEX idx_user_master_reports_to
    ON user_master (reports_to);

CREATE INDEX idx_user_master_role_id
    ON user_master (role_id);
```

---

## Remove Deprecated Dev/Admin Role Migration SQL

Migration file: `migrations/20260805_remove_dev_admin_role.sql`

```sql
BEGIN;

-- Reassign any existing dev/admin users to dev before removing the role.
UPDATE user_master
SET role_id = (
    SELECT role_id
    FROM role_master
    WHERE role_name = 'dev'
)
WHERE role_id = (
    SELECT role_id
    FROM role_master
    WHERE role_name = 'dev/admin'
);

-- Remove any module access rows tied to dev/admin.
-- This may already cascade if the FK has ON DELETE CASCADE,
-- but keeping it explicit makes the migration intent clear.
DELETE FROM role_system_module_access
WHERE role_id = (
    SELECT role_id
    FROM role_master
    WHERE role_name = 'dev/admin'
);

-- Remove the deprecated role.
DELETE FROM role_master
WHERE role_name = 'dev/admin';

COMMIT;
```

---

## Table: `user_checklist_status`

The `user_checklist_status` table stores the checklist status assigned to a user for a specific module.

```sql
CREATE TABLE user_checklist_status (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,
    module_id BIGINT NOT NULL,
    status checklist_status NOT NULL DEFAULT 'Not Started',
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
| `status`      | `checklist_status` | Not null, default `Not Started`     | Assignment workflow status for the module checklist.      |
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

### User Reporting Line

```text
user_master.reports_to
    -> user_master.user_id
```

The `reports_to` value identifies the user's manager or reporting-line owner.

This relationship uses:

```sql
ON DELETE SET NULL
```

Behavior:

* If the referenced manager is deleted, `reports_to` becomes null.
* The user record remains available even when the manager record is removed.

---

### User Role

```text
user_master.role_id
    -> role_master.role_id
```

The `role_id` value identifies the application role assigned to the user.

This relationship uses the default foreign-key delete behavior.

Behavior:

* Role deletion should be restricted or handled by reassigning users before deletion because `role_id` is required.
* The user record remains available because assigned roles should not be removed while users reference them.

---

### Role System Module Access

```text
role_master.role_id
    -> role_system_module_access.role_id
    -> system_module_master.system_module_id
```

The access rows identify which system modules a role can view.

Behavior:

* One role can be linked to many system modules.
* One system module can be linked to many roles.
* Deleting a role removes its system module access rows.
* Deleting a system module removes the corresponding role access rows.

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

The following constraint prevents duplicate user email addresses:

```sql
CONSTRAINT uq_user_master_email
    UNIQUE (email)
```

PostgreSQL allows multiple null values in a unique column, so users without an email address can still be stored.

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
reports_to FK
email
department
role_id FK
created_at
updated_at
     ^
     | reports_to
     |
     + self reference
     |
     | role_id
     v
role_master
-----------
role_id PK
role_name
     |
     | role_id
     v
role_system_module_access
-------------------------
role_id PK/FK
system_module_id PK/FK
can_view
created_at
updated_at
     |
     | system_module_id
     v
system_module_master
--------------------
system_module_id PK
module_code
module_name
module_description
route_path
is_active
created_at
updated_at

user_master
     |
     | user_id / assignee_id
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
owner_user_id FK
approval_required
scoring_metric_id FK
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
4. Optionally provide `reports_to`, `email`, `department`, and `role_id` on the user profile.
5. Create the checklist status record.
6. Use `Not Started` as the default status when no status is provided.

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
status = Not Started
```

To update assignment workflow status:

```sql
UPDATE user_checklist_status
SET
    status = 'In Progress',
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
| `attachment_requirement` | USER-DEFINED | attachment_requirement | Question attachment rule: `none`, `optional`, or `required` |
| `attachment_instruction` | text | text | Instruction shown to users when `attachment_requirement = 'required'` |
| `attachment_approval_required` | boolean | bool | Whether uploaded evidence requires trainer/admin approval |

## Table - Module Master

Table name: `module_master`

This table is the master list for baseline checklist modules. Each module name is stored once here, and `baseline_checklist.module_id` points to the matching master record.

| column_name | data_type | udt_name | notes |
|---|---|---|---|
| `id` | bigint | int8 | Primary key, generated by `BIGSERIAL` |
| `module_name` | character varying | varchar | Required, unique module name |
| `description` | text | text | Optional module description |
| `owner_user_id` | bigint | int8 | Optional module owner, references `user_master.user_id` |
| `approval_required` | boolean | bool | Whether submitted attempts require manual approval |
| `scoring_metric_id` | bigint | int8 | Optional scoring metric, references `scoring_metric.scoring_metric_id` |
| `migrated_by` | character varying | varchar | Optional migration owner or script/user name |
| `created_at` | timestamp with time zone | timestamptz | Required, defaults to `CURRENT_TIMESTAMP` |
| `updated_at` | timestamp with time zone | timestamptz | Required, defaults to `CURRENT_TIMESTAMP` |

## Table Relationship

`module_master` has a one-to-many relationship with `baseline_checklist`:

```text
module_master.id 1 ---- many baseline_checklist.module_id
user_master.user_id 1 ---- many module_master.owner_user_id
scoring_metric.scoring_metric_id 1 ---- many module_master.scoring_metric_id
```

- `module_master.module_name` is unique and should represent the canonical module name.
- `module_master.owner_user_id` is an optional foreign key to the user responsible for the module.
- Deleting a referenced owner user sets `module_master.owner_user_id` to null.
- `module_master.approval_required` controls whether submitted attempts should enter the approval workflow.
- `module_master.scoring_metric_id` controls which answer options and score multipliers apply to the module.
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
  owner_user_id BIGINT,
  migrated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_module_master_owner_user
    FOREIGN KEY (owner_user_id)
    REFERENCES user_master(user_id)
    ON DELETE SET NULL
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

This section describes the PostgreSQL tables used to track checklist attempts, saved user answers, progress, scoring, and completion results.

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
  * Supports answer checkpoints, resuming, attachments, and answer review.

* `baseline_checklist`

  * Stores the checklist questions.
  * Each answer references a question using `baseline_checklist.id`.

* `module_master`

  * Stores the available checklist modules.

* `user_master`

  * Stores user information.

---

## PostgreSQL Enums

### `exam_result_status`

The `exam_result_status` enum stores the approval-oriented result state of an attempt.

```sql
CREATE TYPE exam_result_status AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
);
```

Allowed values:

| Value         | Description                                                  |
| ------------- | ------------------------------------------------------------ |
| `PENDING`     | The attempt is waiting for review or final result handling.  |
| `IN_PROGRESS` | The approval/result workflow is actively being reviewed.     |
| `APPROVED`    | The attempt has been approved.                               |
| `REJECTED`    | The attempt has been rejected.                               |
| `CANCELLED`   | The approval/result workflow was cancelled.                  |

---

### `approval_request_status`

The `approval_request_status` enum stores the review state of an approval request.

```sql
CREATE TYPE approval_request_status AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
);
```

Allowed values:

| Value         | Description                                      |
| ------------- | ------------------------------------------------ |
| `PENDING`     | The request has been created and awaits review.  |
| `IN_PROGRESS` | The assigned approver has started review.        |
| `APPROVED`    | The approver approved the submitted attempt.     |
| `REJECTED`    | The approver rejected the submitted attempt.     |
| `CANCELLED`   | The request was cancelled before completion.     |

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

    user_id BIGINT NOT NULL,
    module_id BIGINT NOT NULL,

    attempt_no INTEGER NOT NULL DEFAULT 1,

    result_status exam_result_status
        NOT NULL DEFAULT 'PENDING',

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
| `user_id`                  | `BIGINT`              | Not null, foreign key | User taking the checklist.                         |
| `module_id`                | `BIGINT`              | Not null, foreign key | Module being attempted.                            |
| `attempt_no`               | `INTEGER`             | Not null, positive    | Attempt number for the user and module.            |
| `result_status`            | `exam_result_status`  | Not null              | Approval/result state: `PENDING`, `IN_PROGRESS`, `APPROVED`, `REJECTED`, or `CANCELLED`. |
| `total_questions`          | `INTEGER`             | Not null, nonnegative | Total number of questions included in the attempt. |
| `answered_questions`       | `INTEGER`             | Not null, nonnegative | Number of questions currently answered.            |
| `correct_answers`          | `INTEGER`             | Not null, nonnegative | Number of answers marked correct.                  |
| `score`                    | `NUMERIC(5,2)`        | Nullable, 0–100       | Percentage score for the attempt.                  |
| `started_at`               | `TIMESTAMPTZ`         | Nullable              | Time when the user started the attempt.            |
| `last_saved_at`            | `TIMESTAMPTZ`         | Nullable              | Most recent checkpoint/save time.                  |
| `submitted_at`             | `TIMESTAMPTZ`         | Nullable              | Time when the user submitted the attempt.          |
| `completed_at`             | `TIMESTAMPTZ`         | Nullable              | Time when attempt processing was completed.        |
| `created_at`               | `TIMESTAMPTZ`         | Not null              | Time when the attempt record was created.          |
| `updated_at`               | `TIMESTAMPTZ`         | Not null              | Time when the attempt record was last updated.     |

## Important Rules

* A user may have multiple attempts for the same module.
* Attempts are not foreign-keyed to `user_checklist_status`; active assignment rows control access only.
* Each attempt must have a unique `attempt_no`.
* `answered_questions` cannot exceed `total_questions`.
* `correct_answers` cannot exceed `answered_questions`.
* `score` must be between `0` and `100`.
* Approval-related result states are stored in `result_status`.
* Assignment workflow states are stored in `user_checklist_status.status`, not
  on the attempt row.
* Learner editability is controlled by `user_checklist_status.status =
  'In Progress'`. `user_exam_attempt.result_status = 'IN_PROGRESS'` means an
  approver is reviewing and must not allow learner save, clear, or submit.
* Frontend `attemptStatus` values are derived from attempt timestamps,
  `result_status`, approval state, or the active assignment status.
* A submitted attempt that needs manual review should have one linked `approval_request`.
* The backend should update `last_saved_at` whenever an answer is saved.
* The backend should update `answered_questions` after answers are inserted, updated, or cleared.

---

# Table: `approval_request`

The `approval_request` table tracks the manual review workflow for a submitted exam attempt.

One row represents:

```text
One submitted attempt
+
One assigned approver
+
One approval decision lifecycle
```

```sql
CREATE TABLE approval_request (
    approval_id SERIAL PRIMARY KEY,

    attempt_id INTEGER NOT NULL,
    assigned_to INTEGER NOT NULL,

    status approval_request_status
        NOT NULL DEFAULT 'PENDING',

    remarks TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,

    CONSTRAINT fk_approval_request_attempt
        FOREIGN KEY (attempt_id)
        REFERENCES user_exam_attempt(attempt_id),

    CONSTRAINT fk_approval_request_assigned_to
        FOREIGN KEY (assigned_to)
        REFERENCES user_master(user_id),

    CONSTRAINT uq_approval_request_attempt
        UNIQUE (attempt_id)
);
```

## Columns

| Column         | Data Type                 | Constraints             | Description                                      |
| -------------- | ------------------------- | ----------------------- | ------------------------------------------------ |
| `approval_id`  | `SERIAL`                  | Primary key             | Unique identifier for the approval request.      |
| `attempt_id`   | `INTEGER`                 | Not null, foreign key, unique | Attempt submitted for approval.            |
| `assigned_to`  | `INTEGER`                 | Not null, foreign key   | User assigned to review the submitted attempt.   |
| `status`       | `approval_request_status` | Not null, default `PENDING` | Current approval workflow state.          |
| `remarks`      | `TEXT`                    | Nullable                | Reviewer remarks or decision notes.              |
| `created_at`   | `TIMESTAMP`               | Not null, default current timestamp | Time when the request was created.     |
| `updated_at`   | `TIMESTAMP`               | Not null, default current timestamp | Time when the request was last updated. |
| `completed_at` | `TIMESTAMP`               | Nullable                | Time when the request reached a final state.      |

## Important Rules

* Each attempt may have at most one approval request.
* Approval requests are assigned to `user_master.user_id`.
* The backend should validate that the current user is allowed to act on the request before changing status or remarks.
* Set `completed_at` when the request reaches `APPROVED`, `REJECTED`, or `CANCELLED`.
* Keep `user_exam_attempt.result_status` and `approval_request.status` synchronized intentionally in service logic.

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
    is_attached BOOLEAN NOT NULL DEFAULT FALSE,
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
| `is_attached`     | `BOOLEAN`      | Not null, default false | Indicates whether the answer has linked attachment evidence. |
| `is_correct`      | `BOOLEAN`      | Nullable              | Indicates whether the saved answer is correct.          |
| `score_awarded`   | `NUMERIC(8,2)` | Nullable, nonnegative | Score awarded for this answer.                          |
| `maximum_score`   | `NUMERIC(8,2)` | Nullable, nonnegative | Maximum possible score for this question.               |
| `answered_at`     | `TIMESTAMPTZ`  | Nullable              | Time when the question was answered.                    |
| `last_saved_at`   | `TIMESTAMPTZ`  | Not null              | Most recent save time for the answer.                    |
| `created_at`      | `TIMESTAMPTZ`  | Not null              | Time when the answer record was created.                |
| `updated_at`      | `TIMESTAMPTZ`  | Not null              | Time when the answer record was last updated.           |

## Important Rules

* Each attempt may only have one answer row per question.
* Saving the same question again must update the existing row.
* An answer must reference a question belonging to the supplied module.
* Deleting an attempt automatically deletes its saved answers.
* The backend should derive `user_id` and `module_id` from the attempt where possible.
* The frontend should not be trusted to provide authoritative ownership values.
* `is_attached` should be true when the answer has supporting evidence linked through `module_attachment.user_exam_answer_id`.
* When the last evidence link for an answer is removed, the backend should set `is_attached` back to false.
* `is_correct` may remain null until the attempt is submitted or evaluated.
* `selected_answer` may be null when the user clears an answer.
* When an answer is cleared, `is_answered` should be set to false.

---

# Indexes

The following indexes improve common lookup, save, resume, reporting, and scoring queries.

```sql
CREATE INDEX idx_user_exam_attempt_user
    ON user_exam_attempt(user_id);

CREATE INDEX idx_user_exam_attempt_module
    ON user_exam_attempt(module_id);

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

## Attempt to Approval Request

```text
user_exam_attempt.attempt_id
    -> approval_request.attempt_id
```

One submitted attempt may have one approval request.

```text
user_exam_attempt 1 ---- 0..1 approval_request
```

The approval request is assigned to a user:

```text
approval_request.assigned_to
    -> user_master.user_id
```

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

user_exam_attempt
-----------------
attempt_id PK
user_id FK
module_id FK
attempt_no
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
is_attached
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
2. Check for an existing editable attempt whose `submitted_at` and
   `completed_at` are both null.
3. Resume the existing attempt when one is available.
4. Otherwise, create a new `user_exam_attempt`.
5. Calculate the next `attempt_no`.
6. Count the questions for the selected module.
7. Set `user_checklist_status.status` to `In Progress`.
8. Set `started_at` to the current timestamp for newly created attempts.
9. Create missing `user_exam_answer` shell rows for every question in the
   selected module.
10. Return the new or existing `attempt_id` to the frontend.

The attempt start operation is also the answer-shell creation boundary. The
backend should create or backfill one `user_exam_answer` row per
`baseline_checklist` question for the attempt, in the same transaction used to
create or resume the attempt.

Example shell values:

```text
attempt_id = current attempt
user_id = attempt user
module_id = attempt module
question_id = baseline_checklist.id
selected_answer = NULL
is_answered = FALSE
is_attached = FALSE
is_correct = NULL
score_awarded = NULL
maximum_score = NULL
answered_at = NULL
```

Use an idempotent insert so older in-progress attempts and partially-created
attempts can be repaired safely:

```sql
INSERT INTO user_exam_answer (
    attempt_id,
    user_id,
    module_id,
    question_id,
    selected_answer,
    is_answered,
    is_attached,
    is_correct,
    score_awarded,
    maximum_score,
    answered_at,
    last_saved_at,
    created_at,
    updated_at
)
SELECT
    $1,
    $2,
    $3,
    checklist.id,
    NULL,
    FALSE,
    FALSE,
    NULL,
    NULL,
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM baseline_checklist checklist
WHERE checklist.module_id = $3
ON CONFLICT (attempt_id, question_id)
DO NOTHING;
```

---

## Saving an Answer

The current frontend treats answer saving as forward-navigation save, not
option-change autosave. It sends a save request when the learner clicks
**Next Question**, and sends one final save before submit.

The backend must update the existing shell row. It should not insert a new
`user_exam_answer` row from the save endpoint.

```sql
UPDATE user_exam_answer
SET
    selected_answer = $3,
    is_answered = $4,
    is_correct = NULL,
    score_awarded = NULL,
    maximum_score = NULL,
    answered_at = CASE
        WHEN $4 THEN COALESCE(answered_at, CURRENT_TIMESTAMP)
        ELSE NULL
    END,
    last_saved_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE attempt_id = $1
  AND question_id = $2
RETURNING
    answer_id,
    selected_answer,
    is_answered,
    is_attached,
    last_saved_at;
```

Parameter meanings:

| Parameter | Description     |
| --------- | --------------- |
| `$1`      | Attempt ID      |
| `$2`      | Question ID     |
| `$3`      | Selected answer |
| `$4`      | Whether the normalized answer is present |

The backend should retrieve `user_id` and `module_id` from
`user_exam_attempt`, validate the question belongs to that module, and return a
clear error such as `Answer shell not found` if the shell row is missing.

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
  AND question_id = $2
RETURNING
    answer_id,
    selected_answer,
    is_answered,
    is_attached,
    last_saved_at;
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

1. Find the latest editable attempt whose `submitted_at` and `completed_at` are
   both null.
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
    attempt.total_questions,
    attempt.answered_questions,
    attempt.last_saved_at
FROM user_exam_attempt attempt
WHERE attempt.user_id = $1
  AND attempt.module_id = $2
  AND attempt.submitted_at IS NULL
  AND attempt.completed_at IS NULL
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
8. Update `user_checklist_status.status` in the same transaction as submit.

Example attempt update:

```sql
UPDATE user_exam_attempt
SET
    result_status = $2,
    correct_answers = $3,
    score = $4,
    submitted_at = CURRENT_TIMESTAMP,
    completed_at = CURRENT_TIMESTAMP,
    last_saved_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE attempt_id = $1;
```

For non-approval modules, mark the assignment completed on submit:

```sql
UPDATE user_checklist_status assignment
SET
    status = 'Completed',
    updated_at = CURRENT_TIMESTAMP
USING user_exam_attempt attempt
WHERE attempt.attempt_id = $1
  AND assignment.user_id = attempt.user_id
  AND assignment.module_id = attempt.module_id;
```

For approval-required modules, set assignment status to `Submitted` on submit,
then set it to `Completed` or `Rejected` at approval decision time. `Rejected`
assignments remain active so the learner can retry. Assignment status updates
must not delete `user_exam_attempt`, `user_exam_answer`, approval requests, or
attachments.

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
* Create or backfill missing answer shells for the attempt.
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
* Confirm the attempt is editable by checking
  `user_checklist_status.status = 'In Progress'`.
* Do not use `user_exam_attempt.result_status = 'IN_PROGRESS'` as learner
  editability; that is approver review state.
* Confirm the question belongs to the attempt module.
* Update the existing `user_exam_answer` shell.
* Update attempt progress.
* Return the saved answer, existing `answerId`, and updated progress.

Example response:

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

---

## Clear Answer

```text
DELETE /api/iebaseline/attempts/:attemptId/questions/:questionId/answer
```

Responsibilities:

* Validate attempt ownership.
* Clear the selected answer.
* Set `is_answered` to false.
* Return the existing `answerId`.
* Recalculate progress.

---

## Submit Attempt

```text
POST /api/iebaseline/attempts/:attemptId/submit
```

Responsibilities:

* Validate attempt ownership.
* Validate all answer shells have `is_answered = true`.
* Validate required attachments have `is_attached = true`, except when the saved
  `selected_answer` leading label is `NA` or `N/A`.
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
7. Retry or show an error if saving fails.
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
* Create answer shells at attempt start using an idempotent insert with
  `ON CONFLICT (attempt_id, question_id) DO NOTHING`.
* Save and clear endpoints should update existing shells only; do not create
  answer rows there.
* Use `is_answered`, not answer row existence, for completion and checkpoint
  logic.
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

### New Columns

| Column | Data Type | Constraints | Description |
|----------|-----------|-------------|-------------|
| `available_points` | `NUMERIC(10,2)` | Not null, default `1`, value >= 0 | Maximum score available for this checklist question before multipliers are applied. |
| `attachment_requirement` | `attachment_requirement` enum | Not null, default `'none'` | Indicates whether the question has no attachment support, optional attachment support, or a mandatory attachment requirement. |
| `attachment_instruction` | `TEXT` | Nullable | Instruction shown to users when `attachment_requirement = 'required'`. |
| `attachment_approval_required` | `BOOLEAN` | Not null, default `false` | Indicates whether an uploaded attachment should enter a manual trainer/admin approval workflow. |

### Notes

* Existing questions default to **1 point**.
* Different questions may be assigned different weights.
* The final awarded score is calculated by multiplying `available_points` with the selected option's `score_multiplier`.
* `is_applicable = true` means the selected option is included in scoring and contributes to `maximum_score`.
* `is_applicable = false` means the selected option is excluded from scoring and its available points are not included in the final denominator.
* `score_multiplier = 0` with `is_applicable = true` means zero credit, not exclusion.
* `attachment_requirement` controls whether the frontend should show attachment functionality and whether evidence is mandatory before submission.
* `attachment_instruction` provides the required-attachment helper text shown by the frontend when `attachment_requirement = 'required'`.
* `attachment_approval_required` is intentionally separate from `attachment_requirement` because mandatory evidence and manual approval are different business rules.
* `attachment_requirement = 'none'` should normally be paired with `attachment_approval_required = false`.

Attachment requirement values:

| Value | Meaning |
|-------|---------|
| `none` | No attachment functionality is needed for this question. |
| `optional` | The user may upload supporting evidence, but submission does not require it. |
| `required` | The user must upload evidence before the assessment can be submitted. |

Attachment workflow examples:

| attachment_requirement | attachment_approval_required | Meaning |
|------------------------|------------------------------|---------|
| `required` | `true` | User must upload evidence, and it requires trainer/admin approval. |
| `required` | `false` | User must upload evidence, but no manual approval is needed. |
| `optional` | `true` | User may upload supporting evidence, and if provided, it will be reviewed. |
| `none` | `false` | No attachment functionality for this question. |

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

---

# Module Attachment Structure

This section describes the database objects, storage decisions, API responsibilities, and frontend behavior required to support module-related file attachments.

## Feature Scope

The initial attachment feature supports:

* Authenticated users uploading files related to a module.
* One module having multiple attachments.
* One attachment potentially being linked to multiple modules.
* Files being stored temporarily on local server storage.
* PostgreSQL storing file metadata and module relationships, not the binary file contents.
* Users listing and downloading attachments through backend-controlled API routes.
* Authorized users removing an attachment from a module.

The first implementation should remain storage-provider agnostic where practical so local storage can later be replaced with object storage such as Amazon S3, Azure Blob Storage, or MinIO.

---

## Storage Decision

For the current implementation, the physical file is stored on the backend server's local filesystem.

Example logical storage location:

```text
uploads/module-attachments/
```

Example stored file:

```text
uploads/module-attachments/3a83398f-9f4a-453d-89a4-708e20f8f851.pdf
```

Important distinction:

```text
PostgreSQL
    stores file metadata and relationships

Local filesystem
    stores the actual file bytes
```

The storage directory may exist on the same machine as PostgreSQL during development, but file handling belongs to the backend application. PostgreSQL should not directly manage or delete filesystem files.

The backend should store a relative storage path or storage key rather than relying on a hardcoded machine-specific absolute path.

Preferred:

```text
uploads/module-attachments/3a83398f-9f4a-453d-89a4-708e20f8f851.pdf
```

Avoid storing environment-specific paths such as:

```text
C:\Users\Developer\Project\uploads\module-attachments\file.pdf
```

The backend may combine the relative path with a configured upload root at runtime.

---

## PostgreSQL UUID Support

The attachment design uses `gen_random_uuid()` to automatically generate a UUID for every attachment record.

Enable the required PostgreSQL extension once per database:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

The `IF NOT EXISTS` clause makes the statement safe to run when the extension is already installed.

The UUID column uses:

```sql
attachment_unq_id UUID NOT NULL
    DEFAULT gen_random_uuid()
    UNIQUE
```

Application code should normally omit `attachment_unq_id` during insert and allow PostgreSQL to generate it.

---

# Table: `attachment_master`

The `attachment_master` table stores metadata about the actual uploaded file.

It does not store the file binary.

```sql
CREATE TABLE attachment_master (
    id BIGSERIAL PRIMARY KEY,

    attachment_unq_id UUID NOT NULL
        DEFAULT gen_random_uuid()
        UNIQUE,

    original_file_name VARCHAR(255) NOT NULL,
    stored_file_name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,

    mime_type VARCHAR(150),
    file_extension VARCHAR(20),
    file_size_bytes BIGINT,

    uploaded_by BIGINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_attachment_uploaded_by
        FOREIGN KEY (uploaded_by)
        REFERENCES user_master(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_attachment_file_size
        CHECK (
            file_size_bytes IS NULL
            OR file_size_bytes >= 0
        )
);
```

## Existing Table Migration

If `attachment_master` was already created without the UUID default, run:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE attachment_master
ALTER COLUMN attachment_unq_id
SET DEFAULT gen_random_uuid();
```

## Columns

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGSERIAL` | Primary key | Internal database identifier used for joins and foreign keys. |
| `attachment_unq_id` | `UUID` | Not null, unique, database-generated | Non-sequential attachment identifier suitable for API exposure. |
| `original_file_name` | `VARCHAR(255)` | Not null | Filename supplied by the user and displayed in the UI. |
| `stored_file_name` | `VARCHAR(255)` | Not null | Safe unique filename used on local storage. |
| `storage_path` | `TEXT` | Not null | Relative path or storage key used by the backend to locate the file. |
| `mime_type` | `VARCHAR(150)` | Nullable | Detected or validated content type, such as `application/pdf`. |
| `file_extension` | `VARCHAR(20)` | Nullable | Normalized extension including or excluding the dot according to one consistent backend rule. |
| `file_size_bytes` | `BIGINT` | Nullable, nonnegative | File size in bytes. |
| `uploaded_by` | `BIGINT` | Not null, foreign key | User who uploaded the file. |
| `created_at` | `TIMESTAMPTZ` | Not null, default current timestamp | Time the attachment record was created. |
| `updated_at` | `TIMESTAMPTZ` | Not null, default current timestamp | Time the attachment metadata was last updated. |

## Identifier Responsibilities

Use:

```text
attachment_master.id
```

for internal joins and foreign keys.

Use:

```text
attachment_master.attachment_unq_id
```

when exposing an attachment identifier through frontend-facing APIs where practical.

Example:

```text
GET /api/iebaseline/attachments/3a83398f-9f4a-453d-89a4-708e20f8f851/download
```

The UUID is not an authorization mechanism. The backend must still validate user access.

## Filename Responsibilities

Example user upload:

```text
HLA Safety Manual.pdf
```

The backend should retain:

```text
original_file_name = HLA Safety Manual.pdf
```

The stored file should use a generated safe name, for example:

```text
stored_file_name = 3a83398f-9f4a-453d-89a4-708e20f8f851.pdf
```

Do not use `original_file_name` directly as the physical stored filename.

---

# Table: `module_attachment`

The `module_attachment` table links attachments to modules and to the specific
saved answer the attachment supports.

```sql
CREATE TABLE module_attachment (
    id BIGSERIAL PRIMARY KEY,

    module_id BIGINT NOT NULL,
    attachment_id BIGINT NOT NULL,
    user_exam_answer_id BIGINT NOT NULL,

    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_module_attachment_module
        FOREIGN KEY (module_id)
        REFERENCES module_master(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_module_attachment_attachment
        FOREIGN KEY (attachment_id)
        REFERENCES attachment_master(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_module_attachment_answer
        FOREIGN KEY (user_exam_answer_id)
        REFERENCES user_exam_answer(answer_id)
        ON DELETE CASCADE,

    CONSTRAINT uq_module_attachment
        UNIQUE (module_id, attachment_id),

    CONSTRAINT chk_module_attachment_display_order
        CHECK (display_order >= 0)
);
```

## Columns

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGSERIAL` | Primary key | Internal identifier for the module-attachment relationship. |
| `module_id` | `BIGINT` | Not null, foreign key | Module to which the attachment is linked. |
| `attachment_id` | `BIGINT` | Not null, foreign key | References the uploaded file metadata. |
| `user_exam_answer_id` | `BIGINT` | Not null, foreign key | References the saved answer that this attachment supports. |
| `display_order` | `INTEGER` | Not null, default `0`, nonnegative | Optional ordering value for attachment display. |
| `created_at` | `TIMESTAMPTZ` | Not null, default current timestamp | Time the attachment was linked to the module. |

## Answer Attachment Migration SQL

```sql
ALTER TABLE user_exam_answer
ADD COLUMN is_attached BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE module_attachment
ADD COLUMN user_exam_answer_id BIGINT NOT NULL,
ADD CONSTRAINT fk_module_attachment_answer
    FOREIGN KEY (user_exam_answer_id)
    REFERENCES user_exam_answer(answer_id)
    ON DELETE CASCADE;
```

If `module_attachment` already contains rows, backfill `user_exam_answer_id`
before enforcing `NOT NULL`.

## Why `uploaded_by` Is Not Repeated Here

The uploader is already stored in:

```text
attachment_master.uploaded_by
```

Do not add a duplicate `user_id` to `module_attachment` unless it represents a different business event such as `attached_by`.

Duplicating the uploader in both tables could produce contradictory records.

## Why `storage_path` Is Not Stored Here

The storage path describes the actual file, not its relationship to a module.

Therefore:

```text
attachment_master.storage_path
```

owns the path.

`module_attachment` only answers:

```text
Which attachment is linked to which module and answer?
```

---

# Attachment Relationships

```text
user_master
    1
    |
    | uploaded_by
    v
attachment_master
    1
    |
    | attachment_id
    v
module_attachment
    ^
    | user_exam_answer_id
    |
    1
user_exam_answer
    ^
    | answer_id
    |
    many
user_exam_attempt
    ^
    | module_id
    |
    1
module_master
```

Cardinality:

```text
user_master 1 ---- many attachment_master

attachment_master 1 ---- many module_attachment

module_master 1 ---- many module_attachment

user_exam_answer 1 ---- many module_attachment
```

This relationship design allows:

* One user to upload many attachments.
* One module to contain many attachments.
* One saved answer to contain many evidence attachments.
* One attachment to be reused by multiple modules if future business rules allow it.
* Duplicate links for the same module and attachment to be rejected.
* Deleting an answer to remove its attachment links through `ON DELETE CASCADE`.

---

# Suggested Indexes

Foreign keys do not automatically create lookup indexes in PostgreSQL.

Add indexes for common attachment queries:

```sql
CREATE INDEX idx_attachment_master_uploaded_by
    ON attachment_master(uploaded_by);

CREATE INDEX idx_attachment_master_created_at
    ON attachment_master(created_at);

CREATE INDEX idx_module_attachment_module
    ON module_attachment(module_id);

CREATE INDEX idx_module_attachment_attachment
    ON module_attachment(attachment_id);

CREATE INDEX idx_module_attachment_answer
    ON module_attachment(user_exam_answer_id);
```

The unique constraint on `(module_id, attachment_id)` already creates a unique index for that column combination.

---

# Expected Upload Flow

When a user uploads an attachment for a module:

1. Authenticate the user.
2. Validate that the module exists.
3. Validate that the user is allowed to add attachments to the module.
4. Confirm that exactly one file was provided.
5. Validate the maximum file size.
6. Validate the allowed extension and content type.
7. Generate a safe unique stored filename.
8. Save the file to local storage.
9. Begin a database transaction.
10. Insert one row into `attachment_master`.
11. Insert one row into `module_attachment`, including `user_exam_answer_id`.
12. Set `user_exam_answer.is_attached` to `TRUE` for the answer.
13. Commit the transaction.
14. Return attachment metadata to the frontend.

If the database insert or relationship insert fails after the file is written, the backend must remove the newly written file to avoid an orphaned local file.

Conceptual flow:

```text
Frontend FormData upload
        |
        v
Backend validates request and authorization
        |
        v
Backend writes file to local storage
        |
        v
INSERT attachment_master
        |
        v
INSERT module_attachment
        |
        v
UPDATE user_exam_answer.is_attached = TRUE
        |
        v
Return attachment response
```

---

# Suggested Backend API Responsibilities

The exact route prefix may be adapted to the existing backend structure.

## Upload Module Attachment

```text
POST /api/iebaseline/modules/:moduleId/attachments
```

Request format:

```text
multipart/form-data
```

Recommended file field name:

```text
file
```

Optional form fields:

```text
displayOrder
```

Responsibilities:

* Authenticate the user.
* Validate `moduleId`.
* Validate module existence.
* Validate upload authorization.
* Validate file presence, size, extension, and MIME type.
* Generate a unique stored filename.
* Save the file under the configured upload root.
* Insert `attachment_master`.
* Insert `module_attachment`.
* Return the created attachment.
* Remove the stored file if the database operation fails.

Example response:

```json
{
  "attachment": {
    "id": 15,
    "attachmentUnqId": "3a83398f-9f4a-453d-89a4-708e20f8f851",
    "moduleId": 7,
    "originalFileName": "HLA Safety Manual.pdf",
    "mimeType": "application/pdf",
    "fileExtension": ".pdf",
    "fileSizeBytes": 2839102,
    "userExamAnswerId": 101,
    "displayOrder": 0,
    "uploadedBy": 5,
    "createdAt": "2026-07-27T11:30:00+08:00",
    "downloadUrl": "/api/iebaseline/attachments/3a83398f-9f4a-453d-89a4-708e20f8f851/download"
  }
}
```

The response should not expose the physical `storage_path` unless an internal administrative use case requires it.

---

## List Module Attachments

```text
GET /api/iebaseline/modules/:moduleId/attachments
```

Responsibilities:

* Authenticate the user.
* Validate module access.
* Return attachment metadata ordered by `display_order`, then creation time.
* Return a backend-controlled download URL.

Example query:

```sql
SELECT
    attachment.id,
    attachment.attachment_unq_id,
    attachment.original_file_name,
    attachment.mime_type,
    attachment.file_extension,
    attachment.file_size_bytes,
    attachment.uploaded_by,
    attachment.created_at,
    relation.user_exam_answer_id,
    relation.display_order
FROM module_attachment relation
JOIN attachment_master attachment
    ON attachment.id = relation.attachment_id
WHERE relation.module_id = $1
ORDER BY
    relation.display_order,
    relation.created_at,
    relation.id;
```

---

## Download Attachment

```text
GET /api/iebaseline/attachments/:attachmentUnqId/download
```

Responsibilities:

* Authenticate the user.
* Find the attachment by `attachment_unq_id`.
* Confirm the user can access at least one module linked to the attachment.
* Resolve the stored file safely under the configured upload root.
* Reject path traversal or paths outside the upload directory.
* Confirm the physical file exists.
* Send the file using `original_file_name` as the download filename.
* Set an appropriate `Content-Type`.
* Return `404` when the record or physical file is unavailable.
* Never build a filesystem path directly from untrusted URL input.

---

## Remove Attachment From Module

```text
DELETE /api/iebaseline/modules/:moduleId/attachments/:attachmentUnqId
```

Initial version responsibilities:

* Authenticate the user.
* Validate module and attachment access.
* Delete the matching `module_attachment` relationship.
* Check whether the attachment remains linked to another module.
* If it has no remaining relationships:
  * delete the `attachment_master` row;
  * delete the physical file.
* Return a clear success response.

Recommended response:

```json
{
  "deleted": true,
  "attachmentUnqId": "3a83398f-9f4a-453d-89a4-708e20f8f851"
}
```

Because database rollback cannot restore a deleted filesystem file, the backend should use a deliberate cleanup strategy.

For the initial local-storage implementation, one practical sequence is:

1. Load and validate the attachment.
2. Delete the module relationship in a database transaction.
3. Delete the master row only when no relationships remain.
4. Commit the database transaction.
5. Delete the physical file when the master row was removed.
6. Log and retry cleanup if filesystem deletion fails.

A future implementation may use soft deletion and scheduled cleanup.

---

# Suggested Frontend Behavior

The frontend should:

1. Display an attachment section for the selected module.
2. Load attachment metadata from the backend.
3. Use an `<input type="file">` or equivalent upload component.
4. Send the selected file using `FormData`.
5. Use the field name `file`.
6. Display upload progress or an uploading state.
7. Disable repeated submission while an upload is active.
8. Refresh or append the attachment list after a successful upload.
9. Display the original filename, file type, file size, and upload time.
10. Open downloads through the backend download route.
11. Ask for confirmation before removing an attachment.
12. Display backend validation errors clearly.

The frontend should not:

* Generate authoritative `uploaded_by` values.
* Send `storage_path`.
* Choose or trust the physical stored filename.
* Construct local filesystem paths.
* Treat UUID obscurity as authorization.
* directly expose an `uploads/` directory.
* decide whether a user is authorized to download or delete a file.

Authentication should determine the uploader.

---

# Frontend Upload Example

The frontend must use `FormData`.

```javascript
async function uploadModuleAttachment(moduleId, file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `/api/iebaseline/modules/${moduleId}/attachments`,
    {
      method: "POST",
      body: formData,
    },
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.message || "Failed to upload attachment.",
    );
  }

  return payload.attachment;
}
```

Do not manually set:

```text
Content-Type: multipart/form-data
```

when using browser `FormData`.

The browser must generate the multipart boundary automatically.

---

# Backend Insert Example

The backend should omit `attachment_unq_id` and allow PostgreSQL to generate it.

```sql
INSERT INTO attachment_master (
    original_file_name,
    stored_file_name,
    storage_path,
    mime_type,
    file_extension,
    file_size_bytes,
    uploaded_by
)
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7
)
RETURNING
    id,
    attachment_unq_id,
    original_file_name,
    stored_file_name,
    storage_path,
    mime_type,
    file_extension,
    file_size_bytes,
    uploaded_by,
    created_at,
    updated_at;
```

Then create the module relationship:

```sql
INSERT INTO module_attachment (
    module_id,
    attachment_id,
    user_exam_answer_id,
    display_order
)
VALUES (
    $1,
    $2,
    $3,
    $4
)
RETURNING
    id,
    module_id,
    attachment_id,
    user_exam_answer_id,
    display_order,
    created_at;
```

Both inserts should be handled as one logical operation.

---

# Validation and Security Rules

At minimum, the backend must enforce:

* Authenticated upload, list, download, and delete operations.
* Authorization based on module access and the user's role.
* A configurable maximum upload size.
* An explicit allowlist of permitted file types.
* Filename sanitization.
* Generated stored filenames.
* Parameterized SQL.
* Safe path resolution.
* No public execution of uploaded files.
* No trust in client-provided MIME type alone.
* No trust in the filename extension alone.
* No direct use of `original_file_name` as a filesystem path.
* No direct public exposure of the upload directory.
* Logging of upload and deletion failures.

Recommended initial allowed types should be agreed with the business requirement.

Possible starting set:

```text
.pdf
.png
.jpg
.jpeg
.docx
.xlsx
```

For stronger validation, inspect file signatures or magic bytes.

For production or wider enterprise use, add malware scanning before making files available for download.

---

# Error Handling

Suggested HTTP responses:

| Situation | Status |
|---|---:|
| File missing from request | `400 Bad Request` |
| Invalid module ID | `400 Bad Request` |
| Unsupported file type | `415 Unsupported Media Type` |
| File exceeds limit | `413 Payload Too Large` |
| User not authenticated | `401 Unauthorized` |
| User lacks module access | `403 Forbidden` |
| Module not found | `404 Not Found` |
| Attachment record not found | `404 Not Found` |
| Physical file missing | `404 Not Found` or internal integrity error |
| Duplicate module-attachment relationship | `409 Conflict` |
| Unexpected storage or database failure | `500 Internal Server Error` |

The backend should avoid returning server filesystem paths in error messages.

---

# Configuration

Do not hardcode upload paths or upload limits in route code.

Suggested environment variables:

```text
ATTACHMENT_UPLOAD_ROOT=uploads/module-attachments
ATTACHMENT_MAX_FILE_SIZE_BYTES=10485760
```

Example:

```text
10485760 bytes = 10 MiB
```

The backend should ensure the upload directory exists during startup.

The local upload directory should be excluded from source control.

Example `.gitignore` entry:

```text
uploads/
```

Production deployment must mount persistent storage if the backend container or server may be rebuilt.

---

# Important Implementation Rules for Coding Agents

* Reuse the project's existing authentication and database connection patterns.
* Do not invent a second user identity mechanism.
* Derive `uploaded_by` from the authenticated user.
* Use `module_master.id` as the authoritative module key.
* Use `attachment_master.id` for database joins.
* Link answer evidence through `module_attachment.user_exam_answer_id`.
* Keep `user_exam_answer.is_attached` synchronized with the answer's evidence links.
* Prefer `attachment_unq_id` for frontend-facing attachment routes.
* Do not expose `storage_path` in normal frontend responses.
* Keep file-storage logic behind a service or helper instead of scattering it across route handlers.
* Keep database queries parameterized.
* Use a database transaction for the two attachment inserts.
* Remove the newly written file when database creation fails.
* Validate authorization separately for upload, list, download, and delete.
* Do not assume that possession of an attachment UUID grants access.
* Return consistent camelCase JSON if that matches the existing frontend contract.
* Preserve original filenames for display and downloads.
* Generate safe physical filenames.
* Normalize file extensions consistently.
* Add indexes for foreign-key lookup columns.
* Add automated tests for upload validation, authorization, listing, downloading, deletion, and orphan cleanup.
* Do not implement cloud object storage in the first version unless the project already provides it.
* Keep the storage interface replaceable so local storage can be migrated later.

---

# Minimum Acceptance Criteria

The attachment feature is complete for the initial version when:

1. An authorized user can upload an allowed file to an existing module.
2. The file is physically saved under the configured local upload directory.
3. One `attachment_master` row is created.
4. One `module_attachment` row is created with `user_exam_answer_id`.
5. PostgreSQL automatically generates `attachment_unq_id`.
6. The related `user_exam_answer.is_attached` value is set to true.
7. The module attachment list displays the uploaded file.
8. An authorized user can download the file using the backend route.
9. Unauthorized users cannot access the file.
10. An authorized user can remove the attachment.
10. Unlinked attachment metadata and physical files are cleaned up.
11. Failed database operations do not leave newly uploaded orphan files.
12. The frontend never receives or constructs a server filesystem path.

---

# Future Improvements

The current structure can later support:

* Cloud or on-premises object storage.
* Presigned or time-limited download URLs.
* Attachment descriptions and display labels.
* Attachment categories.
* Version history.
* Soft deletion.
* Malware scanning.
* Checksums for integrity and duplicate detection.
* Per-attachment access control.
* Audit logs.
* Preview generation.
* Image thumbnails.
* PDF metadata extraction.
* Bulk upload.
* Storage quotas.
* Background cleanup of orphan files.
* Attachment links to checklist questions, attempts, answers, or user submissions.
