import type { IEBaselineAttemptQuestion } from './api';

interface ExportQuestionResultsOpts {
  questions: IEBaselineAttemptQuestion[];
  moduleName: string;
  attemptNo: number;
}

export async function exportIEBaselineQuestionResultsXlsx({
  questions,
  moduleName,
  attemptNo,
}: ExportQuestionResultsOpts): Promise<void> {
  if (!questions.length) {
    console.warn('exportIEBaselineQuestionResultsXlsx called with no questions');
    return;
  }

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'IE Pulse';
  wb.created = new Date();

  const ws = wb.addWorksheet('Question Results', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = [
    { header: 'Question', key: 'question', width: 80 },
    { header: 'Selected Answer', key: 'selectedAnswer', width: 28 },
    { header: 'Score', key: 'score', width: 16 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 20;

  for (const question of questions) {
    const row = ws.addRow({
      question: formatQuestionText(question),
      selectedAnswer: question.answer.selectedAnswer ?? 'Not answered',
      score: formatAnswerScore(question.answer.scoreAwarded, question.answer.maximumScore),
    });
    row.font = { name: 'Calibri', size: 10 };
    row.alignment = { vertical: 'top', wrapText: true };
  }

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 3 },
  };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ie-baseline-question-results_${safeFilenamePart(moduleName)}_attempt-${attemptNo}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatQuestionText(question: IEBaselineAttemptQuestion) {
  return `Question ${question.questionNo ?? question.questionId}: ${question.question}`;
}

function formatAnswerScore(score: number | null | undefined, maximum: number | null | undefined) {
  if (score === null || score === undefined || maximum === null || maximum === undefined) return 'N/A';
  return `${Number(score).toLocaleString(undefined, { maximumFractionDigits: 2 })} / ${Number(maximum).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function safeFilenamePart(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'module';
}
