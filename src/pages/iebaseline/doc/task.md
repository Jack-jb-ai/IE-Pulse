## Objective

Update the LMS module assignment UI so that an admin can manually select a deadline date for each selected module type.

Modules are grouped by module type, and one type may contain multiple modules.

The admin may assign multiple module types in one operation.

Example:

```text
Type A
├── Module 1
├── Module 2
└── Module 3

Deadline: [ Calendar Date Picker ]

Type B
├── Module 4
└── Module 5

Deadline: [ Calendar Date Picker ]
```

Each selected module type should have its own independently selected deadline.

## Current Requirement

There is no default deadline duration and no prefilled deadline based on module type.

Do not implement any `default_duration_months` or similar configuration.

The admin should manually choose the deadline date using a calendar/date picker.

## Required Frontend Changes

Inspect the existing module assignment page/components first.

Locate:

* the module type selection UI
* the module assignment state
* the existing assignment API request
* the existing interfaces/types used for module types and assignments

Then add deadline selection at the module type level.

For every selected module type, display a date picker.

Example:

```text
Type A
Deadline: [ 18/10/2026 📅 ]

Type B
Deadline: [ 30/11/2026 📅 ]
```

The selected deadline for one type must not affect another selected type.

For example:

```text
Type A → 2026-10-18
Type B → 2026-11-30
Type C → 2027-01-15
```

## Multiple Modules Under One Type

A module type may contain multiple modules.

The admin selects one deadline for the type, and that deadline should apply to all modules being assigned under that type.

The frontend does not need to create an individual deadline input for every module.

Example:

```text
Type A
Deadline: 2026-10-18

Modules:
- Module 1
- Module 2
- Module 3
```

All modules under Type A will use `2026-10-18`.

## Assignment Payload

Update the existing assignment payload so that the selected deadline is sent together with each selected module type.

Preferred conceptual structure:

```json
{
  "user_id": 123,
  "assignments": [
    {
      "type_id": 1,
      "deadline_date": "2026-10-18"
    },
    {
      "type_id": 2,
      "deadline_date": "2026-11-30"
    }
  ]
}
```

Please adapt this to the existing API structure instead of unnecessarily redesigning working endpoints.

## Validation

Before allowing submission:

* Every selected module type must have a deadline selected.
* The deadline should not be earlier than the current date.
* Preserve any existing validation already present on the assignment form.
* Display validation using the project's existing UI conventions.

If the project already has a date picker component/library, reuse it.

Do not introduce a new UI dependency unless necessary.

## Important Design Rules

The frontend is responsible for:

```text
Admin selects module type(s)
        ↓
Admin selects deadline for each type
        ↓
Frontend sends selected type + deadline
        ↓
Backend creates actual module assignments
```

The frontend should not calculate or store `remaining_days` as persistent data.

If the backend returns `remaining_days` for existing assignments, the frontend may display it.

## Implementation Approach

Before making changes:

1. Inspect the existing assignment page.
2. Identify how selected module types are currently stored in state.
3. Add a deadline value to each selected type's state.
4. Add the calendar/date picker.
5. Update validation.
6. Update the assignment request payload.
7. Preserve the existing module/type selection behaviour.

Keep the implementation minimal and consistent with the existing React/Vite project structure.

Avoid unnecessary refactoring.
