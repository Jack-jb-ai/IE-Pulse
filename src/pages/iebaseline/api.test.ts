import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ieBaselineApi } from './api';

const jsonResponse = (body: unknown = {}) => ({
  ok: true,
  json: vi.fn().mockResolvedValue(body),
});

const fetchUrl = () => {
  const fetchMock = vi.mocked(fetch);
  return String(fetchMock.mock.calls[0][0]);
};

describe('IE Baseline API protected actor params', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds current_user_id to user search while preserving filters', async () => {
    await ieBaselineApi.users.search('  ada  ', { limit: 25, excludeUserId: 12 }, 7);

    expect(fetchUrl()).toBe('/ietools/iebaseline/api/users/search?current_user_id=7&q=ada&limit=25&exclude_user_id=12');
  });

  it('adds role_id to user search when filtering by role', async () => {
    await ieBaselineApi.users.search('  admin  ', { limit: 25, roleId: 2 }, 7);

    expect(fetchUrl()).toBe('/ietools/iebaseline/api/users/search?current_user_id=7&q=admin&limit=25&role_id=2');
  });

  it('adds current_user_id to user update URLs and keeps the JSON body', async () => {
    await ieBaselineApi.users.update(
      12,
      {
        name: 'Ada',
        position: null,
        wd_id: 123,
        reports_to: null,
        email: 'ada@example.com',
        department: null,
        role_id: 2,
      },
      7,
    );

    const fetchMock = vi.mocked(fetch);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/ietools/iebaseline/api/users/12?current_user_id=7');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toMatchObject({ name: 'Ada', role_id: 2 });
  });

  it('adds current_user_id to module and assignment admin URLs', async () => {
    await ieBaselineApi.modules.list(7);
    await ieBaselineApi.users.modules.get(12, 7);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls[0][0]).toBe('/ietools/iebaseline/api/modules?current_user_id=7');
    expect(fetchMock.mock.calls[1][0]).toBe('/ietools/iebaseline/api/users/12/modules?current_user_id=7');
  });

  it('adds current_user_id to learner attempt question and submit URLs', async () => {
    await ieBaselineApi.attempts.questions.get(101, 7);
    await ieBaselineApi.attempts.questions.saveAnswer(101, 202, { selectedAnswer: 'Yes' }, 7);
    await ieBaselineApi.attempts.questions.clearAnswer(101, 202, 7);
    await ieBaselineApi.attempts.submit(101, 7);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls[0][0]).toBe('/ietools/iebaseline/api/attempts/101/questions?current_user_id=7');
    expect(fetchMock.mock.calls[1][0]).toBe('/ietools/iebaseline/api/attempts/101/questions/202/answer?current_user_id=7');
    expect(fetchMock.mock.calls[2][0]).toBe('/ietools/iebaseline/api/attempts/101/questions/202/answer?current_user_id=7');
    expect(fetchMock.mock.calls[3][0]).toBe('/ietools/iebaseline/api/attempts/101/submit?current_user_id=7');
  });

  it('loads user attempt history with an optional module filter', async () => {
    await ieBaselineApi.attempts.list(7);
    await ieBaselineApi.attempts.list(7, 3);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls[0][0]).toBe('/ietools/iebaseline/api/attempts?user_id=7');
    expect(fetchMock.mock.calls[1][0]).toBe('/ietools/iebaseline/api/attempts?user_id=7&module_id=3');
  });

  it('posts approval delegation request details', async () => {
    await ieBaselineApi.approvals.delegate(15, 7, 2);

    const fetchMock = vi.mocked(fetch);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/ietools/iebaseline/api/approvals/15/delegate');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      reviewerUserId: 7,
      delegateToUserId: 2,
    });
  });

  it('sends wd_id and manager details when resolving the current user', async () => {
    await ieBaselineApi.users.resolveCurrent({
      name: 'Jack Goh',
      email: 'Jack_Goh@jabil.com',
      position: 'IE Engineer II',
      department: 'Industrial Engineering',
      wd_id: 4389269,
      manager: {
        name: 'Badrolhisham Bahari',
        email: 'BadrolHisham_Bahari@Jabil.com',
        position: 'IE Section Manager',
      },
    });

    const fetchMock = vi.mocked(fetch);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/ietools/iebaseline/api/users/resolve-current');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      email: 'Jack_Goh@jabil.com',
      wd_id: 4389269,
      manager: {
        email: 'BadrolHisham_Bahari@Jabil.com',
      },
    });
  });

  it('posts manager details to the background sync endpoint', async () => {
    await ieBaselineApi.users.syncManager(42, {
      manager: {
        name: 'Badrolhisham Bahari',
        email: 'BadrolHisham_Bahari@Jabil.com',
        position: 'IE Section Manager',
      },
    });

    const fetchMock = vi.mocked(fetch);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/ietools/iebaseline/api/users/42/sync-manager');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      manager: {
        name: 'Badrolhisham Bahari',
        email: 'BadrolHisham_Bahari@Jabil.com',
        position: 'IE Section Manager',
      },
    });
  });
});
