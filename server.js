const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// 内存存储
const webhooks = new Map(); // 存储webhook配置
const webhookLogs = new Map(); // 存储webhook日志，每个webhook最多保留100条

// 工具函数
function generateWebhookId() {
  return uuidv4().replace(/-/g, '').substring(0, 8);
}

function addLog(webhookId, logData) {
  if (!webhookLogs.has(webhookId)) {
    webhookLogs.set(webhookId, {
      all: [],
      byType: {}
    });
  }
  
  const webhookData = webhookLogs.get(webhookId);
  
  // 确定消息类型
  let messageType = 'DEFAULT';
  if (logData.body && typeof logData.body === 'object' && logData.body.type) {
    messageType = logData.body.type;
  }
  
  // 添加消息类型到日志数据
  logData.messageType = messageType;
  
  // 添加到总日志
  webhookData.all.unshift(logData);
  if (webhookData.all.length > 10000) {
    webhookData.all.splice(10000);
  }
  
  // 按类型分类存储
  if (!webhookData.byType[messageType]) {
    webhookData.byType[messageType] = [];
  }
  
  webhookData.byType[messageType].unshift(logData);
  // 每种类型最多保留1000条
  if (webhookData.byType[messageType].length > 1000) {
    webhookData.byType[messageType].splice(1000);
  }
  
  webhookLogs.set(webhookId, webhookData);
}

// 路由

// 首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 获取系统内存信息
function getMemoryInfo() {
  const memUsage = process.memoryUsage();
  return {
    rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100, // MB
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
    external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100, // MB
    timestamp: new Date().toISOString()
  };
}

// 获取所有webhook
app.get('/api/webhooks', (req, res) => {
  const webhookList = Array.from(webhooks.entries()).map(([id, webhook]) => {
    const webhookData = webhookLogs.get(id);
    let logCount = 0;
    let typeStats = {};
    
    if (webhookData) {
      logCount = webhookData.all ? webhookData.all.length : 0;
      if (webhookData.byType) {
        Object.keys(webhookData.byType).forEach(type => {
          typeStats[type] = webhookData.byType[type].length;
        });
      }
    }
    
    return Object.assign({ id: id }, webhook, {
      logCount: logCount,
      typeStats: typeStats
    });
  });
  
  res.json({
    webhooks: webhookList,
    memoryInfo: getMemoryInfo()
  });
});

// 获取系统状态API
app.get('/api/system/status', (req, res) => {
  const memInfo = getMemoryInfo();
  
  // 计算总日志数量
  let totalLogs = 0;
  webhookLogs.forEach(webhookData => {
    if (webhookData.all) {
      totalLogs += webhookData.all.length;
    }
  });
  
  res.json({
    memory: memInfo,
    totalLogs: totalLogs,
    webhookCount: webhooks.size,
    uptime: Math.floor(process.uptime())
  });
});

// 创建webhook
app.post('/api/webhooks', (req, res) => {
  const { name, customPath, description, delayType, delayValue, delayMin, delayMax } = req.body;
  
  let webhookId;
  let webhookPath;
  
  if (customPath && customPath.trim()) {
    // 用户自定义路径
    webhookPath = customPath.trim().replace(/^\/+/, ''); // 移除开头的斜杠
    webhookId = webhookPath;
    
    // 检查是否已存在
    if (webhooks.has(webhookId)) {
      return res.status(400).json({ error: '该路径已存在' });
    }
  } else {
    // 自动生成
    webhookId = generateWebhookId();
    webhookPath = webhookId;
  }
  
  const webhook = {
    name: name || `Webhook ${webhookId}`,
    path: webhookPath,
    description: description || '',
    enabled: true,
    delayType: delayType || 'none', // none, fixed, random
    delayValue: delayValue || 0,
    delayMin: delayMin || 0,
    delayMax: delayMax || 0,
    createdAt: new Date().toISOString()
  };
  
  webhooks.set(webhookId, webhook);
  webhookLogs.set(webhookId, []);
  
  res.json({ id: webhookId, ...webhook });
});

// 更新webhook
app.put('/api/webhooks/:id', (req, res) => {
  const id = req.params.id;
  const webhook = webhooks.get(id);
  
  if (!webhook) {
    return res.status(404).json({ error: 'Webhook不存在' });
  }
  
  const name = req.body.name;
  const description = req.body.description;
  const enabled = req.body.enabled;
  const delayType = req.body.delayType;
  const delayValue = req.body.delayValue;
  const delayMin = req.body.delayMin;
  const delayMax = req.body.delayMax;
  
  const updatedWebhook = Object.assign({}, webhook, {
    name: name !== undefined ? name : webhook.name,
    description: description !== undefined ? description : webhook.description,
    enabled: enabled !== undefined ? enabled : webhook.enabled,
    delayType: delayType !== undefined ? delayType : webhook.delayType,
    delayValue: delayValue !== undefined ? delayValue : webhook.delayValue,
    delayMin: delayMin !== undefined ? delayMin : webhook.delayMin,
    delayMax: delayMax !== undefined ? delayMax : webhook.delayMax,
    updatedAt: new Date().toISOString()
  });
  
  webhooks.set(id, updatedWebhook);
  res.json(Object.assign({ id: id }, updatedWebhook));
});

// 删除webhook
app.delete('/api/webhooks/:id', (req, res) => {
  const id = req.params.id;
  
  if (!webhooks.has(id)) {
    return res.status(404).json({ error: 'Webhook不存在' });
  }
  
  webhooks.delete(id);
  webhookLogs.delete(id);
  
  res.json({ message: '删除成功' });
});

// 获取webhook日志
app.get('/api/webhooks/:id/logs', (req, res) => {
  const id = req.params.id;
  const type = req.query.type;
  const webhookData = webhookLogs.get(id);
  
  if (!webhookData) {
    return res.json({ 
      logs: [], 
      typeStats: {},
      message: '暂无日志数据'
    });
  }
  
  let logs = [];
  if (type && type !== 'all') {
    // 获取特定类型的日志
    logs = webhookData.byType[type] || [];
  } else {
    // 获取所有日志
    logs = webhookData.all || [];
  }
  
  // 统计各类型数量
  const typeStats = {};
  if (webhookData.byType) {
    Object.keys(webhookData.byType).forEach(msgType => {
      typeStats[msgType] = webhookData.byType[msgType].length;
    });
  }
  
  res.json({
    logs: logs,
    typeStats: typeStats,
    totalCount: webhookData.all ? webhookData.all.length : 0
  });
});

// 清空webhook日志
app.delete('/api/webhooks/:id/logs', (req, res) => {
  const id = req.params.id;
  const type = req.query.type;
  
  const webhookData = webhookLogs.get(id);
  if (!webhookData) {
    return res.json({ message: '日志已清空' });
  }
  
  if (type && type !== 'all') {
    // 清空特定类型的日志
    if (webhookData.byType && webhookData.byType[type]) {
      webhookData.byType[type] = [];
      // 同时从总日志中移除该类型的日志
      webhookData.all = webhookData.all.filter(log => log.messageType !== type);
    }
  } else {
    // 清空所有日志
    webhookLogs.set(id, {
      all: [],
      byType: {}
    });
  }
  
  res.json({ message: '日志已清空' });
});

// Webhook回调处理
app.all('/webhook/:path(*)', function(req, res) {
  const webhookPath = req.params.path;
  const webhook = webhooks.get(webhookPath);
  
  if (!webhook) {
    return res.status(404).json({ error: 'Webhook不存在' });
  }
  
  if (!webhook.enabled) {
    return res.status(403).json({ error: 'Webhook已禁用' });
  }
  
  // 记录请求日志
  const logData = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
    query: req.query,
    ip: req.ip || req.connection.remoteAddress
  };
  
  addLog(webhookPath, logData);
  
  // 实时推送到前端
  io.emit('webhook-log', {
    webhookId: webhookPath,
    log: logData
  });
  
  // 处理延时响应（延时值现在是毫秒）
  let delay = 0;
  if (webhook.delayType === 'fixed') {
    delay = webhook.delayValue;
  } else if (webhook.delayType === 'random') {
    const min = webhook.delayMin;
    const max = webhook.delayMax;
    delay = Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  if (delay > 0) {
    setTimeout(function() {
      res.json({
        success: true,
        message: 'Webhook接收成功',
        timestamp: new Date().toISOString(),
        delay: delay / 1000
      });
    }, delay);
  } else {
    res.json({
      success: true,
      message: 'Webhook接收成功',
      timestamp: new Date().toISOString(),
      delay: 0
    });
  }
});

// Socket.IO连接处理
io.on('connection', (socket) => {
  console.log('客户端已连接:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('客户端已断开:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Webhook工具已启动，访问地址: http://localhost:${PORT}`);
});