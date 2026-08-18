import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowDownAZ, ArrowUpAZ, BookOpen, GitBranch, Layers, Mail, Route, ServerCog, type LucideIcon } from 'lucide-react';

const routes = [
  { path: '/iebaseline', page: 'IEBaseline.tsx', purpose: 'Learner dashboard for assigned modules' },
  { path: '/iebaseline/module/:moduleId', page: 'ModuleOverview.tsx', purpose: 'Module overview and checklist entry' },
  { path: '/iebaseline/attempts', page: 'PreviousAttempts.tsx', purpose: 'Learner attempt history across active and completed modules' },
  { path: '/iebaseline/attempts/:attemptId/results', page: 'FinalResults.tsx', purpose: 'Selected attempt answer and score results' },
  { path: '/iebaseline/module/:moduleId/results', page: 'FinalResults.tsx', purpose: 'Legacy latest module attempt result route' },
  { path: '/iebaseline/assign', page: 'AssignModules.tsx', purpose: 'User/module assignment management' },
  { path: '/iebaseline/approvals/my-submissions', page: 'Approvals.tsx', purpose: 'Learner approval request history' },
  { path: '/iebaseline/approvals/inbox', page: 'Approvals.tsx', purpose: 'Approver inbox for assigned checklist reviews' },
  { path: '/iebaseline/approvals/:approvalId/review', page: 'ApprovalReviewRoute', purpose: 'Full-screen approver review workflow' },
  { path: '/iebaseline/users', page: 'UserManagement.tsx', purpose: 'Create, update, and delete user_master records' },
  { path: '/iebaseline/edit', page: 'IEBaselineEdit.tsx', purpose: 'Legacy/mock module management landing page' },
  { path: '/iebaseline/admin/:moduleId', page: 'ModuleAdmin.tsx', purpose: 'Legacy/mock module editor' },
  { path: '/iebaseline/developer-docs', page: 'DeveloperDocs.tsx', purpose: 'In-app developer reference' },
];

const identityFlow = [
  'useIEBaselineCurrentUser reads AD profile data through useCurrentUser.',
  'Normal runs require email and call POST /users/resolve-current to obtain user_master.user_id.',
  'VITE_IEBASELINE_USER_ID_OVERRIDE can explicitly supply a temporary staging user ID and skip AD email resolution.',
  'Learner pages block their user-scoped API calls until ieBaselineUserId is available.',
  'There is no hardcoded demo-user fallback.',
];

const notificationFlow = [
  'Approval request emails are sent by the backend after a successful attempt submit commit.',
  'Approved and rejected emails are sent by the backend after a successful approval decision commit.',
  'The frontend does not build recipient email addresses, email subjects, or email bodies.',
  'The manual notification endpoint is intentionally not wrapped or exposed in v1.',
];

const pages = [
  {
    name: 'Learner Dashboard',
    route: '/iebaseline',
    file: 'IEBaseline.tsx',
    owner: 'Learner home and assignment progress display',
    source: 'Backend home API for visible assignment rows; legacy MODULES remains exported for old admin pages.',
    features: [
      'Resolves the active learner through useIEBaselineCurrentUser before learner-specific API calls.',
      'Loads the resolved learner profile and assigned module list.',
      'Displays progress, stored assignment status, owner, assigned by, assigned date, updated date, and question count.',
      'Expands a module row to show details and actions.',
      'Links each assignment to the module overview route.',
      'Links to Previous Attempts for completed, rejected, and pending attempt history.',
    ],
    apis: ['POST /users/resolve-current', 'GET /home?user_id=...'],
    actions: [
      {
        trigger: 'Module name link',
        condition: 'Visible for every assigned module row.',
        result: 'Routes to /iebaseline/module/{module_id}.',
        api: 'No direct call; target page calls GET /home.',
      },
      {
        trigger: 'Start Module / Continue Module / View Module / Result',
        condition: 'Label is derived from assignment.status.',
        result: 'Routes to /iebaseline/module/{module_id}.',
        api: 'No direct call; target page calls GET /home.',
      },
      {
        trigger: 'Accordion row expand',
        condition: 'Visible for every assignment row.',
        result: 'Expands local module details inside the dashboard.',
        api: 'No API call.',
      },
    ],
  },
  {
    name: 'Module Overview',
    route: '/iebaseline/module/:moduleId',
    file: 'ModuleOverview.tsx',
    owner: 'Single assigned module landing page',
    source: 'Backend home API; the route moduleId is matched against assignment.module_id.',
    features: [
      'Resolves the active learner through useIEBaselineCurrentUser.',
      'Reads moduleId from the URL and finds the matching assignment.',
      'Shows module name, description, progress, status, metadata, assignee, and owner.',
      'Starts or continues available checklist assignments.',
      'Shows submitted assignments as waiting for approval without opening a new editable attempt.',
      'For rejected modules, continues the latest rejected attempt without creating a new attempt.',
      'For completed modules, exposes result actions.',
    ],
    apis: ['POST /users/resolve-current', 'GET /home?user_id=...'],
    actions: [
      {
        trigger: 'Start Module',
        condition: 'Shown when assignment.status is Not Started or In Progress.',
        result: 'Sets activeExam to start and opens ExamModal.',
        api: 'Indirectly calls POST /modules/{module_id}/attempts/start, then GET /attempts/{attempt_id}/questions.',
      },
      {
        trigger: 'View Module / Result',
        condition: 'Shown when assignment.status is Submitted.',
        result: 'Routes to the legacy latest module result route without starting a new attempt.',
        api: 'Target page calls GET /modules/{module_id}/attempts, then GET /attempts/{attempt_id}/questions.',
      },
      {
        trigger: 'Continue Module',
        condition: 'Shown as the primary action when assignment.status is Rejected.',
        result: 'Sets activeExam to retake and opens ExamModal with the latest rejected attempt ID.',
        api: 'Calls GET /attempts/{attempt_id}/questions without calling POST /modules/{module_id}/attempts/start.',
      },
      {
        trigger: 'View Module / Result',
        condition: 'Shown when assignment.status is Completed.',
        result: 'Routes to the legacy latest module result route.',
        api: 'Target page calls GET /modules/{module_id}/attempts, then GET /attempts/{attempt_id}/questions.',
      },
      {
        trigger: 'Back to Dashboard',
        condition: 'Always shown on loaded module pages.',
        result: 'Routes to /iebaseline.',
        api: 'No direct call; dashboard calls GET /home.',
      },
    ],
  },
  {
    name: 'Exam Modal',
    route: 'modal',
    file: 'components/ExamModal.tsx',
    owner: 'Checklist taking, answer persistence, submit, and review',
    source: 'Attempt APIs and attempt question payloads from the IE Baseline backend.',
    features: [
      'Starts or resumes an attempt for the selected module.',
      'Uses the resolved userId passed from ModuleOverview.',
      'Loads attempt questions with saved answer state.',
      'Saves selected answers and clears answers when needed.',
      'Lists, uploads, deletes, and downloads answer attachments when questions require or allow evidence.',
      'Submits the attempt, invalidates related query caches, and navigates to attempt-specific final results.',
      'Supports review-only mode for completed/submitted attempts.',
      'Supports approval review mode with editable approver answers, read-only evidence downloads, reviewer remarks, and approve/reject decisions.',
    ],
    apis: [
      'POST /modules/{module_id}/attempts/start',
      'GET /modules/{module_id}/attempts?user_id=...',
      'GET /attempts?user_id=...',
      'GET /attempts/{attempt_id}/questions',
      'PUT /attempts/{attempt_id}/questions/{question_id}/answer',
      'DELETE /attempts/{attempt_id}/questions/{question_id}/answer',
      'GET /modules/{module_id}/attachments?user_id=...',
      'POST /modules/{module_id}/attachments',
      'DELETE /modules/{module_id}/attachments/{attachment_unq_id}',
      'GET /attachments/{attachment_unq_id}/download?user_id=...',
      'POST /attempts/{attempt_id}/submit',
      'GET /approvals/{approval_id}/review?reviewer_user_id=...',
      'POST /approvals/{approval_id}/start',
      'PUT /approvals/{approval_id}/answers/{answer_id}',
      'POST /approvals/{approval_id}/decision',
    ],
    actions: [
      {
        trigger: 'Answer option select',
        condition: 'Enabled while taking the checklist.',
        result: 'Updates selectedAnswer local state for the current question.',
        api: 'No immediate API call until save/clear logic runs.',
      },
      {
        trigger: 'Save/change answer',
        condition: 'Triggered when the user selects a non-empty answer.',
        result: 'Persists answer and updates cached attempt question progress.',
        api: 'PUT /attempts/{attempt_id}/questions/{question_id}/answer.',
      },
      {
        trigger: 'Clear answer',
        condition: 'Triggered when the current selected answer is cleared.',
        result: 'Removes the saved answer and updates cached progress.',
        api: 'DELETE /attempts/{attempt_id}/questions/{question_id}/answer.',
      },
      {
        trigger: 'Upload attachment',
        condition: 'Question has an optional or required attachment section and a backend answerId.',
        result: 'Uploads evidence and refreshes attachment/question state.',
        api: 'POST /modules/{module_id}/attachments.',
      },
      {
        trigger: 'Remove attachment',
        condition: 'Attachment exists and the attempt is editable.',
        result: 'Deletes evidence and refreshes attachment/question state.',
        api: 'DELETE /modules/{module_id}/attachments/{attachment_unq_id}.',
      },
      {
        trigger: 'Finish / Submit checklist',
        condition: 'Available from the exam flow.',
        result: 'Submits the attempt, invalidates related queries, then routes to final results.',
        api: 'POST /attempts/{attempt_id}/submit.',
      },
      {
        trigger: 'Approval review open',
        condition: 'approvalId is provided and review data loads with status PENDING.',
        result: 'Marks the request as actively reviewed.',
        api: 'POST /approvals/{approval_id}/start.',
      },
      {
        trigger: 'Approval answer change',
        condition: 'Assigned approver changes a selected answer in a non-terminal approval.',
        result: 'Updates the authoritative submitted answer and cached progress.',
        api: 'PUT /approvals/{approval_id}/answers/{answer_id}.',
      },
      {
        trigger: 'Approve / Reject',
        condition: 'Assigned approver submits a decision for a non-terminal approval.',
        result: 'Recalculates score on the backend, stores remarks, and invalidates approval/attempt/home queries.',
        api: 'POST /approvals/{approval_id}/decision.',
      },
      {
        trigger: 'Close modal',
        condition: 'Available from modal controls.',
        result: 'Closes ExamModal and returns to the current module overview page.',
        api: 'No API call.',
      },
    ],
  },
  {
    name: 'Final Results',
    route: '/iebaseline/attempts/:attemptId/results',
    file: 'FinalResults.tsx',
    owner: 'Selected checklist attempt outcome display',
    source: 'Attempt question API for selected attempt answers and scores; home API only supplies learner context.',
    features: [
      'Resolves the active learner through useIEBaselineCurrentUser.',
      'Reads attemptId from the URL.',
      'Loads the selected attempt and its saved question answers.',
      'Uses submit navigation state as an immediate fallback after finishing a checklist.',
      'Displays result status, score, attempt number, answered count, learner details, completion date, selected answers, and per-question scores.',
      'Shows waiting-for-approval messaging while resultStatus is PENDING or IN_PROGRESS and the backend hides score.',
      'Uses contextual Back navigation, falling back to /iebaseline on direct entry.',
    ],
    apis: ['POST /users/resolve-current', 'GET /home?user_id=...', 'GET /attempts/{attempt_id}/questions'],
    actions: [
      {
        trigger: 'Back',
        condition: 'Shown at top and bottom of the results page.',
        result: 'Navigates to the previous route when available, otherwise /iebaseline.',
        api: 'No API call.',
      },
    ],
  },
  {
    name: 'Previous Attempts',
    route: '/iebaseline/attempts',
    file: 'PreviousAttempts.tsx',
    owner: 'Learner attempt history',
    source: 'User-level attempt history API backed by user_exam_attempt.',
    features: [
      'Resolves the active learner through useIEBaselineCurrentUser.',
      'Loads all attempts for the learner, independent of active assignments.',
      'Shows module, attempt number, result status, score, and completion date.',
      'Routes each row to /iebaseline/attempts/{attemptId}/results.',
    ],
    apis: ['POST /users/resolve-current', 'GET /attempts?user_id=...'],
    actions: [
      {
        trigger: 'View',
        condition: 'Visible for each attempt row.',
        result: 'Routes to the selected attempt result page.',
        api: 'Target page calls GET /attempts/{attempt_id}/questions.',
      },
    ],
  },
  {
    name: 'Approvals',
    route: '/iebaseline/approvals/my-submissions, /iebaseline/approvals/inbox',
    file: 'Approvals.tsx',
    owner: 'Learner approval history and assigned approver inbox',
    source: 'Approval request APIs plus current-user resolution for learner/reviewer identity.',
    features: [
      'Resolves the active IE Baseline user through useIEBaselineCurrentUser.',
      'Provides route-backed My Submissions and Approval Inbox tabs.',
      'Lists learner-submitted approval requests with status, dates, remarks, and released score.',
      'Lists assigned approver requests with an actionable PENDING/IN_PROGRESS filter plus explicit status filters.',
      'Routes inbox rows to the full-screen approval review workflow.',
      'Routes submission rows to the selected attempt result page.',
    ],
    apis: [
      'POST /users/resolve-current',
      'GET /approvals/my-submissions?user_id=...',
      'GET /approvals/inbox?approver_user_id=...',
      'GET /approvals/inbox?approver_user_id=...&status=...',
    ],
    actions: [
      {
        trigger: 'My Submissions tab',
        condition: 'Current user is resolved.',
        result: 'Lists approval requests submitted by the current learner.',
        api: 'GET /approvals/my-submissions.',
      },
      {
        trigger: 'Approval Inbox tab',
        condition: 'Current user is resolved.',
        result: 'Lists approval requests assigned to the current reviewer.',
        api: 'GET /approvals/inbox.',
      },
      {
        trigger: 'Inbox status filter',
        condition: 'Inbox tab is active.',
        result: 'Refetches or locally filters approval requests by selected status.',
        api: 'GET /approvals/inbox with optional status.',
      },
      {
        trigger: 'Review',
        condition: 'Visible for approval inbox rows.',
        result: 'Routes to /iebaseline/approvals/{approvalId}/review.',
        api: 'Target route calls GET /approvals/{approval_id}/review.',
      },
      {
        trigger: 'Result',
        condition: 'Visible for my submission rows.',
        result: 'Routes to /iebaseline/attempts/{attemptId}/results.',
        api: 'Target page calls GET /attempts/{attempt_id}/questions.',
      },
    ],
  },
  {
    name: 'Modules Assignment',
    route: '/iebaseline/assign',
    file: 'AssignModules.tsx',
    owner: 'Bulk user-to-module assignment management',
    source: 'Users, modules, module type filters, and bulk add assignment API.',
    features: [
      'Resolves the current IE Baseline user for assignee_id.',
      'Loads all assignable users and available modules.',
      'Filters users by name, position, and WD ID.',
      'Supports multi-select users with page-scoped select all and 15 users per client page.',
      'Filters modules by module name and module_type.',
      'Bulk adds selected modules to selected users without removing existing assignments.',
      'Invalidates users, modules, and home queries after save.',
    ],
    apis: ['POST /users/resolve-current', 'GET /users', 'GET /modules', 'POST /users/modules/bulk-add'],
    actions: [
      {
        trigger: 'User search',
        condition: 'Users are loaded.',
        result: 'Filters the user table by name, position, or WD ID and resets to page 1.',
        api: 'No immediate API call.',
      },
      {
        trigger: 'User checkbox / page select all',
        condition: 'Users are visible on the current filtered page.',
        result: 'Adds or removes user_id values in local selectedUserIds.',
        api: 'No immediate API call.',
      },
      {
        trigger: 'Module search / type filter',
        condition: 'Modules are loaded.',
        result: 'Filters modules by module_name and module_type.',
        api: 'No immediate API call.',
      },
      {
        trigger: 'Module checkbox / visible select all',
        condition: 'Modules are visible under the current filter.',
        result: 'Adds or removes module_id values in local selectedModuleIds.',
        api: 'No immediate API call.',
      },
      {
        trigger: 'Assign Modules / Confirm apply',
        condition: 'Shown after selecting at least one user and enabled once at least one module is also selected.',
        result: 'Bulk adds selected modules to selected users and refreshes users, modules, and home query caches.',
        api: 'POST /users/modules/bulk-add.',
      },
    ],
  },
  {
    name: 'User Management',
    route: '/iebaseline/users',
    file: 'UserManagement.tsx',
    owner: 'User profile creation, maintenance, reporting-line assignment, and delete workflow',
    source: 'User Management APIs for user search, full user profile, role options, write operations, and delete preview.',
    features: [
      'Uses Create User, Update User, and Delete User tabs inside one route.',
      'Creates user_master rows through the dedicated create API.',
      'Searches users by name, WD ID, and email for update/delete selection.',
      'Loads one full user profile before editing so email, department, role, and reports_to are preserved.',
      'Uses a searchable reports_to selector and excludes the edited user from manager results.',
      'Loads role options from the backend and falls back to seeded role labels if roles are unavailable.',
      'Previews related record counts and blocking reasons before delete confirmation.',
      'Invalidates IE Baseline user search/list queries after create, update, and delete.',
    ],
    apis: [
      'GET /users/search?q=...',
      'GET /users/{user_id}',
      'POST /users/create',
      'PUT /users/{user_id}',
      'DELETE /users/{user_id}',
      'GET /users/{user_id}/delete-preview',
      'GET /roles',
    ],
    actions: [
      {
        trigger: 'Create user',
        condition: 'Enabled when name is present and no create request is pending.',
        result: 'Submits a normalized user payload, clears the form on success, and refreshes user queries.',
        api: 'POST /users/create.',
      },
      {
        trigger: 'Select user to update',
        condition: 'User searches by name, WD ID, or email in the Update User tab.',
        result: 'Sets selectedUser and loads the full profile into the edit form.',
        api: 'GET /users/search, then GET /users/{user_id}.',
      },
      {
        trigger: 'Reports To selector',
        condition: 'Available in Create User and Update User forms.',
        result: 'Stores the selected manager user_id in reports_to or clears it to null.',
        api: 'GET /users/search with optional exclude_user_id.',
      },
      {
        trigger: 'Save changes',
        condition: 'Enabled when an update user is selected, name is present, and profile loading is complete.',
        result: 'Saves the full user payload and refreshes user queries.',
        api: 'PUT /users/{user_id}.',
      },
      {
        trigger: 'Select user to delete',
        condition: 'User searches by name, WD ID, or email in the Delete User tab.',
        result: 'Sets selectedUser and loads delete impact data.',
        api: 'GET /users/search, then GET /users/{user_id}/delete-preview.',
      },
      {
        trigger: 'Delete user / Confirm delete',
        condition: 'Requires confirmation in the Delete User tab.',
        result: 'Deletes the selected user, clears selection on success, and refreshes user queries.',
        api: 'DELETE /users/{user_id}.',
      },
    ],
  },
  {
    name: 'Edit/Admin',
    route: '/iebaseline/edit, /iebaseline/admin/:moduleId',
    file: 'IEBaselineEdit.tsx, ModuleAdmin.tsx',
    owner: 'Legacy/mock module management screens',
    source: 'Hardcoded MODULES export from IEBaseline.tsx.',
    features: [
      'Lists mock modules and links to admin edit routes.',
      'Renders visual-only controls for metadata, instructor details, visuals, syllabus, quiz, and media.',
      'Does not save module create/edit/upload changes to the backend yet.',
    ],
    apis: [],
    actions: [
      {
        trigger: 'Create New Module',
        condition: 'Visible on /iebaseline/edit.',
        result: 'Visual-only button today.',
        api: 'No API call.',
      },
      {
        trigger: 'Module name / pencil edit',
        condition: 'Visible for each hardcoded MODULES row.',
        result: 'Routes to /iebaseline/admin/{module.id}.',
        api: 'No API call.',
      },
      {
        trigger: 'Save Changes',
        condition: 'Visible on /iebaseline/admin/:moduleId.',
        result: 'Visual-only button today.',
        api: 'No API call.',
      },
      {
        trigger: 'Upload / Add / Delete controls',
        condition: 'Visible in mock admin form sections.',
        result: 'Visual-only controls today.',
        api: 'No API call.',
      },
    ],
  },
];

const apiCalls = [
  { method: 'POST', path: '/users/resolve-current', wrapper: 'users.resolveCurrent', usedBy: 'Dashboard, Module Overview, Final Results, Modules Assignment', purpose: 'Resolve AD or staging current user to user_master.user_id' },
  { method: 'GET', path: '/home?user_id=...', wrapper: 'home.get', usedBy: 'Dashboard, Module Overview, Final Results', purpose: 'Load learner profile and active assigned modules' },
  { method: 'GET', path: '/users', wrapper: 'users.list', usedBy: 'Modules Assignment', purpose: 'Load assignable users' },
  { method: 'GET', path: '/users/search?q=...', wrapper: 'users.search', usedBy: 'User Management', purpose: 'Search users by name, WD ID, or email' },
  { method: 'GET', path: '/users/{user_id}', wrapper: 'users.get', usedBy: 'User Management', purpose: 'Load one full user profile' },
  { method: 'POST', path: '/users/create', wrapper: 'users.create', usedBy: 'User Management', purpose: 'Create a user_master row' },
  { method: 'PUT', path: '/users/{user_id}', wrapper: 'users.update', usedBy: 'User Management', purpose: 'Update a user_master row' },
  { method: 'DELETE', path: '/users/{user_id}', wrapper: 'users.remove', usedBy: 'User Management', purpose: 'Delete a user_master row' },
  { method: 'GET', path: '/users/{user_id}/delete-preview', wrapper: 'users.deletePreview', usedBy: 'User Management', purpose: 'Preview related records before delete' },
  { method: 'GET', path: '/roles', wrapper: 'roles.list', usedBy: 'User Management', purpose: 'Load role dropdown options' },
  { method: 'GET', path: '/modules', wrapper: 'modules.list', usedBy: 'Modules Assignment', purpose: 'Load modules available for assignment' },
  { method: 'GET', path: '/users/{user_id}/modules', wrapper: 'users.modules.get', usedBy: 'Available wrapper', purpose: 'Load one selected user module ID set' },
  { method: 'PUT', path: '/users/{user_id}/modules', wrapper: 'users.modules.update', usedBy: 'Available wrapper', purpose: 'Replace one selected user module assignment set' },
  { method: 'POST', path: '/users/modules/bulk-add', wrapper: 'users.modules.bulkAdd', usedBy: 'Modules Assignment', purpose: 'Bulk add selected modules to selected users' },
  { method: 'POST', path: '/modules/{module_id}/attempts/start', wrapper: 'modules.attempts.start', usedBy: 'Exam Modal', purpose: 'Start or resume an attempt' },
  { method: 'GET', path: '/modules/{module_id}/attempts?user_id=...', wrapper: 'modules.attempts.list', usedBy: 'Exam Modal, Final Results', purpose: 'Load module-scoped attempt history' },
  { method: 'GET', path: '/attempts?user_id=...', wrapper: 'attempts.list', usedBy: 'Previous Attempts', purpose: 'Load user attempt history independent of active assignments' },
  { method: 'GET', path: '/attempts/{attempt_id}', wrapper: 'attempts.get', usedBy: 'Available wrapper', purpose: 'Load one attempt' },
  { method: 'GET', path: '/attempts/{attempt_id}/questions', wrapper: 'attempts.questions.get', usedBy: 'Exam Modal, Final Results', purpose: 'Load attempt questions and saved answers' },
  { method: 'PUT', path: '/attempts/{attempt_id}/questions/{question_id}/answer', wrapper: 'attempts.questions.saveAnswer', usedBy: 'Exam Modal', purpose: 'Save selected answer' },
  { method: 'DELETE', path: '/attempts/{attempt_id}/questions/{question_id}/answer', wrapper: 'attempts.questions.clearAnswer', usedBy: 'Exam Modal', purpose: 'Clear selected answer' },
  { method: 'GET', path: '/modules/{module_id}/attachments?user_id=...&answer_id=...', wrapper: 'modules.attachments.list', usedBy: 'Exam Modal', purpose: 'List evidence files for one answer' },
  { method: 'POST', path: '/modules/{module_id}/attachments', wrapper: 'modules.attachments.upload', usedBy: 'Exam Modal', purpose: 'Upload evidence and set uploadedBy' },
  { method: 'DELETE', path: '/modules/{module_id}/attachments/{attachment_unq_id}?user_id=...', wrapper: 'modules.attachments.remove', usedBy: 'Exam Modal', purpose: 'Remove evidence for one answer' },
  { method: 'GET', path: '/attachments/{attachment_unq_id}/download?user_id=...', wrapper: 'modules.attachments.downloadUrl', usedBy: 'Exam Modal', purpose: 'Build attachment download URL' },
  { method: 'POST', path: '/attempts/{attempt_id}/submit', wrapper: 'attempts.submit', usedBy: 'Exam Modal', purpose: 'Submit and score attempt' },
  { method: 'GET', path: '/approvals/my-submissions?user_id=...', wrapper: 'approvals.listMySubmissions', usedBy: 'Approvals', purpose: 'List approval requests submitted by the current learner' },
  { method: 'GET', path: '/approvals/inbox?approver_user_id=...', wrapper: 'approvals.listInbox', usedBy: 'Approvals', purpose: 'List approval requests assigned to the current approver' },
  { method: 'POST', path: '/approvals/{approval_id}/start', wrapper: 'approvals.start', usedBy: 'Approval Review', purpose: 'Mark a pending approval as in progress' },
  { method: 'GET', path: '/approvals/{approval_id}/review?reviewer_user_id=...', wrapper: 'approvals.getReview', usedBy: 'Approval Review', purpose: 'Load approval metadata, attempt metadata, progress, questions, and answers' },
  { method: 'PUT', path: '/approvals/{approval_id}/answers/{answer_id}', wrapper: 'approvals.updateAnswer', usedBy: 'Approval Review', purpose: 'Let the assigned approver update an authoritative submitted answer' },
  { method: 'POST', path: '/approvals/{approval_id}/decision', wrapper: 'approvals.decision', usedBy: 'Approval Review', purpose: 'Approve or reject, store remarks, and release final score/status' },
];

const flow = [
  'Current-user resolution obtains ieBaselineUserId before learner-scoped API calls.',
  'Dashboard loads GET /home and links to module overview.',
  'Module overview loads GET /home, finds the matching assignment, and opens ExamModal.',
  'ExamModal starts/resumes normal attempts, or opens a provided rejected attempt ID directly, then loads questions, saves or clears answers, and submits.',
  'Submit navigates to /iebaseline/attempts/:attemptId/results with the submit result in navigation state.',
  'Backend sends the approval request notification after the submit workflow commits.',
  'Final results reloads the selected attempt questions, then displays that attempt answer and score detail.',
  'Modules Assignment loads users and modules, bulk adds selected modules to selected users, then invalidates users, modules, and home queries.',
  'User Management searches users, loads full profiles for edits/deletes, and writes through dedicated user_master APIs.',
  'Approvals loads my-submissions and inbox requests for the resolved user.',
  'Approval review loads the review payload, starts pending approvals, saves approver answer edits, and posts the final decision.',
  'Backend sends approved or rejected notification after the decision workflow commits.',
];

const usedByOptions = ['All', 'Approval Review', 'Approvals', 'Available wrapper', 'Dashboard', 'Exam Modal', 'Final Results', 'Module Overview', 'Modules Assignment', 'Previous Attempts', 'User Management'];

function methodClass(method: string) {
  switch (method) {
    case 'GET':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-600';
    case 'POST':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600';
    case 'PUT':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-600';
    case 'DELETE':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

function SectionTitle({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function DeveloperDocs() {
  const [usedByFilter, setUsedByFilter] = useState('All');
  const [usedBySort, setUsedBySort] = useState<'asc' | 'desc'>('asc');

  const visibleApiCalls = useMemo(() => {
    return apiCalls
      .filter((api) => usedByFilter === 'All' || api.usedBy.includes(usedByFilter))
      .sort((left, right) => {
        const result = left.usedBy.localeCompare(right.usedBy) || left.path.localeCompare(right.path);
        return usedBySort === 'asc' ? result : -result;
      });
  }, [usedByFilter, usedBySort]);

  return (
    <div className="space-y-6 px-6 pb-8 pt-32">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 border-b border-border/60 pb-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" className="w-fit border-primary/30 bg-primary/10 text-primary">
              IE Baseline
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Developer API Live Doc</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Frontend route map, feature ownership, active API calls, and data flow for the IE Baseline module.
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-background/70 px-4 py-3 text-xs text-muted-foreground">
            Markdown source: <span className="font-mono text-foreground">src/pages/iebaseline/doc/developer-doc.md</span>
          </div>
        </div>

        <Tabs defaultValue="routes" className="space-y-5">
          <TabsList className="grid w-full grid-cols-2 border border-border/60 bg-muted/40 md:grid-cols-4">
            <TabsTrigger value="routes">Routes</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="apis">API Calls</TabsTrigger>
            <TabsTrigger value="flow">Data Flow</TabsTrigger>
          </TabsList>

          <TabsContent value="routes" className="space-y-4">
            <SectionTitle icon={Route} title="Route Map" description="React routes registered for the IE Baseline module." />
            <Card className="overflow-hidden border-border/60 bg-background/70">
              <div className="grid grid-cols-12 gap-4 border-b border-border/60 bg-muted/30 p-4 text-xs font-semibold uppercase text-muted-foreground">
                <div className="col-span-4">Route</div>
                <div className="col-span-3">Page</div>
                <div className="col-span-5">Purpose</div>
              </div>
              {routes.map((item) => (
                <div key={item.path} className="grid grid-cols-12 gap-4 border-b border-border/50 p-4 text-sm last:border-0">
                  <div className="col-span-4">
                    <Badge variant="outline" className="font-mono">{item.path}</Badge>
                  </div>
                  <div className="col-span-3 font-mono text-xs text-foreground">{item.page}</div>
                  <div className="col-span-5 text-muted-foreground">{item.purpose}</div>
                </div>
              ))}
            </Card>
          </TabsContent>

          <TabsContent value="features" className="space-y-4">
            <SectionTitle icon={Layers} title="Pages And Features" description="Each page or feature owns its own section with feature scope, data source, and API calls." />
            <div className="grid gap-4">
              {pages.map((page, index) => (
                <Card key={page.name} className="overflow-hidden border-border/60 bg-background/70">
                  <div className="border-b border-border/60 bg-muted/25 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Section {index + 1}</Badge>
                          <h3 className="text-lg font-semibold text-foreground">{page.name}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">{page.owner}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="font-mono">{page.route}</Badge>
                        <Badge variant="outline" className="font-mono">{page.file}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 p-5 lg:grid-cols-[1.2fr_0.8fr]">
                    <div>
                      <h4 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Feature Scope</h4>
                      <ul className="grid gap-2">
                        {page.features.map((feature) => (
                          <li key={feature} className="rounded-md border border-border/50 bg-background/50 p-3 text-sm text-muted-foreground">
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Data Source</h4>
                        <p className="rounded-md border border-border/50 bg-muted/20 p-3 text-sm text-muted-foreground">{page.source}</p>
                      </div>
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Frontend API Calls</h4>
                        <div className="flex flex-wrap gap-2">
                          {page.apis.length > 0 ? page.apis.map((api) => (
                            <Badge key={api} variant="outline" className="font-mono text-xs">{api}</Badge>
                          )) : (
                            <Badge variant="outline" className="text-xs">No frontend API calls</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/60 p-5">
                    <h4 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Actions And Triggers</h4>
                    <div className="overflow-hidden rounded-md border border-border/60">
                      <div className="grid grid-cols-12 gap-4 border-b border-border/60 bg-muted/30 p-3 text-xs font-semibold uppercase text-muted-foreground">
                        <div className="col-span-3">Trigger</div>
                        <div className="col-span-3">Condition</div>
                        <div className="col-span-3">Result</div>
                        <div className="col-span-3">API Impact</div>
                      </div>
                      {page.actions.map((action) => (
                        <div key={`${page.name}-${action.trigger}`} className="grid grid-cols-12 gap-4 border-b border-border/50 p-3 text-sm last:border-0">
                          <div className="col-span-3 font-medium text-foreground">{action.trigger}</div>
                          <div className="col-span-3 text-muted-foreground">{action.condition}</div>
                          <div className="col-span-3 text-muted-foreground">{action.result}</div>
                          <div className="col-span-3 font-mono text-xs text-muted-foreground">{action.api}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="apis" className="space-y-4">
            <SectionTitle icon={ServerCog} title="Active API Calls" description="Endpoints exposed through src/pages/iebaseline/api.ts and used by the frontend." />
            <Card className="flex flex-col gap-3 border-border/60 bg-background/70 p-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Filter Used By</label>
                <Select value={usedByFilter} onValueChange={setUsedByFilter}>
                  <SelectTrigger className="w-full bg-background lg:w-[240px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {usedByOptions.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2 lg:w-auto"
                onClick={() => setUsedBySort((current) => current === 'asc' ? 'desc' : 'asc')}
              >
                {usedBySort === 'asc' ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
                Sort Used By {usedBySort === 'asc' ? 'A-Z' : 'Z-A'}
              </Button>
            </Card>
            <Card className="overflow-hidden border-border/60 bg-background/70">
              <div className="grid grid-cols-12 gap-4 border-b border-border/60 bg-muted/30 p-4 text-xs font-semibold uppercase text-muted-foreground">
                <div className="col-span-1">Method</div>
                <div className="col-span-4">Path</div>
                <div className="col-span-2">Wrapper</div>
                <div className="col-span-2">Used By</div>
                <div className="col-span-3">Purpose</div>
              </div>
              {visibleApiCalls.map((api) => (
                <div key={`${api.method}-${api.path}`} className="grid grid-cols-12 gap-4 border-b border-border/50 p-4 text-sm last:border-0">
                  <div className="col-span-1">
                    <Badge variant="outline" className={methodClass(api.method)}>{api.method}</Badge>
                  </div>
                  <div className="col-span-4 font-mono text-xs text-foreground">{api.path}</div>
                  <div className="col-span-2 font-mono text-xs text-muted-foreground">{api.wrapper}</div>
                  <div className="col-span-2 text-muted-foreground">{api.usedBy}</div>
                  <div className="col-span-3 text-muted-foreground">{api.purpose}</div>
                </div>
              ))}
              {visibleApiCalls.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground">No API calls match the selected Used By filter.</div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="flow" className="space-y-4">
            <SectionTitle icon={GitBranch} title="Data Flow" description="The main frontend flows from dashboard through assignment and exam completion." />
            <Card className="border-border/60 bg-background/70 p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Current User Resolution</h3>
              <div className="grid gap-2">
                {identityFlow.map((step, index) => (
                  <div key={step} className="flex items-start gap-3 rounded-md border border-border/50 bg-muted/20 p-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-primary/20 bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </div>
                    <p className="text-sm text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>
            </Card>
            <div className="grid gap-3">
              {flow.map((step, index) => (
                <Card key={step} className="flex items-start gap-4 border-border/60 bg-background/70 p-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </div>
                  <p className="text-sm text-muted-foreground">{step}</p>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <Card className="border-border/60 bg-background/70 p-5">
          <SectionTitle icon={Mail} title="Notifications" description="Frontend alignment for backend-owned approval email delivery." />
          <div className="grid gap-2 md:grid-cols-2">
            {notificationFlow.map((item) => (
              <div key={item} className="rounded-md border border-border/50 bg-muted/20 p-3 text-sm text-muted-foreground">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md border border-border/50 bg-muted/20 p-3 text-sm text-muted-foreground">
            <span className="font-mono text-foreground">POST /notifications/send-email</span> is not listed in the active API table because approval emails are automatic. Add a typed wrapper only if a future manual resend UI is required.
          </div>
        </Card>

        <Card className="border-border/60 bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            Keep this page, the markdown doc, and <span className="font-mono text-foreground">api.ts</span> in sync when adding new frontend integrations.
          </div>
        </Card>
      </div>
    </div>
  );
}
