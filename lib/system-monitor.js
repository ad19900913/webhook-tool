const si = require('systeminformation');
const os = require('os');
const EventEmitter = require('events');

class SystemMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            interval: options.interval || 5000, // 监控间隔，默认5秒
            enableCpu: options.enableCpu !== false,
            enableMemory: options.enableMemory !== false,
            enableDisk: options.enableDisk !== false,
            enableNetwork: options.enableNetwork !== false,
            enableProcess: options.enableProcess !== false,
            maxHistory: options.maxHistory || 100, // 最大历史记录数
            ...options
        };
        
        this.monitoring = false;
        this.intervalId = null;
        this.history = {
            cpu: [],
            memory: [],
            disk: [],
            network: [],
            process: []
        };
        this.alerts = [];
        this.thresholds = {
            cpu: { warning: 80, critical: 95 },
            memory: { warning: 80, critical: 95 },
            disk: { warning: 85, critical: 95 }
        };
    }

    // 启动监控
    start() {
        if (this.monitoring) {
            return false;
        }

        this.monitoring = true;
        this.intervalId = setInterval(() => {
            this.collectMetrics();
        }, this.options.interval);

        // 立即收集一次指标
        this.collectMetrics();
        
        console.log('系统监控已启动');
        return true;
    }

    // 停止监控
    stop() {
        if (!this.monitoring) {
            return false;
        }

        this.monitoring = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        console.log('系统监控已停止');
        return true;
    }

    // 收集系统指标
    async collectMetrics() {
        try {
            const timestamp = Date.now();
            const metrics = {};

            // CPU 监控
            if (this.options.enableCpu) {
                metrics.cpu = await this.getCpuMetrics();
                this.addToHistory('cpu', { timestamp, ...metrics.cpu });
            }

            // 内存监控
            if (this.options.enableMemory) {
                metrics.memory = await this.getMemoryMetrics();
                this.addToHistory('memory', { timestamp, ...metrics.memory });
            }

            // 磁盘监控
            if (this.options.enableDisk) {
                metrics.disk = await this.getDiskMetrics();
                this.addToHistory('disk', { timestamp, ...metrics.disk });
            }

            // 网络监控
            if (this.options.enableNetwork) {
                metrics.network = await this.getNetworkMetrics();
                this.addToHistory('network', { timestamp, ...metrics.network });
            }

            // 进程监控
            if (this.options.enableProcess) {
                metrics.process = await this.getProcessMetrics();
                this.addToHistory('process', { timestamp, ...metrics.process });
            }

            // 检查告警
            this.checkAlerts(metrics);

            // 发送指标事件
            this.emit('metrics', metrics);
            
            return metrics;
        } catch (error) {
            console.error('收集系统指标失败:', error);
            this.emit('error', error);
            return null;
        }
    }

    // 获取CPU指标
    async getCpuMetrics() {
        try {
            const cpuData = await si.cpu();
            const load = os.loadavg();
            
            return {
                usage: Math.round((1 - os.loadavg()[0] / os.cpus().length) * 100),
                loadAverage: {
                    '1min': Math.round(load[0] * 100) / 100,
                    '5min': Math.round(load[1] * 100) / 100,
                    '15min': Math.round(load[2] * 100) / 100
                },
                cores: os.cpus().length,
                model: cpuData.manufacturer + ' ' + cpuData.brand,
                speed: cpuData.speed,
                temperature: cpuData.temperature || null
            };
        } catch (error) {
            console.error('获取CPU指标失败:', error);
            return {
                usage: 0,
                loadAverage: { '1min': 0, '5min': 0, '15min': 0 },
                cores: os.cpus().length,
                model: 'Unknown',
                speed: 0,
                temperature: null
            };
        }
    }

    // 获取内存指标
    async getMemoryMetrics() {
        try {
            const mem = os.totalmem();
            const free = os.freemem();
            const used = mem - free;
            
            return {
                total: this.formatBytes(mem),
                used: this.formatBytes(used),
                free: this.formatBytes(free),
                usage: Math.round((used / mem) * 100),
                totalBytes: mem,
                usedBytes: used,
                freeBytes: free
            };
        } catch (error) {
            console.error('获取内存指标失败:', error);
            return {
                total: '0 B',
                used: '0 B',
                free: '0 B',
                usage: 0,
                totalBytes: 0,
                usedBytes: 0,
                freeBytes: 0
            };
        }
    }

    // 获取磁盘指标
    async getDiskMetrics() {
        try {
            const diskData = await si.fsSize();
            const diskMetrics = diskData.map(fs => ({
                filesystem: fs.fs,
                size: this.formatBytes(fs.size * 1024 * 1024),
                used: this.formatBytes(fs.used * 1024 * 1024),
                available: this.formatBytes(fs.available * 1024 * 1024),
                usage: Math.round((fs.used / fs.size) * 100),
                mount: fs.mount,
                type: fs.type
            }));

            return {
                filesystems: diskMetrics,
                totalUsage: Math.round(diskMetrics.reduce((sum, fs) => sum + fs.usage, 0) / diskMetrics.length)
            };
        } catch (error) {
            console.error('获取磁盘指标失败:', error);
            return {
                filesystems: [],
                totalUsage: 0
            };
        }
    }

    // 获取网络指标
    async getNetworkMetrics() {
        try {
            const networkData = await si.networkStats();
            const networkInterfaces = os.networkInterfaces();
            
            const interfaces = Object.keys(networkInterfaces).map(name => {
                const iface = networkInterfaces[name];
                const ipv4 = iface.find(addr => addr.family === 'IPv4');
                const ipv6 = iface.find(addr => addr.family === 'IPv6');
                
                return {
                    name,
                    ipv4: ipv4 ? ipv4.address : null,
                    ipv6: ipv6 ? ipv6.address : null,
                    mac: ipv4 ? ipv4.mac : null,
                    internal: ipv4 ? ipv4.internal : false
                };
            });

            return {
                interfaces,
                activeConnections: networkData.length > 0 ? networkData[0].connections || 0 : 0
            };
        } catch (error) {
            console.error('获取网络指标失败:', error);
            return {
                interfaces: [],
                activeConnections: 0
            };
        }
    }

    // 获取进程指标
    async getProcessMetrics() {
        try {
            const processData = await si.processes();
            
            return {
                total: processData.all || 0,
                running: processData.running || 0,
                sleeping: processData.sleeping || 0,
                stopped: processData.stopped || 0,
                zombie: processData.zombie || 0,
                threads: processData.threads || 0
            };
        } catch (error) {
            console.error('获取进程指标失败:', error);
            return {
                total: 0,
                running: 0,
                sleeping: 0,
                stopped: 0,
                zombie: 0,
                threads: 0
            };
        }
    }

    // 添加指标到历史记录
    addToHistory(type, data) {
        if (!this.history[type]) {
            this.history[type] = [];
        }

        this.history[type].push(data);

        // 限制历史记录数量
        if (this.history[type].length > this.options.maxHistory) {
            this.history[type] = this.history[type].slice(-this.options.maxHistory);
        }
    }

    // 检查告警
    checkAlerts(metrics) {
        const alerts = [];

        // CPU 告警检查
        if (metrics.cpu && metrics.cpu.usage >= this.thresholds.cpu.critical) {
            alerts.push({
                level: 'critical',
                type: 'cpu',
                message: `CPU使用率过高: ${metrics.cpu.usage}%`,
                value: metrics.cpu.usage,
                threshold: this.thresholds.cpu.critical,
                timestamp: Date.now()
            });
        } else if (metrics.cpu && metrics.cpu.usage >= this.thresholds.cpu.warning) {
            alerts.push({
                level: 'warning',
                type: 'cpu',
                message: `CPU使用率较高: ${metrics.cpu.usage}%`,
                value: metrics.cpu.usage,
                threshold: this.thresholds.cpu.warning,
                timestamp: Date.now()
            });
        }

        // 内存告警检查
        if (metrics.memory && metrics.memory.usage >= this.thresholds.memory.critical) {
            alerts.push({
                level: 'critical',
                type: 'memory',
                message: `内存使用率过高: ${metrics.memory.usage}%`,
                value: metrics.memory.usage,
                threshold: this.thresholds.memory.critical,
                timestamp: Date.now()
            });
        } else if (metrics.memory && metrics.memory.usage >= this.thresholds.memory.warning) {
            alerts.push({
                level: 'warning',
                type: 'memory',
                message: `内存使用率较高: ${metrics.memory.usage}%`,
                value: metrics.memory.usage,
                threshold: this.thresholds.memory.warning,
                timestamp: Date.now()
            });
        }

        // 磁盘告警检查
        if (metrics.disk && metrics.disk.totalUsage >= this.thresholds.disk.critical) {
            alerts.push({
                level: 'critical',
                type: 'disk',
                message: `磁盘使用率过高: ${metrics.disk.totalUsage}%`,
                value: metrics.disk.totalUsage,
                threshold: this.thresholds.disk.critical,
                timestamp: Date.now()
            });
        } else if (metrics.disk && metrics.disk.totalUsage >= this.thresholds.disk.warning) {
            alerts.push({
                level: 'warning',
                type: 'disk',
                message: `磁盘使用率较高: ${metrics.disk.totalUsage}%`,
                value: metrics.disk.totalUsage,
                threshold: this.thresholds.disk.warning,
                timestamp: Date.now()
            });
        }

        // 添加新告警
        this.alerts.push(...alerts);

        // 限制告警数量
        if (this.alerts.length > 100) {
            this.alerts = this.alerts.slice(-100);
        }

        // 发送告警事件
        if (alerts.length > 0) {
            this.emit('alerts', alerts);
        }
    }

    // 设置告警阈值
    setThresholds(thresholds) {
        this.thresholds = { ...this.thresholds, ...thresholds };
    }

    // 获取告警阈值
    getThresholds() {
        return { ...this.thresholds };
    }

    // 获取历史数据
    getHistory(type, limit = null) {
        if (!this.history[type]) {
            return [];
        }

        const data = [...this.history[type]];
        if (limit && limit > 0) {
            return data.slice(-limit);
        }
        return data;
    }

    // 获取所有历史数据
    getAllHistory() {
        return { ...this.history };
    }

    // 获取告警列表
    getAlerts(level = null, type = null) {
        let alerts = [...this.alerts];
        
        if (level) {
            alerts = alerts.filter(alert => alert.level === level);
        }
        
        if (type) {
            alerts = alerts.filter(alert => alert.type === type);
        }
        
        return alerts;
    }

    // 清除告警
    clearAlerts(level = null, type = null) {
        if (level && type) {
            this.alerts = this.alerts.filter(alert => !(alert.level === level && alert.type === type));
        } else if (level) {
            this.alerts = this.alerts.filter(alert => alert.level !== level);
        } else if (type) {
            this.alerts = this.alerts.filter(alert => alert.type !== type);
        } else {
            this.alerts = [];
        }
    }

    // 获取系统概览
    async getSystemOverview() {
        try {
            const [cpu, memory, disk, network, process] = await Promise.all([
                this.getCpuMetrics(),
                this.getMemoryMetrics(),
                this.getDiskMetrics(),
                this.getNetworkMetrics(),
                this.getProcessMetrics()
            ]);

            return {
                timestamp: Date.now(),
                uptime: os.uptime(),
                platform: os.platform(),
                arch: os.arch(),
                nodeVersion: process.version,
                cpu,
                memory,
                disk,
                network,
                process
            };
        } catch (error) {
            console.error('获取系统概览失败:', error);
            return null;
        }
    }

    // 格式化字节数
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    // 获取监控状态
    getStatus() {
        return {
            monitoring: this.monitoring,
            interval: this.options.interval,
            options: { ...this.options },
            historyCounts: Object.keys(this.history).reduce((acc, key) => {
                acc[key] = this.history[key].length;
                return acc;
            }, {}),
            alertCount: this.alerts.length
        };
    }
}

module.exports = SystemMonitor;
