# Webhook工具 配置管理指南

本文档介绍Webhook工具的配置管理系统，包括配置文件结构、环境变量支持、配置验证等功能。

## 目录

- [配置系统概述](#配置系统概述)
- [配置文件结构](#配置文件结构)
- [环境变量支持](#环境变量支持)
- [配置验证](#配置验证)
- [API接口](#api接口)
- [前端界面](#前端界面)
- [使用示例](#使用示例)
- [最佳实践](#最佳实践)

## 配置系统概述

Webhook工具采用分层配置管理架构，支持：

- **多环境配置**：开发、测试、生产环境独立配置
- **环境变量覆盖**：支持通过环境变量动态覆盖配置
- **配置验证**：基于JSON Schema的配置验证
- **热重载**：支持运行时重新加载配置
- **配置管理界面**：可视化的配置管理界面

## 配置文件结构

### 配置文件层次

```
config/
├── default.json          # 默认配置（基础配置）
├── development.json      # 开发环境配置
├── production.json       # 生产环境配置
├── test.json            # 测试环境配置
├── local.json           # 本地配置（可选，不提交到版本控制）
└── schema.json          # 配置验证模式
```

### 配置优先级

配置加载优先级（从高到低）：
1. 环境变量覆盖
2. 本地配置文件 (`local.json`)
3. 环境特定配置文件 (`development.json`, `production.json`, `test.json`)
4. 默认配置文件 (`default.json`)

### 配置分类

#### 服务器配置 (`server`)
```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0",
    "timeout": 30000,
    "maxBodySize": "100mb"
  }
}
```

#### Webhook配置 (`webhook`)
```json
{
  "webhook": {
    "maxPayloadSize": "10mb",
    "rateLimit": {
      "windowMs": 900000,
      "max": 100,
      "message": "请求过于频繁，请稍后再试"
    },
    "security": {
      "enableIpWhitelist": false,
      "ipWhitelist": [],
      "enableSignature": false,
      "signatureSecret": "",
      "enableRateLimit": true
    }
  }
}
```

#### 日志配置 (`logging`)
```json
{
  "logging": {
    "level": "info",
    "maxSize": "100mb",
    "maxFiles": 5,
    "retentionDays": 30,
    "format": "combined"
  }
}
```

#### 存储配置 (`storage`)
```json
{
  "storage": {
    "type": "memory",
    "maxLogs": 10000,
    "cleanupInterval": 3600000
  }
}
```

#### 监控配置 (`monitoring`)
```json
{
  "monitoring": {
    "enableMetrics": true,
    "metricsPath": "/metrics",
    "healthCheckPath": "/health",
    "enableHealthCheck": true
  }
}
```

#### 界面配置 (`ui`)
```json
{
  "ui": {
    "theme": "auto",
    "language": "zh-CN",
    "pageSize": 50,
    "autoRefresh": true,
    "refreshInterval": 30000
  }
}
```

## 环境变量支持

### 环境变量映射

| 环境变量 | 配置路径 | 说明 |
|----------|----------|------|
| `SERVER_PORT` | `server.port` | 服务器端口 |
| `SERVER_HOST` | `server.host` | 服务器地址 |
| `SERVER_TIMEOUT` | `server.timeout` | 请求超时时间 |
| `WEBHOOK_MAX_PAYLOAD_SIZE` | `webhook.maxPayloadSize` | Webhook最大负载 |
| `WEBHOOK_RATE_LIMIT_MAX` | `webhook.rateLimit.max` | 限流最大请求数 |
| `LOGGING_LEVEL` | `logging.level` | 日志级别 |
| `STORAGE_TYPE` | `storage.type` | 存储类型 |
| `MONITORING_ENABLE_METRICS` | `monitoring.enableMetrics` | 是否启用指标 |

### 环境变量使用示例

```bash
# 设置服务器端口
export SERVER_PORT=8080

# 设置日志级别
export LOGGING_LEVEL=debug

# 设置存储类型
export STORAGE_TYPE=redis

# 启动应用
npm start
```

## 配置验证

### JSON Schema验证

配置系统使用JSON Schema进行配置验证，确保：

- 数据类型正确性
- 必填字段完整性
- 数值范围有效性
- 枚举值合法性

### 验证规则示例

```json
{
  "server": {
    "port": {
      "type": "integer",
      "minimum": 1,
      "maximum": 65535,
      "default": 3000
    },
    "host": {
      "type": "string",
      "default": "0.0.0.0"
    }
  }
}
```

## API接口

### 配置管理API

#### 获取配置信息
```http
GET /api/config
```

#### 获取配置摘要
```http
GET /api/config/summary
```

#### 获取环境信息
```http
GET /api/config/environment
```

#### 获取特定配置值
```http
GET /api/config/{path}
```

#### 设置配置值
```http
PUT /api/config/{path}
Content-Type: application/json

{
  "value": "newValue"
}
```

#### 重新加载配置
```http
POST /api/config/reload
```

#### 获取配置文件列表
```http
GET /api/config/files/list
```

#### 获取配置文件内容
```http
GET /api/config/files/{filename}
```

#### 保存配置文件
```http
POST /api/config/files/{filename}
Content-Type: application/json

{
  "config": { ... }
}
```

#### 删除配置文件
```http
DELETE /api/config/files/{filename}
```

#### 验证配置
```http
POST /api/config/validate
Content-Type: application/json

{
  "config": { ... }
}
```

#### 导出配置
```http
GET /api/config/export/{format}
```

支持的导出格式：
- `json` - JSON格式
- `env` - 环境变量格式

## 前端界面

### 配置管理界面

访问 `/config-manager.html` 可以打开配置管理界面，支持：

- **配置概览**：显示主要配置项
- **分类管理**：按功能模块组织配置
- **实时编辑**：支持在线修改配置
- **配置验证**：实时验证配置有效性
- **配置导出**：支持多种格式导出

### 界面功能

- 配置项分类展示
- 实时配置验证
- 配置热重载
- 配置导出功能
- 响应式设计

## 使用示例

### 1. 基础配置

创建 `config/local.json` 文件：

```json
{
  "server": {
    "port": 8080,
    "host": "localhost"
  },
  "logging": {
    "level": "debug"
  }
}
```

### 2. 环境变量配置

```bash
# 开发环境
export NODE_ENV=development
export SERVER_PORT=3000
export LOGGING_LEVEL=debug

# 生产环境
export NODE_ENV=production
export SERVER_PORT=80
export LOGGING_LEVEL=warn
export STORAGE_TYPE=file
```

### 3. 程序中使用配置

```javascript
const config = require('./lib/config');

// 获取配置值
const port = config.get('server.port', 3000);
const logLevel = config.get('logging.level', 'info');

// 获取配置摘要
const summary = config.getSummary();

// 检查配置有效性
if (config.isValid()) {
    console.log('配置有效');
} else {
    console.error('配置无效');
}
```

### 4. 动态更新配置

```javascript
// 设置配置值
config.setConfigValue('server.port', 8080);

// 重新加载配置
config.reload();

// 保存配置到文件
config.saveConfig('custom.json', customConfig);
```

## 最佳实践

### 1. 配置文件管理

- 将敏感信息（如密钥、密码）放在环境变量中
- 使用 `local.json` 存储本地开发配置
- 不要将 `local.json` 提交到版本控制系统
- 定期备份生产环境配置

### 2. 环境变量使用

- 使用大写字母和下划线分隔
- 为环境变量添加有意义的默认值
- 在生产环境中使用强密码和密钥
- 避免在代码中硬编码敏感信息

### 3. 配置验证

- 为所有配置项定义验证规则
- 在应用启动时验证配置完整性
- 提供清晰的错误信息
- 支持配置热重载

### 4. 安全考虑

- 限制配置管理API的访问权限
- 对敏感配置进行加密存储
- 记录配置变更日志
- 定期审查配置安全性

### 5. 性能优化

- 缓存配置值避免重复读取
- 使用配置摘要减少数据传输
- 支持配置增量更新
- 优化配置文件加载性能

## 故障排除

### 常见问题

#### 1. 配置加载失败

**症状**：应用启动时显示配置加载失败
**解决方案**：
- 检查配置文件语法是否正确
- 确认配置文件路径是否正确
- 检查文件权限设置

#### 2. 配置验证失败

**症状**：配置更新后验证失败
**解决方案**：
- 检查配置值类型是否正确
- 确认必填字段是否完整
- 验证数值范围是否合法

#### 3. 环境变量不生效

**症状**：设置环境变量后配置未更新
**解决方案**：
- 确认环境变量名称是否正确
- 检查环境变量映射配置
- 重启应用使环境变量生效

#### 4. 配置热重载失败

**症状**：配置重载后应用异常
**解决方案**：
- 检查新配置的有效性
- 确认配置变更的兼容性
- 查看应用日志获取详细错误信息

### 调试技巧

1. **启用调试日志**：设置 `DEBUG=webhook:*` 环境变量
2. **检查配置状态**：访问 `/api/config` 查看当前配置
3. **验证配置格式**：使用JSON验证工具检查配置文件
4. **查看环境信息**：访问 `/api/config/environment` 查看环境变量

## 联系支持

如果在使用配置管理系统时遇到问题，请：

1. 查看本文档的故障排除部分
2. 检查应用日志获取详细错误信息
3. 提交Issue到项目仓库
4. 联系技术支持团队

---

**注意**: 生产环境部署前，请仔细检查配置安全性，确保敏感信息得到妥善保护。
