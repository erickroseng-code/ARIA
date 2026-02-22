/**
 * Google OAuth2 Token Management
 * Stores and retrieves access tokens for Google Calendar API
 */

import type { GoogleOAuthToken } from './CalendarEventService';

interface TokenStore {
  [userId: string]: GoogleOAuthToken;
}

// In-memory store (in production, use database)
const tokenCache: TokenStore = {};

export const OAuthTokenManager = {
  /**
   * Get stored OAuth token for user
   */
  async getToken(userId: string): Promise<GoogleOAuthToken | null> {
    const token = tokenCache[userId];
    if (!token) return null;

    // Check if token expired
    if (Date.now() > token.expiresAt.getTime()) {
      delete tokenCache[userId];
      return null;
    }

    return token;
  },

  /**
   * Save OAuth token for user
   */
  async saveToken(userId: string, token: GoogleOAuthToken): Promise<void> {
    tokenCache[userId] = {
      ...token,
      expiresAt: new Date(token.expiresAt),
    };
  },

  /**
   * Clear token for user
   */
  async clearToken(userId: string): Promise<void> {
    delete tokenCache[userId];
  },

  /**
   * Check if user has valid token
   */
  async hasValidToken(userId: string): Promise<boolean> {
    const token = await this.getToken(userId);
    return token !== null;
  },

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const redirectUri = process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events');

    return (
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${scope}&` +
      `access_type=offline&` +
      `state=${state}`
    );
  },

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForToken(code: string): Promise<GoogleOAuthToken> {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri = process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`OAuth exchange failed: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        tokenType: data.token_type,
      };
    } catch (error) {
      throw new Error(`Failed to exchange code for token: ${(error as Error).message}`);
    }
  },
};
