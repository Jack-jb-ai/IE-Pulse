# IE Baseline Module Goal

The goal of the IE Baseline module is to turn it into a usable Mock Exam web page for IE Baseline learning, assessment, and administration.

This document is meant to align future development direction. It should be updated as requirements become clearer.

## Product Goal

IE Baseline should allow users to take assigned mock exams/modules, track their progress, and view their results.

Admins should be able to manage exams/modules, assign them to users, and migrate questions from structured source files such as CSV or Excel.

## Target Users

### Normal User / Engineer

A normal user should be able to:

- View assigned mock exams/modules.
- Start or continue an assigned exam/module.
- Answer mock exam questions.
- See progress and completion status.
- Review completed modules or exam results.

### Admin User

An admin user should be able to:

- Create, edit, and manage mock exams/modules.
- Assign exams/modules to users.
- Upload or migrate exam questions from CSV/Excel.
- Review exam metadata, ownership, and module status.
- Manage question content, scoring rules, and supporting references.

## Current State

### Home Page

Status: Partially created

Current file:

```text
src/pages/iebaseline/IEBaseline.tsx
```

Current behavior:

- Shows personal details.
- Shows assigned modules.
- Shows progress and status.
- Links to individual module pages.

Future direction:

- Replace hardcoded user/module data with real data.
- Show only modules assigned to the logged-in user.
- Display exam status, score, attempts, due date, and completion history.

### Module / Exam Overview

Status: Partially created

Current file:

```text
src/pages/iebaseline/ModuleOverview.tsx
```

Current behavior:

- Shows one module/exam page.
- Shows lessons/questions overview.
- Can open the exam modal.

Future direction:

- Treat each module as a mock exam or exam package.
- Show exam instructions, duration, number of questions, passing score, and attempt rules.
- Start the correct exam question set based on the selected module.

### Mock Exam Taking Experience

Status: Partially created

Current file:

```text
src/pages/iebaseline/components/ExamModal.tsx
```

Current behavior:

- Shows mock questions.
- Allows answer selection.
- Has per-question timer.
- Shows immediate feedback.
- Moves between questions.

Future direction:

- Load questions from migrated data instead of hardcoded mock data.
- Support scoring and final result summary.
- Support Yes / No / N/A checklist-style questions if required.
- Support A / B / C / D multiple-choice questions if required.
- Handle skipped or timed-out questions.
- Support retry rules.
- Save results when backend/authentication exists.

### Manage Modules / Exams

Status: Partially created

Current files:

```text
src/pages/iebaseline/IEBaselineEdit.tsx
src/pages/iebaseline/ModuleAdmin.tsx
```

Current behavior:

- Shows a management list of existing modules.
- Opens an admin/editing page for a selected module.
- Provides form UI for metadata, instructor, visuals, syllabus, quiz, and media.

Future direction:

- Make the forms functional.
- Add create, edit, delete, publish, and archive behavior.
- Manage question sets and scoring rules.
- Connect module management to real stored data.

### Migration

Status: Created

Current files:

```text
src/pages/iebaseline/MockExamMigration.tsx
src/pages/iebaseline/templates/mock-exam-migration-template.csv
src/pages/iebaseline/scripts/migrate_mock_exam.py
```

Current behavior:

- Provides CSV upload UI.
- Allows user to enter mock exam name and owner/creator.
- Generates a TypeScript-style migrated question output.
- Provides downloadable sample CSV template.
- Includes a Python helper script for conversion.

Future direction:

- Support real Excel files if needed.
- Persist migrated question sets.
- Validate source data more strictly.
- Show migration errors clearly.
- Map migrated questions to modules/exams automatically.

### Authentication

Status: Not created yet

Priority: Later / last

Future direction:

- Add authentication after the core mock exam workflow is stable.
- Support normal user and admin roles.
- Hide admin-only pages from normal users.
- Protect routes such as migration, module assignment, and module management.

Admin-only pages should eventually include:

```text
/iebaseline/edit
/iebaseline/admin/:moduleId
/iebaseline/migration
```

## Required Major Features

### 1. Authentication

Status: Planned later

Purpose:

- Identify who is using the module.
- Separate normal users from admins.
- Protect admin-only features.

Notes:

- This should be implemented last or near the end.
- The frontend can be designed with roles in mind before real authentication exists.

### 2. Home Page

Status: Partially created

Purpose:

- Main landing page for users.
- Show assigned exams/modules.
- Show progress, status, and available actions.

### 3. Assign Exams / Modules To Users

Status: Not created yet

Purpose:

- Admins assign specific mock exams/modules to specific users or groups.

Suggested features:

- Select exam/module.
- Select users or departments.
- Set due date.
- Set attempt limit.
- Set required passing score.
- Track assignment status.

### 4. Manage Modules / Exams

Status: Partially created

Purpose:

- Admins create and maintain exam/module content.

Suggested features:

- Create new exam/module.
- Edit exam/module metadata.
- Add or remove questions.
- Configure scoring rules.
- Publish or unpublish exams.
- Archive old exams.

### 5. Migration

Status: Created

Purpose:

- Help admins migrate questions from CSV/Excel into the mock exam module.

Suggested features:

- Download sample template.
- Upload CSV/Excel.
- Preview migrated questions.
- Validate missing fields.
- Generate question data.
- Save migrated question set into an exam/module.

### 6. Exam Results

Status: Not created yet

Purpose:

- Show users their score and completion status.

Suggested features:

- Final score.
- Pass/fail status.
- Correct and incorrect answer review.
- Time taken.
- Attempt number.
- Completion date.

### 7. Question Bank

Status: Not created yet

Purpose:

- Store reusable questions separately from exams/modules.

Suggested features:

- Filter by category, keyword, IBPM L2, IBPM L3, Baseline, or Best Practice.
- Add, edit, duplicate, or delete questions.
- Attach references or images.
- Reuse questions across exams.

### 8. Scoring Rules

Status: Not created yet

Purpose:

- Define how exams are graded.

Suggested defaults:

```text
Each question = 1 point
Passing score = 80%
Timed-out question = wrong
N/A behavior must be confirmed
Immediate explanation after answer can stay for now
```

### 9. Data Storage / Backend

Status: Not created yet

Purpose:

- Store users, exams, questions, assignments, and results.

Possible stored data:

- Users
- Roles
- Exams/modules
- Question bank
- Assignments
- Attempts
- Scores/results
- Migration history

## Suggested Development Order

1. Clean up question data structure.
2. Connect `ExamModal` to migrated/mock question data.
3. Add final score/result summary.
4. Improve home page to show assigned exams/modules.
5. Build admin assignment page.
6. Make module/exam management forms functional.
7. Improve migration flow and validation.
8. Add persistence/backend integration.
9. Add authentication and role-based access.

## Important Direction

The module should move away from being a static frontend mockup and become a working mock exam tool.

The main product flow should be:

```text
Admin creates or migrates exam
Admin assigns exam to users
User sees assigned exam on home page
User takes exam
System calculates score
User/admin can view result
```

