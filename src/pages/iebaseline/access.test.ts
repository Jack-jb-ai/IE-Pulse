import { describe, expect, it } from 'vitest';
import { doesIEBaselineRouteMatch, normalizeIEBaselineRoutePath } from './access';

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
});
