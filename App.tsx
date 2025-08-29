import React, { useState, useEffect } from 'react';
import { 
  Layout, Typography, Card, Row, Col, Tag, Button, Space, 
  Input, Modal, Form, Select, InputNumber, message, List, Avatar,
  Switch, Tooltip, Empty, Spin, Tabs, Statistic, Progress, 
  Descriptions, Alert, Divider
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ReloadOutlined, DownloadOutlined, ClearOutlined,
  CopyOutlined, SettingOutlined, DashboardOutlined, 
  SecurityScanOutlined, CleaningServicesOutlined
} from '@ant-design/icons';
import io from 'socket.io-client';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

interface Webhook {
  id: string;
  name: string;
  customPath: string;
  description: string;
  enabled: boolean;
  delayType: 'none' | 'fixed' | 'random';
  delayValue?: number;
  delayMin?: number;
  delayMax?: number;
  createdAt: string;
  url: string;
}

interface WebhookLog {
  id: string;
  timestamp: string;
  method: string;
  headers: Record<string, any>;
  body: any;
  ip: string;
  userAgent: string;
  type?: string;
  tenantId?: number;
  uniqueId?: string;
}


const App: React.FC = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [searchText, setSearchText] = useState('');
  const [logSearchText, setLogSearchText] = useState('');
  const [, setSocket] = useState<any>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  
  // 新增状态
  const [activeTab, setActiveTab] = useState('webhooks');
  const [systemStats, setSystemStats] = useState<any>({});
  const [securityConfig, setSecurityConfig] = useState<any>({});
  const [cleanupConfig, setCleanupConfig] = useState<any>({});
  const [asyncStatus, setAsyncStatus] = useState<any>({});
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [configType, setConfigType] = useState<'security' | 'cleanup' | 'async'>('security');
  const [configForm] = Form.useForm();

  // 初始化Socket连接
  useEffect(() => {
    const socketConnection = io();
    setSocket(socketConnection);

    socketConnection.on('webhook-request', (data: any) => {
      if (data.webhookId === selectedWebhook) {
        setWebhookLogs(prev => [data.log, ...prev.slice(0, 999)]);
      }
    });

    socketConnection.on('webhook-updated', () => {
      loadWebhooks();
    });

    return () => {
      socketConnection.disconnect();
    };
  }, [selectedWebhook]);

  // 加载数据
  useEffect(() => {
    loadWebhooks();
    loadSystemStats();
    loadSecurityConfig();
    loadCleanupConfig();
    loadAsyncStatus();
    
    // 定时刷新统计数据
    const interval = setInterval(() => {
      if (activeTab === 'dashboard') {
        loadSystemStats();
        loadAsyncStatus();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [activeTab]);

  // 当选择webhook时加载日志
  useEffect(() => {
    if (selectedWebhook) {
      loadWebhookLogs(selectedWebhook);
    }
  }, [selectedWebhook]);

  const loadWebhooks = async () => {
    try {
      const response = await fetch('/api/webhooks');
      const data = await response.json();
      // 确保data是数组
      const webhookArray = Array.isArray(data) ? data : [];
      setWebhooks(webhookArray);
      if (!selectedWebhook && webhookArray.length > 0) {
        setSelectedWebhook(webhookArray[0].id);
      }
    } catch (error) {
      console.error('加载Webhook列表失败:', error);
      message.error('加载Webhook列表失败');
      setWebhooks([]);
    }
  };

  const loadWebhookLogs = async (webhookId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/webhooks/${webhookId}/logs`);
      const data = await response.json();
      // 确保data是数组
      const logsArray = Array.isArray(data) ? data : [];
      setWebhookLogs(logsArray);
    } catch (error) {
      console.error('加载日志失败:', error);
      message.error('加载日志失败');
      setWebhookLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // 加载系统统计
  const loadSystemStats = async () => {
    try {
      const response = await fetch('/api/system/status');
      const data = await response.json();
      setSystemStats(data);
    } catch (error) {
      console.error('加载系统统计失败:', error);
    }
  };

  // 加载安全配置
  const loadSecurityConfig = async () => {
    try {
      const response = await fetch('/api/security/config');
      const data = await response.json();
      setSecurityConfig(data);
    } catch (error) {
      console.error('加载安全配置失败:', error);
    }
  };

  // 加载清理配置
  const loadCleanupConfig = async () => {
    try {
      const response = await fetch('/api/cleanup/config');
      const data = await response.json();
      setCleanupConfig(data.data || {});
    } catch (error) {
      console.error('加载清理配置失败:', error);
    }
  };

  // 加载异步状态
  const loadAsyncStatus = async () => {
    try {
      const response = await fetch('/api/async/status');
      const data = await response.json();
      setAsyncStatus(data.data || {});
    } catch (error) {
      console.error('加载异步状态失败:', error);
    }
  };


  const createWebhook = async (values: any) => {
    try {
      const response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      
      if (response.ok) {
        message.success('Webhook创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        loadWebhooks();
      } else {
        message.error('创建失败');
      }
    } catch (error) {
      message.error('创建失败');
    }
  };

  const updateWebhook = async (values: any) => {
    if (!editingWebhook) return;
    
    try {
      const response = await fetch(`/api/webhooks/${editingWebhook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      
      if (response.ok) {
        message.success('Webhook更新成功');
        setEditModalVisible(false);
        setEditingWebhook(null);
        editForm.resetFields();
        loadWebhooks();
      } else {
        message.error('更新失败');
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const deleteWebhook = async (id: string) => {
    try {
      const response = await fetch(`/api/webhooks/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        message.success('Webhook删除成功');
        loadWebhooks();
        if (selectedWebhook === id) {
          setSelectedWebhook(null);
          setWebhookLogs([]);
        }
      } else {
        message.error('删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const toggleWebhook = async (id: string, enabled: boolean) => {
    const webhook = webhooks.find(w => w.id === id);
    if (!webhook) return;

    try {
      const response = await fetch(`/api/webhooks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...webhook, enabled })
      });
      
      if (response.ok) {
        message.success(`Webhook已${enabled ? '启用' : '禁用'}`);
        loadWebhooks();
      } else {
        message.error('操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const exportLogs = async (webhookId: string) => {
    try {
      const response = await fetch(`/api/webhooks/${webhookId}/export`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `webhook-logs-${webhookId}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  // 配置管理函数
  const openConfigModal = (type: 'security' | 'cleanup' | 'async') => {
    setConfigType(type);
    setConfigModalVisible(true);
    
    // 根据类型设置表单初始值
    if (type === 'security') {
      configForm.setFieldsValue(securityConfig);
    } else if (type === 'cleanup') {
      configForm.setFieldsValue(cleanupConfig);
    } else if (type === 'async') {
      configForm.setFieldsValue(asyncStatus.config || {});
    }
  };

  const saveConfig = async (values: any) => {
    try {
      let endpoint = '';
      if (configType === 'security') {
        endpoint = '/api/security/config';
      } else if (configType === 'cleanup') {
        endpoint = '/api/cleanup/config';
      } else if (configType === 'async') {
        endpoint = '/api/async/config';
      }

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });

      if (response.ok) {
        message.success('配置保存成功');
        setConfigModalVisible(false);
        configForm.resetFields();
        
        // 重新加载配置
        if (configType === 'security') {
          loadSecurityConfig();
        } else if (configType === 'cleanup') {
          loadCleanupConfig();
        } else if (configType === 'async') {
          loadAsyncStatus();
        }
      } else {
        message.error('配置保存失败');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      message.error('保存配置失败');
    }
  };

  const triggerCleanup = async () => {
    try {
      const response = await fetch('/api/cleanup/trigger', {
        method: 'POST'
      });
      
      if (response.ok) {
        message.success('数据清理已触发');
        loadSystemStats();
      } else {
        message.error('触发清理失败');
      }
    } catch (error) {
      console.error('触发清理失败:', error);
      message.error('触发清理失败');
    }
  };

  const clearLogs = async (webhookId: string) => {
    try {
      const response = await fetch(`/api/webhooks/${webhookId}/logs`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        message.success('日志已清空');
        setWebhookLogs([]);
      } else {
        message.error('清空失败');
      }
    } catch (error) {
      message.error('清空失败');
    }
  };


  // 过滤webhooks
  const filteredWebhooks = webhooks.filter(webhook =>
    webhook.name.toLowerCase().includes(searchText.toLowerCase()) ||
    webhook.description.toLowerCase().includes(searchText.toLowerCase())
  );

  // 过滤日志
  const filteredLogs = webhookLogs.filter(log => {
    if (!logSearchText) return true;
    const searchLower = logSearchText.toLowerCase();
    return (
      log.tenantId?.toString().includes(searchLower) ||
      log.uniqueId?.toLowerCase().includes(searchLower) ||
      log.type?.toLowerCase().includes(searchLower) ||
      JSON.stringify(log.body).toLowerCase().includes(searchLower)
    );
  });

  const getStatusColor = (type?: string) => {
    switch (type) {
      case 'ALARM': return 'red';
      case 'INFO': return 'blue';
      case 'SUCCESS': return 'green';
      default: return 'default';
    }
  };

  const selectedWebhookData = webhooks.find(w => w.id === selectedWebhook);

  return (
    <Layout style={{ minHeight: '100vh', width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Title level={3} style={{ margin: 0, color: 'white' }}>
          Webhook 管理工具
        </Title>
        <Space>
          <Button 
            type="text" 
            icon={<SettingOutlined />}
            style={{ color: 'white' }}
            onClick={() => openConfigModal('security')}
          >
            配置
          </Button>
        </Space>
      </Header>

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        style={{ padding: '0 24px', background: '#fff' }}
        items={[
          {
            key: 'webhooks',
            label: (
              <span>
                <PlusOutlined />
                Webhook 管理
              </span>
            )
          },
          {
            key: 'dashboard',
            label: (
              <span>
                <DashboardOutlined />
                系统面板
              </span>
            )
          }
        ]}
      />

      {activeTab === 'webhooks' && (
        <Layout style={{ flex: 1, display: 'flex' }}>
          <Sider width={350} style={{ background: '#fff', borderRight: '1px solid #f0f0f0', height: '100%', overflow: 'auto' }}>
          <div style={{ padding: '16px' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => setCreateModalVisible(true)}
                block
              >
                创建 Webhook
              </Button>
              
              <Search
                placeholder="搜索 Webhook"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: '100%' }}
              />
            </Space>
          </div>

          <List
            dataSource={filteredWebhooks}
            renderItem={(webhook) => (
              <List.Item
                style={{
                  padding: '12px 16px',
                  backgroundColor: selectedWebhook === webhook.id ? '#e6f7ff' : 'transparent',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedWebhook(webhook.id)}
                actions={[
                  <Switch
                    key="switch"
                    size="small"
                    checked={webhook.enabled}
                    onChange={(checked, e) => {
                      e.stopPropagation();
                      toggleWebhook(webhook.id, checked);
                    }}
                  />,
                  <Button
                    key="edit"
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingWebhook(webhook);
                      editForm.setFieldsValue(webhook);
                      setEditModalVisible(true);
                    }}
                  />,
                  <Button
                    key="delete"
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      Modal.confirm({
                        title: '确认删除',
                        content: `确定要删除 "${webhook.name}" 吗？`,
                        onOk: () => deleteWebhook(webhook.id)
                      });
                    }}
                  />
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar 
                      style={{ 
                        backgroundColor: webhook.enabled ? '#52c41a' : '#d9d9d9' 
                      }}
                    >
                      {webhook.name.charAt(0).toUpperCase()}
                    </Avatar>
                  }
                  title={
                    <Space>
                      <Text strong>{webhook.name}</Text>
                      {!webhook.enabled && <Tag color="red">已禁用</Tag>}
                    </Space>
                  }
                  description={
                    <div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {webhook.description}
                      </Text>
                      <br />
                      <Text code style={{ fontSize: '11px' }}>
                        {webhook.customPath}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Sider>

        <Content style={{ padding: '24px', background: '#f5f5f5', flex: 1, overflow: 'auto' }}>
          {selectedWebhookData ? (
            <div>
              <Card 
                title={
                  <Space>
                    <Text strong>{selectedWebhookData.name}</Text>
                    <Tag color={selectedWebhookData.enabled ? 'green' : 'red'}>
                      {selectedWebhookData.enabled ? '已启用' : '已禁用'}
                    </Tag>
                  </Space>
                }
                extra={
                  <Space>
                    <Tooltip title="复制URL">
                      <Button 
                        icon={<CopyOutlined />}
                        onClick={() => copyToClipboard(selectedWebhookData.url)}
                      />
                    </Tooltip>
                    <Button 
                      icon={<DownloadOutlined />}
                      onClick={() => exportLogs(selectedWebhookData.id)}
                    >
                      导出
                    </Button>
                    <Button 
                      icon={<ClearOutlined />}
                      onClick={() => clearLogs(selectedWebhookData.id)}
                    >
                      清空日志
                    </Button>
                    <Button 
                      icon={<ReloadOutlined />}
                      onClick={() => loadWebhookLogs(selectedWebhookData.id)}
                    >
                      刷新
                    </Button>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Text strong>URL: </Text>
                    <Text code>{selectedWebhookData.url}</Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>描述: </Text>
                    <Text>{selectedWebhookData.description}</Text>
                  </Col>
                </Row>
              </Card>

              <Card 
                title={
                  <Space>
                    <Text>实时日志</Text>
                    <Tag color="blue">最多保留1000条</Tag>
                  </Space>
                }
                extra={
                  <Search
                    placeholder="搜索 tenantId, uniqueId, type..."
                    value={logSearchText}
                    onChange={(e) => setLogSearchText(e.target.value)}
                    style={{ width: 300 }}
                  />
                }
              >
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '50px' }}>
                    <Spin size="large" />
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <Empty description="暂无日志数据" />
                ) : (
                  <List
                    dataSource={filteredLogs}
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    renderItem={(log) => (
                      <List.Item>
                        <Card 
                          size="small" 
                          style={{ width: '100%' }}
                          title={
                            <Space>
                              <Tag color={getStatusColor(log.type)}>
                                {log.type || 'UNKNOWN'}
                              </Tag>
                              <Text>{log.timestamp}</Text>
                              <Text type="secondary">{log.method}</Text>
                              <Text type="secondary">{log.ip}</Text>
                            </Space>
                          }
                        >
                          <Row gutter={16}>
                            <Col span={12}>
                              <Text strong>请求头:</Text>
                              <pre style={{ 
                                background: '#f5f5f5', 
                                padding: '8px', 
                                borderRadius: '4px',
                                fontSize: '12px',
                                maxHeight: '200px',
                                overflow: 'auto'
                              }}>
                                {JSON.stringify(log.headers, null, 2)}
                              </pre>
                            </Col>
                            <Col span={12}>
                              <Text strong>请求体:</Text>
                              <pre style={{ 
                                background: '#f5f5f5', 
                                padding: '8px', 
                                borderRadius: '4px',
                                fontSize: '12px',
                                maxHeight: '200px',
                                overflow: 'auto'
                              }}>
                                {JSON.stringify(log.body, null, 2)}
                              </pre>
                            </Col>
                          </Row>
                          {(log.tenantId || log.uniqueId) && (
                            <div style={{ marginTop: '8px' }}>
                              <Space>
                                {log.tenantId && <Tag>租户ID: {log.tenantId}</Tag>}
                                {log.uniqueId && <Tag>唯一ID: {log.uniqueId}</Tag>}
                              </Space>
                            </div>
                          )}
                        </Card>
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </div>
          ) : (
            <Empty 
              description="请选择一个 Webhook 查看日志"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </Content>
      </Layout>

      {/* 创建 Webhook 模态框 */}
      <Modal
        title="创建 Webhook"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
        style={{ maxHeight: '80vh' }}
        bodyStyle={{ maxHeight: '60vh', overflowY: 'auto' }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={createWebhook}
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="输入 Webhook 名称" />
          </Form.Item>

          <Form.Item
            name="customPath"
            label="自定义路径"
            rules={[{ required: true, message: '请输入路径' }]}
          >
            <Input placeholder="例如: /my-webhook" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="输入描述信息" />
          </Form.Item>

          <Form.Item
            name="delayType"
            label="延时类型"
            initialValue="none"
          >
            <Select>
              <Option value="none">无延时</Option>
              <Option value="fixed">固定延时</Option>
              <Option value="random">随机延时</Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.delayType !== currentValues.delayType
            }
          >
            {({ getFieldValue }) => {
              const delayType = getFieldValue('delayType');
              
              if (delayType === 'fixed') {
                return (
                  <Form.Item
                    name="delayValue"
                    label="延时时间 (毫秒)"
                    rules={[
                      { required: true, message: '请输入延时时间' },
                      { type: 'number', min: 0, max: 100000, message: '延时时间必须在0-100000毫秒之间' }
                    ]}
                  >
                    <InputNumber 
                      placeholder="输入延时时间" 
                      style={{ width: '100%' }}
                      min={0}
                      max={100000}
                    />
                  </Form.Item>
                );
              }
              
              if (delayType === 'random') {
                return (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="delayMin"
                        label="最小延时 (毫秒)"
                        rules={[
                          { required: true, message: '请输入最小延时' },
                          { type: 'number', min: 0, max: 100000, message: '延时时间必须在0-100000毫秒之间' }
                        ]}
                      >
                        <InputNumber 
                          placeholder="最小延时" 
                          style={{ width: '100%' }}
                          min={0}
                          max={100000}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="delayMax"
                        label="最大延时 (毫秒)"
                        rules={[
                          { required: true, message: '请输入最大延时' },
                          { type: 'number', min: 0, max: 100000, message: '延时时间必须在0-100000毫秒之间' }
                        ]}
                      >
                        <InputNumber 
                          placeholder="最大延时" 
                          style={{ width: '100%' }}
                          min={0}
                          max={100000}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                );
              }
              
              return null;
            }}
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setCreateModalVisible(false);
                form.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑 Webhook 模态框 */}
      <Modal
        title="编辑 Webhook"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingWebhook(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
        style={{ maxHeight: '80vh' }}
        bodyStyle={{ maxHeight: '60vh', overflowY: 'auto' }}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={updateWebhook}
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="输入 Webhook 名称" />
          </Form.Item>

          <Form.Item
            name="customPath"
            label="自定义路径"
            rules={[{ required: true, message: '请输入路径' }]}
          >
            <Input placeholder="例如: /my-webhook" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="输入描述信息" />
          </Form.Item>

          <Form.Item
            name="delayType"
            label="延时类型"
          >
            <Select>
              <Option value="none">无延时</Option>
              <Option value="fixed">固定延时</Option>
              <Option value="random">随机延时</Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.delayType !== currentValues.delayType
            }
          >
            {({ getFieldValue }) => {
              const delayType = getFieldValue('delayType');
              
              if (delayType === 'fixed') {
                return (
                  <Form.Item
                    name="delayValue"
                    label="延时时间 (毫秒)"
                    rules={[
                      { required: true, message: '请输入延时时间' },
                      { type: 'number', min: 0, max: 100000, message: '延时时间必须在0-100000毫秒之间' }
                    ]}
                  >
                    <InputNumber 
                      placeholder="输入延时时间" 
                      style={{ width: '100%' }}
                      min={0}
                      max={100000}
                    />
                  </Form.Item>
                );
              }
              
              if (delayType === 'random') {
                return (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="delayMin"
                        label="最小延时 (毫秒)"
                        rules={[
                          { required: true, message: '请输入最小延时' },
                          { type: 'number', min: 0, max: 100000, message: '延时时间必须在0-100000毫秒之间' }
                        ]}
                      >
                        <InputNumber 
                          placeholder="最小延时" 
                          style={{ width: '100%' }}
                          min={0}
                          max={100000}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="delayMax"
                        label="最大延时 (毫秒)"
                        rules={[
                          { required: true, message: '请输入最大延时' },
                          { type: 'number', min: 0, max: 100000, message: '延时时间必须在0-100000毫秒之间' }
                        ]}
                      >
                        <InputNumber 
                          placeholder="最大延时" 
                          style={{ width: '100%' }}
                          min={0}
                          max={100000}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                );
              }
              
              return null;
            }}
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setEditModalVisible(false);
                setEditingWebhook(null);
                editForm.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      )}

      {activeTab === 'dashboard' && (
        <div style={{ padding: '24px', background: '#f5f5f5', minHeight: 'calc(100vh - 112px)' }}>
          <Row gutter={[16, 16]}>
            {/* 系统统计 */}
            <Col span={24}>
              <Card title="系统统计" extra={
                <Button icon={<ReloadOutlined />} onClick={loadSystemStats}>
                  刷新
                </Button>
              }>
                <Row gutter={16}>
                  <Col span={6}>
                    <Statistic 
                      title="总请求数" 
                      value={systemStats.totalRequests || 0} 
                      valueStyle={{ color: '#3f8600' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="Webhook数量" 
                      value={systemStats.webhookCount || 0}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="运行时间" 
                      value={Math.floor((systemStats.uptime || 0) / 3600)}
                      suffix="小时"
                      valueStyle={{ color: '#722ed1' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="活跃IP" 
                      value={securityConfig.rateLimiting?.activeIPs || 0}
                      valueStyle={{ color: '#fa8c16' }}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* 异步队列状态 */}
            <Col span={12}>
              <Card 
                title="异步队列状态" 
                extra={
                  <Button 
                    icon={<SettingOutlined />} 
                    onClick={() => openConfigModal('async')}
                  >
                    配置
                  </Button>
                }
              >
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="队列长度">
                    {asyncStatus.queue?.length || 0}
                  </Descriptions.Item>
                  <Descriptions.Item label="活跃工作者">
                    {asyncStatus.queue?.activeWorkers || 0}
                  </Descriptions.Item>
                  <Descriptions.Item label="已处理">
                    {asyncStatus.queue?.totalProcessed || 0}
                  </Descriptions.Item>
                  <Descriptions.Item label="失败数">
                    {asyncStatus.queue?.totalFailed || 0}
                  </Descriptions.Item>
                </Descriptions>
                
                {asyncStatus.config && (
                  <Progress 
                    percent={Math.round((asyncStatus.queue?.length || 0) / asyncStatus.config.queueSize * 100)}
                    status={asyncStatus.queue?.length > asyncStatus.config.queueSize * 0.8 ? 'exception' : 'normal'}
                    format={() => `${asyncStatus.queue?.length || 0}/${asyncStatus.config.queueSize}`}
                  />
                )}
              </Card>
            </Col>

            {/* 安全配置 */}
            <Col span={12}>
              <Card 
                title="安全配置" 
                extra={
                  <Button 
                    icon={<SecurityScanOutlined />} 
                    onClick={() => openConfigModal('security')}
                  >
                    配置
                  </Button>
                }
              >
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="IP白名单">
                    {securityConfig.enableIpWhitelist ? 
                      <Tag color="green">已启用 ({securityConfig.ipWhitelist?.length || 0}个)</Tag> : 
                      <Tag color="red">已禁用</Tag>
                    }
                  </Descriptions.Item>
                  <Descriptions.Item label="速率限制">
                    {securityConfig.rateLimiting?.enabled ? 
                      <Tag color="green">已启用</Tag> : 
                      <Tag color="red">已禁用</Tag>
                    }
                  </Descriptions.Item>
                  <Descriptions.Item label="请求签名">
                    {securityConfig.requestSignature?.enabled ? 
                      <Tag color="green">已启用</Tag> : 
                      <Tag color="red">已禁用</Tag>
                    }
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>

            {/* 数据清理 */}
            <Col span={24}>
              <Card 
                title="数据清理" 
                extra={
                  <Space>
                    <Button 
                      icon={<CleaningServicesOutlined />} 
                      onClick={triggerCleanup}
                    >
                      立即清理
                    </Button>
                    <Button 
                      icon={<SettingOutlined />} 
                      onClick={() => openConfigModal('cleanup')}
                    >
                      配置
                    </Button>
                  </Space>
                }
              >
                <Row gutter={16}>
                  <Col span={8}>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="自动清理">
                        {cleanupConfig.enabled ? 
                          <Tag color="green">已启用</Tag> : 
                          <Tag color="red">已禁用</Tag>
                        }
                      </Descriptions.Item>
                      <Descriptions.Item label="清理间隔">
                        {Math.round((cleanupConfig.interval || 0) / 60000)}分钟
                      </Descriptions.Item>
                    </Descriptions>
                  </Col>
                  <Col span={8}>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="最大日志数">
                        {cleanupConfig.maxLogsPerWebhook || 0}条/Webhook
                      </Descriptions.Item>
                      <Descriptions.Item label="日志保留时间">
                        {Math.round((cleanupConfig.maxLogAge || 0) / 3600000)}小时
                      </Descriptions.Item>
                    </Descriptions>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </div>
      )}

      {/* 配置模态框 */}
      <Modal
        title={`${configType === 'security' ? '安全' : configType === 'cleanup' ? '数据清理' : '异步处理'}配置`}
        open={configModalVisible}
        onCancel={() => {
          setConfigModalVisible(false);
          configForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={configForm}
          layout="vertical"
          onFinish={saveConfig}
        >
          {configType === 'security' && (
            <>
              <Form.Item
                name="enableIpWhitelist"
                label="启用IP白名单"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              
              <Form.Item
                name="ipWhitelist"
                label="IP白名单 (每行一个IP)"
              >
                <Input.TextArea 
                  placeholder="192.168.1.1&#10;10.0.0.1"
                  rows={4}
                />
              </Form.Item>

              <Form.Item
                name={['rateLimiting', 'enabled']}
                label="启用速率限制"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['rateLimiting', 'maxRequests']}
                    label="最大请求数"
                  >
                    <InputNumber min={1} max={10000} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['rateLimiting', 'windowMs']}
                    label="时间窗口(分钟)"
                  >
                    <InputNumber 
                      min={1} 
                      max={60} 
                      style={{ width: '100%' }}
                      formatter={value => `${value}分钟`}
                      parser={value => value?.replace('分钟', '') || ''}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {configType === 'cleanup' && (
            <>
              <Form.Item
                name="enabled"
                label="启用自动清理"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="interval"
                label="清理间隔(分钟)"
              >
                <InputNumber 
                  min={1} 
                  max={1440} 
                  style={{ width: '100%' }}
                  formatter={value => `${value}分钟`}
                  parser={value => value?.replace('分钟', '') || ''}
                />
              </Form.Item>

              <Form.Item
                name="maxLogsPerWebhook"
                label="每个Webhook最大日志数"
              >
                <InputNumber min={100} max={10000} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                name="maxLogAge"
                label="日志最大保留时间(小时)"
              >
                <InputNumber 
                  min={1} 
                  max={168} 
                  style={{ width: '100%' }}
                  formatter={value => `${value}小时`}
                  parser={value => value?.replace('小时', '') || ''}
                />
              </Form.Item>
            </>
          )}

          {configType === 'async' && (
            <>
              <Form.Item
                name="enabled"
                label="启用异步处理"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="maxConcurrent"
                    label="最大并发数"
                  >
                    <InputNumber min={1} max={20} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="queueSize"
                    label="队列大小"
                  >
                    <InputNumber min={100} max={10000} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="retryAttempts"
                    label="重试次数"
                  >
                    <InputNumber min={0} max={10} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="retryDelay"
                    label="重试延迟(ms)"
                  >
                    <InputNumber min={100} max={10000} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setConfigModalVisible(false);
                configForm.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default App;