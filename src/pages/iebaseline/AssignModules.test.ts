import { describe, expect, it } from 'vitest';
import {
  MODULE_TYPE_ALL,
  MODULE_TYPE_UNSPECIFIED,
  USER_PAGE_SIZE,
  filterAssignableModules,
  filterAssignableUsers,
  formatDateForDisplay,
  getDeadlineValidationMessage,
  getModuleAssignmentChanges,
  getSelectedModuleTypeDeadlineGroups,
  getUniqueModuleTypes,
  paginateItems,
  parseYmd,
  reconcileDeadlineByType,
  toAssignmentDeadlines,
  toYmd,
  toggleCurrentPageSelection,
} from './AssignModules';
import type { IEBaselineModule, IEBaselineUser } from './api';

const users: IEBaselineUser[] = [
  { user_id: 1, name: 'Jane Tan', position: 'Manager', wd_id: 12345, assigned_module_count: 2 },
  { user_id: 2, name: 'Adam Lee', position: 'IE Engineer', wd_id: 54321, assigned_module_count: 0 },
  { user_id: 3, name: 'Priya Kumar', position: 'Trainer', wd_id: null, assigned_module_count: 1 },
];

const modules: IEBaselineModule[] = [
  { module_id: 10, module_name: 'Order to Cash', description: null, owner_name: null, question_count: 12, module_type: 'Global' },
  { module_id: 11, module_name: 'Site Safety', description: null, owner_name: null, question_count: 8, module_type: 'Site' },
  { module_id: 12, module_name: 'Inventory Basics', description: null, owner_name: null, question_count: 5, module_type: null },
];

describe('Modules Assignment helpers', () => {
  it('filters users by name, position, and WD ID', () => {
    expect(filterAssignableUsers(users, 'jane').map((user) => user.user_id)).toEqual([1]);
    expect(filterAssignableUsers(users, 'engineer').map((user) => user.user_id)).toEqual([2]);
    expect(filterAssignableUsers(users, '12345').map((user) => user.user_id)).toEqual([1]);
  });

  it('paginates users to the fixed assignment page size', () => {
    const manyUsers = Array.from({ length: USER_PAGE_SIZE + 3 }, (_, index) => ({
      user_id: index + 1,
      name: `User ${index + 1}`,
      position: null,
      wd_id: null,
    }));

    expect(paginateItems(manyUsers, 1, USER_PAGE_SIZE)).toHaveLength(USER_PAGE_SIZE);
    expect(paginateItems(manyUsers, 2, USER_PAGE_SIZE).map((user) => user.user_id)).toEqual([16, 17, 18]);
  });

  it('selects and clears only the current page ids', () => {
    const selected = new Set([99]);
    const withPage = toggleCurrentPageSelection(selected, [1, 2, 3]);

    expect(Array.from(withPage).sort((a, b) => a - b)).toEqual([1, 2, 3, 99]);
    expect(Array.from(toggleCurrentPageSelection(withPage, [1, 2, 3]))).toEqual([99]);
  });

  it('derives unique module type values including missing values as Unspecified', () => {
    expect(getUniqueModuleTypes(modules)).toEqual(['Global', 'Site', MODULE_TYPE_UNSPECIFIED]);
  });

  it('combines module name search and module type filtering', () => {
    expect(filterAssignableModules(modules, 'site', MODULE_TYPE_ALL).map((module) => module.module_id)).toEqual([11]);
    expect(filterAssignableModules(modules, '', 'Global').map((module) => module.module_id)).toEqual([10]);
    expect(filterAssignableModules(modules, 'inventory', MODULE_TYPE_UNSPECIFIED).map((module) => module.module_id)).toEqual([12]);
  });

  it('counts edit draft assignment changes', () => {
    const changes = getModuleAssignmentChanges(new Set([2, 3, 4]), new Set([1, 2, 3]));

    expect(changes.toAdd).toEqual([4]);
    expect(changes.toRemove).toEqual([1]);
    expect(changes.unchanged).toEqual([2, 3]);
  });

  it('groups selected modules by type with independent deadlines', () => {
    const groups = getSelectedModuleTypeDeadlineGroups(modules, new Set([10, 11, 12]), {
      Global: '2026-10-18',
      Site: '2026-11-30',
      [MODULE_TYPE_UNSPECIFIED]: '2027-01-15',
    });

    expect(groups).toEqual([
      { moduleType: 'Global', moduleCount: 1, deadlineDate: '2026-10-18' },
      { moduleType: 'Site', moduleCount: 1, deadlineDate: '2026-11-30' },
      { moduleType: MODULE_TYPE_UNSPECIFIED, moduleCount: 1, deadlineDate: '2027-01-15' },
    ]);
  });

  it('preserves selected deadlines only while their module type remains selected', () => {
    const groups = getSelectedModuleTypeDeadlineGroups(modules, new Set([10, 11]));
    const reconciled = reconcileDeadlineByType(
      { Global: '2026-10-18', Site: '2026-11-30', Removed: '2027-01-15' },
      groups,
    );

    expect(reconciled).toEqual({
      Global: '2026-10-18',
      Site: '2026-11-30',
    });
  });

  it('validates missing and past module type deadlines', () => {
    expect(getDeadlineValidationMessage([
      { moduleType: 'Global', moduleCount: 1, deadlineDate: '' },
    ], '2026-08-18')).toBe('Select a deadline for every selected module type.');

    expect(getDeadlineValidationMessage([
      { moduleType: 'Global', moduleCount: 1, deadlineDate: '2026-08-17' },
    ], '2026-08-18')).toBe('Deadline dates cannot be earlier than today.');

    expect(getDeadlineValidationMessage([
      { moduleType: 'Global', moduleCount: 1, deadlineDate: '2026-08-18' },
    ], '2026-08-18')).toBeNull();
  });

  it('converts selected type deadlines to the assignment payload shape', () => {
    expect(toAssignmentDeadlines([
      { moduleType: 'Global', moduleCount: 2, deadlineDate: '2026-10-18' },
    ])).toEqual([
      { module_type: 'Global', deadline_date: '2026-10-18' },
    ]);
  });

  it('parses and formats local date-only values', () => {
    const date = parseYmd('2026-10-18');

    expect(date).toBeInstanceOf(Date);
    expect(toYmd(date!)).toBe('2026-10-18');
    expect(parseYmd('2026-02-31')).toBeUndefined();
    expect(formatDateForDisplay('not-a-date')).toBe('');
  });
});
