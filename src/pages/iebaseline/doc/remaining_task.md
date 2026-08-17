fix needed. 

# Assign Modules module 
  - current unassigning deletes all previous attempts probably due to PK constraint.
  - As module count increase in the future, it might be difficult to assign module, might wanna add a filter/search module function. overall, needs rework for better UX.
  - important fix** : do not show 'User ID'

# Home
  - Add Time remaining for each assignment, when assigned. 
  - New days remaining beside status column.
  - Make it more apparent, easy to know oh not much time left etc. 

# Module details page overhaul
  - Route : /ietools/iebaseline/module/<module_id>
  - Currently we dont have a list showing all previous attempts. 
  - Instead of Review Module / Start Module button, View Result button, Retake Module button. 
    - Fixed to only Start Module -> new Attempt
    - Continue -> Continue on the most latest attempt
  - View Result / Continue for each attempt are now moved to the attemps list/window 
    - Display View Result for the Attempts that are completed attempt_status = 

# Approval module
  - notification template, include HTML, buttons, links etc etc make it a little fancy
  - Rejected status makes score fixed at 0% instead of showing current score, missing retake button. do we need this...(UX)
 
# User
  - Create User flow fix, assign reports_to. When? 
  - Link other columns such as WD_ID etc
  - Refresh multiple times during user first visit/login into IEBaseline. Would this create multiple instance/trigger multiple API thus making the user creation bugged. 

# Future modules (v2)
# Module Management (Admin)
  - Migrate/create new baseline checklist
  - Update 

# RBAC Management (Dev)
  - View current route permission
  - Edit permission
  - Add new permission
