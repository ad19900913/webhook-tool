// 系统监控页面逻辑
class SystemMonitorUI {
    constructor() {
        this.charts = {};
        this.updateInterval = null;
        this.isMonitoring = false;
        this.init();
    }

    init() {
        this.bindEvents();
        this.initCharts();
        this.loadThresholds();
        this.checkMonitorStatus();
    }

    bindEvents() {
        // 返回主页
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = 'index.html';
        });

        // 刷新数据
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });

        // 启动监控
        document.getElementById('startMonitorBtn').addEventListener('click', () => {
            this.startMonitoring();
        });

        // 停止监控
        document.getElementById('stopMonitorBtn').addEventListener('click', () => {
            this.stopMonitoring();
        });

        // 监控间隔变化
        document.getElementById('monitorInterval').addEventListener('change', (e) => {
            if (this.isMonitoring) {
                this.restartMonitoring();
            }
        });

        // 保存阈值
        document.getElementById('saveThresholdsBtn').addEventListener('click', () => {
            this.saveThresholds();
        });

        // 清除告警
        document.getElementById('clearAlertsBtn').addEventListener('click', () => {
            this.clearAlerts();
        });

        // 告警过滤
        document.getElementById('alertFilter').addEventListener('change', (e) => {
            this.filterAlerts(e.target.value);
        });

        // 历史数据类型变化
        document.getElementById('historyType').addEventListener('change', () => {
            this.loadHistoryData();
        });

        // 历史数据条数变化
        document.getElementById('historyLimit').addEventListener('change', () => {
            this.loadHistoryData();
        });

        // 导出历史数据
        document.getElementById('exportHistoryBtn').addEventListener('click', () => {
            this.exportHistoryData();
        });
    }

    // 初始化图表
    initCharts() {
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'second',
                        displayFormats: {
                            second: 'HH:mm:ss'
                        }
                    },
                    ticks: {
                        maxTicksLimit: 10
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        };

        // CPU使用率图表
        this.charts.cpu = new Chart(document.getElementById('cpuChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'CPU使用率',
                    data: [],
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: chartOptions
        });

        // 内存使用率图表
        this.charts.memory = new Chart(document.getElementById('memoryChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '内存使用率',
                    data: [],
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: chartOptions
        });

        // 磁盘使用率图表
        this.charts.disk = new Chart(document.getElementById('diskChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '磁盘使用率',
                    data: [],
                    borderColor: '#FF9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: chartOptions
        });

        // 系统负载图表
        this.charts.load = new Chart(document.getElementById('loadChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '系统负载',
                    data: [],
                    borderColor: '#9C27B0',
                    backgroundColor: 'rgba(156, 39, 176, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                ...chartOptions,
                scales: {
                    ...chartOptions.scales,
                    y: {
                        beginAtZero: true,
                        max: 10,
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
    }

    // 检查监控状态
    async checkMonitorStatus() {
        try {
            const response = await fetch('/api/system-monitor/status');
            const result = await response.json();
            
            if (result.success) {
                this.updateMonitorStatus(result.data.monitoring);
            }
        } catch (error) {
            console.error('检查监控状态失败:', error);
        }
    }

    // 启动监控
    async startMonitoring() {
        try {
            const interval = document.getElementById('monitorInterval').value;
            const response = await fetch('/api/system-monitor/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ interval: parseInt(interval) })
            });

            const result = await response.json();
            if (result.success) {
                this.updateMonitorStatus(true);
                this.startDataUpdates();
                this.showMessage('监控已启动', 'success');
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('启动监控失败:', error);
            this.showMessage('启动监控失败', 'error');
        }
    }

    // 停止监控
    async stopMonitoring() {
        try {
            const response = await fetch('/api/system-monitor/stop', {
                method: 'POST'
            });

            const result = await response.json();
            if (result.success) {
                this.updateMonitorStatus(false);
                this.stopDataUpdates();
                this.showMessage('监控已停止', 'success');
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('停止监控失败:', error);
            this.showMessage('停止监控失败', 'error');
        }
    }

    // 重启监控
    async restartMonitoring() {
        if (this.isMonitoring) {
            await this.stopMonitoring();
            setTimeout(() => {
                this.startMonitoring();
            }, 1000);
        }
    }

    // 更新监控状态
    updateMonitorStatus(monitoring) {
        this.isMonitoring = monitoring;
        const statusElement = document.getElementById('monitorStatus');
        const startBtn = document.getElementById('startMonitorBtn');
        const stopBtn = document.getElementById('stopMonitorBtn');

        if (monitoring) {
            statusElement.textContent = '运行中';
            statusElement.className = 'status-indicator running';
            startBtn.disabled = true;
            stopBtn.disabled = false;
        } else {
            statusElement.textContent = '已停止';
            statusElement.className = 'status-indicator stopped';
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }
    }

    // 开始数据更新
    startDataUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        const interval = parseInt(document.getElementById('monitorInterval').value);
        this.updateInterval = setInterval(() => {
            this.updateSystemOverview();
            this.updateCharts();
            this.updateAlerts();
        }, interval);
    }

    // 停止数据更新
    stopDataUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    // 更新系统概览
    async updateSystemOverview() {
        try {
            const response = await fetch('/api/system-monitor/overview');
            const result = await response.json();
            
            if (result.success) {
                this.updateOverviewUI(result.data);
            }
        } catch (error) {
            console.error('更新系统概览失败:', error);
        }
    }

    // 更新概览UI
    updateOverviewUI(data) {
        // CPU信息
        if (data.cpu) {
            document.getElementById('cpuUsage').textContent = data.cpu.usage + '%';
            document.getElementById('cpuCores').textContent = data.cpu.cores;
            document.getElementById('cpuLoad').textContent = data.cpu.loadAverage['1min'].toFixed(2);
            
            const cpuProgress = document.getElementById('cpuProgress');
            cpuProgress.style.width = data.cpu.usage + '%';
            cpuProgress.className = this.getProgressClass(data.cpu.usage);
        }

        // 内存信息
        if (data.memory) {
            document.getElementById('memoryUsage').textContent = data.memory.usage + '%';
            document.getElementById('memoryUsed').textContent = data.memory.used;
            document.getElementById('memoryFree').textContent = data.memory.free;
            
            const memoryProgress = document.getElementById('memoryProgress');
            memoryProgress.style.width = data.memory.usage + '%';
            memoryProgress.className = this.getProgressClass(data.memory.usage);
        }

        // 磁盘信息
        if (data.disk) {
            document.getElementById('diskUsage').textContent = data.disk.totalUsage + '%';
            document.getElementById('diskFilesystems').textContent = data.disk.filesystems.length;
            
            const diskProgress = document.getElementById('diskProgress');
            diskProgress.style.width = data.disk.totalUsage + '%';
            diskProgress.className = this.getProgressClass(data.disk.totalUsage);
        }

        // 网络信息
        if (data.network) {
            document.getElementById('networkInterfaces').textContent = data.network.interfaces.length;
            document.getElementById('networkActiveConnections').textContent = data.network.activeConnections;
            document.getElementById('networkConnections').textContent = data.network.activeConnections;
        }
    }

    // 更新图表
    async updateCharts() {
        try {
            const response = await fetch('/api/system-monitor/metrics');
            const result = await response.json();
            
            if (result.success) {
                this.updateChartData(result.data);
            }
        } catch (error) {
            console.error('更新图表失败:', error);
        }
    }

    // 更新图表数据
    updateChartData(metrics) {
        const now = new Date();

        // CPU图表
        if (metrics.cpu) {
            this.updateChart(this.charts.cpu, now, metrics.cpu.usage);
        }

        // 内存图表
        if (metrics.memory) {
            this.updateChart(this.charts.memory, now, metrics.memory.usage);
        }

        // 磁盘图表
        if (metrics.disk) {
            this.updateChart(this.charts.disk, now, metrics.disk.totalUsage);
        }

        // 负载图表
        if (metrics.cpu) {
            this.updateChart(this.charts.load, now, metrics.cpu.loadAverage['1min']);
        }
    }

    // 更新单个图表
    updateChart(chart, time, value) {
        const maxDataPoints = 50;
        
        chart.data.labels.push(time);
        chart.data.datasets[0].data.push(value);

        if (chart.data.labels.length > maxDataPoints) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }

        chart.update('none');
    }

    // 更新告警
    async updateAlerts() {
        try {
            const response = await fetch('/api/system-monitor/alerts');
            const result = await response.json();
            
            if (result.success) {
                this.updateAlertsUI(result.data.alerts);
            }
        } catch (error) {
            console.error('更新告警失败:', error);
        }
    }

    // 更新告警UI
    updateAlertsUI(alerts) {
        document.getElementById('alertsCount').textContent = alerts.length;
        
        const alertsList = document.getElementById('alertsList');
        alertsList.innerHTML = '';

        if (alerts.length === 0) {
            alertsList.innerHTML = '<div class="no-alerts">暂无告警</div>';
            return;
        }

        alerts.forEach(alert => {
            const alertElement = document.createElement('div');
            alertElement.className = `alert-item ${alert.level}`;
            alertElement.innerHTML = `
                <div class="alert-header">
                    <span class="alert-level">${this.getAlertLevelText(alert.level)}</span>
                    <span class="alert-time">${this.formatTime(alert.timestamp)}</span>
                </div>
                <div class="alert-message">${alert.message}</div>
                <div class="alert-details">
                    <span>类型: ${alert.type}</span>
                    <span>值: ${alert.value}%</span>
                    <span>阈值: ${alert.threshold}%</span>
                </div>
            `;
            alertsList.appendChild(alertElement);
        });
    }

    // 获取告警级别文本
    getAlertLevelText(level) {
        const levelMap = {
            warning: '⚠️ 警告',
            critical: '🚨 严重'
        };
        return levelMap[level] || level;
    }

    // 加载阈值设置
    async loadThresholds() {
        try {
            const response = await fetch('/api/system-monitor/thresholds');
            const result = await response.json();
            
            if (result.success) {
                this.updateThresholdsUI(result.data);
            }
        } catch (error) {
            console.error('加载阈值失败:', error);
        }
    }

    // 更新阈值UI
    updateThresholdsUI(thresholds) {
        document.getElementById('cpuWarning').value = thresholds.cpu.warning;
        document.getElementById('cpuCritical').value = thresholds.cpu.critical;
        document.getElementById('memoryWarning').value = thresholds.memory.warning;
        document.getElementById('memoryCritical').value = thresholds.memory.critical;
        document.getElementById('diskWarning').value = thresholds.disk.warning;
        document.getElementById('diskCritical').value = thresholds.disk.critical;
    }

    // 保存阈值
    async saveThresholds() {
        try {
            const thresholds = {
                cpu: {
                    warning: parseInt(document.getElementById('cpuWarning').value),
                    critical: parseInt(document.getElementById('cpuCritical').value)
                },
                memory: {
                    warning: parseInt(document.getElementById('memoryWarning').value),
                    critical: parseInt(document.getElementById('memoryCritical').value)
                },
                disk: {
                    warning: parseInt(document.getElementById('diskWarning').value),
                    critical: parseInt(document.getElementById('diskCritical').value)
                }
            };

            const response = await fetch('/api/system-monitor/thresholds', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(thresholds)
            });

            const result = await response.json();
            if (result.success) {
                this.showMessage('阈值已保存', 'success');
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('保存阈值失败:', error);
            this.showMessage('保存阈值失败', 'error');
        }
    }

    // 清除告警
    async clearAlerts() {
        try {
            const response = await fetch('/api/system-monitor/alerts', {
                method: 'DELETE'
            });

            const result = await response.json();
            if (result.success) {
                this.updateAlerts();
                this.showMessage('告警已清除', 'success');
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('清除告警失败:', error);
            this.showMessage('清除告警失败', 'error');
        }
    }

    // 过滤告警
    filterAlerts(level) {
        const alertItems = document.querySelectorAll('.alert-item');
        alertItems.forEach(item => {
            if (!level || item.classList.contains(level)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    // 加载历史数据
    async loadHistoryData() {
        try {
            const type = document.getElementById('historyType').value;
            const limit = document.getElementById('historyLimit').value;
            
            const response = await fetch(`/api/system-monitor/history/${type}?limit=${limit}`);
            const result = await response.json();
            
            if (result.success) {
                this.displayHistoryData(result.data);
            }
        } catch (error) {
            console.error('加载历史数据失败:', error);
        }
    }

    // 显示历史数据
    displayHistoryData(data) {
        const historyData = document.getElementById('historyData');
        
        if (data.count === 0) {
            historyData.innerHTML = '<div class="no-data">暂无历史数据</div>';
            return;
        }

        let html = '<div class="history-table">';
        html += '<table><thead><tr>';
        
        // 根据数据类型生成表头
        if (data.type === 'cpu') {
            html += '<th>时间</th><th>使用率</th><th>负载</th><th>核心数</th>';
        } else if (data.type === 'memory') {
            html += '<th>时间</th><th>使用率</th><th>已用</th><th>可用</th>';
        } else if (data.type === 'disk') {
            html += '<th>时间</th><th>总使用率</th><th>文件系统数</th>';
        } else if (data.type === 'network') {
            html += '<th>时间</th><th>接口数</th><th>连接数</th>';
        } else if (data.type === 'process') {
            html += '<th>时间</th><th>总进程</th><th>运行中</th><th>线程数</th>';
        }
        
        html += '</tr></thead><tbody>';

        // 生成数据行
        data.data.forEach(item => {
            html += '<tr>';
            html += `<td>${this.formatTime(item.timestamp)}</td>`;
            
            if (data.type === 'cpu') {
                html += `<td>${item.usage}%</td>`;
                html += `<td>${item.loadAverage['1min'].toFixed(2)}</td>`;
                html += `<td>${item.cores}</td>`;
            } else if (data.type === 'memory') {
                html += `<td>${item.usage}%</td>`;
                html += `<td>${item.used}</td>`;
                html += `<td>${item.free}</td>`;
            } else if (data.type === 'disk') {
                html += `<td>${item.totalUsage}%</td>`;
                html += `<td>${item.filesystems.length}</td>`;
            } else if (data.type === 'network') {
                html += `<td>${item.interfaces.length}</td>`;
                html += `<td>${item.activeConnections}</td>`;
            } else if (data.type === 'process') {
                html += `<td>${item.total}</td>`;
                html += `<td>${item.running}</td>`;
                html += `<td>${item.threads}</td>`;
            }
            
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        historyData.innerHTML = html;
    }

    // 导出历史数据
    async exportHistoryData() {
        try {
            const type = document.getElementById('historyType').value;
            const limit = document.getElementById('historyLimit').value;
            
            const response = await fetch(`/api/system-monitor/export/json?type=${type}&limit=${limit}`);
            const data = await response.json();
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `system-monitor-${type}-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showMessage('数据导出成功', 'success');
        } catch (error) {
            console.error('导出数据失败:', error);
            this.showMessage('导出数据失败', 'error');
        }
    }

    // 刷新数据
    refreshData() {
        this.updateSystemOverview();
        this.updateCharts();
        this.updateAlerts();
        this.loadHistoryData();
    }

    // 获取进度条样式类
    getProgressClass(value) {
        if (value >= 95) return 'progress-fill critical';
        if (value >= 80) return 'progress-fill warning';
        return 'progress-fill normal';
    }

    // 格式化时间
    formatTime(timestamp) {
        return new Date(timestamp).toLocaleString('zh-CN');
    }

    // 显示消息
    showMessage(message, type = 'info') {
        // 创建消息元素
        const messageElement = document.createElement('div');
        messageElement.className = `message message-${type}`;
        messageElement.textContent = message;
        
        // 添加到页面
        document.body.appendChild(messageElement);
        
        // 自动移除
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 3000);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new SystemMonitorUI();
});
