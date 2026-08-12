import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CheckCircle2, ClipboardList, Clock, PlayCircle, UserCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ieBaselineApi, type IEBaselineHomeAssignment } from './api';
import { useIEBaselineCurrentUser } from './useIEBaselineCurrentUser';

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

export const MODULES: ModuleData[] = [
  {
    id: 'm1',
    name: 'Process Control Flow (PCF) Fundamentals',
    description: 'Learn the basics of process control flow, standard operating procedures, and how to maintain quality standards on the floor.',
    progress: 100,
    status: 'Completed',
    lessons: [
      { id: 'l1-1', title: 'Introduction to PCF', duration: '15 mins', completed: true },
      { id: 'l1-2', title: 'Identifying Control Points', duration: '25 mins', completed: true },
    ],
    createdAt: '2023-08-15',
    owner: 'John Doe',
    lastUpdated: '2023-11-02'
  },
  {
    id: 'm2',
    name: 'Yield Analysis & Defect Reduction',
    description: 'Advanced techniques for identifying root causes of yield drop and implementing effective counter-measures.',
    progress: 45,
    status: 'In Progress',
    lessons: [
      { id: 'l2-1', title: 'Pareto Chart Analysis', duration: '20 mins', completed: true },
      { id: 'l2-2', title: 'Root Cause Simulation', duration: '40 mins', completed: false },
      { id: 'l2-3', title: 'Defect Reduction Strategies', duration: '30 mins', completed: false },
    ],
    createdAt: '2023-09-01',
    owner: 'Jane Smith',
    lastUpdated: '2023-11-15'
  },
  {
    id: 'm3',
    name: 'Lean Manufacturing Principles',
    description: 'Core concepts of lean manufacturing, including 5S, waste elimination, and continuous improvement (Kaizen).',
    progress: 0,
    status: 'Not Started',
    lessons: [
      { id: 'l3-1', title: 'Understanding the 8 Wastes', duration: '30 mins', completed: false },
      { id: 'l3-2', title: 'Implementing 5S on the Shop Floor', duration: '45 mins', completed: false },
    ],
    createdAt: '2023-10-10',
    owner: 'Alex Johnson',
    lastUpdated: '2023-10-10'
  }
];

export default function IEBaseline() {
  const {
    user: currentUser,
    ieBaselineUserId,
    isLoading: isResolvingCurrentUser,
    error: currentUserResolveError,
  } = useIEBaselineCurrentUser();

  const {
    data,
    isLoading: isLoadingHome,
    isError: isHomeError,
    error: homeError,
  } = useQuery({
    queryKey: ['iebaseline', 'home', ieBaselineUserId],
    queryFn: () => ieBaselineApi.home.get(ieBaselineUserId!),
    enabled: Boolean(ieBaselineUserId),
  });

  const isLoading = isResolvingCurrentUser || isLoadingHome;
  const isError = Boolean(currentUserResolveError) || isHomeError;
  const error = currentUserResolveError ?? homeError;

  const getStatusColorClass = (status: ModuleStatus) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20';
      case 'In Progress': return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20';
      case 'Not Started': return 'bg-muted text-muted-foreground hover:bg-muted/80';
    }
  };

  const getActionLabel = (status: ModuleStatus, progress: number) => {
    if (status === 'Completed' || progress >= 100) return 'Review Material';
    if (status === 'In Progress') return 'Continue Module';
    if (progress === 0) return 'Start Module';
    return 'Continue Module';
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const assignments = data?.assignments ?? [];

  return (
    <div className="space-y-6 px-6 pb-6 pt-32 max-w-7xl mx-auto">
      {/* Profile Details */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2 text-foreground">
            <UserCircle className="w-5 h-5 text-primary" />
            Personal Details
          </h2>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs font-medium text-green-500">Active: Completing Baseline Syllabus</span>
          </div>
        </div>

        <Card className="border-border/50 bg-background/40 backdrop-blur-sm overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-border/50 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="col-span-3">Name</div>
            <div className="col-span-4">Email</div>
            <div className="col-span-3">Department</div>
            <div className="col-span-2">Job Title</div>
          </div>

          {/* Table Body */}
          <div className="grid grid-cols-12 gap-4 p-4 w-full items-center text-left text-sm text-foreground">
            <div className="col-span-3">
              <div className="font-medium">{isLoading ? 'Loading...' : data?.user.name ?? currentUser?.fullName ?? 'N/A'}</div>
              {!isLoading && (
                <div className="text-xs text-muted-foreground mt-1">
                  WD ID: {data?.user.wd_id ?? 'N/A'}
                </div>
              )}
            </div>
            <div className="col-span-4">{currentUser?.email ?? 'N/A'}</div>
            <div className="col-span-3">{currentUser?.department ?? 'N/A'}</div>
            <div className="col-span-2">
              {isLoading ? 'Loading...' : data?.user.position ?? currentUser?.jobTitle ?? 'N/A'}
            </div>
          </div>
        </Card>
      </div>

      {/* Module Tracking Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2 text-foreground">
            <BookOpen className="w-5 h-5 text-primary" />
            Assigned Modules
          </h2>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/iebaseline/attempts">
              <ClipboardList className="h-4 w-4" />
              Previous Attempts
            </Link>
          </Button>
        </div>

        <Card className="border-border/50 bg-background/40 backdrop-blur-sm overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-border/50 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="col-span-5">Module Name</div>
            <div className="col-span-4">Progress</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1 text-right">Action</div>
          </div>

          {isLoading && (
            <div className="p-6 text-sm text-muted-foreground">Loading assigned modules...</div>
          )}

          {isError && (
            <div className="p-6 space-y-2">
              <p className="text-sm font-medium text-destructive">Unable to load assigned modules.</p>
              <p className="text-xs text-muted-foreground">
                {error instanceof Error ? error.message : 'Please check the IE Baseline API and try again.'}
              </p>
            </div>
          )}

          {!isLoading && !isError && assignments.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              No IE Baseline modules are assigned to your profile yet.
            </div>
          )}

          {!isLoading && !isError && assignments.length > 0 && (
            <AssignmentAccordion
              assignments={assignments}
              formatDate={formatDate}
              getActionLabel={getActionLabel}
              getStatusColorClass={getStatusColorClass}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

interface AssignmentAccordionProps {
  assignments: IEBaselineHomeAssignment[];
  formatDate: (value: string) => string;
  getActionLabel: (status: ModuleStatus, progress: number) => string;
  getStatusColorClass: (status: ModuleStatus) => string;
}

function AssignmentAccordion({
  assignments,
  formatDate,
  getActionLabel,
  getStatusColorClass,
}: AssignmentAccordionProps) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {assignments.map((assignment) => (
        <AccordionItem
          value={String(assignment.assignment_id)}
          key={assignment.assignment_id}
          className="border-b border-border/50 last:border-0"
        >
          <AccordionTrigger className="hover:no-underline px-4 py-4 hover:bg-muted/20 transition-colors [&[data-state=open]]:bg-muted/10">
            <div className="grid grid-cols-12 gap-4 w-full items-center text-left text-sm">
              <div className="col-span-5 font-medium text-foreground">
                <Link
                  to={`/iebaseline/module/${assignment.module_id}`}
                  className="hover:text-primary transition-colors hover:underline underline-offset-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  {assignment.module_name}
                </Link>
              </div>

              <div className="col-span-4 flex items-center gap-3 pr-8">
                <Progress
                  value={assignment.progress}
                  className={`h-2 flex-1 bg-muted ${assignment.progress === 100 ? '[&>div]:bg-emerald-500' : ''}`}
                />
                <span className="text-xs font-medium text-muted-foreground min-w-[3rem] text-right">
                  {assignment.progress}%
                </span>
              </div>

              <div className="col-span-2">
                <Badge variant="outline" className={`${getStatusColorClass(assignment.status)} font-semibold border`}>
                  {assignment.status}
                </Badge>
              </div>

              <div className="col-span-1"></div>
            </div>
          </AccordionTrigger>

          <AccordionContent className="bg-muted/5 border-t border-border/50 px-4 py-6">
            <div className="space-y-6 max-w-4xl mx-auto w-full">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {assignment.description ?? 'No description available.'}
              </p>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Module Details</h4>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between p-3 rounded-md bg-background/50 backdrop-blur-sm border border-border/50">
                    <div className="flex items-center gap-3">
                      {assignment.status === 'Completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      <span className="text-sm text-foreground font-medium">
                        {assignment.question_count} checklist question{assignment.question_count === 1 ? '' : 's'}
                      </span>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      Updated {formatDate(assignment.updated_at)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div className="p-3 rounded-md bg-background/40 border border-border/50">
                      <span className="block font-semibold text-foreground mb-1">Owner</span>
                      {assignment.owner_name ?? 'N/A'}
                    </div>
                    <div className="p-3 rounded-md bg-background/40 border border-border/50">
                      <span className="block font-semibold text-foreground mb-1">Assigned By</span>
                      {assignment.assigned_by?.name ?? 'N/A'}
                    </div>
                    <div className="p-3 rounded-md bg-background/40 border border-border/50">
                      <span className="block font-semibold text-foreground mb-1">Assigned At</span>
                      {formatDate(assignment.assigned_at)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button className="gap-2 shadow-sm" asChild>
                  <Link to={`/iebaseline/module/${assignment.module_id}`}>
                    <PlayCircle className="w-4 h-4" />
                    {getActionLabel(assignment.status, assignment.progress)}
                  </Link>
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
