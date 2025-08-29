const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const ExcelJS = require('exceljs');


const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 默认配置
const config = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    maxBodySize: '10mb'
  },
  webhook: {
    security: {
      ipWhitelist: [],
      enableIpWhitelist: false,
      enableRateLimit: true,
      enableSignature: false,
      signatureSecret: ''
    },
    maxPayloadSize: '10mb',
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 100
    }
  }
};

// 中间件
app.use(express.json({ limit: config.server?.maxBodySize || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: config.server?.maxBodySize || '10mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// 内存存储
const webhooks = new Map(); // 存储webhook配置
const webhookLogs = new Map(); // 存储webhook日志，每个webhook最多保留100条
const webhookAlerts = new Map(); // 存储webhook告警信息
const webhookStats = new Map(); // 存储webhook统计信息

// 安全配置 - 从配置管理器获取
let securityConfig = {
  ipWhitelist: config.webhook?.security?.ipWhitelist || [],
  enableIpWhitelist: config.webhook?.security?.enableIpWhitelist || false,
  enableRequestValidation: true,
  maxRequestSize: config.webhook?.maxPayloadSize || '10mb',
  rateLimiting: {
    enabled: config.webhook?.security?.enableRateLimit || true,
    windowMs: config.webhook?.rateLimit?.windowMs || 15 * 60 * 1000, // 15分钟
    maxRequests: config.webhook?.rateLimit?.max || 100 // 每个IP最多100个请求
  },
  requestSignature: {
    enabled: config.webhook?.security?.enableSignature || false,
    secretKey: config.webhook?.security?.signatureSecret || '',
    algorithm: 'sha256'
  }
};

// 异步处理配置
const asyncConfig = {
  enabled: true,
  maxConcurrent: 5, // 最大并发处理数
  queueSize: 1000, // 队列最大长度
  retryAttempts: 3, // 重试次数
  retryDelay: 1000, // 重试延迟(ms)
  timeout: 30000 // 任务超时时间(ms)
};

// 数据清理配置
let cleanupConfig = {
  enabled: true,
  interval: 5 * 60 * 1000, // 5分钟清理一次
  maxLogsPerWebhook: 1000, // 每个webhook最多保留1000条日志
  maxLogAge: 24 * 60 * 60 * 1000, // 日志最大保留24小时
  cleanupThreshold: 0.8 // 当内存使用率超过80%时触发清理
};

let cleanupTimer = null;

// 请求计数器（用于速率限制）
const requestCounts = new Map();





// 手动清理所有数据
function clearAllData() {
  console.log('🧹 开始清理所有数据...');
  
  try {
    // 清理所有webhook日志
    webhookLogs.clear();
    
    // 清理所有统计信息
    webhookStats.clear();
    
    // 清理所有告警信息
    webhookAlerts.clear();
    
    // 清理请求计数器
    requestCounts.clear();
    
    console.log('✅ 所有数据已清理完成');
    
    // 通知前端数据已清理
    io.emit('data-cleared', { message: '所有数据已清理完成' });
    
  } catch (error) {
    console.error('❌ 清理所有数据失败:', error);
  }
}

// 数据清理函数
function cleanupExpiredData() {
  console.log('🧹 开始执行数据清理...');
  
  const now = Date.now();
  let totalCleaned = 0;
  
  try {
    // 清理过期日志
    webhookLogs.forEach((webhookData, webhookId) => {
      if (!webhookData || !webhookData.all) return;
      
      const originalCount = webhookData.all.length;
      
      // 按时间清理
      if (cleanupConfig.maxLogAge > 0) {
        webhookData.all = webhookData.all.filter(log => {
          const logTime = new Date(log.timestamp).getTime();
          return (now - logTime) <= cleanupConfig.maxLogAge;
        });
      }
      
      // 按数量限制清理
      if (webhookData.all.length > cleanupConfig.maxLogsPerWebhook) {
        webhookData.all = webhookData.all.slice(0, cleanupConfig.maxLogsPerWebhook);
      }
      
      // 重建类型索引
      const newByType = {};
      webhookData.all.forEach(log => {
        const type = log.messageType || 'DEFAULT';
        if (!newByType[type]) {
          newByType[type] = [];
        }
        newByType[type].push(log);
      });
      
      webhookData.byType = newByType;
      webhookLogs.set(webhookId, webhookData);
      
      const cleanedCount = originalCount - webhookData.all.length;
      totalCleaned += cleanedCount;
      
      if (cleanedCount > 0) {
        console.log(`📝 Webhook ${webhookId}: 清理了 ${cleanedCount} 条日志`);
      }
    });
    
    // 清理过期的请求计数器
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    requestCounts.forEach((requests, ip) => {
      const validRequests = requests.filter(timestamp => timestamp > fiveMinutesAgo);
      if (validRequests.length !== requests.length) {
        requestCounts.set(ip, validRequests);
      }
      if (validRequests.length === 0) {
        requestCounts.delete(ip);
      }
    });
    
    // 清理过期的统计信息
    webhookStats.forEach((stats, webhookId) => {
      const fifteenMinutesAgo = now - 15 * 60 * 1000;
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      const oneMinuteAgo = now - 60 * 1000;
      
      if (stats.requestCounts) {
        stats.requestCounts.last1Minute = stats.requestCounts.last1Minute?.filter(
          item => item.timestamp >= oneMinuteAgo
        ) || [];
        stats.requestCounts.last5Minutes = stats.requestCounts.last5Minutes?.filter(
          item => item.timestamp >= fiveMinutesAgo
        ) || [];
        stats.requestCounts.last15Minutes = stats.requestCounts.last15Minutes?.filter(
          item => item.timestamp >= fifteenMinutesAgo
        ) || [];
      }
      
      if (stats.responseTimes) {
        stats.responseTimes = stats.responseTimes.filter(
          item => item.timestamp >= fifteenMinutesAgo
        );
      }
      
      webhookStats.set(webhookId, stats);
    });
    
    console.log(`✅ 数据清理完成，共清理 ${totalCleaned} 条日志`);
    
    // 通知前端
    io.emit('cleanup-completed', {
      cleanedLogs: totalCleaned,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 数据清理失败:', error);
  }
}

// 启动定时清理任务
function startCleanupTask() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }
  
  if (cleanupConfig.enabled) {
    cleanupTimer = setInterval(() => {
      cleanupExpiredData();
    }, cleanupConfig.interval);
    
    console.log(`🕒 定时清理任务已启动，间隔: ${cleanupConfig.interval / 1000}秒`);
  }
}

// 安全中间件
function securityMiddleware(req, res, next) {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  // IP白名单检查
  if (securityConfig.enableIpWhitelist && securityConfig.ipWhitelist.length > 0) {
    if (!securityConfig.ipWhitelist.includes(clientIp)) {
      return res.status(403).json({ error: 'IP地址不在白名单中' });
    }
  }
  
  // 速率限制检查
  if (securityConfig.rateLimiting.enabled) {
    const now = Date.now();
    const windowStart = now - securityConfig.rateLimiting.windowMs;
    
    if (!requestCounts.has(clientIp)) {
      requestCounts.set(clientIp, []);
    }
    
    const ipRequests = requestCounts.get(clientIp);
    // 清理过期的请求记录
    const validRequests = ipRequests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= securityConfig.rateLimiting.maxRequests) {
      return res.status(429).json({ 
        error: '请求过于频繁，请稍后再试',
        retryAfter: Math.ceil(securityConfig.rateLimiting.windowMs / 1000)
      });
    }
    
    validRequests.push(now);
    requestCounts.set(clientIp, validRequests);
  }
  
  next();
}

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
  
  // 确保 webhookData 和其属性存在
  if (!webhookData.all) {
    webhookData.all = [];
  }
  if (!webhookData.byType) {
    webhookData.byType = {};
  }
  
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
  
  // 更新统计信息并检查告警
  updateStatsAndCheckAlerts(webhookId, logData);
}

// 更新统计信息并检查告警
function updateStatsAndCheckAlerts(webhookId, logData) {
  // 初始化统计信息
  if (!webhookStats.has(webhookId)) {
    webhookStats.set(webhookId, {
      requestCounts: {
        last1Minute: [],
        last5Minutes: [],
        last15Minutes: []
      },
      errorCounts: {
        last5Minutes: 0,
        total: 0
      },
      responseTimes: [],
      lastAlertTime: null
    });
  }
  
  const stats = webhookStats.get(webhookId);
  const now = new Date();
  
  // 更新请求计数
  stats.requestCounts.last1Minute.push({
    timestamp: now,
    logId: logData.id
  });
  stats.requestCounts.last5Minutes.push({
    timestamp: now,
    logId: logData.id
  });
  stats.requestCounts.last15Minutes.push({
    timestamp: now,
    logId: logData.id
  });
  
  // 清理过期的请求记录
  const oneMinuteAgo = new Date(now - 60 * 1000);
  const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
  const fifteenMinutesAgo = new Date(now - 15 * 60 * 1000);
  
  stats.requestCounts.last1Minute = stats.requestCounts.last1Minute.filter(item => item.timestamp >= oneMinuteAgo);
  stats.requestCounts.last5Minutes = stats.requestCounts.last5Minutes.filter(item => item.timestamp >= fiveMinutesAgo);
  stats.requestCounts.last15Minutes = stats.requestCounts.last15Minutes.filter(item => item.timestamp >= fifteenMinutesAgo);
  
  // 检查是否为错误请求（这里简单判断，可以根据实际需求调整）
  let isError = false;
  if (logData.body && logData.body.error) {
    isError = true;
  } else if (logData.body && logData.body.statusCode && (logData.body.statusCode < 200 || logData.body.statusCode >= 400)) {
    isError = true;
  } else if (logData.messageType === 'ERROR' || logData.messageType === 'ALARM') {
    isError = true;
  }
  
  // 更新错误计数
  if (isError) {
    stats.errorCounts.total++;
    if (logData.timestamp >= fiveMinutesAgo) {
      stats.errorCounts.last5Minutes++;
    }
  }
  
  // 更新响应时间
  if (logData.body && logData.body.responseTime) {
    stats.responseTimes.push({
      timestamp: now,
      value: logData.body.responseTime
    });
  }
  
  // 只保留最近15分钟的响应时间数据
  stats.responseTimes = stats.responseTimes.filter(item => item.timestamp >= fifteenMinutesAgo);
  
  // 保存更新后的统计信息
  webhookStats.set(webhookId, stats);
  
  // 检查告警条件
  checkAlerts(webhookId);
}

// 检查告警条件
function checkAlerts(webhookId) {
  const stats = webhookStats.get(webhookId);
  const webhook = webhooks.get(webhookId);
  
  if (!stats || !webhook) return;
  
  const now = new Date();
  const alerts = [];
  
  // 如果最近一次告警时间在5分钟内，则不再发送新告警
  if (stats.lastAlertTime && (now - stats.lastAlertTime) < 5 * 60 * 1000) {
    return;
  }
  
  // 检查高频请求告警 - 每分钟超过30个请求
  const requestsPerMinute = stats.requestCounts.last1Minute.length;
  if (requestsPerMinute > 30) {
    alerts.push({
      type: 'HIGH_FREQUENCY',
      message: `高频请求告警: ${webhook.name} 在过去1分钟内收到了 ${requestsPerMinute} 个请求`,
      level: 'warning',
      timestamp: now.toISOString()
    });
  }
  
  // 检查错误率告警 - 5分钟内错误率超过20%
  const requestsIn5Min = stats.requestCounts.last5Minutes.length;
  if (requestsIn5Min > 0) {
    const errorRate = (stats.errorCounts.last5Minutes / requestsIn5Min) * 100;
    if (errorRate > 20) {
      alerts.push({
        type: 'ERROR_RATE',
        message: `错误率告警: ${webhook.name} 在过去5分钟内的错误率为 ${errorRate.toFixed(2)}%`,
        level: 'error',
        timestamp: now.toISOString(),
        details: {
          errorRate: errorRate,
          totalRequests: requestsIn5Min,
          errorRequests: stats.errorCounts.last5Minutes
        }
      });
    }
  }
  
  // 如果有告警，则发送并记录
  if (alerts.length > 0) {
    // 更新最后告警时间
    stats.lastAlertTime = now;
    webhookStats.set(webhookId, stats);
    
    // 存储告警信息
    if (!webhookAlerts.has(webhookId)) {
      webhookAlerts.set(webhookId, []);
    }
    
    const alertsList = webhookAlerts.get(webhookId);
    alerts.forEach(alert => {
      alertsList.unshift(alert);
    });
    
    // 最多保留100条告警记录
    if (alertsList.length > 100) {
      alertsList.splice(100);
    }
    
    webhookAlerts.set(webhookId, alertsList);
    
    // 通过Socket.IO发送告警
    io.emit('webhook-alerts', {
      webhookId: webhookId,
      alerts: alerts
    });
    
    console.log(`[告警] 为Webhook ${webhookId} 生成了 ${alerts.length} 条告警`);
  }
}





// 路由

// 首页 - 服务React应用
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});


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
    webhooks: webhookList
  });
});

// 获取系统状态API
app.get('/api/system/status', (req, res) => {
  // 计算总日志数量
  let totalLogs = 0;
  webhookLogs.forEach(webhookData => {
    if (webhookData.all) {
      totalLogs += webhookData.all.length;
    }
  });
  
  res.json({
    totalRequests: totalLogs,
    webhookCount: webhooks.size,
    uptime: Math.floor(process.uptime())
  });
});

// 获取安全配置
app.get('/api/security/config', (req, res) => {
  res.json(securityConfig);
});

// 更新安全配置
app.put('/api/security/config', (req, res) => {
  const {
    ipWhitelist,
    enableIpWhitelist,
    enableRequestValidation,
    maxRequestSize,
    rateLimiting,
    requestSignature
  } = req.body;
  
  if (ipWhitelist !== undefined) {
    securityConfig.ipWhitelist = Array.isArray(ipWhitelist) ? ipWhitelist : [];
  }
  
  if (enableIpWhitelist !== undefined) {
    securityConfig.enableIpWhitelist = Boolean(enableIpWhitelist);
  }
  
  if (enableRequestValidation !== undefined) {
    securityConfig.enableRequestValidation = Boolean(enableRequestValidation);
  }
  
  if (maxRequestSize !== undefined) {
    securityConfig.maxRequestSize = Number(maxRequestSize) || 10 * 1024 * 1024;
  }
  
  if (rateLimiting !== undefined) {
    securityConfig.rateLimiting = {
      enabled: Boolean(rateLimiting.enabled),
      windowMs: Number(rateLimiting.windowMs) || 15 * 60 * 1000,
      maxRequests: Number(rateLimiting.maxRequests) || 100
    };
  }
  
  if (requestSignature !== undefined) {
    securityConfig.requestSignature = {
      enabled: Boolean(requestSignature.enabled),
      secretKey: String(requestSignature.secretKey || ''),
      algorithm: String(requestSignature.algorithm || 'sha256')
    };
  }
  
  res.json({
    message: '安全配置已更新',
    config: securityConfig
  });
});

// 获取请求统计信息
app.get('/api/security/stats', (req, res) => {
  const stats = {
    activeIPs: requestCounts.size,
    totalRequests: 0,
    blockedRequests: 0
  };
  
  requestCounts.forEach(requests => {
    stats.totalRequests += requests.length;
  });
  
  res.json(stats);
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
  webhookLogs.set(webhookId, {
    all: [],
    byType: {}
  });
  
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
  
  console.log(`[API] 获取日志请求 - Webhook ID: ${id}, 类型: ${type || 'all'}`);
  
  // 检查webhook是否存在
  if (!webhooks.has(id)) {
    console.log(`[API] Webhook不存在: ${id}`);
    return res.status(404).json({ 
      error: 'Webhook不存在',
      logs: [], 
      typeStats: {}
    });
  }
  
  const webhookData = webhookLogs.get(id);
  
  if (!webhookData) {
    console.log(`[API] Webhook ${id} 暂无日志数据`);
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
    console.log(`[API] 返回 ${type} 类型日志 ${logs.length} 条`);
  } else {
    // 获取所有日志
    logs = webhookData.all || [];
    console.log(`[API] 返回所有日志 ${logs.length} 条`);
  }
  
  // 统计各类型数量
  const typeStats = {};
  if (webhookData.byType) {
    Object.keys(webhookData.byType).forEach(msgType => {
      typeStats[msgType] = webhookData.byType[msgType].length;
    });
  }
  
  console.log(`[API] 类型统计:`, typeStats);
  
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

// 获取webhook告警信息
app.get('/api/webhooks/:id/alerts', (req, res) => {
  const id = req.params.id;
  
  // 检查webhook是否存在
  if (!webhooks.has(id)) {
    return res.status(404).json({ error: 'Webhook不存在' });
  }
  
  const alerts = webhookAlerts.get(id) || [];
  
  res.json({
    alerts: alerts,
    count: alerts.length
  });
});

// 导出webhook日志为Excel格式
app.get('/api/webhooks/:id/export', async (req, res) => {
  const id = req.params.id;
  const type = req.query.type;
  
  // 检查webhook是否存在
  if (!webhooks.has(id)) {
    return res.status(404).json({ error: 'Webhook不存在' });
  }
  
  const webhook = webhooks.get(id);
  const webhookData = webhookLogs.get(id);
  
  if (!webhookData || !webhookData.all || webhookData.all.length === 0) {
    return res.status(404).json({ error: '没有可导出的日志数据' });
  }
  
  // 获取要导出的日志
  let logsToExport = [];
  if (type && type !== 'all' && webhookData.byType && webhookData.byType[type]) {
    logsToExport = webhookData.byType[type];
  } else {
    logsToExport = webhookData.all;
  }
  
  if (logsToExport.length === 0) {
    return res.status(404).json({ error: '没有可导出的日志数据' });
  }
  
  try {
    // 创建工作簿和工作表
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Webhook日志');
    
    // 设置列
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: '时间', key: 'timestamp', width: 20 },
      { header: '方法', key: 'method', width: 10 },
      { header: 'URL', key: 'url', width: 30 },
      { header: 'IP地址', key: 'ip', width: 15 },
      { header: '消息类型', key: 'messageType', width: 15 },
      { header: '请求头', key: 'headers', width: 40 },
      { header: '请求体', key: 'body', width: 50 }
    ];
    
    // 添加数据
    logsToExport.forEach(log => {
      worksheet.addRow({
        id: log.id,
        timestamp: log.timestamp,
        method: log.method,
        url: log.url,
        ip: log.ip,
        messageType: log.messageType || 'DEFAULT',
        headers: JSON.stringify(log.headers),
        body: JSON.stringify(log.body)
      });
    });
    
    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=webhook-logs-${id}-${new Date().toISOString().slice(0,10)}.xlsx`);
    
    // 将工作簿写入响应
    await workbook.xlsx.write(res);
    res.end();
    
    console.log(`[API] 导出日志成功 - Webhook ID: ${id}, 类型: ${type || 'all'}, 共 ${logsToExport.length} 条`);
  } catch (error) {
    console.error('导出日志失败:', error);
    res.status(500).json({ error: '导出日志失败', details: error.message });
  }
});

// Webhook回调处理
app.all('/webhook/:path(*)', securityMiddleware, function(req, res) {
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
  
  // 根据配置决定是否使用异步处理
  if (asyncConfig.enabled && req.headers['x-async'] === 'true') {
    // 异步处理模式
    const priority = req.headers['x-priority'] || 'normal';
    const task = new AsyncTask(webhookPath, logData, priority);
    
    if (addToQueue(task)) {
      // 立即返回响应
      res.json({
        success: true,
        message: 'Webhook已接收，正在异步处理',
        taskId: task.id,
        priority: priority,
        async: true
      });
      
      // 异步推送到前端
      setImmediate(() => {
        io.emit('webhook-log', {
          webhookId: webhookPath,
          log: logData,
          async: true,
          taskId: task.id
        });
      });
    } else {
      res.status(503).json({ 
        error: '异步队列已满，请稍后重试',
        async: true
      });
    }
  } else {
    // 同步处理模式（原有逻辑）
    addLog(webhookPath, logData);
    
    // 实时推送到前端
    io.emit('webhook-log', {
      webhookId: webhookPath,
      log: logData,
      async: false
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
  }
});

// Socket.IO连接处理
io.on('connection', (socket) => {
  console.log('客户端已连接:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('客户端已断开:', socket.id);
  });
});

// 从配置管理器获取端口和主机配置
const PORT = config.server?.port || process.env.PORT || 3000;
const HOST = config.server?.host || process.env.HOST || '0.0.0.0';



// 获取数据清理配置
app.get('/api/cleanup/config', (req, res) => {
  res.json({
    success: true,
    data: cleanupConfig
  });
});

// 更新数据清理配置
app.put('/api/cleanup/config', (req, res) => {
  const { enabled, interval, maxLogsPerWebhook, maxLogAge, cleanupThreshold } = req.body;
  
  if (enabled !== undefined) cleanupConfig.enabled = Boolean(enabled);
  if (interval !== undefined) cleanupConfig.interval = Number(interval) || 5 * 60 * 1000;
  if (maxLogsPerWebhook !== undefined) cleanupConfig.maxLogsPerWebhook = Number(maxLogsPerWebhook) || 1000;
  if (maxLogAge !== undefined) cleanupConfig.maxLogAge = Number(maxLogAge) || 24 * 60 * 60 * 1000;
  if (cleanupThreshold !== undefined) cleanupConfig.cleanupThreshold = Number(cleanupThreshold) || 0.8;
  
  res.json({
    success: true,
    message: '数据清理配置已更新',
    data: cleanupConfig
  });
});

// 手动触发数据清理
app.post('/api/cleanup/trigger', (req, res) => {
  try {
    cleanupExpiredData();
    res.json({
      success: true,
      message: '数据清理已触发'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取异步队列状态
app.get('/api/async/status', (req, res) => {
  res.json({
    success: true,
    data: {
      config: asyncConfig,
      queue: {
        length: asyncQueue.length,
        activeWorkers: activeWorkers,
        totalProcessed: totalProcessed,
        totalFailed: totalFailed
      }
    }
  });
});

// 更新异步配置
app.put('/api/async/config', (req, res) => {
  const { enabled, maxConcurrent, queueSize, retryAttempts, retryDelay, timeout } = req.body;
  
  if (enabled !== undefined) asyncConfig.enabled = Boolean(enabled);
  if (maxConcurrent !== undefined) asyncConfig.maxConcurrent = Number(maxConcurrent) || 5;
  if (queueSize !== undefined) asyncConfig.queueSize = Number(queueSize) || 1000;
  if (retryAttempts !== undefined) asyncConfig.retryAttempts = Number(retryAttempts) || 3;
  if (retryDelay !== undefined) asyncConfig.retryDelay = Number(retryDelay) || 1000;
  if (timeout !== undefined) asyncConfig.timeout = Number(timeout) || 30000;
  
  res.json({
    success: true,
    message: '异步配置已更新',
    data: asyncConfig
  });
});













// 异步任务队列
const asyncQueue = [];
let activeWorkers = 0;
let totalProcessed = 0;
let totalFailed = 0;

// 异步任务类
class AsyncTask {
  constructor(webhookId, logData, priority = 'normal') {
    this.id = Date.now() + Math.random();
    this.webhookId = webhookId;
    this.logData = logData;
    this.priority = priority; // high, normal, low
    this.status = 'pending'; // pending, processing, completed, failed
    this.createdAt = Date.now();
    this.startedAt = null;
    this.completedAt = null;
    this.retryCount = 0;
    this.error = null;
  }
}

// 异步任务处理器
async function processAsyncTask(task) {
  try {
    task.status = 'processing';
    task.startedAt = Date.now();
    
    // 模拟异步处理（实际项目中可能是数据库操作、外部API调用等）
    await new Promise((resolve, reject) => {
      const processingTime = Math.random() * 1000 + 100; // 100-1100ms
      
      setTimeout(() => {
        if (Math.random() > 0.95) { // 5%失败率用于测试
          reject(new Error('模拟处理失败'));
        } else {
          resolve();
        }
      }, processingTime);
    });
    
    // 处理成功
    task.status = 'completed';
    task.completedAt = Date.now();
    totalProcessed++;
    
    // 添加到日志（异步）
    addLogAsync(task.webhookId, task.logData);
    
    console.log(`✅ 异步任务完成: ${task.id}, 耗时: ${task.completedAt - task.startedAt}ms`);
    
  } catch (error) {
    task.status = 'failed';
    task.error = error.message;
    totalFailed++;
    
    console.error(`❌ 异步任务失败: ${task.id}, 错误: ${error.message}`);
    
    // 重试逻辑
    if (task.retryCount < asyncConfig.retryAttempts) {
      task.retryCount++;
      task.status = 'pending';
      task.error = null;
      
      // 延迟重试
      setTimeout(() => {
        addToQueue(task);
      }, asyncConfig.retryDelay * task.retryCount);
      
      console.log(`🔄 任务 ${task.id} 将在 ${asyncConfig.retryDelay * task.retryCount}ms 后重试 (${task.retryCount}/${asyncConfig.retryAttempts})`);
    }
  } finally {
    activeWorkers--;
    processNextTask();
  }
}

// 添加任务到队列
function addToQueue(task) {
  if (asyncQueue.length >= asyncConfig.queueSize) {
    console.warn(`⚠️ 异步队列已满，丢弃任务: ${task.id}`);
    return false;
  }
  
  // 根据优先级插入队列
  if (task.priority === 'high') {
    asyncQueue.unshift(task);
  } else if (task.priority === 'low') {
    asyncQueue.push(task);
  } else {
    // normal优先级插入到中间位置
    const normalIndex = Math.floor(asyncQueue.length / 2);
    asyncQueue.splice(normalIndex, 0, task);
  }
  
  processNextTask();
  return true;
}

// 处理下一个任务
function processNextTask() {
  if (activeWorkers >= asyncConfig.maxConcurrent || asyncQueue.length === 0) {
    return;
  }
  
  const task = asyncQueue.shift();
  if (task) {
    activeWorkers++;
    processAsyncTask(task);
  }
}

// 异步添加日志
async function addLogAsync(webhookId, logData) {
  try {
    if (!webhookLogs.has(webhookId)) {
      webhookLogs.set(webhookId, {
        all: [],
        byType: {}
      });
    }
    
    const webhookData = webhookLogs.get(webhookId);
    
    // 确保 webhookData 和其属性存在
    if (!webhookData.all) {
      webhookData.all = [];
    }
    if (!webhookData.byType) {
      webhookData.byType = {};
    }
    
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
    
    // 更新统计信息并检查告警（异步）
    setImmediate(() => {
      updateStatsAndCheckAlerts(webhookId, logData);
    });
    
  } catch (error) {
    console.error('❌ 异步添加日志失败:', error);
  }
}




















  












server.listen(PORT, HOST, () => {
  console.log(`Webhook工具已启动，访问地址: http://${HOST}:${PORT}`);

  console.log(`当前环境: production`);
  console.log(`配置状态: 有效`);
  startCleanupTask(); // 启动定时清理任务


});