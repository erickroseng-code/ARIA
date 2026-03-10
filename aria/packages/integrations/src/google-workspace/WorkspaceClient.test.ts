import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted ensures these vars are available inside vi.mock factory (hoisted before imports)
const mocks = vi.hoisted(() => {
    const mockSetCredentials = vi.fn();
    const mockOn = vi.fn();
    return { mockSetCredentials, mockOn };
});

vi.mock('googleapis', () => {
    // Must use a regular function (not arrow) so it can be used as a constructor with `new`
    function MockOAuth2() {
        return {
            setCredentials: mocks.mockSetCredentials,
            on: mocks.mockOn,
            credentials: {} as Record<string, unknown>,
        };
    }
    return {
        google: {
            auth: { OAuth2: MockOAuth2 },
        },
    };
});

// Expose for use in tests
const mockSetCredentials = mocks.mockSetCredentials;
const mockOn = mocks.mockOn;

import {
    createWorkspaceClient,
    setWorkspaceTokenResolver,
    setWorkspaceTokenPersistor,
    setOnInvalidGrant,
    notifyInvalidGrant,
    isWorkspaceConfigured,
} from './WorkspaceClient';

describe('WorkspaceClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset environment
        process.env.GOOGLE_CLIENT_ID = 'test-client-id';
        process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
        process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/auth/google/callback';
        delete process.env.GOOGLE_REFRESH_TOKEN;

        // Reset global state by setting resolvers to null
        setWorkspaceTokenResolver(async () => null);
        setWorkspaceTokenPersistor(async () => {});
        setOnInvalidGrant(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createWorkspaceClient — bug fix: single setCredentials call', () => {
        it('sets both refresh_token and access_token in a single setCredentials call', async () => {
            setWorkspaceTokenResolver(async () => ({
                refreshToken: 'test-refresh-token',
                accessToken: 'test-access-token',
            }));

            await createWorkspaceClient();

            expect(mockSetCredentials).toHaveBeenCalledTimes(1);
            expect(mockSetCredentials).toHaveBeenCalledWith({
                refresh_token: 'test-refresh-token',
                access_token: 'test-access-token',
            });
        });

        it('sets only refresh_token when accessToken is null', async () => {
            setWorkspaceTokenResolver(async () => ({
                refreshToken: 'test-refresh-token',
                accessToken: null,
            }));

            await createWorkspaceClient();

            expect(mockSetCredentials).toHaveBeenCalledTimes(1);
            expect(mockSetCredentials).toHaveBeenCalledWith({
                refresh_token: 'test-refresh-token',
                access_token: undefined,
            });
        });

        it('falls back to GOOGLE_REFRESH_TOKEN env when DB returns null', async () => {
            process.env.GOOGLE_REFRESH_TOKEN = 'env-refresh-token';
            setWorkspaceTokenResolver(async () => null);

            await createWorkspaceClient();

            expect(mockSetCredentials).toHaveBeenCalledTimes(1);
            expect(mockSetCredentials).toHaveBeenCalledWith(
                expect.objectContaining({ refresh_token: 'env-refresh-token' })
            );
        });

        it('throws when no refresh_token and no access_token available', async () => {
            setWorkspaceTokenResolver(async () => null);

            await expect(createWorkspaceClient()).rejects.toThrow('Google Workspace Integration missing');
        });
    });

    describe('token listener — auto-persist on refresh', () => {
        it('registers on("tokens") listener when persistor is configured', async () => {
            const persistor = vi.fn().mockResolvedValue(undefined);
            setWorkspaceTokenPersistor(persistor);
            setWorkspaceTokenResolver(async () => ({ refreshToken: 'refresh-token', accessToken: null }));

            await createWorkspaceClient();

            expect(mockOn).toHaveBeenCalledWith('tokens', expect.any(Function));
        });

        it('calls persistor with new access_token when tokens event fires', async () => {
            const persistor = vi.fn().mockResolvedValue(undefined);
            setWorkspaceTokenPersistor(persistor);
            setWorkspaceTokenResolver(async () => ({ refreshToken: 'refresh-token', accessToken: null }));

            await createWorkspaceClient();

            // Simulate googleapis emitting 'tokens' event after auto-refresh
            const tokensCallback = mockOn.mock.calls.find(([event]) => event === 'tokens')?.[1];
            expect(tokensCallback).toBeDefined();

            await tokensCallback({ access_token: 'new-access-token', expiry_date: 1700000000000 });

            expect(persistor).toHaveBeenCalledWith({
                accessToken: 'new-access-token',
                expiryDate: 1700000000000,
            });
        });

        it('does NOT register on("tokens") listener when no persistor configured', async () => {
            // Reset persistor to null by setting a no-op but checking mockOn calls
            setWorkspaceTokenPersistor(null as unknown as Parameters<typeof setWorkspaceTokenPersistor>[0]);
            setWorkspaceTokenResolver(async () => ({ refreshToken: 'refresh-token', accessToken: null }));

            await createWorkspaceClient();

            expect(mockOn).not.toHaveBeenCalledWith('tokens', expect.any(Function));
        });
    });

    describe('notifyInvalidGrant', () => {
        it('calls the registered invalid_grant callback', () => {
            const callback = vi.fn();
            setOnInvalidGrant(callback);

            notifyInvalidGrant();

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('does not throw when no callback is registered', () => {
            setOnInvalidGrant(null as unknown as () => void);

            expect(() => notifyInvalidGrant()).not.toThrow();
        });
    });

    describe('isWorkspaceConfigured', () => {
        it('returns true when CLIENT_ID, CLIENT_SECRET, and refresh_token are set', async () => {
            setWorkspaceTokenResolver(async () => ({ refreshToken: 'refresh-token', accessToken: null }));

            expect(await isWorkspaceConfigured()).toBe(true);
        });

        it('returns false when no refresh token available', async () => {
            setWorkspaceTokenResolver(async () => null);

            expect(await isWorkspaceConfigured()).toBe(false);
        });
    });
});
