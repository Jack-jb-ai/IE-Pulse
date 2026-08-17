fix needed. 

# Assign Modules module 
  - current unassigning deletes all previous attempts probably due to PK constraint.
  - As module count increase in the future, it might be difficult to assign module, might wanna add a filter/search module function. overall, needs rework for better UX.
  - important fix** : do not show 'User ID'

# Home
  - Add Time remaining for each assignment, when assigned. 
  - New days remaining beside status column.
  - Make it more apparent, easy to know oh not much time left etc. 

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
