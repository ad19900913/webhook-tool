const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const ExcelJS = require('exceljs');
const zlib = require('zlib');
const util = require('util');

// 导入配置管理
const configManager = require('./lib/config');

// 压缩配置
const compressionConfig = {
  enabled: true,
  threshold: 1024, // 1KB以上才压缩
  level: 6, // 压缩级别 0-9
  windowBits: 15, // 压缩窗口大小
  memLevel: 8, // 内存使用级别
  filter: (req, res) => {
    // 只对特定内容类型进行压缩
    const contentType = res.getHeader('Content-Type');
    return contentType && (
      contentType.includes('application/json') ||
      contentType.includes('text/') ||
      contentType.includes('application/xml')
    );
  }
};

// 压缩工具函数
const gzip = util.promisify(zlib.gzip);
const gunzip = util.promisify(zlib.gunzip);
const deflate = util.promisify(zlib.deflate);
const inflate = util.promisify(zlib.inflate);

// 压缩中间件
function compressionMiddleware(req, res, next) {
  if (!compressionConfig.enabled) {
    return next();
  }
  
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const contentLength = parseInt(req.headers['content-length']) || 0;
  
  // 检查是否需要压缩
  if (contentLength < compressionConfig.threshold || 
      !acceptEncoding.includes('gzip') && !acceptEncoding.includes('deflate')) {
    return next();
  }
  
  // 选择压缩算法
  let compressionMethod = null;
  let compress = null;
  
  if (acceptEncoding.includes('gzip')) {
    compressionMethod = 'gzip';
    compress = gzip;
  } else if (acceptEncoding.includes('deflate')) {
    compressionMethod = 'deflate';
    compress = deflate;
  }
  
  if (!compressionMethod) {
    return next();
  }
  
  // 重写res.send方法以支持压缩
  const originalSend = res.send;
  res.send = function(data) {
    if (typeof data === 'string' || Buffer.isBuffer(data)) {
      const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
      
      if (dataBuffer.length < compressionConfig.threshold) {
        return originalSend.call(this, data);
      }
      
      // 压缩数据
      compress(dataBuffer, {
        level: compressionConfig.level,
        windowBits: compressionConfig.windowBits,
        memLevel: compressionConfig.memLevel
      }).then(compressedData => {
        res.setHeader('Content-Encoding', compressionMethod);
        res.setHeader('Content-Length', compressedData.length);
        res.setHeader('Vary', 'Accept-Encoding');
        
        const compressionRatio = ((1 - compressedData.length / dataBuffer.length) * 100).toFixed(2);
        console.log(`📦 数据压缩完成: ${dataBuffer.length} -> ${compressedData.length} bytes (节省 ${compressionRatio}%)`);
        
        originalSend.call(this, compressedData);
      }).catch(error => {
        console.error('❌ 数据压缩失败:', error);
        originalSend.call(this, data);
      });
    } else {
      originalSend.call(this, data);
    }
  };
  
  next();
}

// 解压缩中间件
function decompressionMiddleware(req, res, next) {
  const contentEncoding = req.headers['content-encoding'];
  
  if (!contentEncoding || contentEncoding === 'identity') {
    return next();
  }
  
  let chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  
  req.on('end', () => {
    const compressedData = Buffer.concat(chunks);
    
    let decompress = null;
    if (contentEncoding === 'gzip') {
      decompress = gunzip;
    } else if (contentEncoding === 'deflate') {
      decompress = inflate;
    } else {
      return next();
    }
    
    decompress(compressedData).then(decompressedData => {
      req.body = decompressedData;
      req.headers['content-length'] = decompressedData.length;
      
      console.log(`📦 数据解压缩完成: ${compressedData.length} -> ${decompressedData.length} bytes`);
      next();
    }).catch(error => {
      console.error('❌ 数据解压缩失败:', error);
      res.status(400).json({ error: '数据解压缩失败' });
    });
  });
}

// 压缩响应数据
async function compressResponseData(data, encoding = 'gzip') {
  try {
    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data), 'utf8');
    
    if (dataBuffer.length < compressionConfig.threshold) {
      return { data: dataBuffer, compressed: false, ratio: 0 };
    }
    
    const compress = encoding === 'gzip' ? gzip : deflate;
    const compressedData = await compress(dataBuffer, {
      level: compressionConfig.level,
      windowBits: compressionConfig.windowBits,
      memLevel: compressionConfig.memLevel
    });
    
    const compressionRatio = ((1 - compressedData.length / dataBuffer.length) * 100).toFixed(2);
    
    return {
      data: compressedData,
      compressed: true,
      ratio: parseFloat(compressionRatio),
      originalSize: dataBuffer.length,
      compressedSize: compressedData.length
    };
  } catch (error) {
    console.error('❌ 响应数据压缩失败:', error);
    return { data: data, compressed: false, ratio: 0, error: error.message };
  }
}

// 压缩统计
const compressionStats = {
  totalRequests: 0,
  compressedRequests: 0,
  totalBytesSaved: 0,
  averageCompressionRatio: 0
};

// 更新压缩统计
function updateCompressionStats(originalSize, compressedSize) {
  compressionStats.totalRequests++;
  compressionStats.compressedRequests++;
  compressionStats.totalBytesSaved += (originalSize - compressedSize);
  compressionStats.averageCompressionRatio = (
    (compressionStats.averageCompressionRatio * (compressionStats.compressedRequests - 1) + 
     ((1 - compressedSize / originalSize) * 100)) / compressionStats.compressedRequests
  ).toFixed(2);
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 从配置管理器获取配置
const config = configManager.getAll();

// 中间件
app.use(express.json({ limit: config.server?.maxBodySize || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: config.server?.maxBodySize || '10mb' }));
app.use(express.static('public'));
app.use(compressionMiddleware); // 应用压缩中间件
app.use(decompressionMiddleware); // 应用解压缩中间件

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

// 请求计数器（用于速率限制）
const requestCounts = new Map();

// 数据清理配置
const cleanupConfig = {
  enabled: true,
  interval: 5 * 60 * 1000, // 5分钟执行一次
  maxLogsPerWebhook: 1000, // 每个webhook最多保留1000条日志
  maxLogAge: 24 * 60 * 60 * 1000, // 日志最多保留24小时
  cleanupThreshold: 0.8 // 内存使用率超过80%时触发清理
};

// 数据清理函数
function cleanupExpiredData() {
  if (!cleanupConfig.enabled) return;
  
  console.log('🧹 开始清理过期数据...');
  const startTime = Date.now();
  let cleanedCount = 0;
  
  try {
    // 清理过期的日志
    const now = Date.now();
    const maxAge = now - cleanupConfig.maxLogAge;
    
    for (const [webhookId, webhookData] of webhookLogs.entries()) {
      if (!webhookData || !webhookData.all) continue;
      
      const originalCount = webhookData.all.length;
      
      // 按时间清理过期日志
      webhookData.all = webhookData.all.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime > maxAge;
      });
      
      // 按数量限制清理（保留最新的）
      if (webhookData.all.length > cleanupConfig.maxLogsPerWebhook) {
        webhookData.all = webhookData.all.slice(0, cleanupConfig.maxLogsPerWebhook);
      }
      
      // 更新按类型分类的日志
      if (webhookData.byType) {
        for (const [type, logs] of Object.entries(webhookData.byType)) {
          webhookData.byType[type] = logs.filter(log => {
            const logTime = new Date(log.timestamp).getTime();
            return logTime > maxAge;
          }).slice(0, cleanupConfig.maxLogsPerWebhook);
        }
      }
      
      cleanedCount += (originalCount - webhookData.all.length);
    }
    
    // 清理过期的请求统计
    for (const [webhookId, stats] of webhookStats.entries()) {
      if (!stats || !stats.requestCounts) continue;
      
      const now = Date.now();
      const oneMinuteAgo = now - 60 * 1000;
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      const fifteenMinutesAgo = now - 15 * 60 * 1000;
      
      stats.requestCounts.last1Minute = stats.requestCounts.last1Minute.filter(item => item.timestamp > oneMinuteAgo);
      stats.requestCounts.last5Minutes = stats.requestCounts.last5Minutes.filter(item => item.timestamp > fiveMinutesAgo);
      stats.requestCounts.last15Minutes = stats.requestCounts.last15Minutes.filter(item => item.timestamp > fifteenMinutesAgo);
      
      // 清理过期的响应时间数据
      if (stats.responseTimes) {
        stats.responseTimes = stats.responseTimes.filter(item => item.timestamp > maxAge);
      }
    }
    
    // 清理过期的告警信息
    for (const [webhookId, alerts] of webhookAlerts.entries()) {
      if (!alerts || !Array.isArray(alerts)) continue;
      
      const originalAlertCount = alerts.length;
      webhookAlerts.set(webhookId, alerts.filter(alert => {
        const alertTime = new Date(alert.timestamp).getTime();
        return alertTime > maxAge;
      }));
      
      cleanedCount += (originalAlertCount - webhookAlerts.get(webhookId).length);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ 数据清理完成，清理了 ${cleanedCount} 条过期数据，耗时 ${duration}ms`);
    
    // 检查内存使用情况
    const memUsage = process.memoryUsage();
    const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    if (memUsageMB > 100) { // 如果内存使用超过100MB
      console.log(`⚠️ 内存使用较高: ${memUsageMB}MB`);
      
      // 强制垃圾回收（仅在开发环境）
      if (process.env.NODE_ENV === 'development') {
        if (global.gc) {
          global.gc();
          console.log('🔄 已触发垃圾回收');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ 数据清理失败:', error);
  }
}

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

// 启动定时清理任务
function startCleanupTask() {
  if (cleanupConfig.enabled) {
    setInterval(cleanupExpiredData, cleanupConfig.interval);
    console.log(`🔄 数据清理任务已启动，间隔: ${cleanupConfig.interval / 1000}秒`);
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

// 配置管理API路由
const configApiRouter = require('./lib/config-api');
app.use('/api/config', configApiRouter);

// 系统监控API
const systemMonitorApiRouter = require('./lib/system-monitor-api');
app.use('/api/system-monitor', systemMonitorApiRouter);

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

// 清理所有数据
app.post('/api/cleanup/clear-all', (req, res) => {
  try {
    clearAllData();
    res.json({
      success: true,
      message: '所有数据已清理完成'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取数据统计信息
app.get('/api/cleanup/stats', (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const totalLogs = Array.from(webhookLogs.values()).reduce((total, data) => {
      return total + (data.all ? data.all.length : 0);
    }, 0);
    
    const totalAlerts = Array.from(webhookAlerts.values()).reduce((total, alerts) => {
      return total + (Array.isArray(alerts) ? alerts.length : 0);
    }, 0);
    
    const totalStats = webhookStats.size;
    
    res.json({
      success: true,
      data: {
        memoryUsage: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024)
        },
        dataCounts: {
          totalLogs,
          totalAlerts,
          totalStats,
          webhookCount: webhooks.size
        },
        cleanupConfig
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 内存优化配置
const memoryConfig = {
  enabled: true,
  monitorInterval: 30 * 1000, // 30秒监控一次
  warningThreshold: 0.7, // 内存使用率超过70%时警告
  criticalThreshold: 0.9, // 内存使用率超过90%时紧急处理
  maxHeapSize: 512 * 1024 * 1024, // 最大堆内存512MB
  gcThreshold: 0.8, // 内存使用率超过80%时触发垃圾回收
  leakDetection: {
    enabled: true,
    sampleInterval: 60 * 1000, // 1分钟采样一次
    historySize: 60, // 保留60个采样点
    growthThreshold: 0.1 // 内存增长率超过10%时认为可能泄漏
  }
};

// 内存监控数据
const memoryHistory = [];
let lastMemoryUsage = null;
let memoryLeakWarning = false;

// 内存监控函数
function monitorMemory() {
  if (!memoryConfig.enabled) return;
  
  try {
    const memUsage = process.memoryUsage();
    const now = Date.now();
    
    // 计算内存使用率
    const heapUsageRate = memUsage.heapUsed / memUsage.heapTotal;
    const rssUsageRate = memUsage.rss / memoryConfig.maxHeapSize;
    
    // 记录内存使用历史
    const memoryData = {
      timestamp: now,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      heapUsageRate: heapUsageRate,
      rss: memUsage.rss,
      rssUsageRate: rssUsageRate,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers || 0
    };
    
    memoryHistory.push(memoryData);
    
    // 保持历史记录在指定大小内
    if (memoryHistory.length > memoryConfig.leakDetection.historySize) {
      memoryHistory.shift();
    }
    
    // 检查内存泄漏
    if (memoryConfig.leakDetection.enabled && memoryHistory.length >= 10) {
      checkMemoryLeak();
    }
    
    // 内存使用率检查
    if (heapUsageRate > memoryConfig.criticalThreshold) {
      console.log(`🚨 内存使用率严重超标: ${(heapUsageRate * 100).toFixed(2)}%`);
      emergencyMemoryCleanup();
    } else if (heapUsageRate > memoryConfig.warningThreshold) {
      console.log(`⚠️ 内存使用率较高: ${(heapUsageRate * 100).toFixed(2)}%`);
      if (heapUsageRate > memoryConfig.gcThreshold) {
        triggerGarbageCollection();
      }
    }
    
    // 更新上次内存使用情况
    lastMemoryUsage = memUsage;
    
    // 发送内存状态到前端
    io.emit('memory-status', {
      current: memoryData,
      history: memoryHistory.slice(-10), // 只发送最近10个数据点
      warning: heapUsageRate > memoryConfig.warningThreshold,
      critical: heapUsageRate > memoryConfig.criticalThreshold
    });
    
  } catch (error) {
    console.error('❌ 内存监控失败:', error);
  }
}

// 检查内存泄漏
function checkMemoryLeak() {
  try {
    if (memoryHistory.length < 10) return;
    
    // 计算最近10个采样点的内存增长率
    const recentHistory = memoryHistory.slice(-10);
    const firstSample = recentHistory[0];
    const lastSample = recentHistory[recentHistory.length - 1];
    
    const timeDiff = lastSample.timestamp - firstSample.timestamp;
    const heapGrowth = lastSample.heapUsed - firstSample.heapUsed;
    const growthRate = heapGrowth / firstSample.heapUsed;
    
    // 如果内存持续增长且增长率超过阈值，可能存在内存泄漏
    if (growthRate > memoryConfig.leakDetection.growthThreshold && timeDiff > 5 * 60 * 1000) {
      if (!memoryLeakWarning) {
        console.log(`🚨 检测到可能的内存泄漏，增长率: ${(growthRate * 100).toFixed(2)}%`);
        memoryLeakWarning = true;
        
        // 发送内存泄漏警告到前端
        io.emit('memory-leak-warning', {
          message: '检测到可能的内存泄漏',
          growthRate: growthRate,
          timeSpan: timeDiff / 1000,
          recommendation: '建议检查代码中是否存在内存泄漏问题'
        });
      }
    } else if (growthRate <= memoryConfig.leakDetection.growthThreshold) {
      memoryLeakWarning = false;
    }
    
  } catch (error) {
    console.error('❌ 内存泄漏检查失败:', error);
  }
}

// 触发垃圾回收
function triggerGarbageCollection() {
  try {
    if (global.gc) {
      const beforeGC = process.memoryUsage();
      global.gc();
      const afterGC = process.memoryUsage();
      
      const freedMemory = beforeGC.heapUsed - afterGC.heapUsed;
      console.log(`🔄 垃圾回收完成，释放内存: ${Math.round(freedMemory / 1024 / 1024)}MB`);
      
      // 发送垃圾回收结果到前端
      io.emit('garbage-collection', {
        freedMemory: Math.round(freedMemory / 1024 / 1024),
        beforeGC: Math.round(beforeGC.heapUsed / 1024 / 1024),
        afterGC: Math.round(afterGC.heapUsed / 1024 / 1024)
      });
    } else {
      console.log('⚠️ 垃圾回收不可用，请使用 --expose-gc 启动参数');
    }
  } catch (error) {
    console.error('❌ 垃圾回收失败:', error);
  }
}

// 紧急内存清理
function emergencyMemoryCleanup() {
  try {
    console.log('🚨 执行紧急内存清理...');
    
    // 强制清理过期数据
    cleanupExpiredData();
    
    // 清理内存历史记录（保留最近20个）
    if (memoryHistory.length > 20) {
      memoryHistory.splice(0, memoryHistory.length - 20);
    }
    
    // 强制垃圾回收
    triggerGarbageCollection();
    
    // 发送紧急清理通知到前端
    io.emit('emergency-cleanup', {
      message: '已执行紧急内存清理',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 紧急内存清理失败:', error);
  }
}

// 启动内存监控
function startMemoryMonitoring() {
  if (memoryConfig.enabled) {
    setInterval(monitorMemory, memoryConfig.monitorInterval);
    console.log(`🔄 内存监控已启动，监控间隔: ${memoryConfig.monitorInterval / 1000}秒`);
    
    // 立即执行一次监控
    monitorMemory();
  }
}

// 异步处理配置
const asyncConfig = {
  enabled: true,
  maxConcurrent: 10, // 最大并发处理数
  queueSize: 1000, // 队列最大长度
  workerTimeout: 30000, // 工作线程超时时间（30秒）
  retryAttempts: 3, // 重试次数
  retryDelay: 1000 // 重试延迟（1秒）
};

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

// 启动异步任务处理器
function startAsyncProcessor() {
  if (asyncConfig.enabled) {
    console.log(`🔄 异步任务处理器已启动，最大并发: ${asyncConfig.maxConcurrent}`);
    
    // 定期清理已完成的任务
    setInterval(() => {
      // 这里可以添加任务清理逻辑
      if (totalProcessed > 10000) {
        totalProcessed = Math.floor(totalProcessed * 0.9);
        totalFailed = Math.floor(totalFailed * 0.9);
      }
    }, 5 * 60 * 1000); // 5分钟清理一次
  }
}

// 获取内存优化配置
app.get('/api/memory/config', (req, res) => {
  res.json({
    success: true,
    data: memoryConfig
  });
});

// 更新内存优化配置
app.put('/api/memory/config', (req, res) => {
  const { enabled, monitorInterval, warningThreshold, criticalThreshold, maxHeapSize, gcThreshold, leakDetection } = req.body;
  
  if (enabled !== undefined) memoryConfig.enabled = Boolean(enabled);
  if (monitorInterval !== undefined) memoryConfig.monitorInterval = Number(monitorInterval) || 30 * 1000;
  if (warningThreshold !== undefined) memoryConfig.warningThreshold = Number(warningThreshold) || 0.7;
  if (criticalThreshold !== undefined) memoryConfig.criticalThreshold = Number(criticalThreshold) || 0.9;
  if (maxHeapSize !== undefined) memoryConfig.maxHeapSize = Number(maxHeapSize) || 512 * 1024 * 1024;
  if (gcThreshold !== undefined) memoryConfig.gcThreshold = Number(gcThreshold) || 0.8;
  
  if (leakDetection !== undefined) {
    if (leakDetection.enabled !== undefined) memoryConfig.leakDetection.enabled = Boolean(leakDetection.enabled);
    if (leakDetection.sampleInterval !== undefined) memoryConfig.leakDetection.sampleInterval = Number(leakDetection.sampleInterval) || 60 * 1000;
    if (leakDetection.historySize !== undefined) memoryConfig.leakDetection.historySize = Number(leakDetection.historySize) || 60;
    if (leakDetection.growthThreshold !== undefined) memoryConfig.leakDetection.growthThreshold = Number(leakDetection.growthThreshold) || 0.1;
  }
  
  res.json({
    success: true,
    message: '内存优化配置已更新',
    data: memoryConfig
  });
});

// 手动触发垃圾回收
app.post('/api/memory/gc', (req, res) => {
  try {
    triggerGarbageCollection();
    res.json({
      success: true,
      message: '垃圾回收已触发'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取内存使用详情
app.get('/api/memory/status', (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const heapUsageRate = memUsage.heapUsed / memUsage.heapTotal;
    const rssUsageRate = memUsage.rss / memoryConfig.maxHeapSize;
    
    res.json({
      success: true,
      data: {
        current: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          heapUsageRate: heapUsageRate,
          rss: Math.round(memUsage.rss / 1024 / 1024),
          rssUsageRate: rssUsageRate,
          external: Math.round(memUsage.external / 1024 / 1024),
          arrayBuffers: Math.round((memUsage.arrayBuffers || 0) / 1024 / 1024)
        },
        history: memoryHistory.slice(-20), // 返回最近20个数据点
        warning: heapUsageRate > memoryConfig.warningThreshold,
        critical: heapUsageRate > memoryConfig.criticalThreshold,
        leakWarning: memoryLeakWarning,
        config: memoryConfig
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 手动触发内存监控
app.post('/api/memory/monitor', (req, res) => {
  try {
    monitorMemory();
    res.json({
      success: true,
      message: '内存监控已触发'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 紧急内存清理
app.post('/api/memory/emergency-cleanup', (req, res) => {
  try {
    emergencyMemoryCleanup();
    res.json({
      success: true,
      message: '紧急内存清理已执行'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取异步处理配置
app.get('/api/async/config', (req, res) => {
  res.json({
    success: true,
    data: asyncConfig
  });
});

// 更新异步处理配置
app.put('/api/async/config', (req, res) => {
  const { enabled, maxConcurrent, queueSize, workerTimeout, retryAttempts, retryDelay } = req.body;
  
  if (enabled !== undefined) asyncConfig.enabled = Boolean(enabled);
  if (maxConcurrent !== undefined) asyncConfig.maxConcurrent = Number(maxConcurrent) || 10;
  if (queueSize !== undefined) asyncConfig.queueSize = Number(queueSize) || 1000;
  if (workerTimeout !== undefined) asyncConfig.workerTimeout = Number(workerTimeout) || 30000;
  if (retryAttempts !== undefined) asyncConfig.retryAttempts = Number(retryAttempts) || 3;
  if (retryDelay !== undefined) asyncConfig.retryDelay = Number(retryDelay) || 1000;
  
  res.json({
    success: true,
    message: '异步处理配置已更新',
    data: asyncConfig
  });
});

// 获取异步处理状态
app.get('/api/async/status', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        enabled: asyncConfig.enabled,
        queueLength: asyncQueue.length,
        activeWorkers: activeWorkers,
        maxConcurrent: asyncConfig.maxConcurrent,
        totalProcessed: totalProcessed,
        totalFailed: totalFailed,
        queueSize: asyncConfig.queueSize,
        queueUsage: (asyncQueue.length / asyncConfig.queueSize * 100).toFixed(2)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 手动触发异步任务
app.post('/api/async/trigger', (req, res) => {
  try {
    const { webhookId, priority = 'normal' } = req.body;
    
    if (!webhookId) {
      return res.status(400).json({
        success: false,
        error: '缺少webhookId参数'
      });
    }
    
    // 创建测试任务
    const testLogData = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      method: 'POST',
      url: `/webhook/${webhookId}`,
      headers: { 'Content-Type': 'application/json' },
      body: { test: true, priority: priority },
      ip: '127.0.0.1'
    };
    
    const task = new AsyncTask(webhookId, testLogData, priority);
    const added = addToQueue(task);
    
    if (added) {
      res.json({
        success: true,
        message: '异步任务已添加到队列',
        taskId: task.id,
        priority: priority
      });
    } else {
      res.status(503).json({
        success: false,
        error: '队列已满，无法添加任务'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 清空异步队列
app.post('/api/async/clear-queue', (req, res) => {
  try {
    const clearedCount = asyncQueue.length;
    asyncQueue.length = 0;
    
    res.json({
      success: true,
      message: `异步队列已清空，清理了 ${clearedCount} 个任务`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取压缩配置
app.get('/api/compression/config', (req, res) => {
  res.json({
    success: true,
    data: compressionConfig
  });
});

// 更新压缩配置
app.put('/api/compression/config', (req, res) => {
  const { enabled, threshold, level, windowBits, memLevel } = req.body;
  
  if (enabled !== undefined) compressionConfig.enabled = Boolean(enabled);
  if (threshold !== undefined) compressionConfig.threshold = Number(threshold) || 1024;
  if (level !== undefined) compressionConfig.level = Math.max(0, Math.min(9, Number(level) || 6));
  if (windowBits !== undefined) compressionConfig.windowBits = Number(windowBits) || 15;
  if (memLevel !== undefined) compressionConfig.memLevel = Math.max(1, Math.min(9, Number(memLevel) || 8));
  
  res.json({
    success: true,
    message: '压缩配置已更新',
    data: compressionConfig
  });
});

// 获取压缩统计信息
app.get('/api/compression/stats', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        ...compressionStats,
        totalBytesSavedMB: (compressionStats.totalBytesSaved / 1024 / 1024).toFixed(2),
        compressionEfficiency: compressionStats.totalRequests > 0 ? 
          (compressionStats.compressedRequests / compressionStats.totalRequests * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 手动压缩数据
app.post('/api/compression/compress', async (req, res) => {
  try {
    const { data, encoding = 'gzip' } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: '缺少数据参数'
      });
    }
    
    const result = await compressResponseData(data, encoding);
    
    if (result.compressed) {
      updateCompressionStats(result.originalSize, result.compressedSize);
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 重置压缩统计
app.post('/api/compression/reset-stats', (req, res) => {
  try {
    Object.assign(compressionStats, {
      totalRequests: 0,
      compressedRequests: 0,
      totalBytesSaved: 0,
      averageCompressionRatio: 0
    });
    
    res.json({
      success: true,
      message: '压缩统计已重置'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Webhook工具已启动，访问地址: http://${HOST}:${PORT}`);
  console.log(`配置管理界面: http://${HOST}:${PORT}/config-manager.html`);
  console.log(`当前环境: ${configManager.env}`);
  console.log(`配置状态: ${configManager.isValid() ? '有效' : '无效'}`);
  startCleanupTask(); // 启动定时清理任务
  startMemoryMonitoring(); // 启动内存监控
  startAsyncProcessor(); // 启动异步任务处理器
});