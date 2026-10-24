import crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { authProviders } from '@uiliuili/db';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../common/database.service';
import { SettingsService } from '../common/settings.service';

interface OAuthProfile {
  provider: string;
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl?: string;
}

interface ProviderConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  issuer: string;
  scopes: string[];
}

interface Discovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly settings: SettingsService,
    private readonly jwt: JwtService,
  ) {}

  async enabledProviders(): Promise<string[]> {
    const rows = await this.database.db.select().from(authProviders);
    return rows.filter((row) => row.enabled).map((row) => row.provider);
  }

  async createState(provider: string): Promise<string> {
    return this.jwt.signAsync(
      { type: 'oauth_state', provider, nonce: crypto.randomUUID() },
      { expiresIn: '10m' },
    );
  }

  async verifyState(state: string, provider: string): Promise<boolean> {
    try {
      const payload = await this.jwt.verifyAsync<{ type: string; provider: string }>(state);
      return payload.type === 'oauth_state' && payload.provider === provider;
    } catch {
      return false;
    }
  }

  async authorizeUrl(provider: string, state: string, siteUrl: string): Promise<string> {
    const config = await this.providerConfig(provider);
    if (!config?.enabled || !config.clientId) throw new Error('该登录方式未启用');
    const redirectUri = `${siteUrl}/api/v1/auth/oauth/${provider}/callback`;
    if (provider === 'github') {
      const url = new URL('https://github.com/login/oauth/authorize');
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('scope', 'read:user user:email');
      url.searchParams.set('state', state);
      return url.toString();
    }
    if (provider === 'google') {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('state', state);
      url.searchParams.set('access_type', 'online');
      url.searchParams.set('prompt', 'select_account');
      return url.toString();
    }
    const discovery = await this.discovery(config);
    const url = new URL(discovery.authorization_endpoint);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set(
      'scope',
      (config.scopes.length ? config.scopes : ['openid', 'email', 'profile']).join(' '),
    );
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchange(provider: string, code: string, siteUrl: string): Promise<OAuthProfile> {
    const config = await this.providerConfig(provider);
    if (!config?.enabled) throw new Error('该登录方式未启用');
    const redirectUri = `${siteUrl}/api/v1/auth/oauth/${provider}/callback`;
    if (provider === 'github') return this.exchangeGithub(config, code, redirectUri);
    if (provider === 'google') return this.exchangeGoogle(config, code, redirectUri);
    return this.exchangeOidc(config, code, redirectUri);
  }

  private async providerConfig(provider: string): Promise<ProviderConfig | null> {
    return this.settings.getOAuthProvider(provider);
  }

  private async discovery(config: ProviderConfig): Promise<Discovery> {
    if (!config.issuer) throw new Error('OIDC Issuer 未配置');
    const response = await fetch(
      `${config.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`,
    );
    if (!response.ok) throw new Error('无法读取 OIDC 配置');
    return (await response.json()) as Discovery;
  }

  private async exchangeGithub(
    config: ProviderConfig,
    code: string,
    redirectUri: string,
  ): Promise<OAuthProfile> {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token) throw new Error('GitHub 授权失败');
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token.access_token}`, 'User-Agent': 'uiliuili' },
    });
    const user = (await userResponse.json()) as {
      id: number;
      login: string;
      name?: string;
      avatar_url?: string;
      email?: string;
    };
    let email = user.email ?? '';
    let emailVerified = false;
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${token.access_token}`, 'User-Agent': 'uiliuili' },
    });
    if (emailResponse.ok) {
      const emails = (await emailResponse.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary =
        emails.find((item) => item.primary && item.verified) ??
        emails.find((item) => item.verified);
      if (primary) {
        email = primary.email;
        emailVerified = true;
      }
    }
    if (!email) throw new Error('GitHub 账号没有可用邮箱');
    return {
      provider: 'github',
      providerAccountId: String(user.id),
      email,
      emailVerified,
      name: user.name || user.login,
      avatarUrl: user.avatar_url,
    };
  }

  private async exchangeGoogle(
    config: ProviderConfig,
    code: string,
    redirectUri: string,
  ): Promise<OAuthProfile> {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token) throw new Error('Google 授权失败');
    const userResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const user = (await userResponse.json()) as {
      sub: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };
    if (!user.email) throw new Error('Google 账号没有可用邮箱');
    return {
      provider: 'google',
      providerAccountId: user.sub,
      email: user.email,
      emailVerified: Boolean(user.email_verified),
      name: user.name || user.email.split('@')[0]!,
      avatarUrl: user.picture,
    };
  }

  private async exchangeOidc(
    config: ProviderConfig,
    code: string,
    redirectUri: string,
  ): Promise<OAuthProfile> {
    const discovery = await this.discovery(config);
    const tokenResponse = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token) throw new Error('OIDC 授权失败');
    const userResponse = await fetch(discovery.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const user = (await userResponse.json()) as {
      sub: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      preferred_username?: string;
      picture?: string;
    };
    if (!user.email) throw new Error('OIDC 账号没有可用邮箱');
    return {
      provider: 'oidc',
      providerAccountId: user.sub,
      email: user.email,
      emailVerified: Boolean(user.email_verified),
      name: user.name || user.preferred_username || user.email.split('@')[0]!,
      avatarUrl: user.picture,
    };
  }
}
