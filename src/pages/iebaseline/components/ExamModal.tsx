import { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileText, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { ieBaselineApi } from '../api';

interface ExamModalProps {
  moduleId: number;
  moduleName: string;
  onClose: () => void;
}

export default function ExamModal({ moduleId, moduleName, onClose }: ExamModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const {
    data: questions = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['iebaseline', 'modules', moduleId, 'questions'],
    queryFn: () => ieBaselineApi.modules.questions.get(moduleId),
  });

  const question = questions[currentIndex];
  const options = useMemo(() => parseOptions(question?.options), [question?.options]);
  const selectedOption = question ? answers[question.id] ?? '' : '';
  const answeredCount = questions.filter((item) => answers[item.id]).length;
  const progressPct = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const setSelectedOption = (value: string) => {
    if (!question) return;
    setAnswers((current) => ({
      ...current,
      [question.id]: value,
    }));
  };

  const goPrevious = () => {
    setCurrentIndex((value) => Math.max(0, value - 1));
  };

  const goNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((value) => value + 1);
      return;
    }

    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black/95 backdrop-blur-md animate-in fade-in duration-300 overflow-hidden">
      <div className="relative flex-shrink-0 flex flex-col items-center pt-4 pb-3 px-6 gap-2">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-white/50 text-sm font-semibold uppercase tracking-widest">
            {moduleName}
          </span>
          {questions.length > 0 && (
            <span className="text-white/70 text-sm font-bold tabular-nums">
              Question {currentIndex + 1} / {questions.length}
            </span>
          )}
        </div>

        <div className="w-full max-w-2xl h-4 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="absolute top-3 right-4 lg:right-6 z-[110]">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/20 rounded-full">
          <X className="w-6 h-6" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 w-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-2 px-6 pb-6 lg:px-12 lg:pb-10 gap-8 lg:gap-16">
        <div className="flex flex-col h-full overflow-y-auto pr-2 lg:pr-4">
          <div className="space-y-6 lg:space-y-8 animate-in slide-in-from-left-4 duration-500 my-auto">
            {isLoading && (
              <div className="flex items-center gap-3 text-white/80">
                <Loader2 className="w-6 h-6 animate-spin" />
                <h2 className="text-3xl md:text-4xl font-bold">Loading checklist questions...</h2>
              </div>
            )}

            {isError && (
              <div className="space-y-4 text-white">
                <AlertCircle className="w-10 h-10 text-red-400" />
                <h2 className="text-3xl md:text-4xl font-bold">Unable to Load Questions</h2>
                <p className="text-white/70 text-lg">
                  {error instanceof Error ? error.message : 'Please check the IE Baseline API and try again.'}
                </p>
              </div>
            )}

            {!isLoading && !isError && questions.length === 0 && (
              <div className="space-y-4 text-white">
                <FileText className="w-10 h-10 text-white/60" />
                <h2 className="text-3xl md:text-4xl font-bold">No Checklist Questions</h2>
                <p className="text-white/70 text-lg">This module exists, but no checklist rows are available yet.</p>
              </div>
            )}

            {question && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {question.category && <Badge variant="secondary">{question.category}</Badge>}
                  {question.risk && <Badge variant="outline" className="border-white/20 text-white/70">{question.risk}</Badge>}
                  {question.question_no !== null && question.question_no !== undefined && (
                    <Badge variant="outline" className="border-white/20 text-white/70">#{question.question_no}</Badge>
                  )}
                </div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
                  {question.question}
                </h2>
                <QuestionContext question={question} />
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col h-full overflow-y-auto lg:px-4">
          <Card className="bg-background/95 backdrop-blur-md border-border/50 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] p-2 sm:p-4 animate-in slide-in-from-right-8 duration-500 relative overflow-hidden rounded-2xl w-full h-fit my-auto">
            <div className="space-y-6 p-4 sm:p-6">
              {question && (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">Select Response</h3>
                      <p className="text-sm text-muted-foreground">
                        {answeredCount} of {questions.length} answered
                      </p>
                    </div>
                    {selectedOption && <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />}
                  </div>

                  {options.length > 0 ? (
                    <RadioGroup value={selectedOption} onValueChange={setSelectedOption} className="grid gap-3">
                      {options.map((option) => (
                        <label
                          key={option.id}
                          className={cn(
                            'flex items-center space-x-4 p-5 rounded-xl border-2 transition-all cursor-pointer select-none group',
                            selectedOption === option.value
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50 bg-background/50 hover:bg-muted/50',
                          )}
                        >
                          <RadioGroupItem value={option.value} id={option.id} className="mt-0.5 data-[state=checked]:border-primary" />
                          <span className="flex-1 text-base sm:text-lg font-medium leading-tight text-foreground/80 group-hover:text-foreground">
                            {option.label}
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  ) : (
                    <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
                      This question has no stored response options yet.
                    </div>
                  )}

                  <div className="pt-2 flex flex-col sm:flex-row justify-between gap-3">
                    <Button variant="outline" size="lg" className="gap-2" disabled={currentIndex === 0} onClick={goPrevious}>
                      <ArrowLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <Button size="lg" className="gap-2" disabled={options.length > 0 && !selectedOption} onClick={goNext}>
                      {currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Checklist'}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}

              {!question && (
                <div className="flex justify-end">
                  <Button size="lg" onClick={onClose}>Close</Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}

function parseOptions(value?: string | null) {
  if (!value) return [];

  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((label, index) => ({
      id: `option-${index}`,
      label,
      value: label,
    }));
}

function QuestionContext({ question }: { question: { keyword: string | null; ibpm_l2: string | null; ibpm_l3: string | null; reference: string | null; memo: string | null } }) {
  const items = [
    ['Keyword', question.keyword],
    ['IBPM L2', question.ibpm_l2],
    ['IBPM L3', question.ibpm_l3],
    ['Reference', question.reference],
    ['Memo', question.memo],
  ].filter(([, value]) => Boolean(value));

  if (items.length === 0) return null;

  return (
    <div className="grid gap-2 text-white/70 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
          <span className="block text-xs font-semibold uppercase tracking-wider text-white/40 mb-1">{label}</span>
          {value}
        </div>
      ))}
    </div>
  );
}
