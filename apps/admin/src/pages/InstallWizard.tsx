import {
  CheckCircleOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  LockOutlined,
  ReloadOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  Progress,
  Result,
  Segmented,
  Select,
  Space,
  Steps,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  notification,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api } from '../api';
import { AdminLanguageSwitcher, useT } from '../i18n';
import type { EnvironmentReport, InstallProgressState, InstallStatus } from '../types';

const { Title, Paragraph, Text } = Typography;
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

interface DatabaseForm {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  schema: string;
  createIfMissing: boolean;
}

interface SiteForm {
  name: string;
  description: string;
  url: string;
  timezone: string;
  locale: 'zh-CN' | 'en-US';
  registration: 'open' | 'invite' | 'closed';
}

interface StorageForm {
  driver: 'local' | 's3';
  localPath: string;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  publicBaseUrl: string;
  prefix: string;
}

interface OptionalForm {
  redisEnabled: boolean;
  redisUrl: string;
  meiliEnabled: boolean;
  meiliUrl: string;
  meiliKey: string;
  mailEnabled: boolean;
  mailHost: string;
  mailPort: number;
  mailSecure: boolean;
  mailUser: string;
  mailPassword: string;
  mailFromName: string;
  mailFromAddress: string;
  mailTestTo: string;
  verificationRequired: boolean;
  githubEnabled: boolean;
  githubClientId: string;
  githubClientSecret: string;
  googleEnabled: boolean;
  googleClientId: string;
  googleClientSecret: string;
  oidcEnabled: boolean;
  oidcIssuer: string;
  oidcClientId: string;
  oidcClientSecret: string;
}

const stepItems = [
  { title: '欢迎' },
  { title: '环境检查' },
  { title: '数据库' },
  { title: '站点信息' },
  { title: '存储' },
  { title: '可选服务' },
  { title: '确认安装' },
  { title: '完成' },
];

export function InstallWizard() {
  const t = useT();
  const [status, setStatus] = useState<InstallStatus | null>(null);
  const localizedSteps = stepItems.map((item) => ({ ...item, title: t(item.title) }));
  const [step, setStep] = useState(0);
  const [token, setToken] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [environment, setEnvironment] = useState<EnvironmentReport | null>(null);
  const [dbTest, setDbTest] = useState<{
    ok: boolean;
    message: string;
    warnings?: string[];
  } | null>(null);
  const [storageTest, setStorageTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [mailTest, setMailTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [progress, setProgress] = useState<InstallProgressState | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<number | null>(null);

  const [dbForm] = Form.useForm<DatabaseForm>();
  const [siteForm] = Form.useForm<SiteForm>();
  const [storageForm] = Form.useForm<StorageForm>();
  const [optionalForm] = Form.useForm<OptionalForm>();

  const storageDriver = Form.useWatch('driver', storageForm) ?? 'local';
  const redisEnabled = Form.useWatch('redisEnabled', optionalForm) ?? false;
  const meiliEnabled = Form.useWatch('meiliEnabled', optionalForm) ?? false;
  const mailEnabled = Form.useWatch('mailEnabled', optionalForm) ?? false;
  const githubEnabled = Form.useWatch('githubEnabled', optionalForm) ?? false;
  const googleEnabled = Form.useWatch('googleEnabled', optionalForm) ?? false;
  const oidcEnabled = Form.useWatch('oidcEnabled', optionalForm) ?? false;

  useEffect(() => {
    void loadStatus();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const loadStatus = async () => {
    try {
      const data = await api.get<InstallStatus>('/api/install/status');
      setStatus(data);
      if (data.installed) {
        setStep(7);
      }
    } catch (error) {
      notification.error({ message: t('无法连接 API'), description: messageOf(error) });
    }
  };

  const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const unlock = async () => {
    setUnlocking(true);
    try {
      await api.post('/api/install/unlock', { token });
      setStep(1);
      const env = await api.get<EnvironmentReport>('/api/install/environment');
      setEnvironment(env);
    } catch (error) {
      notification.error({ message: t('无法进入安装器'), description: messageOf(error) });
    } finally {
      setUnlocking(false);
    }
  };

  const refreshEnvironment = async () => {
    try {
      setEnvironment(await api.get<EnvironmentReport>('/api/install/environment'));
    } catch (error) {
      notification.error({ message: t('环境检查失败'), description: messageOf(error) });
    }
  };

  const testDatabase = async () => {
    try {
      const values = await dbForm.validateFields();
      setBusy(true);
      const result = await api.post<{ warnings: string[]; serverVersion: string }>(
        '/api/install/test/database',
        { config: values },
      );
      const warnings = result.warnings ?? [];
      setDbTest({
        ok: true,
        message: t('连接成功{0}', {
          0: result.serverVersion ? ` · ${result.serverVersion.split(',')[0]}` : '',
        }),
        warnings,
      });
    } catch (error) {
      setDbTest({ ok: false, message: messageOf(error) });
    } finally {
      setBusy(false);
    }
  };

  const testStorage = async () => {
    try {
      const values = await storageForm.validateFields();
      setBusy(true);
      await api.post('/api/install/test/storage', {
        config:
          values.driver === 'local'
            ? { driver: 'local', localPath: values.localPath }
            : {
                driver: 's3',
                s3: {
                  endpoint: values.endpoint || '',
                  region: values.region,
                  bucket: values.bucket,
                  accessKeyId: values.accessKeyId,
                  secretAccessKey: values.secretAccessKey,
                  forcePathStyle: values.forcePathStyle,
                  publicBaseUrl: values.publicBaseUrl || '',
                  prefix: values.prefix || 'uiliuili',
                },
              },
      });
      setStorageTest({ ok: true, message: t('存储读写测试成功') });
    } catch (error) {
      setStorageTest({ ok: false, message: messageOf(error) });
    } finally {
      setBusy(false);
    }
  };

  const testMail = async () => {
    try {
      const values = await optionalForm.validateFields();
      const to = values.mailTestTo;
      if (!to) throw new Error(t('请填写测试收件邮箱'));
      setBusy(true);
      await api.post('/api/install/test/mail', {
        to,
        config: {
          enabled: true,
          host: values.mailHost,
          port: values.mailPort,
          secure: values.mailSecure,
          user: values.mailUser,
          password: values.mailPassword,
          fromName: values.mailFromName,
          fromAddress: values.mailFromAddress,
          verificationRequired: values.verificationRequired,
        },
      });
      setMailTest({ ok: true, message: t('测试邮件已发送到 {0}', { 0: to }) });
    } catch (error) {
      setMailTest({ ok: false, message: messageOf(error) });
    } finally {
      setBusy(false);
    }
  };

  const buildConfig = () => {
    const db = dbForm.getFieldsValue();
    const site = siteForm.getFieldsValue();
    const storage = storageForm.getFieldsValue();
    const optional = optionalForm.getFieldsValue();
    const oauth: Record<string, unknown> = {};
    if (optional.githubEnabled) {
      oauth.github = {
        enabled: true,
        clientId: optional.githubClientId,
        clientSecret: optional.githubClientSecret,
        scopes: [],
      };
    }
    if (optional.googleEnabled) {
      oauth.google = {
        enabled: true,
        clientId: optional.googleClientId,
        clientSecret: optional.googleClientSecret,
        scopes: [],
      };
    }
    if (optional.oidcEnabled) {
      oauth.oidc = {
        enabled: true,
        clientId: optional.oidcClientId,
        clientSecret: optional.oidcClientSecret,
        issuer: optional.oidcIssuer,
        scopes: ['openid', 'email', 'profile'],
      };
    }
    return {
      locale: site.locale,
      database: db,
      site: {
        name: site.name,
        description: site.description,
        url: site.url,
        timezone: site.timezone,
        locale: site.locale,
        registration: site.registration,
      },
      storage:
        storage.driver === 'local'
          ? { driver: 'local', localPath: storage.localPath }
          : {
              driver: 's3',
              s3: {
                endpoint: storage.endpoint || '',
                region: storage.region,
                bucket: storage.bucket,
                accessKeyId: storage.accessKeyId,
                secretAccessKey: storage.secretAccessKey,
                forcePathStyle: storage.forcePathStyle,
                publicBaseUrl: storage.publicBaseUrl || '',
                prefix: storage.prefix || 'uiliuili',
              },
            },
      redis: optional.redisEnabled ? { url: optional.redisUrl } : null,
      search: optional.meiliEnabled
        ? {
            driver: 'meilisearch',
            url: optional.meiliUrl,
            key: optional.meiliKey,
            indexPrefix: 'uiliuili',
          }
        : { driver: 'postgres' },
      mail: {
        enabled: optional.mailEnabled,
        host: optional.mailHost || '',
        port: optional.mailPort || 587,
        secure: optional.mailSecure || false,
        user: optional.mailUser || '',
        password: optional.mailPassword || '',
        fromName: optional.mailFromName || '萌悠',
        fromAddress: optional.mailFromAddress || '',
        verificationRequired: optional.verificationRequired || false,
      },
      oauth: Object.keys(oauth).length ? oauth : undefined,
      demoContent: false,
    };
  };

  const startInstall = async () => {
    try {
      setBusy(true);
      await api.post('/api/install/run', buildConfig());
      setStep(7);
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(async () => {
        try {
          const state = await api.get<InstallProgressState>('/api/install/progress');
          setProgress(state);
          if (!state.running) {
            if (pollRef.current) window.clearInterval(pollRef.current);
            setBusy(false);
          }
        } catch {
          setProgress((current) => ({
            running: true,
            installed: current?.installed ?? true,
            failed: false,
            stage: 'restart',
            percent: 100,
            message: t('服务正在重启…'),
            warnings: current?.warnings ?? [],
          }));
        }
      }, 700);
    } catch (error) {
      setBusy(false);
      notification.error({ message: t('无法开始安装'), description: messageOf(error) });
    }
  };

  const next = async () => {
    try {
      if (step === 3) await siteForm.validateFields();
      if (step === 4) await storageForm.validateFields();
      if (step === 5) await optionalForm.validateFields();
      setStep((current) => Math.min(current + 1, 6));
    } catch {}
  };

  const total = useMemo(() => {
    if (step <= 0) return 0;
    if (step >= 7 && status?.installed) return 100;
    return Math.min(95, Math.round((step / 7) * 100));
  }, [step, status?.installed]);

  if (!status) {
    return (
      <div className="install-shell">
        <Card className="install-card" loading />
      </div>
    );
  }

  if (status.installed) {
    return (
      <div className="install-shell">
        <Card className="install-card">
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px 0' }}>
            <AdminLanguageSwitcher />
          </div>
          <Result
            status="success"
            title={t('萌悠已经安装')}
            subTitle={status.siteUrl ? t('站点地址：{0}', { 0: status.siteUrl }) : t('安装已完成')}
            extra={[
              <Button type="primary" key="login" href={`${base}/login`}>
                {t('前往管理后台')}{' '}
              </Button>,
              <Button key="site" href="/">
                {t('访问站点')}{' '}
              </Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="install-shell">
      <div className="install-card">
        <div className="install-header">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div className="install-brand">
              <span className="install-brand-mark">萌</span>
              萌悠
            </div>
            <AdminLanguageSwitcher />
          </div>
          <div className="install-subtitle">{t('开源、自托管的弹幕视频平台 · 安装向导')}</div>
          <Steps
            current={step}
            items={localizedSteps}
            size="small"
            style={{ marginTop: 24 }}
            responsive
          />
        </div>

        <div className="install-body">
          {step === 0 && (
            <Space direction="vertical" size="large" className="w-full">
              <div>
                <Title level={2}>{t('欢迎使用萌悠')}</Title>
                <Paragraph className="muted">
                  {t(
                    '这是首次安装向导。请准备一个 PostgreSQL 数据库，并确保服务器已安装 FFmpeg。 Redis、Meilisearch、S3、SMTP 和 OAuth 都可以稍后配置。',
                  )}{' '}
                </Paragraph>
              </div>
              <Alert
                type="info"
                showIcon
                icon={<SafetyCertificateOutlined />}
                message={t('安装令牌')}
                description={
                  status.localhostBypass
                    ? t(
                        '当前请求来自本机，可直接继续。生产环境会要求输入服务端控制台打印的一次性安装令牌。',
                      )
                    : t('请从 API 服务端控制台或 storage/install-token 文件读取一次性安装令牌。')
                }
              />
              {!status.localhostBypass && (
                <Form layout="vertical">
                  <Form.Item label={t('安装令牌')} required>
                    <Input.Password
                      prefix={<LockOutlined />}
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                      placeholder={t('粘贴安装令牌')}
                      autoComplete="off"
                    />
                  </Form.Item>
                </Form>
              )}
              <Button
                type="primary"
                size="large"
                icon={<RocketOutlined />}
                loading={unlocking}
                onClick={unlock}
              >
                {t('开始安装')}{' '}
              </Button>
            </Space>
          )}

          {step === 1 && (
            <Space direction="vertical" size="large" className="w-full">
              <div>
                <Title level={3}>{t('环境检查')}</Title>
                <Paragraph className="muted">
                  {t(
                    '萌悠需要 Node.js 22+、可写的配置目录和 FFmpeg。数据库连接将在下一步检查。',
                  )}{' '}
                </Paragraph>
              </div>
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={environment?.checks ?? []}
                columns={[
                  { title: t('检查项'), dataIndex: 'label' },
                  {
                    title: t('状态'),
                    dataIndex: 'ok',
                    width: 110,
                    render: (ok: boolean, record) => (
                      <Tag color={ok ? 'success' : record.required ? 'error' : 'warning'}>
                        {ok ? t('通过') : record.required ? t('未通过') : t('警告')}
                      </Tag>
                    ),
                  },
                  { title: t('详情'), dataIndex: 'detail', className: 'mono' },
                ]}
              />
              <Space>
                <Button icon={<ReloadOutlined />} onClick={refreshEnvironment}>
                  {t('重新检查')}{' '}
                </Button>
                <Text className="muted">
                  {environment?.platform} · {environment?.arch} · {environment?.nodeVersion}
                </Text>
              </Space>
              {environment && !environment.ok && (
                <Alert
                  type="error"
                  showIcon
                  message={t('必需项未通过')}
                  description={t('请先修复标记为“未通过”的环境问题后再继续。')}
                />
              )}
            </Space>
          )}

          {step === 2 && (
            <Space direction="vertical" size="large" className="w-full">
              <div>
                <Title level={3}>{t('数据库')}</Title>
                <Paragraph className="muted">
                  {t('使用 PostgreSQL 16 或更高版本。安装器会在独立 schema 中创建数据表。')}{' '}
                </Paragraph>
              </div>
              <Form
                form={dbForm}
                layout="vertical"
                initialValues={{
                  host: '127.0.0.1',
                  port: 5432,
                  database: 'uiliuili',
                  user: 'uiliuili',
                  password: '',
                  ssl: false,
                  schema: 'uiliuili',
                  createIfMissing: true,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 2fr) 120px',
                    gap: 16,
                  }}
                >
                  <Form.Item label={t('主机')} name="host" rules={[{ required: true }]}>
                    <Input prefix={<DatabaseOutlined />} placeholder="127.0.0.1" />
                  </Form.Item>
                  <Form.Item label={t('端口')} name="port" rules={[{ required: true }]}>
                    <InputNumber min={1} max={65535} className="w-full" />
                  </Form.Item>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 16,
                  }}
                >
                  <Form.Item label={t('数据库名')} name="database" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item label={t('Schema（固定）')} name="schema" rules={[{ required: true }]}>
                    <Input disabled />
                  </Form.Item>
                  <Form.Item label={t('用户名')} name="user" rules={[{ required: true }]}>
                    <Input autoComplete="off" />
                  </Form.Item>
                  <Form.Item label={t('密码')} name="password">
                    <Input.Password autoComplete="new-password" />
                  </Form.Item>
                </div>
                <Space size="large" wrap>
                  <Form.Item name="ssl" valuePropName="checked" noStyle>
                    <Checkbox>{t('使用 SSL')}</Checkbox>
                  </Form.Item>
                  <Form.Item name="createIfMissing" valuePropName="checked" noStyle>
                    <Checkbox>{t('数据库不存在时自动创建')}</Checkbox>
                  </Form.Item>
                </Space>
              </Form>
              <Space>
                <Button icon={<CloudServerOutlined />} loading={busy} onClick={testDatabase}>
                  {t('测试连接')}{' '}
                </Button>
                {dbTest && (
                  <Alert
                    type={dbTest.ok ? 'success' : 'error'}
                    showIcon
                    message={dbTest.message}
                    description={dbTest.warnings?.join('；')}
                  />
                )}
              </Space>
            </Space>
          )}

          {step === 3 && (
            <Space direction="vertical" size="large" className="w-full">
              <div>
                <Title level={3}>{t('站点信息')}</Title>
                <Paragraph className="muted">
                  {t('设置站点名称、地址与注册策略。站点负责人将在安装完成后通过注册创建。')}{' '}
                </Paragraph>
              </div>
              <Form
                form={siteForm}
                layout="vertical"
                initialValues={{
                  name: '萌悠',
                  description: t('一个自托管的弹幕视频站'),
                  url: window.location.origin,
                  timezone: 'Asia/Shanghai',
                  locale: 'zh-CN',
                  registration: 'open',
                }}
              >
                <Form.Item label={t('站点名称')} name="name" rules={[{ required: true }]}>
                  <Input maxLength={80} />
                </Form.Item>
                <Form.Item label={t('站点描述')} name="description">
                  <Input.TextArea rows={2} maxLength={300} showCount />
                </Form.Item>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr',
                    gap: 16,
                  }}
                >
                  <Form.Item
                    label={t('站点 URL')}
                    name="url"
                    rules={[{ required: true, type: 'url', message: t('请输入完整 URL') }]}
                  >
                    <Input placeholder="https://video.example.com" />
                  </Form.Item>
                  <Form.Item label={t('默认语言')} name="locale">
                    <Select
                      options={[
                        { value: 'zh-CN', label: t('简体中文') },
                        { value: 'en-US', label: 'English' },
                      ]}
                    />
                  </Form.Item>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 16,
                  }}
                >
                  <Form.Item label={t('时区')} name="timezone">
                    <Input />
                  </Form.Item>
                  <Form.Item label={t('注册策略')} name="registration">
                    <Select
                      options={[
                        { value: 'open', label: t('开放注册') },
                        { value: 'invite', label: t('仅邀请') },
                        { value: 'closed', label: t('关闭注册') },
                      ]}
                    />
                  </Form.Item>
                </div>
                <Alert
                  type="info"
                  showIcon
                  message={t('安装后不再创建初始管理员')}
                  description={t(
                    '安装完成后请注册第一个账号，该账号会自动成为站长。请务必先完成注册再开放站点访问。',
                  )}
                />
              </Form>
            </Space>
          )}

          {step === 4 && (
            <Space direction="vertical" size="large" className="w-full">
              <div>
                <Title level={3}>{t('存储')}</Title>
                <Paragraph className="muted">
                  {t(
                    '本地磁盘适合单机部署；S3 适合多节点部署与 CDN。你可以稍后在后台切换，但历史文件不会自动迁移。',
                  )}{' '}
                </Paragraph>
              </div>
              <Form
                form={storageForm}
                layout="vertical"
                initialValues={{
                  driver: 'local',
                  localPath: './storage/uploads',
                  region: 'us-east-1',
                  forcePathStyle: false,
                  prefix: 'uiliuili',
                }}
              >
                <Form.Item label={t('存储方式')} name="driver">
                  <Segmented
                    options={[
                      { value: 'local', label: t('本地磁盘') },
                      { value: 's3', label: t('S3 对象存储') },
                    ]}
                  />
                </Form.Item>
                {storageDriver === 'local' ? (
                  <Form.Item label={t('本地路径')} name="localPath" rules={[{ required: true }]}>
                    <Input className="mono" />
                  </Form.Item>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr',
                        gap: 16,
                      }}
                    >
                      <Form.Item
                        label={t('Endpoint（AWS 留空）')}
                        name="endpoint"
                        rules={[{ type: 'url', warningOnly: true }]}
                      >
                        <Input placeholder="https://s3.example.com" />
                      </Form.Item>
                      <Form.Item label="Region" name="region" rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 16,
                      }}
                    >
                      <Form.Item label="Bucket" name="bucket" rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item label={t('路径前缀')} name="prefix">
                        <Input />
                      </Form.Item>
                      <Form.Item
                        label="Access Key ID"
                        name="accessKeyId"
                        rules={[{ required: true }]}
                      >
                        <Input autoComplete="off" />
                      </Form.Item>
                      <Form.Item
                        label="Secret Access Key"
                        name="secretAccessKey"
                        rules={[{ required: true }]}
                      >
                        <Input.Password autoComplete="new-password" />
                      </Form.Item>
                    </div>
                    <Form.Item label={t('公开访问域名 / CDN（可选）')} name="publicBaseUrl">
                      <Input placeholder="https://cdn.example.com" />
                    </Form.Item>
                    <Form.Item name="forcePathStyle" valuePropName="checked">
                      <Checkbox>{t('使用 Path Style（MinIO 等兼容服务通常需要）')}</Checkbox>
                    </Form.Item>
                  </>
                )}
              </Form>
              <Space>
                <Button loading={busy} onClick={testStorage}>
                  {t('测试存储')}{' '}
                </Button>
                {storageTest && (
                  <Alert
                    type={storageTest.ok ? 'success' : 'error'}
                    showIcon
                    message={storageTest.message}
                  />
                )}
              </Space>
            </Space>
          )}

          {step === 5 && (
            <Space direction="vertical" size="large" className="w-full">
              <div>
                <Title level={3}>{t('可选服务')}</Title>
                <Paragraph className="muted">
                  {t(
                    '所有选项都可以跳过并在管理后台中稍后配置。单机部署建议跳过 Redis 和 Meilisearch。',
                  )}{' '}
                </Paragraph>
              </div>
              <Form
                form={optionalForm}
                layout="vertical"
                initialValues={{
                  redisEnabled: false,
                  redisUrl: 'redis://127.0.0.1:6379',
                  meiliEnabled: false,
                  meiliUrl: 'http://127.0.0.1:7700',
                  mailEnabled: false,
                  mailPort: 587,
                  mailSecure: false,
                  mailFromName: 'uiliuili',
                  verificationRequired: false,
                  githubEnabled: false,
                  googleEnabled: false,
                  oidcEnabled: false,
                }}
              >
                <Tabs
                  items={[
                    {
                      key: 'cache',
                      label: 'Redis',
                      children: (
                        <Space direction="vertical" className="w-full">
                          <Form.Item name="redisEnabled" valuePropName="checked">
                            <Switch checkedChildren={t('启用')} unCheckedChildren={t('跳过')} />
                          </Form.Item>
                          {redisEnabled && (
                            <Form.Item
                              label="Redis URL"
                              name="redisUrl"
                              rules={[{ required: true }]}
                            >
                              <Input className="mono" />
                            </Form.Item>
                          )}
                          <Alert
                            type="info"
                            message={t('不启用 Redis 时，缓存、限流和实时广播使用单进程内存模式。')}
                          />
                        </Space>
                      ),
                    },
                    {
                      key: 'search',
                      label: 'Meilisearch',
                      children: (
                        <Space direction="vertical" className="w-full">
                          <Form.Item name="meiliEnabled" valuePropName="checked">
                            <Switch checkedChildren={t('启用')} unCheckedChildren={t('跳过')} />
                          </Form.Item>
                          {meiliEnabled && (
                            <>
                              <Form.Item
                                label="Meilisearch URL"
                                name="meiliUrl"
                                rules={[{ required: true }]}
                              >
                                <Input className="mono" />
                              </Form.Item>
                              <Form.Item label="Master Key" name="meiliKey">
                                <Input.Password autoComplete="new-password" />
                              </Form.Item>
                            </>
                          )}
                          <Alert
                            type="info"
                            message={t(
                              '跳过时使用 PostgreSQL 模糊搜索；启用后支持更好的中文分词和相关性排序。',
                            )}
                          />
                        </Space>
                      ),
                    },
                    {
                      key: 'mail',
                      label: t('邮件'),
                      children: (
                        <Space direction="vertical" className="w-full">
                          <Form.Item name="mailEnabled" valuePropName="checked">
                            <Switch checkedChildren={t('启用')} unCheckedChildren={t('跳过')} />
                          </Form.Item>
                          {mailEnabled && (
                            <>
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '2fr 1fr',
                                  gap: 16,
                                }}
                              >
                                <Form.Item
                                  label={t('SMTP 主机')}
                                  name="mailHost"
                                  rules={[{ required: true }]}
                                >
                                  <Input />
                                </Form.Item>
                                <Form.Item label={t('端口')} name="mailPort">
                                  <InputNumber min={1} max={65535} className="w-full" />
                                </Form.Item>
                                <Form.Item label={t('用户名')} name="mailUser">
                                  <Input autoComplete="off" />
                                </Form.Item>
                                <Form.Item label={t('密码')} name="mailPassword">
                                  <Input.Password autoComplete="new-password" />
                                </Form.Item>
                                <Form.Item label={t('发件人名称')} name="mailFromName">
                                  <Input />
                                </Form.Item>
                                <Form.Item
                                  label={t('发件人地址')}
                                  name="mailFromAddress"
                                  rules={[{ required: true, type: 'email' }]}
                                >
                                  <Input />
                                </Form.Item>
                                <Form.Item
                                  label={t('测试收件邮箱')}
                                  name="mailTestTo"
                                  rules={[{ type: 'email' }]}
                                >
                                  <Input />
                                </Form.Item>
                              </div>
                              <Space size="large">
                                <Form.Item name="mailSecure" valuePropName="checked" noStyle>
                                  <Checkbox>{t('直接使用 TLS')}</Checkbox>
                                </Form.Item>
                                <Form.Item
                                  name="verificationRequired"
                                  valuePropName="checked"
                                  noStyle
                                >
                                  <Checkbox>{t('新用户必须验证邮箱')}</Checkbox>
                                </Form.Item>
                              </Space>
                              <div style={{ marginTop: 16 }}>
                                <Button loading={busy} onClick={testMail}>
                                  {t('发送测试邮件')}{' '}
                                </Button>
                                {mailTest && (
                                  <Alert
                                    style={{ marginTop: 12 }}
                                    type={mailTest.ok ? 'success' : 'error'}
                                    showIcon
                                    message={mailTest.message}
                                  />
                                )}
                              </div>
                            </>
                          )}
                          <Alert
                            type="warning"
                            message={t(
                              '跳过邮件后，邮箱验证和自助找回密码不可用；管理员仍可在后台重置密码。',
                            )}
                          />
                        </Space>
                      ),
                    },
                    {
                      key: 'oauth',
                      label: t('第三方登录'),
                      children: (
                        <Space direction="vertical" size="middle" className="w-full">
                          <Card size="small" title="GitHub">
                            <Form.Item name="githubEnabled" valuePropName="checked">
                              <Switch checkedChildren={t('启用')} unCheckedChildren={t('关闭')} />
                            </Form.Item>
                            {githubEnabled && (
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr 1fr',
                                  gap: 16,
                                }}
                              >
                                <Form.Item
                                  label="Client ID"
                                  name="githubClientId"
                                  rules={[{ required: true }]}
                                >
                                  <Input autoComplete="off" />
                                </Form.Item>
                                <Form.Item
                                  label="Client Secret"
                                  name="githubClientSecret"
                                  rules={[{ required: true }]}
                                >
                                  <Input.Password autoComplete="new-password" />
                                </Form.Item>
                              </div>
                            )}
                          </Card>
                          <Card size="small" title="Google">
                            <Form.Item name="googleEnabled" valuePropName="checked">
                              <Switch checkedChildren={t('启用')} unCheckedChildren={t('关闭')} />
                            </Form.Item>
                            {googleEnabled && (
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr 1fr',
                                  gap: 16,
                                }}
                              >
                                <Form.Item
                                  label="Client ID"
                                  name="googleClientId"
                                  rules={[{ required: true }]}
                                >
                                  <Input autoComplete="off" />
                                </Form.Item>
                                <Form.Item
                                  label="Client Secret"
                                  name="googleClientSecret"
                                  rules={[{ required: true }]}
                                >
                                  <Input.Password autoComplete="new-password" />
                                </Form.Item>
                              </div>
                            )}
                          </Card>
                          <Card size="small" title={t('通用 OIDC')}>
                            <Form.Item name="oidcEnabled" valuePropName="checked">
                              <Switch checkedChildren={t('启用')} unCheckedChildren={t('关闭')} />
                            </Form.Item>
                            {oidcEnabled && (
                              <>
                                <Form.Item
                                  label="Issuer"
                                  name="oidcIssuer"
                                  rules={[{ required: true }]}
                                >
                                  <Input placeholder="https://auth.example.com/application/o/uiliuili/" />
                                </Form.Item>
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 16,
                                  }}
                                >
                                  <Form.Item
                                    label="Client ID"
                                    name="oidcClientId"
                                    rules={[{ required: true }]}
                                  >
                                    <Input autoComplete="off" />
                                  </Form.Item>
                                  <Form.Item
                                    label="Client Secret"
                                    name="oidcClientSecret"
                                    rules={[{ required: true }]}
                                  >
                                    <Input.Password autoComplete="new-password" />
                                  </Form.Item>
                                </div>
                              </>
                            )}
                          </Card>
                          <Alert
                            type="info"
                            message={t(
                              '回调地址将使用站点 URL，例如 /api/v1/auth/oauth/github/callback。',
                            )}
                          />
                        </Space>
                      ),
                    },
                  ]}
                />
              </Form>
            </Space>
          )}

          {step === 6 && (
            <Space direction="vertical" size="large" className="w-full">
              <div>
                <Title level={3}>{t('确认安装')}</Title>
                <Paragraph className="muted">
                  {t('安装器将写入 .env、创建数据库表并初始化站点。此操作会修改数据库。')}{' '}
                </Paragraph>
              </div>
              <div className="install-summary">
                <Descriptions column={2} size="small">
                  <Descriptions.Item label={t('站点名称')}>
                    {siteForm.getFieldValue('name')}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('站点 URL')}>
                    {siteForm.getFieldValue('url')}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('数据库')}>
                    {dbForm.getFieldValue('host')}:{dbForm.getFieldValue('port')}/
                    {dbForm.getFieldValue('database')}
                  </Descriptions.Item>
                  <Descriptions.Item label="Schema">
                    {dbForm.getFieldValue('schema')}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('存储')}>
                    {storageForm.getFieldValue('driver') === 's3' ? 'S3' : t('本地磁盘')}
                  </Descriptions.Item>
                  <Descriptions.Item label="Redis">
                    {optionalForm.getFieldValue('redisEnabled') ? t('启用') : t('跳过')}
                  </Descriptions.Item>
                  <Descriptions.Item label="Meilisearch">
                    {optionalForm.getFieldValue('meiliEnabled') ? t('启用') : 'PostgreSQL'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('邮件')}>
                    {optionalForm.getFieldValue('mailEnabled') ? t('启用') : t('跳过')}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('第三方登录')}>
                    {[
                      optionalForm.getFieldValue('githubEnabled') ? 'GitHub' : null,
                      optionalForm.getFieldValue('googleEnabled') ? 'Google' : null,
                      optionalForm.getFieldValue('oidcEnabled') ? 'OIDC' : null,
                    ]
                      .filter(Boolean)
                      .join(' / ') || t('跳过')}
                  </Descriptions.Item>
                </Descriptions>
              </div>
              <Alert
                type="warning"
                showIcon
                message={t('安装完成后服务会短暂重启')}
                description={t(
                  '请确保 API 由 systemd 或 uiliuili serve 托管；如果没有自动重启，请手动重启 API 进程。',
                )}
              />
            </Space>
          )}

          {step === 7 && (
            <Space direction="vertical" size="large" className="w-full">
              {progress?.installed ? (
                <>
                  <Result
                    status="success"
                    title={t('安装完成')}
                    subTitle={t(
                      '安装已完成，但站点还没有站长。请访问站点并注册第一个账号，该账号将自动成为站长。',
                    )}
                    extra={[
                      <Button type="primary" key="register" href="/register">
                        {t('注册站长账号')}{' '}
                      </Button>,
                      <Button key="site" href="/">
                        {t('访问站点')}{' '}
                      </Button>,
                    ]}
                  />
                  {progress.ownerClaimToken && (
                    <Alert
                      type="warning"
                      showIcon
                      message={t('站长认领码（仅显示一次）')}
                      description={
                        <Space direction="vertical">
                          <Typography.Text code copyable>
                            {progress.ownerClaimToken}
                          </Typography.Text>
                          <span>
                            {t(
                              '从非本机地址注册站长账号时需要填写此认领码。请立即保存；丢失后可通过 CLI owner:promote 恢复。',
                            )}
                          </span>
                        </Space>
                      }
                    />
                  )}
                </>
              ) : progress?.failed ? (
                <Result
                  status="error"
                  title={t('安装失败')}
                  subTitle={progress.error ?? t('请查看 API 日志并重试。')}
                  extra={[
                    <Button key="back" onClick={() => setStep(6)}>
                      {t('返回检查配置')}{' '}
                    </Button>,
                  ]}
                />
              ) : (
                <>
                  <div>
                    <Title level={3}>{t('正在安装')}</Title>
                    <Paragraph className="muted">{progress?.message ?? t('正在准备…')}</Paragraph>
                  </div>
                  <Progress percent={progress?.percent ?? 0} status="active" />
                  <div className="install-progress-log">
                    <div>
                      [{progress?.stage ?? 'starting'}] {progress?.message ?? t('正在启动安装')}
                    </div>
                    {progress?.warnings?.map((warning) => (
                      <div key={warning}>! {warning}</div>
                    ))}
                    <div className="muted">{t('安装完成后 API 会自动重启，请稍候…')}</div>
                  </div>
                </>
              )}
            </Space>
          )}
        </div>

        <div className="install-footer">
          <Button
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0 || step === 7 || busy}
          >
            {t('上一步')}{' '}
          </Button>
          <Text className="muted">萌悠 {status.version} · MIT License</Text>
          <Space>
            {step === 0 && (
              <Button type="primary" loading={unlocking} onClick={unlock}>
                {t('开始')}{' '}
              </Button>
            )}
            {step > 0 && step < 6 && (
              <Button
                type="primary"
                onClick={next}
                disabled={
                  (step === 1 && !environment?.ok) ||
                  (step === 2 && !dbTest?.ok) ||
                  (step === 4 && !storageTest?.ok)
                }
              >
                {t('下一步')}{' '}
              </Button>
            )}
            {step === 6 && (
              <Button
                type="primary"
                icon={<SettingOutlined />}
                loading={busy}
                onClick={startInstall}
              >
                {t('开始安装')}{' '}
              </Button>
            )}
          </Space>
        </div>
      </div>
    </div>
  );
}
