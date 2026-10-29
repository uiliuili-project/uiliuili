import { SaveOutlined, UploadOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Tabs,
  Typography,
  Upload,
  notification,
} from 'antd';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useT } from '../i18n';
import { can } from '../permissions';
import { useAdminUser } from '../user-context';

const { Title, Text } = Typography;

interface SettingsData {
  groups: Record<string, Record<string, any>>;
  storage: Record<string, any> | null;
  mail: Record<string, any> | null;
  search: Record<string, any> | null;
  redis: { url: string } | null;
  oauth: Array<{ provider: string; enabled: boolean; config: Record<string, any> }>;
}

export function SettingsPage() {
  const t = useT();
  const actor = useAdminUser();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [siteForm] = Form.useForm();
  const [uploadForm] = Form.useForm();
  const [playbackForm] = Form.useForm();
  const [danmakuForm] = Form.useForm();
  const [socialForm] = Form.useForm();
  const [recommendForm] = Form.useForm();
  const [regionForm] = Form.useForm();
  const [storageForm] = Form.useForm();
  const [mailForm] = Form.useForm();
  const [searchForm] = Form.useForm();
  const [securityForm] = Form.useForm();
  const [oauthForms] = Form.useForm();
  const logoUrl = Form.useWatch('logoUrl', siteForm) as string | undefined;
  const canSite = can(actor, 'settings:site');
  const canContent = can(actor, 'settings:content');
  const canIntegration = can(actor, 'settings:integration');
  const canSecurity = can(actor, 'settings:security');

  const canSeeTab = (key: string) => {
    if (key === 'site') return canSite;
    if (key === 'content' || key === 'social' || key === 'region') return canContent;
    if (key === 'storage' || key === 'mail' || key === 'search' || key === 'oauth') {
      return canIntegration;
    }
    if (key === 'security') return canSecurity;
    return false;
  };

  const regionOptions = useQuery({
    queryKey: ['region-options'],
    queryFn: () =>
      api.get<{ items: Array<{ code: string; name: string; nameEn: string }> }>(
        '/api/v1/region/options',
      ),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const regionSelectOptions = (regionOptions.data?.items ?? []).map((item) => ({
    value: item.code,
    label: `${item.name} (${item.code})`,
  }));

  const query = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.get<SettingsData>('/api/v1/admin/settings'),
  });

  useEffect(() => {
    if (!query.data) return;
    const { groups, storage, mail, search, oauth } = query.data;
    const siteGroups = groups.site ?? {};
    siteForm.setFieldsValue(groups.site ?? {});
    uploadForm.setFieldsValue({
      ...(groups.upload ?? {}),
      maxBytesMb: Math.round(
        Number(groups.upload?.maxBytes ?? 2 * 1024 * 1024 * 1024) / 1024 / 1024,
      ),
      allowedExtensions: (groups.upload?.allowedExtensions ?? []).join(','),
    });
    playbackForm.setFieldsValue(groups.playback ?? {});
    danmakuForm.setFieldsValue({
      ...(groups.danmaku ?? {}),
      blockedWords: (groups.danmaku?.blockedWords ?? []).join('\n'),
    });
    socialForm.setFieldsValue(groups.social ?? {});
    regionForm.setFieldsValue({
      fallback: groups.region?.fallback ?? 'CN',
      header: groups.region?.header ?? 'cf-ipcountry',
      geoipDatabase: groups.region?.geoipDatabase ?? '',
      blockedRegions: groups.restricted?.blockedRegions ?? [],
      defaultBehavior: groups.restricted?.defaultBehavior ?? 'message',
      defaultMessage: groups.restricted?.defaultMessage ?? '该内容在您所在的地区不可用',
    });
    recommendForm.setFieldsValue({
      ...(groups.recommendation ?? {}),
      ...(groups.recommendation?.weights ?? {}),
    });
    if (storage) {
      storageForm.setFieldsValue({
        driver: storage.driver ?? 'local',
        localPath: storage.localPath ?? './storage/uploads',
        endpoint: storage.s3?.endpoint ?? '',
        region: storage.s3?.region ?? 'us-east-1',
        bucket: storage.s3?.bucket ?? '',
        accessKeyId: storage.s3?.accessKeyId ?? '',
        secretAccessKey: storage.s3?.secretAccessKey ?? '',
        forcePathStyle: storage.s3?.forcePathStyle ?? false,
        publicBaseUrl: storage.s3?.publicBaseUrl ?? '',
        prefix: storage.s3?.prefix ?? 'uiliuili',
      });
    }
    if (mail) {
      mailForm.setFieldsValue({
        ...mail,
        enabled: groups.mail?.enabled ?? mail.enabled ?? false,
        verificationRequired:
          groups.mail?.verificationRequired ?? mail.verificationRequired ?? false,
      });
    }
    if (search) {
      searchForm.setFieldsValue({
        driver: search.driver ?? 'postgres',
        url: search.url ?? '',
        key: search.key ?? '',
        indexPrefix: search.indexPrefix ?? 'uiliuili',
      });
    }
    securityForm.setFieldsValue({
      ...(groups.security ?? {}),
      registration: siteGroups.registration ?? 'open',
      maintenance: Boolean(siteGroups.maintenance),
    });
    const oauthValues: Record<string, any> = {};
    for (const provider of oauth ?? []) {
      oauthValues[provider.provider] = {
        enabled: provider.enabled,
        clientId: provider.config.clientId ?? '',
        clientSecret: provider.config.clientSecret ?? '',
        issuer: provider.config.issuer ?? '',
        scopes: (provider.config.scopes ?? []).join(' '),
      };
    }
    oauthForms.setFieldsValue(oauthValues);
  }, [query.data]);

  const save = async (patches: Record<string, unknown>, forms?: Array<() => Promise<unknown>>) => {
    try {
      if (forms) for (const validate of forms) await validate();
      setSaving(true);
      await api.put('/api/v1/admin/settings', { patches });
      notification.success({ message: t('设置已保存') });
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    } catch (error) {
      if (error instanceof Error) notification.error({ message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const saveSite = async () => {
    const values = await siteForm.validateFields();
    const { registration: _registration, maintenance: _maintenance, ...site } = values;
    await save({ site });
  };

  const uploadLogo = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      notification.error({ message: t('Logo 只支持 JPG、PNG 或 WebP 图片') });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      notification.error({ message: t('Logo 不能超过 2 MB') });
      return;
    }
    try {
      setSaving(true);
      const result = await api.upload<{ logoUrl: string }>(
        '/api/v1/admin/site/logo',
        file,
        file.type,
      );
      siteForm.setFieldValue('logoUrl', result.logoUrl);
      notification.success({ message: t('Logo 已更新') });
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    } catch (error) {
      notification.error({
        message: error instanceof Error ? error.message : t('Logo 上传失败'),
      });
    } finally {
      setSaving(false);
    }
  };
  const saveUpload = async () => {
    const values = await uploadForm.validateFields();
    await save({
      upload: {
        ...values,
        maxBytes: Number(values.maxBytesMb) * 1024 * 1024,
        maxBytesMb: undefined,
        allowedExtensions: String(values.allowedExtensions)
          .split(',')
          .map((item: string) => item.trim())
          .filter(Boolean),
      },
    });
  };
  const savePlayback = async () => {
    const values = await playbackForm.validateFields();
    await save({ playback: values });
  };
  const saveDanmaku = async () => {
    const values = await danmakuForm.validateFields();
    await save({
      danmaku: {
        ...values,
        blockedWords: String(values.blockedWords ?? '')
          .split('\n')
          .map((item: string) => item.trim())
          .filter(Boolean),
      },
    });
  };
  const saveRegion = async () => {
    const values = await regionForm.validateFields();
    await save({
      region: {
        fallback: values.fallback,
        header: values.header,
        geoipDatabase: values.geoipDatabase ?? '',
      },
      restricted: {
        blockedRegions: values.blockedRegions ?? [],
        defaultBehavior: values.defaultBehavior,
        defaultMessage: values.defaultMessage ?? '',
      },
    });
  };
  const saveSocial = async () => {
    const social = await socialForm.validateFields();
    const recommendation = await recommendForm.validateFields();
    await save({
      social,
      recommendation: {
        enabled: recommendation.enabled,
        explorationRatio: recommendation.explorationRatio,
        cacheSeconds: recommendation.cacheSeconds,
        weights: {
          views: recommendation.views,
          likes: recommendation.likes,
          coins: recommendation.coins,
          favorites: recommendation.favorites,
          comments: recommendation.comments,
          completion: recommendation.completion,
          freshness: recommendation.freshness,
          reportPenalty: recommendation.reportPenalty,
        },
      },
    });
  };
  const saveStorage = async () => {
    const values = await storageForm.validateFields();
    const config =
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
          };
    await save({ storage_config: config });
  };
  const saveMail = async () => {
    const values = await mailForm.validateFields();
    await save({
      mail: {
        enabled: values.enabled,
        verificationRequired: values.verificationRequired,
      },
      mail_config: {
        enabled: values.enabled,
        host: values.host ?? '',
        port: values.port ?? 587,
        secure: values.secure ?? false,
        user: values.user ?? '',
        password: values.password ?? '',
        fromName: values.fromName ?? 'uiliuili',
        fromAddress: values.fromAddress ?? '',
        verificationRequired: values.verificationRequired,
      },
    });
  };
  const saveSearch = async () => {
    const values = await searchForm.validateFields();
    await save({
      search_config:
        values.driver === 'postgres'
          ? { driver: 'postgres' }
          : {
              driver: 'meilisearch',
              url: values.url,
              key: values.key ?? '',
              indexPrefix: values.indexPrefix ?? 'uiliuili',
            },
    });
  };
  const saveSecurity = async () => {
    const values = await securityForm.validateFields();
    const { registration, maintenance, ...security } = values;
    await save({
      security,
      site: { registration, maintenance },
    });
  };
  const saveOAuth = async (provider: string) => {
    const values = await oauthForms.validateFields();
    const config = values[provider];
    try {
      setSaving(true);
      await api.put(`/api/v1/admin/oauth/${provider}`, {
        enabled: config.enabled,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        issuer: config.issuer,
        scopes: String(config.scopes ?? '')
          .split(/\s+/)
          .filter(Boolean),
      });
      notification.success({ message: t('第三方登录已保存') });
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    } catch (error) {
      notification.error({ message: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Title level={3} style={{ margin: 0 }}>
          {t('站点设置')}{' '}
        </Title>
        <Text className="muted">{t('公开配置与密钥均会即时生效')}</Text>
      </div>
      <Card loading={query.isLoading}>
        <Tabs
          items={[
            {
              key: 'site',
              label: t('站点'),
              children: (
                <Form form={siteForm} layout="vertical" style={{ maxWidth: 720 }}>
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item label={t('站点名称')} name="name">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label={t('站点 URL')} name="url">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24}>
                      <Form.Item
                        label={t('站点 Logo')}
                        extra={t('上传后立即生效，建议使用正方形 JPG、PNG 或 WebP 图片。')}
                      >
                        <Space align="center" wrap>
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt=""
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: 12,
                                objectFit: 'cover',
                                border: '1px solid #f0f0f0',
                              }}
                            />
                          ) : (
                            <span className="install-brand-mark">u</span>
                          )}
                          <Upload
                            accept="image/jpeg,image/png,image/webp"
                            showUploadList={false}
                            beforeUpload={(file) => {
                              void uploadLogo(file);
                              return false;
                            }}
                          >
                            <Button icon={<UploadOutlined />} loading={saving}>
                              {t('上传 Logo')}
                            </Button>
                          </Upload>
                          {logoUrl && (
                            <Button onClick={() => siteForm.setFieldValue('logoUrl', '')}>
                              {t('移除 Logo')}
                            </Button>
                          )}
                        </Space>
                      </Form.Item>
                    </Col>
                    <Col xs={24}>
                      <Form.Item label={t('Logo 地址')} name="logoUrl">
                        <Input placeholder="/media/branding/logo.png" allowClear />
                      </Form.Item>
                    </Col>
                    <Col xs={24}>
                      <Form.Item label={t('描述')} name="description">
                        <Input.TextArea rows={2} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item label={t('默认语言')} name="locale">
                        <Select
                          options={[
                            { value: 'zh-CN', label: t('简体中文') },
                            { value: 'en-US', label: 'English' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item label={t('时区')} name="timezone">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label={t('ICP 备案号')} name="icp">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24}>
                      <Form.Item label={t('页脚')} name="footer">
                        <Input.TextArea rows={2} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving}
                    onClick={() => void saveSite()}
                  >
                    {t('保存站点设置')}{' '}
                  </Button>
                </Form>
              ),
            },
            {
              key: 'content',
              label: t('内容与播放'),
              children: (
                <Row gutter={[24, 24]}>
                  <Col xs={24} lg={12}>
                    <Card size="small" title={t('上传')}>
                      <Form form={uploadForm} layout="vertical">
                        <Form.Item label={t('最大文件大小（MB）')} name="maxBytesMb">
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item label={t('最大时长（秒）')} name="maxDurationSeconds">
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item label={t('最大分辨率')} name="maxResolution">
                          <InputNumber min={360} max={2160} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item label={t('允许格式（逗号分隔）')} name="allowedExtensions">
                          <Input />
                        </Form.Item>
                        <Form.Item
                          label={t('投稿需要审核')}
                          name="requireReview"
                          valuePropName="checked"
                        >
                          <Switch />
                        </Form.Item>
                        <Button type="primary" loading={saving} onClick={() => void saveUpload()}>
                          {t('保存上传设置')}{' '}
                        </Button>
                      </Form>
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card size="small" title={t('播放')}>
                      <Form form={playbackForm} layout="vertical">
                        <Form.Item label={t('默认清晰度')} name="defaultQuality">
                          <Select
                            options={['auto', '360p', '480p', '720p', '1080p'].map((value) => ({
                              value,
                              label: value,
                            }))}
                          />
                        </Form.Item>
                        <Form.Item label={t('自动播放')} name="autoplay" valuePropName="checked">
                          <Switch />
                        </Form.Item>
                        <Form.Item
                          label={t('默认开启弹幕')}
                          name="danmakuEnabled"
                          valuePropName="checked"
                        >
                          <Switch />
                        </Form.Item>
                        <Form.Item label={t('签名 URL 有效期（秒）')} name="signedUrlTtlSeconds">
                          <InputNumber min={60} style={{ width: '100%' }} />
                        </Form.Item>
                        <Button type="primary" loading={saving} onClick={() => void savePlayback()}>
                          {t('保存播放设置')}{' '}
                        </Button>
                      </Form>
                    </Card>
                  </Col>
                  <Col xs={24}>
                    <Card size="small" title={t('弹幕')}>
                      <Form form={danmakuForm} layout="vertical">
                        <Row gutter={16}>
                          <Col xs={24} sm={8}>
                            <Form.Item label={t('启用弹幕')} name="enabled" valuePropName="checked">
                              <Switch />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={8}>
                            <Form.Item label={t('最大长度')} name="maxLength">
                              <InputNumber min={1} max={200} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={8}>
                            <Form.Item label={t('发送间隔（秒）')} name="intervalSeconds">
                              <InputNumber min={0} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={8}>
                            <Form.Item label={t('默认不透明度')} name="defaultOpacity">
                              <InputNumber
                                min={0.1}
                                max={1}
                                step={0.05}
                                style={{ width: '100%' }}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={8}>
                            <Form.Item label={t('默认字号')} name="defaultFontSize">
                              <InputNumber min={12} max={48} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={8}>
                            <Form.Item label={t('默认速度')} name="defaultSpeed">
                              <InputNumber min={1} max={12} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={8}>
                            <Form.Item label={t('等级门槛')} name="levelGate">
                              <InputNumber min={0} max={6} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Form.Item label={t('屏蔽词（每行一个）')} name="blockedWords">
                          <Input.TextArea rows={4} />
                        </Form.Item>
                        <Button type="primary" loading={saving} onClick={() => void saveDanmaku()}>
                          {t('保存弹幕设置')}{' '}
                        </Button>
                      </Form>
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'social',
              label: t('社交与推荐'),
              children: (
                <Row gutter={[24, 24]}>
                  <Col xs={24} lg={12}>
                    <Card size="small" title={t('社交')}>
                      <Form form={socialForm} layout="vertical">
                        <Form.Item label={t('每日硬币')} name="dailyCoins">
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item label={t('单视频最多投币')} name="maxCoinPerVideo">
                          <InputNumber min={1} max={10} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item label={t('收藏夹上限')} name="maxFavoriteFolders">
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Form>
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card size="small" title={t('推荐')}>
                      <Form form={recommendForm} layout="vertical">
                        <Form.Item label={t('启用推荐')} name="enabled" valuePropName="checked">
                          <Switch />
                        </Form.Item>
                        <Form.Item label={t('探索比例')} name="explorationRatio">
                          <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item label={t('缓存秒数')} name="cacheSeconds">
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                        <Row gutter={12}>
                          {[
                            'views',
                            'likes',
                            'coins',
                            'favorites',
                            'comments',
                            'completion',
                            'freshness',
                            'reportPenalty',
                          ].map((key) => (
                            <Col span={12} key={key}>
                              <Form.Item label={key} name={key}>
                                <InputNumber step={0.01} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                          ))}
                        </Row>
                      </Form>
                    </Card>
                  </Col>
                  <Col span={24}>
                    <Button type="primary" loading={saving} onClick={() => void saveSocial()}>
                      {t('保存社交与推荐设置')}{' '}
                    </Button>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'storage',
              label: t('存储'),
              children: (
                <Form form={storageForm} layout="vertical" style={{ maxWidth: 760 }}>
                  <Alert
                    type="info"
                    showIcon
                    message={t('切换存储驱动不会自动迁移已有文件')}
                    style={{ marginBottom: 16 }}
                  />
                  <Form.Item label={t('驱动')} name="driver">
                    <Select
                      options={[
                        { value: 'local', label: t('本地磁盘') },
                        { value: 's3', label: t('S3 兼容对象存储') },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item label={t('本地路径')} name="localPath">
                    <Input />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item label="S3 Endpoint" name="endpoint">
                        <Input placeholder={t('AWS 留空')} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Region" name="region">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Bucket" name="bucket">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label={t('路径前缀')} name="prefix">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Access Key ID" name="accessKeyId">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Secret Access Key" name="secretAccessKey">
                        <Input.Password />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label={t('公开访问域名 / CDN')} name="publicBaseUrl">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Path Style" name="forcePathStyle" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Button type="primary" loading={saving} onClick={() => void saveStorage()}>
                    {t('保存存储设置')}{' '}
                  </Button>
                </Form>
              ),
            },
            {
              key: 'mail',
              label: t('邮件'),
              children: (
                <Form form={mailForm} layout="vertical" style={{ maxWidth: 760 }}>
                  <Row gutter={16}>
                    <Col xs={24} sm={8}>
                      <Form.Item label={t('启用邮件')} name="enabled" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={16}>
                      <Form.Item
                        label={t('新用户必须验证邮箱')}
                        name="verificationRequired"
                        valuePropName="checked"
                      >
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={16}>
                      <Form.Item label={t('SMTP 主机')} name="host">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item label={t('端口')} name="port">
                        <InputNumber style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label={t('用户名')} name="user">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label={t('密码')} name="password">
                        <Input.Password />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label={t('发件人名称')} name="fromName">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label={t('发件人地址')} name="fromAddress">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label={t('直接 TLS')} name="secure" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Button type="primary" loading={saving} onClick={() => void saveMail()}>
                    {t('保存邮件设置')}{' '}
                  </Button>
                </Form>
              ),
            },
            {
              key: 'search',
              label: t('搜索'),
              children: (
                <Form form={searchForm} layout="vertical" style={{ maxWidth: 640 }}>
                  <Form.Item label={t('搜索引擎')} name="driver">
                    <Select
                      options={[
                        { value: 'postgres', label: t('PostgreSQL 兜底') },
                        { value: 'meilisearch', label: 'Meilisearch' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item label="Meilisearch URL" name="url">
                    <Input />
                  </Form.Item>
                  <Form.Item label="Master Key" name="key">
                    <Input.Password />
                  </Form.Item>
                  <Form.Item label={t('索引前缀')} name="indexPrefix">
                    <Input />
                  </Form.Item>
                  <Button type="primary" loading={saving} onClick={() => void saveSearch()}>
                    {t('保存搜索设置')}{' '}
                  </Button>
                </Form>
              ),
            },
            {
              key: 'oauth',
              label: t('第三方登录'),
              children: (
                <Form form={oauthForms} layout="vertical">
                  {['github', 'google', 'oidc'].map((provider) => (
                    <Card
                      key={provider}
                      size="small"
                      title={provider.toUpperCase()}
                      style={{ marginBottom: 16 }}
                    >
                      <Row gutter={16}>
                        <Col xs={24} sm={4}>
                          <Form.Item
                            label={t('启用')}
                            name={[provider, 'enabled']}
                            valuePropName="checked"
                          >
                            <Switch />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={10}>
                          <Form.Item label="Client ID" name={[provider, 'clientId']}>
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={10}>
                          <Form.Item label="Client Secret" name={[provider, 'clientSecret']}>
                            <Input.Password />
                          </Form.Item>
                        </Col>
                        {provider === 'oidc' && (
                          <Col xs={24}>
                            <Form.Item label="Issuer" name={[provider, 'issuer']}>
                              <Input />
                            </Form.Item>
                          </Col>
                        )}
                        <Col xs={24}>
                          <Form.Item label={t('Scopes（空格分隔）')} name={[provider, 'scopes']}>
                            <Input placeholder="openid email profile" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Button
                        type="primary"
                        loading={saving}
                        onClick={() => void saveOAuth(provider)}
                      >
                        {t('保存')} {provider}
                      </Button>
                    </Card>
                  ))}
                </Form>
              ),
            },
            {
              key: 'region',
              label: t('地区与限制级内容'),
              children: (
                <Form form={regionForm} layout="vertical" style={{ maxWidth: 720 }}>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message={t(
                      '地区按国家自动判定，注册后用户不能自行修改。限制级内容只能发布到未被勾选的国家。',
                    )}
                  />
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label={t('无法判断时的默认地区')}
                        name="fallback"
                        extra={t('既没有账号地区、也没有国家请求头时使用。')}
                      >
                        <Select showSearch optionFilterProp="label" options={regionSelectOptions} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label={t('国家请求头')}
                        name="header"
                        extra={t('由反向代理或 CDN 提供，值为 ISO 3166-1 两位国家代码。')}
                      >
                        <Input placeholder="cf-ipcountry" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item
                    label={t('GeoIP 数据库路径（可选）')}
                    name="geoipDatabase"
                    extra={t(
                      '填写 MaxMind .mmdb 文件路径并安装可选依赖 maxmind 后，在没有国家请求头时按 IP 查询。',
                    )}
                  >
                    <Input placeholder="/var/lib/GeoIP/GeoLite2-Country.mmdb" allowClear />
                  </Form.Item>
                  <Divider />
                  <Form.Item
                    label={t('限制级内容不可发布的地区')}
                    name="blockedRegions"
                    extra={t(
                      '被勾选的国家既不能上传限制级内容，也不能播放；其余国家均为无限制地区。',
                    )}
                  >
                    <Select
                      mode="multiple"
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      options={regionSelectOptions}
                      placeholder={t('搜索国家或地区代码')}
                    />
                  </Form.Item>
                  <Form.Item label={t('默认拒绝方式')} name="defaultBehavior">
                    <Select
                      options={[
                        { value: 'message', label: t('说明地区限制') },
                        { value: 'not_found', label: t('显示视频不存在') },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item label={t('默认提示文案')} name="defaultMessage">
                    <Input.TextArea rows={3} maxLength={200} showCount />
                  </Form.Item>
                  <Button type="primary" loading={saving} onClick={() => void saveRegion()}>
                    {t('保存地区设置')}
                  </Button>
                </Form>
              ),
            },
            {
              key: 'security',
              label: t('安全'),
              children: (
                <Form form={securityForm} layout="vertical" style={{ maxWidth: 640 }}>
                  <Form.Item label={t('注册策略')} name="registration">
                    <Select
                      options={[
                        { value: 'open', label: t('开放注册') },
                        { value: 'invite', label: t('仅邀请') },
                        { value: 'closed', label: t('关闭注册') },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item
                    label={t('维护模式')}
                    name="maintenance"
                    valuePropName="checked"
                    extra={t('开启后公开站显示维护提示，仅管理员可访问。')}
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item label={t('会话有效期（天）')} name="sessionDays">
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label={t('登录限流（次/分钟）')} name="loginRateLimit">
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                  <Button type="primary" loading={saving} onClick={() => void saveSecurity()}>
                    {t('保存安全设置')}{' '}
                  </Button>
                </Form>
              ),
            },
          ].filter((tab) => canSeeTab(tab.key))}
        />
      </Card>
    </div>
  );
}
