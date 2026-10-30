import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Col, Form, Input, InputNumber, Row, Select, Switch } from 'antd';
import { useT } from '../i18n';

const ICONS = [
  'link',
  'home',
  'video',
  'star',
  'heart',
  'book',
  'users',
  'info',
  'music',
  'game',
  'download',
  'external',
];

const VISIBILITIES = ['all', 'guest', 'user', 'staff'];

function newItem(sort: number) {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: '',
    href: '/',
    icon: 'link',
    newTab: false,
    visibility: 'all',
    enabled: true,
    highlight: false,
    sort,
  };
}

function ItemList({ name, title }: { name: 'header' | 'footer'; title: string }) {
  const t = useT();
  return (
    <Form.List name={name}>
      {(fields, { add, remove }) => (
        <Card
          size="small"
          title={title}
          style={{ marginBottom: 16 }}
          extra={
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => add(newItem((fields.length + 1) * 10))}
              disabled={fields.length >= 12}
            >
              {t('添加按钮')}
            </Button>
          }
        >
          {fields.length === 0 && (
            <div className="muted" style={{ fontSize: 12 }}>
              {t('暂无自定义按钮，站点将只显示内置导航。')}
            </div>
          )}
          {fields.map((field) => (
            <Row key={field.key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
              <Col xs={24} md={6}>
                <Form.Item
                  name={[field.name, 'label']}
                  rules={[{ required: true, message: t('请输入名称') }]}
                  style={{ marginBottom: 0 }}
                >
                  <Input placeholder={t('显示名称')} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name={[field.name, 'href']}
                  rules={[{ required: true, message: t('请输入链接') }]}
                  style={{ marginBottom: 0 }}
                >
                  <Input placeholder="/rankings 或 https://example.com" />
                </Form.Item>
              </Col>
              <Col xs={12} md={4}>
                <Form.Item name={[field.name, 'icon']} style={{ marginBottom: 0 }}>
                  <Select options={ICONS.map((value) => ({ value, label: value }))} />
                </Form.Item>
              </Col>
              <Col xs={12} md={4}>
                <Form.Item name={[field.name, 'visibility']} style={{ marginBottom: 0 }}>
                  <Select
                    options={VISIBILITIES.map((value) => ({
                      value,
                      label:
                        value === 'all'
                          ? t('所有人')
                          : value === 'guest'
                            ? t('仅游客')
                            : value === 'user'
                              ? t('仅登录用户')
                              : t('仅员工'),
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={8} md={2}>
                <Form.Item name={[field.name, 'sort']} style={{ marginBottom: 0 }}>
                  <InputNumber style={{ width: '100%' }} aria-label={t('排序')} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name={[field.name, 'newTab']}
                  valuePropName="checked"
                  style={{ marginBottom: 0 }}
                >
                  <Switch checkedChildren={t('新窗口')} unCheckedChildren={t('当前窗口')} />
                </Form.Item>
                <Form.Item
                  name={[field.name, 'enabled']}
                  valuePropName="checked"
                  style={{ marginBottom: 0, marginLeft: 8, display: 'inline-block' }}
                >
                  <Switch checkedChildren={t('启用')} unCheckedChildren={t('停用')} />
                </Form.Item>
                <Form.Item
                  name={[field.name, 'highlight']}
                  valuePropName="checked"
                  style={{ marginBottom: 0, marginLeft: 8, display: 'inline-block' }}
                >
                  <Switch checkedChildren={t('高亮')} unCheckedChildren={t('普通')} />
                </Form.Item>
                <Button
                  danger
                  type="text"
                  icon={<DeleteOutlined />}
                  style={{ marginLeft: 8 }}
                  onClick={() => remove(field.name)}
                  aria-label={t('删除')}
                />
              </Col>
              <Col xs={0} md={0}>
                <Form.Item name={[field.name, 'id']} hidden>
                  <Input />
                </Form.Item>
              </Col>
            </Row>
          ))}
        </Card>
      )}
    </Form.List>
  );
}

export function NavigationEditor() {
  const t = useT();
  return (
    <div>
      <ItemList name="header" title={t('顶部导航按钮')} />
      <ItemList name="footer" title={t('页脚按钮')} />
    </div>
  );
}
