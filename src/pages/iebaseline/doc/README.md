# IE Baseline Frontend File Guide

This folder contains the frontend screens for the IE Baseline module.

If you are new to frontend development, think of each `.tsx` file as a React component. A component is a reusable piece of UI. Some components are full pages, and some are smaller parts used inside a page.

## Quick Mental Model

The IE Baseline module is currently built from 5 main files:

1. `IEBaseline.tsx` shows the main dashboard.
2. `IEBaselineEdit.tsx` shows the module management page.
3. `ModuleOverview.tsx` shows one module from the learner/user view.
4. `ModuleAdmin.tsx` shows one module from the admin/editing view.
5. `components/ExamModal.tsx` shows the quiz/exam popup.

The files are connected by routes. A route is the URL path that decides which page appears in the browser.

Example:

```text
/iebaseline                  -> IEBaseline.tsx
/iebaseline/edit             -> IEBaselineEdit.tsx
/iebaseline/module/:moduleId -> ModuleOverview.tsx
/iebaseline/admin/:moduleId  -> ModuleAdmin.tsx
```

The `:moduleId` part means the URL contains a dynamic value, such as `m1`, `m2`, or `m3`.

## 1. `IEBaseline.tsx`

This is the main dashboard page for IE Baseline.

It does two important things:

- Defines the mock module data in `MODULES`.
- Displays the user details and assigned training modules.

The `MODULES` array is currently the source of data for the whole IE Baseline module. Other files import this array to know which modules exist.

For example:

```tsx
export const MODULES: ModuleData[] = [
  {
    id: 'm1',
    name: 'Process Control Flow (PCF) Fundamentals',
    progress: 100,
    status: 'Completed',
    lessons: [...]
  }
];
```

In a real production app, this data might eventually come from an API or database instead of being hardcoded here.

Main UI shown in this file:

- Personal details table
- Assigned modules table
- Module progress bar
- Status badge
- Expandable lesson list
- Links to open each module overview page

Important beginner note:

`MODULES.map(...)` means "loop through every module and render UI for each one."

## 2. `IEBaselineEdit.tsx`

This is the module management page.

It is like an admin landing page where someone can see all modules and choose one to edit.

It imports `MODULES` from `IEBaseline.tsx`, then displays each module in a table.

Main UI shown in this file:

- "Manage Modules" heading
- "Create New Module" button
- Table of existing modules
- Module name
- Created date
- Owner
- Last updated date
- Edit icon/button

Clicking a module or the pencil icon sends the user to:

```text
/iebaseline/admin/m1
```

That page is handled by `ModuleAdmin.tsx`.

Important beginner note:

`Link` comes from `react-router-dom`. It is used for internal navigation without fully reloading the page.

## 3. `ModuleOverview.tsx`

This is the learner/user view for one specific module.

It reads `moduleId` from the URL, then finds the matching module from `MODULES`.

Example:

```text
/iebaseline/module/m2
```

In that case, `moduleId` is `m2`, and the page looks for the module with `id: 'm2'`.

Main UI shown in this file:

- Back button to the dashboard
- Module title and description
- Module status badge
- Completion banner if the module is completed
- Lesson list
- Additional details tab
- Side card with duration, lesson count, delivery mode, and instructor
- Button to start or review the course

This file also controls when the exam popup appears.

It uses React state:

```tsx
const [activeExam, setActiveExam] = useState<string | null>(null);
```

Simple explanation:

- `activeExam` is empty when no exam is open.
- When the user clicks start/play, `setActiveExam(...)` stores a value.
- When `activeExam` has a value, the page shows `ExamModal`.
- When the modal closes, it sets `activeExam` back to `null`.

At the bottom:

```tsx
{activeExam && <ExamModal onClose={() => setActiveExam(null)} />}
```

This means "show the exam modal only when `activeExam` exists."

## 4. `ModuleAdmin.tsx`

This is the admin/editing page for one specific module.

Like `ModuleOverview.tsx`, it also reads `moduleId` from the URL and finds the matching module from `MODULES`.

Example:

```text
/iebaseline/admin/m3
```

Main UI shown in this file:

- Sticky header with back button and save button
- General module details form
- Published status switch
- Instructor profile form
- Visual customization controls
- Syllabus text area
- Quiz builder section
- Media upload section
- Right-side quick navigation

This file is mostly a form layout right now. Many fields use `defaultValue`, which means they show initial values, but the file does not yet save real changes anywhere.

Important beginner note:

The `useEffect` in this file sets up an `IntersectionObserver`. That is browser logic used to detect which section is currently visible while scrolling, so the quick navigation can highlight the active section.

## 5. `components/ExamModal.tsx`

This is the full-screen quiz/exam popup used by `ModuleOverview.tsx`.

It is not a route by itself. It only appears when another component renders it.

Main behavior in this file:

- Stores mock exam questions in `MOCK_QUESTIONS`
- Shows one question at a time
- Lets the user choose an answer
- Checks whether the selected answer is correct
- Shows feedback after submitting
- Moves to the next question
- Has a timer for each question
- Closes after the last question

Important state values:

- `currentIndex`: which question the user is currently on
- `selectedOption`: which answer the user selected
- `isSubmitted`: whether the current answer has been submitted
- `timeLeft`: how many seconds remain

Important beginner note:

This file uses `ReactDOM.createPortal(...)`. That means the modal is rendered directly into `document.body` instead of staying inside the normal page layout. This is common for popups because it helps the modal cover the whole screen properly.

## How The Files Work Together

The simplest flow is:

```text
IEBaseline.tsx
  shows all modules
  links to ModuleOverview.tsx

ModuleOverview.tsx
  shows one module
  can open ExamModal.tsx

IEBaselineEdit.tsx
  shows all modules for editing
  links to ModuleAdmin.tsx

ModuleAdmin.tsx
  shows the edit form for one module
```

## Shared UI Components

You will see imports like:

```tsx
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
```

These are shared UI building blocks used across the app. They are not specific to IE Baseline.

You will also see imports like:

```tsx
import { BookOpen, Save, PlayCircle } from 'lucide-react';
```

These are icons from the `lucide-react` icon library.

## What To Touch First As A Beginner

If you are asked to change text, layout, or visible content:

- Start with `IEBaseline.tsx` for the main dashboard.
- Start with `ModuleOverview.tsx` for the learner module page.
- Start with `IEBaselineEdit.tsx` for the module list/admin landing page.
- Start with `ModuleAdmin.tsx` for the editing form.
- Start with `ExamModal.tsx` for quiz behavior or exam UI.

If you are asked to add real data saving or connect to a backend, that is a bigger task. Right now the module mostly uses hardcoded/mock data.

## IE Baseline Python Setup

Some IE Baseline migration/import scripts use Python.

Run these commands from the repo root:

```powershell
cd C:\Python\VSCode_Workplace\jdoc_retreival\IE-Pulse
```

Create and activate a local virtual environment for IE Baseline:

```powershell
py -3 -m venv src\pages\iebaseline\.venv
src\pages\iebaseline\.venv\Scripts\Activate.ps1
```

Install the IE Baseline Python requirements:

```powershell
py -3 -m pip install -r src\pages\iebaseline\requirements.txt
```

The requirements file is:

```text
src/pages/iebaseline/requirements.txt
```

## HLA Baseline Checklist Import

The HLA baseline checklist import script is:

```text
src/pages/iebaseline/scripts/import_hla_baseline_checklist.py
```

By default, it reads all direct `.csv` files from:

```text
src/pages/iebaseline/csv/hla_baseline_checklist/
```

Each CSV filename becomes the imported `module_name`. For example:

```text
DatP.csv -> module_name = DatP
```

Preview the import without writing to PostgreSQL:

```powershell
py -3 src\pages\iebaseline\scripts\import_hla_baseline_checklist.py --dry-run
```

Insert into the default `baseline_checklist` table:

```powershell
py -3 src\pages\iebaseline\scripts\import_hla_baseline_checklist.py
```

Use a different CSV folder if needed:

```powershell
py -3 src\pages\iebaseline\scripts\import_hla_baseline_checklist.py --csv-dir path\to\csv_folder --dry-run
py -3 src\pages\iebaseline\scripts\import_hla_baseline_checklist.py --csv-dir path\to\csv_folder
```

The script reads PostgreSQL credentials from:

```text
src/pages/iebaseline/.env
```

Expected variable:

```text
DATABASE_CRED=postgresql://user:password@host:5432/database
```

Before inserting each CSV file, the script deletes existing rows with the same `module_name`, then inserts the fresh CSV rows.
