import { describe, expect, it } from 'vitest';
import {
  MODULE_TYPE_ALL,
  MODULE_TYPE_UNSPECIFIED,
  USER_PAGE_SIZE,
  filterAssignableModules,
  filterAssignableUsers,
  getModuleAssignmentChanges,
  getUniqueModuleTypes,
  paginateItems,
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
});
