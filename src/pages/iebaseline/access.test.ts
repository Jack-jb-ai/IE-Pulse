import { describe, expect, it } from 'vitest';
import { doesIEBaselineRouteMatch, normalizeIEBaselineRoutePath, resolveIEBaselineNavTarget } from './access';

describe('IE Baseline route access helpers', () => {
  it('normalizes deployed IE Tools paths to React router paths', () => {
    expect(normalizeIEBaselineRoutePath('/ietools/iebaseline/edit')).toBe('/iebaseline/edit');
    expect(normalizeIEBaselineRoutePath('/ietools/iebaseline/module/12/results?tab=score')).toBe('/iebaseline/module/12/results');
    expect(normalizeIEBaselineRoutePath('/iebaseline/assign/')).toBe('/iebaseline/assign');
  });

  it('matches static IE Baseline routes exactly', () => {
    expect(doesIEBaselineRouteMatch('/iebaseline/users', '/iebaseline/users')).toBe(true);
    expect(doesIEBaselineRouteMatch('/iebaseline/users', '/iebaseline/users/extra')).toBe(false);
  });

  it('matches dynamic IE Baseline module and approval routes', () => {
    expect(doesIEBaselineRouteMatch('/iebaseline/module/:moduleId', '/iebaseline/module/42')).toBe(true);
    expect(doesIEBaselineRouteMatch('/iebaseline/module/:moduleId/results', '/iebaseline/module/42/results')).toBe(true);
    expect(doesIEBaselineRouteMatch('/iebaseline/approvals/:approvalId/review', '/iebaseline/approvals/99/review')).toBe(true);
    expect(doesIEBaselineRouteMatch('/iebaseline/module/:moduleId', '/iebaseline/module/42/results')).toBe(false);
  });

  it('resolves Approvals nav to my submissions when inbox is denied', () => {
    const approvalsItem = {
      to: '/iebaseline/approvals/inbox',
      accessPaths: ['/iebaseline/approvals/inbox', '/iebaseline/approvals/my-submissions'],
    };

    expect(resolveIEBaselineNavTarget(approvalsItem, (path) => path === '/iebaseline/approvals/my-submissions'))
      .toBe('/iebaseline/approvals/my-submissions');
  });

  it('prefers Approvals inbox when both approval routes are granted', () => {
    const approvalsItem = {
      to: '/iebaseline/approvals/inbox',
      accessPaths: ['/iebaseline/approvals/inbox', '/iebaseline/approvals/my-submissions'],
    };

    expect(resolveIEBaselineNavTarget(approvalsItem, () => true)).toBe('/iebaseline/approvals/inbox');
  });

  it('hides Approvals nav when no approval route is granted', () => {
    const approvalsItem = {
      to: '/iebaseline/approvals/inbox',
      accessPaths: ['/iebaseline/approvals/inbox', '/iebaseline/approvals/my-submissions'],
    };

    expect(resolveIEBaselineNavTarget(approvalsItem, () => false)).toBeNull();
  });
});
