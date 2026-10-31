import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  notification,
} from 'antd';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useT } from '../i18n';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface VideoNodeRecord {
  id: string;
  name: string;
  baseUrl: string;
  keyId: string;
  enabled: boolean;
  region: string;
  regions: string[];
  weight: number;
  maxConcurrency: number;
  status: string;
  version: string;
  storageUsedBytes: number;
  storageCapacityBytes: number;
  lastSeenAt: string | null;
  lastError: string | null;
  hasSecret: boolean;
}

interface NodeAsset {
  id: string;
  videoId: string;
  partId: string | null;
  nodeId: string;
  nodeName: string;
  remoteAssetId: string;
  status: string;
  isPrimary: boolean;
  durationSeconds: number;
  width: number;
  height: number;
  error: string | null;
  updatedAt: string;
}

interface ReplicationJob {
  id: string;
  assetId: string;
  sourceName: string;
  targetName: string;
  status: string;
  attempts: number;
  error: string | null;
  remoteAssetId: string | null;
  createdAt: string;
}

interface VideoNodeSettings {
  enabled: boolean;
  uploadStrategy: 'fixed' | 'region' | 'load';
  fixedNodeId: string;
  regionMap: Record<string, string>;
  playbackTtlSeconds: number;
  syncIntervalSeconds: number;
  replication: {
    enabled: boolean;
    mode: 'manual' | 'auto';
    maxCopies: number;
    sameRegionOnly: boolean;
  };
}

function formatBytes(value: number): string {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '-';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function regionMapToText(map: Record<string, string>): string {
  return Object.entries(map ?? {})
    .map(([country, nodeId]) => `${country}=${nodeId}`)
    .join('\n');
}

function textToRegionMap(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [country, nodeId] = trimmed.split('=');
    if (country && nodeId) result[country.trim().toUpperCase()] = nodeId.trim();
  }
  return result;
}

export function VideoNodesPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<VideoNodeRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [settingsForm] = Form.useForm();

  const nodes = useQuery({
    queryKey: ['admin-video-nodes'],
    queryFn: () => api.get<{ items: VideoNodeRecord[] }>('/api/v1/admin/video-nodes'),
  });
  const assets = useQuery({
    queryKey: ['admin-video-node-assets'],
    queryFn: () => api.get<{ items: NodeAsset[] }>('/api/v1/admin/video-nodes/assets'),
  });
  const jobs = useQuery({
    queryKey: ['admin-video-node-jobs'],
    queryFn: () =>
      api.get<{ items: ReplicationJob[] }>('/api/v1/admin/video-nodes/replication-jobs'),
  });
  const settings = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () =>
      api.get<{ groups: Record<string, Record<string, unknown>> }>('/api/v1/admin/settings'),
  });

  const videoSettings = (settings.data?.groups.videoNodes ?? {}) as unknown as VideoNodeSettings;

  useEffect(() => {
    const loaded = settings.data?.groups.videoNodes;
    if (!loaded) return;
    const current = loaded as unknown as VideoNodeSettings;
    settingsForm.setFieldsValue({
      enabled: current.enabled,
      uploadStrategy: current.uploadStrategy,
      fixedNodeId: current.fixedNodeId || undefined,
      regionMap: regionMapToText(current.regionMap),
      playbackTtlSeconds: current.playbackTtlSeconds,
      syncIntervalSeconds: current.syncIntervalSeconds,
      replicationEnabled: current.replication?.enabled ?? false,
      replicationMode: current.replication?.mode ?? 'manual',
      replicationMaxCopies: current.replication?.maxCopies ?? 2,
      replicationSameRegionOnly: current.replication?.sameRegionOnly ?? true,
    });
  }, [settings.data, settingsForm]);

  const nodeOptions = (nodes.data?.items ?? []).map((node) => ({
    label: `${node.name}${node.region ? ` · ${node.region}` : ''}`,
    value: node.id,
  }));

  const statusLabel: Record<string, string> = {
    online: t('videoNodes.statusOnline'),
    degraded: t('videoNodes.statusDegraded'),
    offline: t('videoNodes.statusOffline'),
    unknown: t('videoNodes.statusUnknown'),
  };
  const statusColor: Record<string, string> = {
    online: 'green',
    degraded: 'orange',
    offline: 'red',
    unknown: 'default',
  };
  const assetStatusLabel: Record<string, string> = {
    pending: t('videoNodes.assetPending'),
    uploading: t('videoNodes.assetUploading'),
    transcoding: t('videoNodes.assetTranscoding'),
    ready: t('videoNodes.assetReady'),
    failed: t('videoNodes.assetFailed'),
    deleted: t('videoNodes.assetDeleted'),
  };
  const jobStatusLabel: Record<string, string> = {
    pending: t('videoNodes.jobPending'),
    running: t('videoNodes.jobRunning'),
    done: t('videoNodes.jobDone'),
    failed: t('videoNodes.assetFailed'),
  };

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      enabled: true,
      keyId: 'default',
      weight: 100,
      maxConcurrency: 2,
      region: '',
      regions: '',
    });
  };

  const openEdit = (node: VideoNodeRecord) => {
    setEditing(node);
    setCreating(false);
    form.setFieldsValue({
      ...node,
      secret: '',
      regions: node.regions.join(','),
    });
  };

  const saveNode = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        regions: String(values.regions ?? '')
          .split(',')
          .map((item: string) => item.trim())
          .filter(Boolean),
        ...(values.secret ? {} : { secret: undefined }),
      };
      if (editing) await api.patch(`/api/v1/admin/video-nodes/${editing.id}`, payload);
      else await api.post('/api/v1/admin/video-nodes', payload);
      notification.success({ message: t('videoNodes.nodeSaved') });
      setEditing(null);
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ['admin-video-nodes'] });
    } catch (error) {
      if (error instanceof Error) notification.error({ message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const removeNode = async (node: VideoNodeRecord) => {
    if (!window.confirm(t('videoNodes.deleteConfirm', { 0: node.name }))) return;
    try {
      await api.delete(`/api/v1/admin/video-nodes/${node.id}`);
      await queryClient.invalidateQueries({ queryKey: ['admin-video-nodes'] });
    } catch (error) {
      notification.error({ message: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  const testNode = async (node: VideoNodeRecord) => {
    try {
      const result = await api.post<{ ok: boolean; latencyMs: number; error?: string }>(
        `/api/v1/admin/video-nodes/${node.id}/test`,
      );
      if (result.ok) {
        notification.success({
          message: t('videoNodes.testOk', { 0: result.latencyMs }),
        });
      } else {
        notification.error({ message: result.error ?? t('videoNodes.testFailed') });
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-video-nodes'] });
    } catch (error) {
      notification.error({
        message: error instanceof Error ? error.message : t('videoNodes.testFailed'),
      });
    }
  };

  const syncNow = useMutation({
    mutationFn: () => api.post('/api/v1/admin/video-nodes/sync'),
    onSuccess: async () => {
      notification.success({ message: t('videoNodes.syncDone') });
      await queryClient.invalidateQueries({ queryKey: ['admin-video-node-assets'] });
    },
    onError: (error: Error) => notification.error({ message: error.message }),
  });

  const replicate = async (asset: NodeAsset, targetNodeId: string) => {
    try {
      await api.post(`/api/v1/admin/video-nodes/assets/${asset.id}/replicas`, { targetNodeId });
      notification.success({ message: t('videoNodes.replicaCreated') });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-video-node-jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-video-node-assets'] }),
      ]);
    } catch (error) {
      notification.error({ message: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  const retryJob = async (job: ReplicationJob) => {
    try {
      await api.post(`/api/v1/admin/video-nodes/replication-jobs/${job.id}/retry`);
      await queryClient.invalidateQueries({ queryKey: ['admin-video-node-jobs'] });
    } catch (error) {
      notification.error({ message: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  const saveSettings = async () => {
    try {
      const values = await settingsForm.validateFields();
      setSaving(true);
      await api.put('/api/v1/admin/settings', {
        patches: {
          videoNodes: {
            enabled: values.enabled,
            uploadStrategy: values.uploadStrategy,
            fixedNodeId: values.fixedNodeId ?? '',
            regionMap: textToRegionMap(values.regionMap ?? ''),
            playbackTtlSeconds: values.playbackTtlSeconds,
            syncIntervalSeconds: values.syncIntervalSeconds,
            replication: {
              enabled: values.replicationEnabled,
              mode: values.replicationMode,
              maxCopies: values.replicationMaxCopies,
              sameRegionOnly: values.replicationSameRegionOnly,
            },
          },
        },
      });
      notification.success({ message: t('videoNodes.settingsSaved') });
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    } catch (error) {
      if (error instanceof Error) notification.error({ message: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Title level={3} style={{ margin: 0 }}>
          {t('videoNodes.title')}
        </Title>
        <Text className="muted">{t('videoNodes.subtitle')}</Text>
      </div>

      <Card
        title={t('videoNodes.nodes')}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              loading={syncNow.isPending}
              onClick={() => syncNow.mutate()}
            >
              {t('videoNodes.syncNow')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {t('videoNodes.addNode')}
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Table
          rowKey="id"
          loading={nodes.isLoading}
          dataSource={nodes.data?.items ?? []}
          pagination={false}
          scroll={{ x: 1000 }}
          locale={{ emptyText: t('videoNodes.emptyNodes') }}
          columns={[
            {
              title: t('videoNodes.name'),
              dataIndex: 'name',
              render: (name: string, node: VideoNodeRecord) => (
                <Space direction="vertical" size={0}>
                  <Space>
                    <Text strong>{name}</Text>
                    {node.region && <Tag>{node.region}</Tag>}
                    {!node.enabled && <Tag color="default">{t('videoNodes.disabled')}</Tag>}
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {node.baseUrl}
                  </Text>
                </Space>
              ),
            },
            {
              title: t('videoNodes.status'),
              dataIndex: 'status',
              render: (status: string, node: VideoNodeRecord) => (
                <Space direction="vertical" size={0}>
                  <Tag color={statusColor[status] ?? 'default'}>
                    {statusLabel[status] ?? status}
                  </Tag>
                  {node.lastError && (
                    <Text type="danger" style={{ fontSize: 12 }}>
                      {node.lastError}
                    </Text>
                  )}
                </Space>
              ),
            },
            {
              title: t('videoNodes.storage'),
              key: 'storage',
              render: (_value, node) =>
                node.storageCapacityBytes > 0
                  ? `${formatBytes(node.storageUsedBytes)} / ${formatBytes(node.storageCapacityBytes)}`
                  : formatBytes(node.storageUsedBytes),
            },
            { title: t('videoNodes.weight'), dataIndex: 'weight' },
            { title: t('videoNodes.maxConcurrency'), dataIndex: 'maxConcurrency' },
            {
              title: t('videoNodes.lastSeen'),
              dataIndex: 'lastSeenAt',
              render: (value: string | null) =>
                value ? value.replace('T', ' ').slice(0, 19) : '-',
            },
            {
              title: t('videoNodes.actions'),
              key: 'actions',
              render: (_value, node) => (
                <Space>
                  <Button size="small" onClick={() => void testNode(node)}>
                    {t('videoNodes.test')}
                  </Button>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(node)} />
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => void removeNode(node)}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card title={t('videoNodes.routing')} style={{ marginBottom: 16 }}>
        <Text className="muted" style={{ display: 'block', marginBottom: 12 }}>
          {t('videoNodes.routingHint')}
        </Text>
        <Form form={settingsForm} layout="vertical">
          <Space size="large" wrap align="start">
            <Form.Item
              name="enabled"
              label={t('videoNodes.routingEnabled')}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item name="uploadStrategy" label={t('videoNodes.strategy')}>
              <Select
                style={{ width: 160 }}
                options={[
                  { value: 'load', label: t('videoNodes.strategyLoad') },
                  { value: 'region', label: t('videoNodes.strategyRegion') },
                  { value: 'fixed', label: t('videoNodes.strategyFixed') },
                ]}
              />
            </Form.Item>
            <Form.Item name="fixedNodeId" label={t('videoNodes.fixedNode')}>
              <Select
                allowClear
                style={{ width: 220 }}
                placeholder={t('videoNodes.strategyFixed')}
                options={nodeOptions}
              />
            </Form.Item>
            <Form.Item name="playbackTtlSeconds" label={t('videoNodes.playbackTtl')}>
              <InputNumber min={30} max={86400} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="syncIntervalSeconds" label={t('videoNodes.syncInterval')}>
              <InputNumber min={10} max={600} style={{ width: 140 }} />
            </Form.Item>
          </Space>
          <Form.Item
            name="regionMap"
            label={t('videoNodes.regionMap')}
            extra={t('videoNodes.regionMapHint')}
          >
            <TextArea rows={3} placeholder={'CN=<node-id>\nUS=<node-id>'} />
          </Form.Item>
          <Space size="large" wrap align="start">
            <Form.Item
              name="replicationEnabled"
              label={t('videoNodes.replicationEnabled')}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item name="replicationMode" label={t('videoNodes.replicationMode')}>
              <Select
                style={{ width: 140 }}
                options={[
                  { value: 'manual', label: t('videoNodes.replicationManual') },
                  { value: 'auto', label: t('videoNodes.replicationAuto') },
                ]}
              />
            </Form.Item>
            <Form.Item name="replicationMaxCopies" label={t('videoNodes.replicationMax')}>
              <InputNumber min={1} max={10} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item
              name="replicationSameRegionOnly"
              label={t('videoNodes.replicationSameRegion')}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Space>
          <Button type="primary" loading={saving} onClick={() => void saveSettings()}>
            {t('videoNodes.saveSettings')}
          </Button>
        </Form>
      </Card>

      <Card title={t('videoNodes.assets')} style={{ marginBottom: 16 }}>
        <Table
          rowKey="id"
          loading={assets.isLoading}
          dataSource={assets.data?.items ?? []}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 900 }}
          columns={[
            {
              title: t('videoNodes.assetVideo'),
              dataIndex: 'videoId',
              render: (value: string) => (
                <Text copyable={{ text: value }} style={{ fontSize: 12 }}>
                  {value}
                </Text>
              ),
            },
            { title: t('videoNodes.assetNode'), dataIndex: 'nodeName' },
            {
              title: t('videoNodes.assetStatus'),
              dataIndex: 'status',
              render: (status: string) => (
                <Tag color={status === 'ready' ? 'green' : status === 'failed' ? 'red' : 'blue'}>
                  {assetStatusLabel[status] ?? status}
                </Tag>
              ),
            },
            {
              title: t('videoNodes.assetResolution'),
              key: 'resolution',
              render: (_value, asset) => (asset.height ? `${asset.width}×${asset.height}` : '-'),
            },
            {
              title: t('videoNodes.assetDuration'),
              dataIndex: 'durationSeconds',
              render: (value: number) => formatDuration(value),
            },
            {
              title: t('videoNodes.replicate'),
              key: 'replicate',
              render: (_value, asset) =>
                videoSettings?.replication?.enabled && asset.status === 'ready' ? (
                  <Select
                    size="small"
                    style={{ width: 180 }}
                    placeholder={t('videoNodes.replicateTo')}
                    options={nodeOptions.filter((option) => option.value !== asset.nodeId)}
                    onChange={(value) => void replicate(asset, value)}
                  />
                ) : null,
            },
          ]}
        />
      </Card>

      <Card title={t('videoNodes.jobs')}>
        <Table
          rowKey="id"
          loading={jobs.isLoading}
          dataSource={jobs.data?.items ?? []}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 900 }}
          columns={[
            { title: t('videoNodes.jobSource'), dataIndex: 'sourceName' },
            { title: t('videoNodes.jobTarget'), dataIndex: 'targetName' },
            {
              title: t('videoNodes.jobStatus'),
              dataIndex: 'status',
              render: (status: string) => (
                <Tag
                  color={
                    status === 'done'
                      ? 'green'
                      : status === 'failed'
                        ? 'red'
                        : status === 'running'
                          ? 'blue'
                          : 'default'
                  }
                >
                  {jobStatusLabel[status] ?? status}
                </Tag>
              ),
            },
            { title: t('videoNodes.jobAttempts'), dataIndex: 'attempts' },
            {
              title: t('videoNodes.jobError'),
              dataIndex: 'error',
              render: (value: string | null) =>
                value ? (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    {value}
                  </Text>
                ) : (
                  '-'
                ),
            },
            {
              title: t('videoNodes.actions'),
              key: 'actions',
              render: (_value, job) =>
                job.status === 'failed' ? (
                  <Button size="small" onClick={() => void retryJob(job)}>
                    {t('videoNodes.retry')}
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? t('videoNodes.editNode') : t('videoNodes.addNode')}
        open={creating || Boolean(editing)}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
        }}
        onOk={() => void saveNode()}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t('videoNodes.name')}
            rules={[{ required: true, message: t('videoNodes.name') }]}
          >
            <Input maxLength={80} />
          </Form.Item>
          <Form.Item
            name="baseUrl"
            label={t('videoNodes.baseUrl')}
            rules={[{ required: true, type: 'url', message: t('videoNodes.baseUrl') }]}
          >
            <Input placeholder="https://video-node.example.com" maxLength={500} />
          </Form.Item>
          <Space size="large" wrap>
            <Form.Item name="keyId" label={t('videoNodes.keyId')}>
              <Input style={{ width: 180 }} maxLength={64} />
            </Form.Item>
            <Form.Item name="region" label={t('videoNodes.region')}>
              <Input style={{ width: 120 }} maxLength={8} placeholder="CN" />
            </Form.Item>
            <Form.Item name="weight" label={t('videoNodes.weight')}>
              <InputNumber min={1} max={1000} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="maxConcurrency" label={t('videoNodes.maxConcurrency')}>
              <InputNumber min={1} max={64} style={{ width: 120 }} />
            </Form.Item>
          </Space>
          <Form.Item
            name="regions"
            label={t('videoNodes.regions')}
            extra={t('videoNodes.regionsHint')}
          >
            <Input placeholder="CN,HK,JP" />
          </Form.Item>
          <Form.Item
            name="secret"
            label={t('videoNodes.secret')}
            extra={editing ? t('videoNodes.secretHint') : undefined}
            rules={editing ? [] : [{ required: true, message: t('videoNodes.secret') }]}
          >
            <Input.Password autoComplete="new-password" maxLength={500} />
          </Form.Item>
          <Form.Item name="enabled" label={t('videoNodes.enabled')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
