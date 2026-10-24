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
  adminUsername: string;
  adminEmail: string;
  adminPassword: string;
  adminPasswordConfirm: string;
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
  { title: '站点与管理员' },
  { title: '存储' },
  { title: '可选服务' },
  { title: '确认安装' },
  { title: '完成' },
];

export function InstallWizard() {
  const [status, setStatus] = useState<InstallStatus | null>(null);
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
      notification.error({ message: '无法连接 API', description: messageOf(error) });
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
      notification.error({ message: '无法进入安装器', description: messageOf(error) });
    } finally {
      setUnlocking(false);
    }
  };

  const refreshEnvironment = async () => {
    try {
      setEnvironment(await api.get<EnvironmentReport>('/api/install/environment'));
    } catch (error) {
      notification.error({ message: '环境检查失败', description: messageOf(error) });
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
        message: `连接成功${result.serverVersion ? ` · ${result.serverVersion.split(',')[0]}` : ''}`,
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
      setStorageTest({ ok: true, message: '存储读写测试成功' });
    } catch (error) {
      setStorageTest({ ok: false, message: messageOf(error) });
    } finally {
      setBusy(false);
    }
  };

  const testMail = async () => {
    try {
      const values = await optionalForm.validateFields();
      const to = siteForm.getFieldValue('adminEmail');
      if (!to) throw new Error('请先在“站点与管理员”步骤填写管理员邮箱');
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
      setMailTest({ ok: true, message: `测试邮件已发送到 ${to}` });
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
      admin: {
        username: site.adminUsername,
        email: site.adminEmail,
        password: site.adminPassword,
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
        fromName: optional.mailFromName || 'uiliuili',
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
            message: '服务正在重启…',
            warnings: current?.warnings ?? [],
          }));
        }
      }, 700);
    } catch (error) {
      setBusy(false);
      notification.error({ message: '无法开始安装', description: messageOf(error) });
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
          <Result
            status="success"
            title="uiliuili 已经安装"
            subTitle={status.siteUrl ? `站点地址：${status.siteUrl}` : '安装已完成'}
            extra={[
              <Button type="primary" key="login" href={`${base}/login`}>
                前往管理后台
              </Button>,
              <Button key="site" href="/">
                访问站点
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
          <div className="install-brand">
            <span className="install-brand-mark">u</span>
            uiliuili
          </div>
          <div className="install-subtitle">开源、自托管的弹幕视频平台 · 安装向导</div>
          <Steps
            current={step}
            items={stepItems}
            size="small"
            style={{ marginTop: 24 }}
            responsive
          />
        </div>

        <div className="install-body">
          {step === 0 && (
            <Space direction="vertical" size="large" className="w-full">
              <div>
                <Title level={2}>欢迎使用 uiliuili</Title>
                <Paragraph className="muted">
                  这是首次安装向导。请准备一个 PostgreSQL 数据库，并确保服务器已安装 FFmpeg。
                  Redis、Meilisearch、S3、SMTP 和 OAuth 都可以稍后配置。
                </Paragraph>
              </div>
              <Alert
                type="info"
                showIcon
                icon={<SafetyCertificateOutlined />}
                message="安装令牌"
                description={
                  status.localhostBypass
                    ? '当前请求来自本机，可直接继续。生产环境会要求输入服务端控制台打印的一次性安装令牌。'
                    : '请从 API 服务端控制台或 storage/install-token 文件读取一次性安装令牌。'
                }
              />
              {!status.localhostBypass && (
                <Form layout="vertical">
                  <Form.Item label="安装令牌" required>
                    <Input.Password
                      prefix={<LockOutlined />}
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                      placeholder="粘贴安装令牌"
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
                开始安装
              </Button>
            </Space>
          )}

          {step === 1 && (
            <Space direction="vertical" size="large" className="w-full">
              <div>
                <Title level={3}>环境检查</Title>
                <Paragraph className="muted">
                  uiliuili 需要 Node.js 22+、可写的配置目录和 FFmpeg。数据库连接将在下一步检查。
                </Paragraph>
              </div>
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={environment?.checks ?? []}
                columns={[
                  { title: '检查项', dataIndex: 'label' },
                  {
                    title: '状态',
                    dataIndex: 'ok',
                    width: 110,
                    render: (ok: boolean, record) => (
                      <Tag color={ok ? 'success' : record.required ? 'error' : 'warning'}>
                        {ok ? '通过' : record.required ? '未通过' : '警告'}
                      </Tag>
                    ),
                  },
                  { title: '详情', dataIndex: 'detail', className: 'mono' },
                ]}
              />
              <Space>
                <Button icon={<ReloadOutlined />} onClick={refreshEnvironment}>
                  重新检查
                </Button>
                <Text className="muted">
                  {environment?.platform} · {environment?.arch} · {environment?.nodeVersion}
                </Text>
              </Space>
              {environment && !environment.ok && (
                <Alert
                  type="error"
                  showIcon
                  message="必需项未通过"
                  description="请先修复标记为“未通过”的环境问题后再继续。"
                />
              )}
            </Space>
          )}

          {step === 2 && (
            <Space direction="vertical" size="large" className="w-full">
              <div>
                <Title level={3}>数据库</Title>
                <Paragraph className="muted">
                  使用 PostgreSQL 16 或更高版本。安装器会在独立 schema 中创建数据表。
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
                  <Form.Item label="主机" name="host" rules={[{ required: true }]}>
                    <Input prefix={<DatabaseOutlined />} placeholder="127.0.0.1" />
                  </Form.Item>
                  <Form.Item label="端口" name="port" rules={[{ required: true }]}>
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
                  <Form.Item label="数据库名" name="database" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item label="Schema（固定）" name="schema" rules={[{ required: true }]}>
                    <Input disabled />
                  </Form.Item>
                  <Form.Item label="用户名" name="user" rules={[{ required: true }]}>
                    <Input autoComplete="off" />
                  </Form.Item>
                  <Form.Item label="密码" name="password">
                    <Input.Password autoComplete="new-password" />
                  </Form.Item>
                </div>
                <Space size="large" wrap>
                  <Form.Item name="ssl" valuePropName="checked" noStyle>
                    <Checkbox>使用 SSL</Checkbox>
                  </Form.Item>
                  <Form.Item name="createIfMissing" valuePropName="checked" noStyle>
                    <Checkbox>数据库不存在时自动创建</Checkbox>
                  </Form.Item>
                </Space>
              </Form>
              <Space>
                <Button icon={<CloudServerOutlined />} loading={busy} onClick={testDatabase}>
                  测试连接
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
                <Title level={3}>站点与管理员</Title>
                <Paragraph className="muted">
                  创建超级管理员账号。请使用高强度密码，安装完成后即可登录管理后台。
                </Paragraph>
              </div>
              <Form
                form={siteForm}
                layout="vertical"
                initialValues={{
                  name: 'uiliuili',
                  description: '一个自托管的弹幕视频站',
                  url: window.location.origin,
                  timezone: 'Asia/Shanghai',
                  locale: 'zh-CN',
                  registration: 'open',
                }}
              >
                <Form.Item label="站点名称" name="name" rules={[{ required: true }]}>
                  <Input maxLength={80} />
                </Form.Item>
                <Form.Item label="站点描述" name="description">
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
                    label="站点 URL"
                    name="url"
                    rules={[{ required: true, type: 'url', message: '请输入完整 URL' }]}
                  >
                    <Input placeholder="https://video.example.com" />
                  </Form.Item>
                  <Form.Item label="默认语言" name="locale">
                    <Select
                      options={[
                        { value: 'zh-CN', label: '简体中文' },
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
                  <Form.Item label="时区" name="timezone">
                    <Input />
                  </Form.Item>
                  <Form.Item label="注册策略" name="registration">
                    <Select
                      options={[
                        { value: 'open', label: '开放注册' },
                        { value: 'invite', label: '仅邀请' },
                        { value: 'closed', label: '关闭注册' },
                      ]}
                    />
                  </Form.Item>
                </div>
                <Divider orientation="left">管理员账号</Divider>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 16,
                  }}
                >
                  <Form.Item
                    label="用户名"
                    name="adminUsername"
                    rules={[
                      { required: true },
                      { min: 3 },
                      {
                        pattern: /^[a-zA-Z0-9_-]+$/,
                        message: '只能包含字母、数字、下划线和短横线',
                      },
                    ]}
                  >
                    <Input autoComplete="off" />
                  </Form.Item>
                  <Form.Item
                    label="邮箱"
                    name="adminEmail"
                    rules={[{ required: true, type: 'email' }]}
                  >
                    <Input autoComplete="off" />
                  </Form.Item>
                  <Form.Item
                    label="密码"
                    name="adminPassword"
                    rules={[
                      { required: true },
                      { min: 10, message: '至少 10 个字符' },
                      {
                        pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/,
                        message: '必须同时包含字母和数字',
                      },
                    ]}
                  >
                    <Input.Password autoComplete="new-password" />
                  </Form.Item>
                  <Form.Item
                    label="确认密码"
                    name="adminPasswordConfirm"
                    dependencies={['adminPassword']}
                    rules={[
                      { required: true },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('adminPassword') === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('两次输入的密码不一致'));
                        },
                      }),
                    ]}
                  >
                    <Input.Password autoComplete="new-password" />
                  </Form.Item>
                </div>
              </Form>
            </Space>
          )}

          {step === 4 && (
            <Space direction="vertical" size="large" className="w-full">
              <div>
                <Title level={3}>存储</Title>
                <Paragraph className="muted">
                  本地磁盘适合单机部署；S3 适合多节点部署与
                  CDN。你可以稍后在后台切换，但历史文件不会自动迁移。
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
                <Form.Item label="存储方式" name="driver">
                  <Segmented
                    options={[
                      { value: 'local', label: '本地磁盘' },
                      { value: 's3', label: 'S3 对象存储' },
                    ]}
                  />
                </Form.Item>
                {storageDriver === 'local' ? (
                  <Form.Item label="本地路径" name="localPath" rules={[{ required: true }]}>
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
                        label="Endpoint（AWS 留空）"
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
                      <Form.Item label="路径前缀" name="prefix">
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
                    <Form.Item label="公开访问域名 / CDN（可选）" name="publicBaseUrl">
                      <Input placeholder="https://cdn.example.com" />
                    </Form.Item>
                    <Form.Item name="forcePathStyle" valuePropName="checked">
                      <Checkbox>使用 Path Style（MinIO 等兼容服务通常需要）</Checkbox>
                    </Form.Item>
                  </>
                )}
              </Form>
              <Space>
                <Button loading={busy} onClick={testStorage}>
                  测试存储
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
                <Title level={3}>可选服务</Title>
                <Paragraph className="muted">
                  所有选项都可以跳过并在管理后台中稍后配置。单机部署建议跳过 Redis 和 Meilisearch。
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
                            <Switch checkedChildren="启用" unCheckedChildren="跳过" />
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
                            message="不启用 Redis 时，缓存、限流和实时广播使用单进程内存模式。"
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
                            <Switch checkedChildren="启用" unCheckedChildren="跳过" />
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
                            message="跳过时使用 PostgreSQL 模糊搜索；启用后支持更好的中文分词和相关性排序。"
                          />
                        </Space>
                      ),
                    },
                    {
                      key: 'mail',
                      label: '邮件',
                      children: (
                        <Space direction="vertical" className="w-full">
                          <Form.Item name="mailEnabled" valuePropName="checked">
                            <Switch checkedChildren="启用" unCheckedChildren="跳过" />
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
                                  label="SMTP 主机"
                                  name="mailHost"
                                  rules={[{ required: true }]}
                                >
                                  <Input />
                                </Form.Item>
                                <Form.Item label="端口" name="mailPort">
                                  <InputNumber min={1} max={65535} className="w-full" />
                                </Form.Item>
                                <Form.Item label="用户名" name="mailUser">
                                  <Input autoComplete="off" />
                                </Form.Item>
                                <Form.Item label="密码" name="mailPassword">
                                  <Input.Password autoComplete="new-password" />
                                </Form.Item>
                                <Form.Item label="发件人名称" name="mailFromName">
                                  <Input />
                                </Form.Item>
                                <Form.Item
                                  label="发件人地址"
                                  name="mailFromAddress"
                                  rules={[{ required: true, type: 'email' }]}
                                >
                                  <Input />
                                </Form.Item>
                              </div>
                              <Space size="large">
                                <Form.Item name="mailSecure" valuePropName="checked" noStyle>
                                  <Checkbox>直接使用 TLS</Checkbox>
                                </Form.Item>
                                <Form.Item
                                  name="verificationRequired"
                                  valuePropName="checked"
                                  noStyle
                                >
                                  <Checkbox>新用户必须验证邮箱</Checkbox>
                                </Form.Item>
                              </Space>
                              <div style={{ marginTop: 16 }}>
                                <Button loading={busy} onClick={testMail}>
                                  发送测试邮件
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
                            message="跳过邮件后，邮箱验证和自助找回密码不可用；管理员仍可在后台重置密码。"
                          />
                        </Space>
                      ),
                    },
                    {
                      key: 'oauth',
                      label: '第三方登录',
                      children: (
                        <Space direction="vertical" size="middle" className="w-full">
                          <Card size="small" title="GitHub">
                            <Form.Item name="githubEnabled" valuePropName="checked">
                              <Switch checkedChildren="启用" unCheckedChildren="关闭" />
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
                              <Switch checkedChildren="启用" unCheckedChildren="关闭" />
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
                          <Card size="small" title="通用 OIDC">
                            <Form.Item name="oidcEnabled" valuePropName="checked">
                              <Switch checkedChildren="启用" unCheckedChildren="关闭" />
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
                            message="回调地址将使用站点 URL，例如 /api/v1/auth/oauth/github/callback。"
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
                <Title level={3}>确认安装</Title>
                <Paragraph className="muted">
                  安装器将写入 .env、创建数据库表、初始化站点并创建管理员账号。此操作会修改数据库。
                </Paragraph>
              </div>
              <div className="install-summary">
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="站点名称">
                    {siteForm.getFieldValue('name')}
                  </Descriptions.Item>
                  <Descriptions.Item label="站点 URL">
                    {siteForm.getFieldValue('url')}
                  </Descriptions.Item>
                  <Descriptions.Item label="数据库">
                    {dbForm.getFieldValue('host')}:{dbForm.getFieldValue('port')}/
                    {dbForm.getFieldValue('database')}
                  </Descriptions.Item>
                  <Descriptions.Item label="Schema">
                    {dbForm.getFieldValue('schema')}
                  </Descriptions.Item>
                  <Descriptions.Item label="管理员">
                    {siteForm.getFieldValue('adminUsername')} ·{' '}
                    {siteForm.getFieldValue('adminEmail')}
                  </Descriptions.Item>
                  <Descriptions.Item label="存储">
                    {storageForm.getFieldValue('driver') === 's3' ? 'S3' : '本地磁盘'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Redis">
                    {optionalForm.getFieldValue('redisEnabled') ? '启用' : '跳过'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Meilisearch">
                    {optionalForm.getFieldValue('meiliEnabled') ? '启用' : 'PostgreSQL'}
                  </Descriptions.Item>
                  <Descriptions.Item label="邮件">
                    {optionalForm.getFieldValue('mailEnabled') ? '启用' : '跳过'}
                  </Descriptions.Item>
                  <Descriptions.Item label="第三方登录">
                    {[
                      optionalForm.getFieldValue('githubEnabled') ? 'GitHub' : null,
                      optionalForm.getFieldValue('googleEnabled') ? 'Google' : null,
                      optionalForm.getFieldValue('oidcEnabled') ? 'OIDC' : null,
                    ]
                      .filter(Boolean)
                      .join(' / ') || '跳过'}
                  </Descriptions.Item>
                </Descriptions>
              </div>
              <Alert
                type="warning"
                showIcon
                message="安装完成后服务会短暂重启"
                description="请确保 API 由 systemd 或 uiliuili serve 托管；如果没有自动重启，请手动重启 API 进程。"
              />
            </Space>
          )}

          {step === 7 && (
            <Space direction="vertical" size="large" className="w-full">
              {progress?.installed ? (
                <Result
                  status="success"
                  title="安装完成"
                  subTitle="管理员账号已创建。服务重启后即可登录管理后台。"
                  extra={[
                    <Button type="primary" key="login" href={`${base}/login`}>
                      前往登录
                    </Button>,
                    <Button key="site" href="/">
                      访问站点
                    </Button>,
                  ]}
                />
              ) : progress?.failed ? (
                <Result
                  status="error"
                  title="安装失败"
                  subTitle={progress.error ?? '请查看 API 日志并重试。'}
                  extra={[
                    <Button key="back" onClick={() => setStep(6)}>
                      返回检查配置
                    </Button>,
                  ]}
                />
              ) : (
                <>
                  <div>
                    <Title level={3}>正在安装</Title>
                    <Paragraph className="muted">{progress?.message ?? '正在准备…'}</Paragraph>
                  </div>
                  <Progress percent={progress?.percent ?? 0} status="active" />
                  <div className="install-progress-log">
                    <div>
                      [{progress?.stage ?? 'starting'}] {progress?.message ?? '正在启动安装'}
                    </div>
                    {progress?.warnings?.map((warning) => (
                      <div key={warning}>! {warning}</div>
                    ))}
                    <div className="muted">安装完成后 API 会自动重启，请稍候…</div>
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
            上一步
          </Button>
          <Text className="muted">uiliuili {status.version} · MIT License</Text>
          <Space>
            {step === 0 && (
              <Button type="primary" loading={unlocking} onClick={unlock}>
                开始
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
                下一步
              </Button>
            )}
            {step === 6 && (
              <Button
                type="primary"
                icon={<SettingOutlined />}
                loading={busy}
                onClick={startInstall}
              >
                开始安装
              </Button>
            )}
          </Space>
        </div>
      </div>
    </div>
  );
}
