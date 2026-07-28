import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowDownAZ, ArrowUpAZ, BookOpen, GitBranch, Layers, Route, ServerCog, type LucideIcon } from 'lucide-react';

const routes = [
  { path: '/iebaseline', page: 'IEBaseline.tsx', purpose: 'Learner dashboard for assigned modules' },
  { path: '/iebaseline/module/:moduleId', page: 'ModuleOverview.tsx', purpose: 'Module overview and checklist entry' },
  { path: '/iebaseline/module/:moduleId/results', page: 'FinalResults.tsx', purpose: 'Final submitted/completed attempt results' },
  { path: '/iebaseline/assign', page: 'AssignModules.tsx', purpose: 'User/module assignment management' },
  { path: '/iebaseline/edit', page: 'IEBaselineEdit.tsx', purpose: 'Legacy/mock module management landing page' },
  { path: '/iebaseline/admin/:moduleId', page: 'ModuleAdmin.tsx', purpose: 'Legacy/mock module editor' },
  { path: '/iebaseline/developer-docs', page: 'DeveloperDocs.tsx', purpose: 'In-app developer reference' },
];

const pages = [
  {
    name: 'Learner Dashboard',
    route: '/iebaseline',
    file: 'IEBaseline.tsx',
    owner: 'Learner home and assignment progress display',
    source: 'Backend home API for visible assignment rows; legacy MODULES remains exported for old admin pages.',
    features: [
      'Loads the demo learner profile and assigned module list.',
      'Displays progress, derived status, owner, assigned by, assigned date, updated date, and question count.',
      'Expands a module row to show details and actions.',
      'Links each assignment to the module overview route.',
    ],
    apis: ['GET /home?user_id=...'],
    actions: [
      {
        trigger: 'Module name link',
        condition: 'Visible for every assigned module row.',
        result: 'Routes to /iebaseline/module/{module_id}.',
        api: 'No direct call; target page calls GET /home.',
      },
      {
        trigger: 'Start Module / Continue Module / Review Material',
        condition: 'Label is derived from assignment.status and assignment.progress.',
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
      'Reads moduleId from the URL and finds the matching assignment.',
      'Shows module name, description, progress, status, metadata, assignee, and owner.',
      'Starts the checklist for incomplete modules.',
      'For completed modules, exposes review, retake, and result actions.',
    ],
    apis: ['GET /home?user_id=...'],
    actions: [
      {
        trigger: 'Start Module',
        condition: 'Shown when assignment.status is not Completed.',
        result: 'Sets activeExam to start and opens ExamModal.',
        api: 'Indirectly calls POST /modules/{module_id}/attempts/start, then GET /attempts/{attempt_id}/questions.',
      },
      {
        trigger: 'Review Module',
        condition: 'Shown when assignment.status is Completed.',
        result: 'Sets activeExam to review and opens ExamModal in review-only mode.',
        api: 'Indirectly calls GET /modules/{module_id}/attempts and GET /attempts/{attempt_id}/questions.',
      },
      {
        trigger: 'View Result',
        condition: 'Shown when assignment.status is Completed.',
        result: 'Routes to /iebaseline/module/{module_id}/results.',
        api: 'Target page calls GET /home and GET /modules/{module_id}/attempts.',
      },
      {
        trigger: 'Retake Module',
        condition: 'Shown when assignment.status is Completed.',
        result: 'Sets activeExam to retake and opens ExamModal.',
        api: 'Indirectly calls POST /modules/{module_id}/attempts/start, then GET /attempts/{attempt_id}/questions.',
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
      'Loads attempt questions with saved answer state.',
      'Saves selected answers and clears answers when needed.',
      'Submits the attempt, invalidates related query caches, and navigates to final results.',
      'Supports review-only mode for completed/submitted attempts.',
    ],
    apis: [
      'POST /modules/{module_id}/attempts/start',
      'GET /modules/{module_id}/attempts?user_id=...',
      'GET /attempts/{attempt_id}/questions',
      'PUT /attempts/{attempt_id}/questions/{question_id}/answer',
      'DELETE /attempts/{attempt_id}/questions/{question_id}/answer',
      'POST /attempts/{attempt_id}/submit',
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
        trigger: 'Finish / Submit checklist',
        condition: 'Available from the exam flow.',
        result: 'Submits the attempt, invalidates related queries, then routes to final results.',
        api: 'POST /attempts/{attempt_id}/submit.',
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
    route: '/iebaseline/module/:moduleId/results',
    file: 'FinalResults.tsx',
    owner: 'Submitted checklist outcome display',
    source: 'Home API for learner/module context and module attempt history API for stored attempts.',
    features: [
      'Reads moduleId from the URL.',
      'Loads learner context and module attempt history.',
      'Selects the latest submitted or completed attempt.',
      'Uses submit navigation state as an immediate fallback after finishing a checklist.',
      'Displays result status, score, attempt number, answered count, learner details, and completion date.',
    ],
    apis: ['GET /home?user_id=...', 'GET /modules/{module_id}/attempts?user_id=...'],
    actions: [
      {
        trigger: 'Return to Module',
        condition: 'Shown at top and bottom of the results page.',
        result: 'Routes to /iebaseline/module/{moduleId}.',
        api: 'No direct call; target page calls GET /home.',
      },
    ],
  },
  {
    name: 'Assign Modules',
    route: '/iebaseline/assign',
    file: 'AssignModules.tsx',
    owner: 'User-to-module assignment management',
    source: 'Users, modules, selected user module IDs, and update assignment API.',
    features: [
      'Loads all assignable users and available modules.',
      'Loads selected user assignments after choosing a user.',
      'Tracks draft add/remove changes locally.',
      'Applies assignment changes with confirmation.',
      'Invalidates users, selected user modules, and home queries after save.',
    ],
    apis: ['GET /users', 'GET /modules', 'GET /users/{user_id}/modules', 'PUT /users/{user_id}/modules'],
    actions: [
      {
        trigger: 'Manage user',
        condition: 'Visible for each user row.',
        result: 'Sets selectedUser and enables the selected user modules query.',
        api: 'GET /users/{user_id}/modules.',
      },
      {
        trigger: 'Module checkbox',
        condition: 'Visible when a user is selected and modules are loaded.',
        result: 'Adds or removes module_id in local draftModuleIds.',
        api: 'No immediate API call.',
      },
      {
        trigger: 'Reset',
        condition: 'Enabled when draft assignments differ from loaded assignments.',
        result: 'Restores draftModuleIds from original assigned_module_ids.',
        api: 'No API call.',
      },
      {
        trigger: 'Remove selected',
        condition: 'Enabled when draftModuleIds is not empty.',
        result: 'Clears all draft selected module IDs.',
        api: 'No immediate API call.',
      },
      {
        trigger: 'Apply changes / Confirm apply',
        condition: 'Enabled when there are unsaved assignment changes.',
        result: 'Saves sorted module_ids for the selected user and refreshes related query caches.',
        api: 'PUT /users/{user_id}/modules.',
      },
      {
        trigger: 'Back to Users',
        condition: 'Shown when a user is selected.',
        result: 'Clears selectedUser and draftModuleIds.',
        api: 'No API call.',
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
  { method: 'GET', path: '/home?user_id=...', wrapper: 'home.get', usedBy: 'Dashboard, Module Overview, Final Results', purpose: 'Load learner profile and assigned modules' },
  { method: 'GET', path: '/users', wrapper: 'users.list', usedBy: 'Assign Modules', purpose: 'Load assignable users' },
  { method: 'GET', path: '/modules', wrapper: 'modules.list', usedBy: 'Assign Modules', purpose: 'Load modules available for assignment' },
  { method: 'GET', path: '/users/{user_id}/modules', wrapper: 'users.modules.get', usedBy: 'Assign Modules', purpose: 'Load selected user module IDs' },
  { method: 'PUT', path: '/users/{user_id}/modules', wrapper: 'users.modules.update', usedBy: 'Assign Modules', purpose: 'Replace selected user module assignments' },
  { method: 'POST', path: '/modules/{module_id}/attempts/start', wrapper: 'modules.attempts.start', usedBy: 'Exam Modal', purpose: 'Start or resume an attempt' },
  { method: 'GET', path: '/modules/{module_id}/attempts?user_id=...', wrapper: 'modules.attempts.list', usedBy: 'Exam Modal, Final Results', purpose: 'Load attempt history' },
  { method: 'GET', path: '/attempts/{attempt_id}', wrapper: 'attempts.get', usedBy: 'Available wrapper', purpose: 'Load one attempt' },
  { method: 'GET', path: '/attempts/{attempt_id}/questions', wrapper: 'attempts.questions.get', usedBy: 'Exam Modal', purpose: 'Load attempt questions and saved answers' },
  { method: 'PUT', path: '/attempts/{attempt_id}/questions/{question_id}/answer', wrapper: 'attempts.questions.saveAnswer', usedBy: 'Exam Modal', purpose: 'Save selected answer' },
  { method: 'DELETE', path: '/attempts/{attempt_id}/questions/{question_id}/answer', wrapper: 'attempts.questions.clearAnswer', usedBy: 'Exam Modal', purpose: 'Clear selected answer' },
  { method: 'POST', path: '/attempts/{attempt_id}/submit', wrapper: 'attempts.submit', usedBy: 'Exam Modal', purpose: 'Submit and score attempt' },
];

const flow = [
  'Dashboard loads GET /home and links to module overview.',
  'Module overview loads GET /home, finds the matching assignment, and opens ExamModal.',
  'ExamModal starts/resumes an attempt, loads questions, saves or clears answers, then submits.',
  'Submit navigates to /iebaseline/module/:moduleId/results with the submit result in navigation state.',
  'Final results reloads home and attempt history, then displays the latest submitted/completed attempt.',
  'Assign modules loads users/modules/user assignments, saves changes, then invalidates IE Baseline queries.',
];

const usedByOptions = ['All', 'Assign Modules', 'Available wrapper', 'Dashboard', 'Exam Modal', 'Final Results', 'Module Overview'];

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
            Markdown source: <span className="font-mono text-foreground">src/pages/iebaseline/doc/developer-live-doc.md</span>
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
