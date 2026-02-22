import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OAuthTokenManager } from '../oauth';
import type { GoogleOAuthToken } from '../CalendarEventService';

describe('OAuthTokenManager', () => {
  const mockToken: GoogleOAuthToken = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    tokenType: 'Bearer',
  };

  beforeEach(async () => {
    await OAuthTokenManager.clearToken('test-user');
  });

  describe('saveToken / getToken', () => {
    it('should save and retrieve token', async () => {
      await OAuthTokenManager.saveToken('test-user', mockToken);
      const retrieved = await OAuthTokenManager.getToken('test-user');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.accessToken).toBe('test-access-token');
      expect(retrieved?.refreshToken).toBe('test-refresh-token');
    });

    it('should return null for non-existent token', async () => {
      const retrieved = await OAuthTokenManager.getToken('non-existent-user');
      expect(retrieved).toBeNull();
    });

    it('should return null for expired token', async () => {
      const expiredToken: GoogleOAuthToken = {
        ...mockToken,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };

      await OAuthTokenManager.saveToken('test-user', expiredToken);
      const retrieved = await OAuthTokenManager.getToken('test-user');

      expect(retrieved).toBeNull();
    });
  });

  describe('clearToken', () => {
    it('should remove stored token', async () => {
      await OAuthTokenManager.saveToken('test-user', mockToken);
      expect(await OAuthTokenManager.getToken('test-user')).not.toBeNull();

      await OAuthTokenManager.clearToken('test-user');
      expect(await OAuthTokenManager.getToken('test-user')).toBeNull();
    });
  });

  describe('hasValidToken', () => {
    it('should return true for valid token', async () => {
      await OAuthTokenManager.saveToken('test-user', mockToken);
      const hasToken = await OAuthTokenManager.hasValidToken('test-user');

      expect(hasToken).toBe(true);
    });

    it('should return false for expired token', async () => {
      const expiredToken: GoogleOAuthToken = {
        ...mockToken,
        expiresAt: new Date(Date.now() - 1000),
      };

      await OAuthTokenManager.saveToken('test-user', expiredToken);
      const hasToken = await OAuthTokenManager.hasValidToken('test-user');

      expect(hasToken).toBe(false);
    });

    it('should return false for non-existent token', async () => {
      const hasToken = await OAuthTokenManager.hasValidToken('non-existent-user');
      expect(hasToken).toBe(false);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate valid OAuth URL', () => {
      const url = OAuthTokenManager.getAuthorizationUrl('test-state');

      expect(url).toContain('accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('state=test-state');
    });

    it('should include calendar scope', () => {
      const url = OAuthTokenManager.getAuthorizationUrl('test-state');
      expect(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/calendar.events'));
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should exchange code for token', async () => {
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      const token = await OAuthTokenManager.exchangeCodeForToken('auth-code');

      expect(token.accessToken).toBe('new-access-token');
      expect(token.refreshToken).toBe('new-refresh-token');
      expect(token.tokenType).toBe('Bearer');
      expect(token.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw error on failed exchange', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      });

      await expect(OAuthTokenManager.exchangeCodeForToken('invalid-code')).rejects.toThrow(
        'OAuth exchange failed'
      );
    });

    it('should throw error on network failure', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      await expect(OAuthTokenManager.exchangeCodeForToken('auth-code')).rejects.toThrow(
        'Failed to exchange code for token'
      );
    });
  });
});
