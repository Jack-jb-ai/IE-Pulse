# Assign Modules Revamp

## Changes
- rename to Modules Assignment
- The purpose of revamp is to prioritize better UX. Current workflow works completely but as modules number grows in the future it might not be easy to navigate. 
- Module Assignmnet involves mainly 2 Tables/Modules,
  List of current User & List of current Modules. 
- Admin and dev will have access to this module(current RBAC seed works just fine unless new routes are added in this task then we need to populate for those as well)

## User List
- First, Admin will select user from the user list, current user list, "Users" doesnt have a search feature as well as a multi select option, select all option. 
- Allow search on user 'name' and user 'position' as well as 'WD ID'
- Select all or applies to the current filtered user list, if unfilter select all users shown in the current page and only. Include a pagination feature on client side 1 page should only display up to 15 user. 
- After user selection, display 'Assign Modules' button.

## Module List
- Module List UI can follow user list UI
- Includes search feature for module name and a pull down selection of unique column values from module_master (new column/migration needed) "module_type". Values such as, Site, Global and Others. Values will later be added to each module manually. 
- After module selection, Bulk Apply module to each selected user. 

## Note to codex
- Your the frontend repo
- For backend related changes, drop it in src\pages\iebaseline\doc\backend-handoff.md
- Instructions are not absolete, the goal is to prioritize UX, if you have a better design or idea do let me know. 

