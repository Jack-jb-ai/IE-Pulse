# IE Baseline Home Page Template

This document is a coding-agent reference for future work on the IE Baseline home page.

The current home page should be treated as the visual and layout template for the learner-facing IE Baseline dashboard while the module moves from hardcoded mock data toward real mock exam, checklist, assignment, and result data.

## Primary File

```text
src/pages/iebaseline/IEBaseline.tsx
```

Route:

```text
/iebaseline
```

Sidebar navigation entry:

```text
src/config/apps.ts
IE Baseline -> Overview -> /iebaseline
```

Route registration:

```text
src/App.tsx
<Route path="/iebaseline" element={<IEBaseline />} />
```

## Product Role

The home page is the main learner dashboard for IE Baseline.

It should answer these questions for a normal user:

- Who am I in the system?
- Which IE Baseline exams/modules are assigned to me?
- What is my progress for each assignment?
- What is the current status of each assignment?
- What action should I take next: start, continue, or review?

For now, the page is also the source of the mock module data used by other IE Baseline pages. This is acceptable during prototyping, but future implementation should move shared data into a dedicated data/API layer.

Current update:

- The home page now fetches learner home data from `GET /api/iebaseline/home?user_id=1`.
- `user_id=1` is a temporary demo-user default until authentication/current-user lookup exists.
- Assignment progress now supports latest-attempt percentages from `0` to `100`, not only `0` or `100`.
- Assignment status now supports the derived API labels `Not Started`, `In Progress`, and `Completed`.
- Email and department remain placeholders because the current API response does not include them.
- `MODULES` remains exported from `IEBaseline.tsx` only for dependent legacy pages such as module overview, admin, and edit views.

## Current Template Structure

The home page uses this layout:

```text
Page container
  Personal Details section
    Section heading
    Active learning status pill
    Personal details table/card

  Assigned Modules section
    Section heading
    Module table/card
      Header row
      Accordion rows, one per module
        Summary row
          Module name link
          Progress bar
          Status badge
          Action column placeholder
        Expanded detail panel
          Module description
          Lessons & Exams list
          Start / Continue / Review CTA
```

Keep this structure as the base template unless a future requirement explicitly changes the learner workflow.

## Current Data Contract

`IEBaseline.tsx` exports these types:

```tsx
export type ModuleStatus = 'Not Started' | 'In Progress' | 'Completed';

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  completed: boolean;
}

export interface ModuleData {
  id: string;
  name: string;
  description: string;
  progress: number;
  status: ModuleStatus;
  lessons: Lesson[];
  createdAt: string;
  owner: string;
  lastUpdated: string;
}
```

`MODULES` is currently hardcoded in `IEBaseline.tsx` for legacy dependent pages. The home page should not use it for assigned module rendering now that the home API exists.

Current import users:

```text
src/pages/iebaseline/ModuleOverview.tsx
src/pages/iebaseline/ModuleAdmin.tsx
src/pages/iebaseline/IEBaselineEdit.tsx
```

Important: when replacing `MODULES` with API data, update all import users or introduce a compatibility layer so these pages do not break.

## Visual/Component Pattern

Use the same UI vocabulary already present in the page:

- `Card` for framed dashboard/table sections.
- `Accordion` for expandable module rows.
- `Progress` for assignment completion.
- `Badge` for module status.
- `Button` for CTAs.
- `Link` from `react-router-dom` for navigation.
- Lucide icons for section labels and lesson states.

The current status color helper is:

```tsx
const getStatusColorClass = (status: ModuleStatus) => {
  switch (status) {
    case 'Completed': return 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20';
    case 'In Progress': return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20';
    case 'Not Started': return 'bg-muted text-muted-foreground hover:bg-muted/80';
  }
};
```

Keep status styling consistent across home, overview, admin, and results pages.

## Navigation Behavior

Module names link to the learner module overview:

```tsx
to={`/iebaseline/module/${mod.id}`}
```

The target route is:

```text
/iebaseline/module/:moduleId
```

Handled by:

```text
src/pages/iebaseline/ModuleOverview.tsx
```

The accordion trigger and the module link overlap. The current link calls:

```tsx
onClick={(e) => e.stopPropagation()}
```

Keep this behavior if the row remains expandable, otherwise clicking the link may also toggle the accordion.

## What Is Hardcoded Today

These items are currently static and should eventually come from authenticated user/profile, assignment, module, attempt, and result data:

- User name.
- User email.
- Department.
- Job title.
- Active learning status text.
- Assigned modules.
- Progress percent.
- Module status.
- Lessons and completion state.
- Module descriptions.
- Module owner and dates.

## Future Data Shape

When the backend or state layer exists, the home page should receive or fetch a learner dashboard payload similar to:

```ts
interface IEBaselineHomeData {
  user: {
    id: string;
    name: string;
    email: string;
    department: string;
    jobTitle: string;
  };
  assignments: AssignedModuleSummary[];
}

interface AssignedModuleSummary {
  assignmentId: string;
  moduleId: string | number;
  moduleName: string;
  description: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  progress: number;
  score?: number;
  passingScore?: number;
  dueDate?: string;
  attemptCount?: number;
  attemptLimit?: number;
  lastAttemptAt?: string;
  lessons?: Lesson[];
}
```

Prefer adding new optional fields without removing the existing display fields until all dependent pages are migrated.

## Relationship To Existing Database/API Notes

Current documented backend endpoints:

```text
GET /api/iebaseline/home?user_id=1
GET /api/iebaseline/modules/{moduleName}/questions
```

The home endpoint fetches the learner profile and assigned module summaries. The questions endpoint fetches checklist questions from `baseline_checklist`.

Current documented tables:

```text
module_master
baseline_checklist
```

The home page calls the home endpoint through the frontend path:

```text
/ietools/iebaseline/api/home?user_id=1
```

The Vite development proxy rewrites that path to:

```text
/api/iebaseline/home?user_id=1
```

`ModuleOverview` or `ExamModal` should load detailed module/question data separately.

Likely future endpoints:

```text
GET /api/iebaseline/modules
GET /api/iebaseline/assignments
GET /api/iebaseline/assignments/{assignmentId}/result
```

These endpoints do not exist yet; they are design placeholders only.

## Backend Home API Requirements

The home page expects this endpoint:

```http
GET /api/iebaseline/home?user_id=1
```

Temporary identity behavior:

- Use `user_id=1` as the default demo user.
- Replace this with authenticated current-user lookup when authentication is implemented.

Expected response shape:

```ts
interface IEBaselineHomeResponse {
  user: {
    user_id: number;
    name: string;
    position: string | null;
    wd_id: number | null;
  };
  assignments: Array<{
    assignment_id: number;
    module_id: number;
    module_name: string;
    description: string | null;
    owner_name: string | null;
    assigned_by: {
      user_id: number;
      name: string;
    } | null;
    status: 'Not Started' | 'In Progress' | 'Completed';
    raw_status: 'Incomplete' | 'Completed';
    progress: number;
    assigned_at: string;
    updated_at: string;
    question_count: number;
  }>;
}
```

Current status/progress behavior:

```text
No attempt exists                                      -> Not Started -> 0%
Latest attempt answered questions < total questions    -> In Progress -> 0..99%
Latest attempt answered questions = total questions    -> Completed   -> 100%
```

The backend should derive progress from the most recent `user_exam_attempt` for
the assigned `user_id` and `module_id`.

```text
progress = round(answered user_exam_answer rows / total module questions * 100)
```

Count only latest-attempt `user_exam_answer` rows with `is_answered = true`.
Saved `NA` / `N/A` answers still count as answered when `is_answered = true`.

Keep `user_checklist_status.status` unchanged as the raw database enum:
`Incomplete` or `Completed`. `In Progress` is a derived API/frontend label and
must not be stored in `user_checklist_status.status`.

## Coding-Agent Instructions For Future Edits

When modifying the home page:

1. Preserve the two-section dashboard pattern unless the user asks for a new IA.
2. Keep learner-facing data separate from admin-only controls.
3. Do not add admin create/edit controls to this page; use `/iebaseline/edit` and `/iebaseline/admin/:moduleId`.
4. Keep module row navigation pointed at `/iebaseline/module/:moduleId`.
5. Keep status/progress visible at a glance.
6. If adding backend data, avoid deleting `MODULES` until all pages that import it are migrated.
7. If extracting mock data, prefer a dedicated file such as `src/pages/iebaseline/data/modules.ts`.
8. If adding React Query/API calls, include loading, empty, and error states.
9. If adding assignment data, show only modules assigned to the logged-in user.
10. If authentication is not available yet, use a local mock user object with a clear `TODO` or fixture name.

## Recommended Next Refactor

The cleanest next implementation step is to separate data from layout:

```text
src/pages/iebaseline/IEBaseline.tsx
src/pages/iebaseline/data/modules.ts
src/pages/iebaseline/types.ts
```

Suggested ownership:

- `IEBaseline.tsx`: page layout and rendering only.
- `types.ts`: `ModuleStatus`, `Lesson`, `ModuleData`, future assignment/profile types.
- `data/modules.ts`: temporary `MODULES` fixture.

After that, replace fixture data with API hooks when endpoints exist.

## Template Acceptance Checklist

A future home page implementation should be considered aligned with this template if:

- It renders personal/profile details at the top.
- It renders assigned modules/exams below the profile area.
- Each assignment shows module name, progress, status, and next action.
- Each assignment can reveal additional details without navigating away.
- Each module can navigate to `/iebaseline/module/:moduleId`.
- The page remains learner-focused.
- Admin management stays on the edit/admin routes.
- Mock data is easy to replace with backend data.
