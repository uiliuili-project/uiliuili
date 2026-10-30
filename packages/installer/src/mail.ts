import type { MailConfig } from '@uiliuili/shared';
import nodemailer from 'nodemailer';

export async function testMail(config: MailConfig, to: string): Promise<void> {
  if (!config.host || !config.fromAddress) {
    throw new Error('请填写 SMTP 主机和发件人地址');
  }
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
    connectionTimeout: 15_000,
  });
  await transport.verify();
  await transport.sendMail({
    from: `"${config.fromName}" <${config.fromAddress}>`,
    to,
    subject: '萌悠 SMTP 测试',
    text: '这是一封来自萌悠安装器的测试邮件。如果你收到它，SMTP 配置正确。',
  });
}

export function createMailTransport(config: MailConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
  });
}
