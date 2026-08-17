# Backend Handoff

## IE Baseline Question Results XLSX Export

No backend changes required.

The `/iebaseline/attempts/:attemptId/results` page already receives the complete Question Results data from `GET /attempts/{attempt_id}/questions`. The XLSX file is generated client-side from that response using the existing frontend `exceljs` dependency.
