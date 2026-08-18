## Objective

Update the module assignment UI to support configurable deadline durations based on the selected module type.

Modules are grouped by a module type. Each module type will now have a backend-provided default deadline duration, for example:

* Type A → 2 months
* Type B → 3 months
* Type C → 1 month

The purpose is to use this value as a QOL prefill when an admin assigns modules, while still allowing the admin to override the suggested duration.

## Current Behaviour

The admin can assign one or multiple module types/modules to a learner.

A single module type may contain multiple modules.

## Required Changes

When loading the available module types/modules for assignment, use the `default_duration_months` value returned by the backend.

Example response concept:

```json
{
  "type_id": 1,
  "type_name": "Type A",
  "default_duration_months": 2,
  "modules": [
    {
      "module_id": 101,
      "module_name": "Module A"
    },
    {
      "module_id": 102,
      "module_name": "Module B"
    }
  ]
}
```

For each selected module type:

1. Prefill its deadline duration using `default_duration_months`.
2. Allow the admin to override the value using a dropdown.
3. Suggested dropdown values can be:

```text
1 month
2 months
3 months
4 months
5 months
6 months
```

Do not hardcode the default deadline for individual module types in the frontend.

The backend-provided `default_duration_months` must be treated as the source of truth for the initial value.

The dropdown options themselves may remain frontend-defined for now.

## Multiple Module Types

The admin may select multiple module types in the same assignment operation.

Each selected type should maintain its own deadline duration.

Example:

```text
Type A
Deadline: [2 months ▼]

Type B
Deadline: [3 months ▼]

Type C
Deadline: [1 month ▼]
```

The admin should be able to change them independently:

```text
Type A → 2 months
Type B → 4 months
Type C → 1 month
```

Changing Type B must not affect Type A or Type C.

## Assignment Payload

Update the assignment request payload so that the selected duration for each type is sent to the backend.

Preferred conceptual structure:

```json
{
  "user_id": 123,
  "assignments": [
    {
      "type_id": 1,
      "duration_months": 2
    },
    {
      "type_id": 2,
      "duration_months": 4
    }
  ]
}
```

Please adapt this to the existing API structure rather than replacing working functionality unnecessarily.

## Implementation Notes

* Inspect the existing assignment page/components and API client first.
* Reuse the existing API that loads module/type assignment options rather than introducing a separate API call just for the deadline default.
* Keep the changes minimal and consistent with the existing project structure.
* Preserve all existing assignment behaviour.
* Do not duplicate backend business rules in the frontend.
* Use the backend value only to initialize/prefill the selected duration.
* Once the admin manually changes the duration, preserve their selected value.

Before modifying the code, inspect the existing implementation and identify the relevant components, state management, API types/interfaces, and assignment payload structure.

Then implement the changes using the existing patterns in the repository.
