# Fix v0.1

## Migration
 - Table: "user_checklist_status"
 - Column: status
 - dType: ENUM
 - Value: (Not Started, In Progress, Submitted, Rejected, Completed)
 - Default value = "Not Started"
 - Description: Change column value
 
 - Table: "user_exam_attempt"
 - Column: attempt_status
 - Description: Drop column. Column is now migrated to "user_checklist_status".status. 
 - As is: Current API writes In Progress on attempt creation, Submitted when approval is required, and Completed after normal submit or approval finalization.
 - To be: On attempt creation, writes user_checklist_status.status = 'In Progress'. 'Submitted' when approval is required(module_master.approval_required = True), if not required 'Completed'. 'Rejected' when approval was rejected. 

 ## Home route
 - Assigned Modules 'STATUS' now refers to user_checklist_status.status
 - Progress bar now refer to 'latest attempt' progress only when user_checklist_status.status is not "Not Started"
