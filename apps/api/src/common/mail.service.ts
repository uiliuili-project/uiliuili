import { Injectable, Logger } from '@nestjs/common';
import { createMailTransport } from '@uiliuili/installer';
import type { MailConfig } from '@uiliuili/shared';
import { SettingsService } from './settings.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly settings: SettingsService) {}

  private async getConfig(): Promise<MailConfig | null> {
    return this.settings.getMailConfig();
  }

  async send(to: string, subject: string, text: string, html?: string): Promise<boolean> {
    const mail = await this.getConfig();
    if (!mail) {
      this.logger.warn(`Mail is not configured; skipped message to ${to}`);
      return false;
    }
    try {
      const transport = createMailTransport(mail);
      await transport.sendMail({
        from: `"${mail.fromName || 'uiliuili'}" <${mail.fromAddress}>`,
        to,
        subject,
        text,
        html,
      });
      return true;
    } catch (error) {
      this.logger.warn(`Failed to send mail to ${to}: ${String(error)}`);
      return false;
    }
  }

  async sendVerification(to: string, token: string): Promise<boolean> {
    const site = await this.settings.getSite();
    const url = `${site.url}/verify-email?token=${encodeURIComponent(token)}`;
    return this.send(
      to,
      '验证你的 uiliuili 邮箱',
      `请打开以下链接完成邮箱验证：\n${url}\n\n如果不是你本人操作，请忽略这封邮件。`,
    );
  }

  async sendPasswordReset(to: string, token: string): Promise<boolean> {
    const site = await this.settings.getSite();
    const url = `${site.url}/reset-password?token=${encodeURIComponent(token)}`;
    return this.send(
      to,
      '重置你的 uiliuili 密码',
      `请打开以下链接重置密码：\n${url}\n\n链接将在 1 小时后过期。`,
    );
  }
}
