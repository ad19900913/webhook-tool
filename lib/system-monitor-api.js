const express = require('express');
const SystemMonitor = require('./system-monitor');

const router = express.Router();

// 创建系统监控实例
const systemMonitor = new SystemMonitor({
    interval: 5000,
    enableCpu: true,
    enableMemory: true,
    enableDisk: true,
    enableNetwork: true,
    enableProcess: true,
    maxHistory: 100
});

// 启动监控
router.post('/start', (req, res) => {
    try {
        const options = req.body || {};
        if (options.interval) {
            systemMonitor.options.interval = options.interval;
        }
        
        const result = systemMonitor.start();
        if (result) {
            res.json({
                success: true,
                message: '系统监控已启动',
                status: systemMonitor.getStatus()
            });
        } else {
            res.status(400).json({
                success: false,
                message: '系统监控已在运行中'
            });
        }
    } catch (error) {
        console.error('启动系统监控失败:', error);
        res.status(500).json({
            success: false,
            message: '启动系统监控失败',
            error: error.message
        });
    }
});

// 停止监控
router.post('/stop', (req, res) => {
    try {
        const result = systemMonitor.stop();
        if (result) {
            res.json({
                success: true,
                message: '系统监控已停止',
                status: systemMonitor.getStatus()
            });
        } else {
            res.status(400).json({
                success: false,
                message: '系统监控未在运行'
            });
        }
    } catch (error) {
        console.error('停止系统监控失败:', error);
        res.status(500).json({
            success: false,
            message: '停止系统监控失败',
            error: error.message
        });
    }
});

// 获取监控状态
router.get('/status', (req, res) => {
    try {
        const status = systemMonitor.getStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('获取监控状态失败:', error);
        res.status(500).json({
            success: false,
            message: '获取监控状态失败',
            error: error.message
        });
    }
});

// 获取系统概览
router.get('/overview', async (req, res) => {
    try {
        const overview = await systemMonitor.getSystemOverview();
        if (overview) {
            res.json({
                success: true,
                data: overview
            });
        } else {
            res.status(500).json({
                success: false,
                message: '获取系统概览失败'
            });
        }
    } catch (error) {
        console.error('获取系统概览失败:', error);
        res.status(500).json({
            success: false,
            message: '获取系统概览失败',
            error: error.message
        });
    }
});

// 获取实时指标
router.get('/metrics', async (req, res) => {
    try {
        const metrics = await systemMonitor.collectMetrics();
        if (metrics) {
            res.json({
                success: true,
                data: metrics,
                timestamp: Date.now()
            });
        } else {
            res.status(500).json({
                success: false,
                message: '获取系统指标失败'
            });
        }
    } catch (error) {
        console.error('获取系统指标失败:', error);
        res.status(500).json({
            success: false,
            message: '获取系统指标失败',
            error: error.message
        });
    }
});

// 获取历史数据
router.get('/history/:type', (req, res) => {
    try {
        const { type } = req.params;
        const { limit } = req.query;
        
        const history = systemMonitor.getHistory(type, limit ? parseInt(limit) : null);
        res.json({
            success: true,
            data: {
                type,
                count: history.length,
                data: history
            }
        });
    } catch (error) {
        console.error('获取历史数据失败:', error);
        res.status(500).json({
            success: false,
            message: '获取历史数据失败',
            error: error.message
        });
    }
});

// 获取所有历史数据
router.get('/history', (req, res) => {
    try {
        const history = systemMonitor.getAllHistory();
        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        console.error('获取所有历史数据失败:', error);
        res.status(500).json({
            success: false,
            message: '获取所有历史数据失败',
            error: error.message
        });
    }
});

// 获取告警列表
router.get('/alerts', (req, res) => {
    try {
        const { level, type } = req.query;
        const alerts = systemMonitor.getAlerts(level, type);
        
        res.json({
            success: true,
            data: {
                count: alerts.length,
                alerts: alerts
            }
        });
    } catch (error) {
        console.error('获取告警列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取告警列表失败',
            error: error.message
        });
    }
});

// 清除告警
router.delete('/alerts', (req, res) => {
    try {
        const { level, type } = req.query;
        systemMonitor.clearAlerts(level, type);
        
        res.json({
            success: true,
            message: '告警已清除',
            remainingCount: systemMonitor.getAlerts().length
        });
    } catch (error) {
        console.error('清除告警失败:', error);
        res.status(500).json({
            success: false,
            message: '清除告警失败',
            error: error.message
        });
    }
});

// 获取告警阈值
router.get('/thresholds', (req, res) => {
    try {
        const thresholds = systemMonitor.getThresholds();
        res.json({
            success: true,
            data: thresholds
        });
    } catch (error) {
        console.error('获取告警阈值失败:', error);
        res.status(500).json({
            success: false,
            message: '获取告警阈值失败',
            error: error.message
        });
    }
});

// 设置告警阈值
router.put('/thresholds', (req, res) => {
    try {
        const thresholds = req.body;
        if (!thresholds || typeof thresholds !== 'object') {
            return res.status(400).json({
                success: false,
                message: '无效的阈值数据'
            });
        }

        systemMonitor.setThresholds(thresholds);
        
        res.json({
            success: true,
            message: '告警阈值已更新',
            data: systemMonitor.getThresholds()
        });
    } catch (error) {
        console.error('设置告警阈值失败:', error);
        res.status(500).json({
            success: false,
            message: '设置告警阈值失败',
            error: error.message
        });
    }
});

// 获取监控配置
router.get('/config', (req, res) => {
    try {
        const config = {
            options: systemMonitor.options,
            thresholds: systemMonitor.getThresholds()
        };
        
        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('获取监控配置失败:', error);
        res.status(500).json({
            success: false,
            message: '获取监控配置失败',
            error: error.message
        });
    }
});

// 更新监控配置
router.put('/config', (req, res) => {
    try {
        const { options, thresholds } = req.body;
        
        if (options) {
            Object.assign(systemMonitor.options, options);
        }
        
        if (thresholds) {
            systemMonitor.setThresholds(thresholds);
        }
        
        res.json({
            success: true,
            message: '监控配置已更新',
            data: {
                options: systemMonitor.options,
                thresholds: systemMonitor.getThresholds()
            }
        });
    } catch (error) {
        console.error('更新监控配置失败:', error);
        res.status(500).json({
            success: false,
            message: '更新监控配置失败',
            error: error.message
        });
    }
});

// 导出监控数据
router.get('/export/:format', (req, res) => {
    try {
        const { format } = req.params;
        const { type, limit } = req.query;
        
        if (format === 'json') {
            const data = type ? 
                systemMonitor.getHistory(type, limit ? parseInt(limit) : null) :
                systemMonitor.getAllHistory();
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="system-monitor-${type || 'all'}-${Date.now()}.json"`);
            res.json(data);
        } else {
            res.status(400).json({
                success: false,
                message: '不支持的导出格式，仅支持 JSON'
            });
        }
    } catch (error) {
        console.error('导出监控数据失败:', error);
        res.status(500).json({
            success: false,
            message: '导出监控数据失败',
            error: error.message
        });
    }
});

// 健康检查
router.get('/health', (req, res) => {
    try {
        const status = systemMonitor.getStatus();
        const health = {
            status: 'healthy',
            timestamp: Date.now(),
            monitoring: status.monitoring,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.version
        };
        
        res.json({
            success: true,
            data: health
        });
    } catch (error) {
        console.error('健康检查失败:', error);
        res.status(500).json({
            success: false,
            message: '健康检查失败',
            error: error.message
        });
    }
});

// 错误处理中间件
router.use((error, req, res, next) => {
    console.error('系统监控API错误:', error);
    res.status(500).json({
        success: false,
        message: '内部服务器错误',
        error: error.message
    });
});

module.exports = router;
