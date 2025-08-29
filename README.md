# Webhook 管理工具

一个基于 React + Ant Design + Node.js 的现代化 Webhook 管理工具，提供实时监控、日志管理和数据分析功能。

## 功能特性

### 核心功能
- ✅ **多Webhook管理**: 支持创建、编辑、删除多个回调地址
- ✅ **实时日志监控**: 实时展示接收到的请求数据
- ✅ **智能数据展示**: 请求头和请求体分开展示，JSON格式化
- ✅ **启用/禁用控制**: 支持对回调地址进行启用、禁用操作
- ✅ **延时响应模拟**: 支持固定延时和随机延时，模拟真实场景
- ✅ **备注信息管理**: 支持给回调地址添加描述信息

### 高级功能
- ✅ **按名称搜索**: 左侧webhook列表支持按名称搜索
- ✅ **日志搜索**: 支持按tenantId、uniqueId、type等字段搜索
- ✅ **消息类型识别**: 根据type字段显示不同的消息类型标签
- ✅ **数据限制**: 每个回调地址最多保留1000条日志
- ✅ **一键复制**: 复制按钮支持复制Webhook URL
- ✅ **数据导出**: 支持导出Excel格式的日志数据
- ✅ **响应式布局**: 适配1920*1080分辨率，自动调整显示效果

### UI/UX优化
- ✅ **现代化界面**: 基于Ant Design的专业UI组件
- ✅ **左右布局**: Webhook列表在左侧，实时日志占据右侧主要区域
- ✅ **模态框优化**: 创建/编辑弹窗支持滚动，解决字段过多问题
- ✅ **实时更新**: 使用Socket.IO实现实时数据推送

## 技术栈

### 前端
- **React 19** - 现代化前端框架
- **TypeScript** - 类型安全
- **Ant Design 5** - 企业级UI组件库
- **Vite** - 快速构建工具
- **Socket.IO Client** - 实时通信

### 后端
- **Node.js** - 服务器运行时
- **Express** - Web框架
- **Socket.IO** - 实时通信
- **ExcelJS** - Excel文件生成

## 快速开始

### 安装依赖
```bash
npm install
```

### 构建前端
```bash
npm run build
```

### 启动服务器
```bash
npm start
```

访问 http://localhost:3000 即可使用。

### 开发模式
```bash
# 启动前端开发服务器
npm run dev

# 启动后端服务器（另一个终端）
npm run server
```

## 项目结构

```
webhook-tool/
├── server.js                 # 后端服务器
├── App.tsx                   # React主应用组件
├── main.tsx                  # React应用入口
├── index.html                # HTML模板
├── vite.config.ts            # Vite配置
├── tsconfig.json             # TypeScript配置
├── package.json              # 项目依赖和脚本
├── dist/                     # 构建输出目录
├── config/                   # 后端配置文件
├── docs/                     # 文档
└── README.md                 # 项目说明
```

## 使用说明

### 创建Webhook
1. 点击左侧"创建 Webhook"按钮
2. 填写名称、自定义路径、描述
3. 选择延时类型（无延时/固定延时/随机延时）
4. 延时时间范围：0-100000毫秒
5. 点击"创建"完成

### 管理Webhook
- **启用/禁用**: 使用列表中的开关控制
- **编辑**: 点击编辑按钮修改配置
- **删除**: 点击删除按钮（需确认）
- **搜索**: 在搜索框中输入名称或描述关键词

### 查看日志
1. 在左侧列表中选择一个Webhook
2. 右侧会显示该Webhook的实时日志
3. 支持按tenantId、uniqueId、type等字段搜索
4. 每个Webhook最多保留1000条日志

### 数据管理
- **复制URL**: 点击复制按钮复制Webhook地址
- **导出数据**: 点击导出按钮下载Excel文件
- **清空日志**: 清空当前Webhook的所有日志

## API接口

### Webhook管理
- `GET /api/webhooks` - 获取所有webhook
- `POST /api/webhooks` - 创建webhook
- `PUT /api/webhooks/:id` - 更新webhook
- `DELETE /api/webhooks/:id` - 删除webhook

### 日志管理
- `GET /api/webhooks/:id/logs` - 获取webhook日志
- `DELETE /api/webhooks/:id/logs` - 清空webhook日志
- `GET /api/webhooks/:id/export` - 导出日志为Excel

### 系统监控
- `GET /api/system/status` - 获取系统状态
- `POST /api/cleanup/clear-all` - 清空所有数据

## 配置说明

### 延时配置
- **无延时**: 立即响应
- **固定延时**: 设置固定的延时时间（毫秒）
- **随机延时**: 设置最小和最大延时范围（毫秒）

### 内存管理
- 支持一键清理所有数据释放内存

### 数据限制
- 每个Webhook最多保留1000条日志
- 超出限制时自动删除最旧的记录
- 页面上有明显的数量限制提示

## 脚本说明

```bash
# 生产环境启动
npm start

# 开发环境前端服务器
npm run dev

# 构建前端项目
npm run build

# 预览构建结果
npm run preview

# 代码检查
npm run lint

# 开发环境后端服务器
npm run server
```

## 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0

## 部署说明

### 生产部署
1. 克隆项目到服务器
2. 安装依赖：`npm install`
3. 构建前端：`npm run build`
4. 启动服务：`npm start`
5. 访问 http://your-server:3000

## 更新日志

## 许可证

MIT License