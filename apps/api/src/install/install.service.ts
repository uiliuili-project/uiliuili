import crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  type EnvironmentReport,
  type InstallProgress,
  type InstallResult,
  checkEnvironment,
  getOrCreateInstallToken,
  instanceExists,
  isLoopback,
  readInstance,
  runInstall,
  runtimeRoot,
  testDatabase,
  testMail,
  testStorage,
  verifyInstallToken,
} from '@uiliuili/installer';
import {
  APP_VERSION,
  type DatabaseConfig,
  type InstallConfig,
  type MailConfig,
  type StorageConfig,
} from '@uiliuili/shared';
import { config } from '../config';

interface SessionRecord {
  id: string;
  expiresAt: number;
}

export interface InstallStatus {
  installed: boolean;
  version: string;
  siteUrl?: string;
  instanceId?: string;
  tokenRequired: boolean;
  localhostBypass: boolean;
  running: boolean;
  failed: boolean;
  error?: string;
}

export interface InstallProgressState {
  running: boolean;
  installed: boolean;
  failed: boolean;
  stage: string;
  percent: number;
  message: string;
  error?: string;
  warnings: string[];
}

@Injectable()
export class InstallService {
  private readonly logger = new Logger('Installer');
  private readonly sessions = new Map<string, SessionRecord>();
  private state: InstallProgressState = {
    running: false,
    installed: false,
    failed: false,
    stage: 'idle',
    percent: 0,
    message: '',
    warnings: [],
  };

  status(ip?: string, forwardedFor?: string | string[]): InstallStatus {
    const instance = readInstance();
    const localBypass = this.isLocalRequest(ip, forwardedFor);
    return {
      installed: Boolean(instance) || instanceExists(),
      version: APP_VERSION,
      siteUrl: instance?.siteUrl,
      instanceId: instance?.instanceId,
      tokenRequired: !localBypass,
      localhostBypass: localBypass,
      running: this.state.running,
      failed: this.state.failed,
      error: this.state.error,
    };
  }

  unlock(
    token: string,
    ip?: string,
    forwardedFor?: string | string[],
  ): { sessionId: string } | { bypass: true } {
    if (this.isLocalRequest(ip, forwardedFor) && !token) {
      return { bypass: true };
    }
    if (!verifyInstallToken(runtimeRoot(), token)) {
      throw new Error('安装令牌不正确');
    }
    const sessionId = crypto.randomBytes(24).toString('base64url');
    this.sessions.set(sessionId, {
      id: sessionId,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });
    return { sessionId };
  }

  hasValidSession(
    sessionId: string | undefined,
    ip?: string,
    forwardedFor?: string | string[],
  ): boolean {
    if (this.isLocalRequest(ip, forwardedFor)) return true;
    if (!sessionId) return false;
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(sessionId);
      return false;
    }
    return true;
  }

  token(): string {
    return getOrCreateInstallToken(runtimeRoot());
  }

  async environment(): Promise<EnvironmentReport> {
    return checkEnvironment(runtimeRoot());
  }

  async testDatabase(database: DatabaseConfig) {
    return testDatabase(database);
  }

  async testStorage(storage: StorageConfig): Promise<{ ok: true }> {
    await testStorage(storage);
    return { ok: true };
  }

  async testMail(mail: MailConfig & { to: string }): Promise<{ ok: true }> {
    const { to, ...rest } = mail;
    await testMail(rest, to);
    return { ok: true };
  }

  start(installConfig: InstallConfig): InstallProgressState {
    if (this.state.running) throw new Error('安装正在进行中');
    if (instanceExists()) throw new Error('uiliuili 已经安装');
    this.state = {
      running: true,
      installed: false,
      failed: false,
      stage: 'starting',
      percent: 0,
      message: '正在启动安装',
      warnings: [],
    };

    void this.performInstall(installConfig);
    return this.state;
  }

  progress(): InstallProgressState {
    return this.state;
  }

  private isLocalRequest(ip?: string, forwardedFor?: string | string[]): boolean {
    if (!config.installAllowLocalhost) return false;
    if (forwardedFor && (Array.isArray(forwardedFor) ? forwardedFor.length > 0 : forwardedFor)) {
      return false;
    }
    return isLoopback(ip);
  }

  private update(progress: InstallProgress): void {
    this.state = {
      ...this.state,
      running: progress.stage !== 'restart',
      installed: progress.stage === 'restart',
      stage: progress.stage,
      percent: progress.percent,
      message: progress.message,
    };
  }

  private async performInstall(installConfig: InstallConfig): Promise<void> {
    try {
      const result: InstallResult = await runInstall(installConfig, {
        root: runtimeRoot(),
        production: config.production || installConfig.site.url.startsWith('https://'),
        onProgress: (progress) => {
          this.update(progress);
          this.logger.log(`${progress.percent}% ${progress.message}`);
        },
      });
      this.state = {
        running: false,
        installed: true,
        failed: false,
        stage: 'complete',
        percent: 100,
        message: '安装完成',
        warnings: result.warnings,
      };
      this.logger.log(`Installation completed. Admin ID: ${result.adminId}`);
      if (!config.installNoRestart) {
        this.logger.log('Restarting the API process to load the installed instance…');
        setTimeout(() => process.exit(75), 1200);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state = {
        running: false,
        installed: false,
        failed: true,
        stage: 'failed',
        percent: 0,
        message: '安装失败',
        error: message,
        warnings: [],
      };
      this.logger.error(message, error instanceof Error ? error.stack : undefined);
    }
  }
}
