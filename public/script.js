// 全局变量
let socket;
let webhooks = [];
let allWebhooks = []; // 保存所有webhook用于搜索
let logs = [];
let allLogs = []; // 保存所有日志用于搜索
let currentEditingWebhook = null;
let selectedWebhookFilter = '';
let selectedMessageTypeFilter = 'all';
let currentTypeStats = {};
let searchFilters = {
    tenantId: '',
    uniqueId: '',
    startTime: '',
    endTime: ''
};
let webhookSearchFilter = ''; // webhook名称搜索过滤器
let alerts = []; // 存储告警信息

// 高级搜索相关变量
let advancedSearchConditions = []; // 存储高级搜索条件
let searchHistory = []; // 存储搜索历史
let currentAdvancedSearch = null; // 当前应用的高级搜索

// 快速过滤相关变量
let quickFilters = []; // 存储快速过滤条件
let savedQuickFilters = []; // 存储已保存的快速过滤
let currentQuickFilter = null; // 当前应用的快速过滤

// 图表对象
let successRateChart = null;
let responseTimeChart = null;
let requestTrendChart = null;
let ipSourceChart = null;
let userAgentChart = null;
let responseTimeDistChart = null;
let performanceChart = null;
let errorTypeChart = null;
let errorTrendChart = null;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 页面加载完成，开始初始化...');
    testServerConnection();
    initializeSocket();
    loadWebhooks();
    bindEvents();
    startMemoryMonitoring();
    initTheme();
    loadQuickFilters(); // 加载快速过滤配置
});

// 测试服务器连接
async function testServerConnection() {
    try {
        console.log('🔍 测试服务器连接...');
        const response = await fetch('/api/system/status');
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ 服务器连接正常，系统状态:', data);
            showNotification('服务器连接正常', 'success');
        } else {
            throw new Error(`服务器响应异常: ${response.status}`);
}

// 安全配置相关函数
async function loadSecurityConfig() {
    try {
        const response = await fetch('/api/security/config');
        const config = await response.json();
        
        // 更新界面
        document.getElementById('enableIpWhitelist').checked = config.enableIpWhitelist;
        document.getElementById('ipWhitelist').value = config.ipWhitelist.join('\n');
        document.getElementById('enableRateLimit').checked = config.rateLimiting.enabled;
        document.getElementById('rateLimitWindow').value = config.rateLimiting.windowMs / (60 * 1000);
        document.getElementById('rateLimitMax').value = config.rateLimiting.maxRequests;
        document.getElementById('enableRequestValidation').checked = config.enableRequestValidation;
        document.getElementById('maxRequestSize').value = config.maxRequestSize / (1024 * 1024);
        document.getElementById('enableSignature').checked = config.requestSignature.enabled;
        document.getElementById('signatureSecret').value = config.requestSignature.secretKey;
        document.getElementById('signatureAlgorithm').value = config.requestSignature.algorithm;
        
    } catch (error) {
        console.error('加载安全配置失败:', error);
    }
}

function openSecurityConfig() {
    document.getElementById('securityConfigModal').style.display = 'block';
    loadSecurityConfig();
}

function closeSecurityConfig() {
    document.getElementById('securityConfigModal').style.display = 'none';
}

async function saveSecurityConfig() {
    const config = {
        enableIpWhitelist: document.getElementById('enableIpWhitelist').checked,
        ipWhitelist: document.getElementById('ipWhitelist').value
            .split('\n')
            .map(ip => ip.trim())
            .filter(ip => ip.length > 0),
        enableRequestValidation: document.getElementById('enableRequestValidation').checked,
        maxRequestSize: parseInt(document.getElementById('maxRequestSize').value) * 1024 * 1024,
        rateLimiting: {
            enabled: document.getElementById('enableRateLimit').checked,
            windowMs: parseInt(document.getElementById('rateLimitWindow').value) * 60 * 1000,
            maxRequests: parseInt(document.getElementById('rateLimitMax').value)
        },
        requestSignature: {
            enabled: document.getElementById('enableSignature').checked,
            secretKey: document.getElementById('signatureSecret').value,
            algorithm: document.getElementById('signatureAlgorithm').value
        }
    };
    
    try {
        const response = await fetch('/api/security/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        if (response.ok) {
            showNotification('安全配置已保存', 'success');
            closeSecurityConfig();
        } else {
            const error = await response.json();
            showNotification('保存失败: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('保存安全配置失败:', error);
        showNotification('保存失败: ' + error.message, 'error');
    }
}

function resetSecurityConfig() {
    if (confirm('确定要重置安全配置为默认值吗？')) {
        document.getElementById('enableIpWhitelist').checked = false;
        document.getElementById('ipWhitelist').value = '';
        document.getElementById('enableRateLimit').checked = true;
        document.getElementById('rateLimitWindow').value = 15;
        document.getElementById('rateLimitMax').value = 100;
        document.getElementById('enableRequestValidation').checked = true;
        document.getElementById('maxRequestSize').value = 10;
        document.getElementById('enableSignature').checked = false;
        document.getElementById('signatureSecret').value = '';
        document.getElementById('signatureAlgorithm').value = 'sha256';
    }
}

// 在页面加载时绑定安全配置事件
document.addEventListener('DOMContentLoaded', function() {
    // 绑定安全配置事件
    if (document.getElementById('securityConfigBtn')) {
        document.getElementById('securityConfigBtn').addEventListener('click', openSecurityConfig);
    }
    
    // 绑定系统监控事件
    if (document.getElementById('systemMonitorBtn')) {
        document.getElementById('systemMonitorBtn').addEventListener('click', openSystemMonitor);
    }
    if (document.getElementById('saveSecurityConfig')) {
        document.getElementById('saveSecurityConfig').addEventListener('click', saveSecurityConfig);
    }
    if (document.getElementById('resetSecurityConfig')) {
        document.getElementById('resetSecurityConfig').addEventListener('click', resetSecurityConfig);
    }
    if (document.getElementById('cancelSecurityConfig')) {
        document.getElementById('cancelSecurityConfig').addEventListener('click', closeSecurityConfig);
    }
    
    // 初始化安全配置
    loadSecurityConfig();
});
    } catch (error) {
        console.error('❌ 服务器连接测试失败:', error);
        showNotification(`服务器连接失败: ${error.message}`, 'error');
        
        // 显示连接错误提示
        const container = document.getElementById('webhookContainer');
        container.innerHTML = `
            <div class="no-logs">
                <div style="color: #e74c3c; margin-bottom: 15px; font-size: 18px;">🚫 服务器连接失败</div>
                <div style="color: #7f8c8d; margin-bottom: 10px;">无法连接到后端服务器</div>
                <div style="font-size: 14px; color: #95a5a6; margin-bottom: 15px;">错误信息: ${error.message}</div>
                <div style="font-size: 12px; color: #95a5a6;">
                    <p>请检查：</p>
                    <ul style="text-align: left; margin: 10px 0;">
                        <li>服务器是否已启动 (node server.js)</li>
                        <li>端口3000是否被占用</li>
                        <li>网络连接是否正常</li>
                    </ul>
                </div>
                <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 10px;">重新加载</button>
            </div>
        `;
    }
}

// 初始化Socket连接
function initializeSocket() {
    console.log('正在初始化Socket连接...');
    
    socket = io({
        timeout: 5000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
    });
    
    socket.on('connect', function() {
        console.log('✅ Socket已连接到服务器，ID:', socket.id);
        showNotification('已连接到服务器', 'success');
    });
    
    socket.on('disconnect', function(reason) {
        console.log('❌ Socket与服务器断开连接，原因:', reason);
        showNotification('与服务器断开连接', 'warning');
    });
    
    socket.on('connect_error', function(error) {
        console.error('❌ Socket连接错误:', error);
        showNotification('连接服务器失败', 'error');
    });
    
    socket.on('reconnect', function(attemptNumber) {
        console.log('🔄 Socket重新连接成功，尝试次数:', attemptNumber);
        showNotification('重新连接成功', 'success');
    });
    
    socket.on('reconnect_error', function(error) {
        console.error('❌ Socket重连失败:', error);
    });
    
    socket.on('webhook-log', function(data) {
        console.log('📨 收到新的webhook日志:', data);
        addLogToUI(data.log, data.webhookId);
    });
    
    socket.on('webhook-alerts', function(data) {
        console.log('⚠️ 收到新的告警信息:', data);
        handleNewAlerts(data.alerts, data.webhookId);
    });
}

// 绑定事件
function bindEvents() {
    // 侧边栏创建按钮
    document.getElementById('createBtn2').addEventListener('click', function() {
        openWebhookModal();
    });
    
    // 模态框关闭
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            closeModal(this.closest('.modal'));
        });
    });
    
    // 点击模态框外部关闭
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target);
        }
    });
    
    // 表单提交
    document.getElementById('webhookForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveWebhook();
    });
    
    // 取消按钮
    document.getElementById('cancelBtn').addEventListener('click', function() {
        closeModal(document.getElementById('webhookModal'));
    });
    
    // 路径类型切换
    document.getElementById('pathType').addEventListener('change', function() {
        toggleCustomPath();
    });
    
    // 延时类型切换
    document.getElementById('delayType').addEventListener('change', function() {
        toggleDelayOptions();
    });
    
    // Webhook过滤器
    document.getElementById('webhookFilter').addEventListener('change', function() {
        selectedWebhookFilter = this.value;
        loadLogsForWebhook();
    });
    
    // 消息类型过滤器
    document.getElementById('messageTypeFilter').addEventListener('change', function() {
        selectedMessageTypeFilter = this.value;
        loadLogsForWebhook();
    });
    
    // 搜索功能
    document.getElementById('tenantIdSearch').addEventListener('input', function() {
        searchFilters.tenantId = this.value.trim();
        applySearchFilters();
    });
    
    document.getElementById('uniqueIdSearch').addEventListener('input', function() {
        searchFilters.uniqueId = this.value.trim();
        applySearchFilters();
    });
    
    document.getElementById('clearSearchBtn').addEventListener('click', function() {
        document.getElementById('tenantIdSearch').value = '';
        document.getElementById('uniqueIdSearch').value = '';
        searchFilters.tenantId = '';
        searchFilters.uniqueId = '';
        applySearchFilters();
    });
    
    // 清空日志按钮
    document.getElementById('clearLogsBtn').addEventListener('click', function() {
        clearLogs();
    });
    
    // 清除高级搜索按钮
    document.getElementById('clearAdvancedSearchBtn').addEventListener('click', function() {
        clearAdvancedSearch();
    });
    
    // 清除快速过滤按钮
    document.getElementById('clearQuickFilterBtn').addEventListener('click', function() {
        clearQuickFilter();
    });
    
    // 导出日志按钮
    document.getElementById('exportLogsBtn').addEventListener('click', function() {
        exportLogs();
    });
    
    // 清空所有日志按钮
    document.getElementById('clearAllLogsBtn').addEventListener('click', function() {
        clearAllLogs();
    });
    
    // Webhook搜索功能
    document.getElementById('webhookSearch').addEventListener('input', function() {
        webhookSearchFilter = this.value.trim();
        applyWebhookSearchFilter();
        toggleClearWebhookSearchBtn();
    });
    
    // 清空Webhook搜索按钮
    document.getElementById('clearWebhookSearchBtn').addEventListener('click', function() {
        document.getElementById('webhookSearch').value = '';
        webhookSearchFilter = '';
        applyWebhookSearchFilter();
        toggleClearWebhookSearchBtn();
    });
    
    // 高级搜索按钮
    document.getElementById('advancedSearchBtn').addEventListener('click', function() {
        openAdvancedSearchModal();
    });
    
    // 时间范围过滤
    document.getElementById('applyTimeFilterBtn').addEventListener('click', function() {
        const startTime = document.getElementById('startTimeFilter').value;
        const endTime = document.getElementById('endTimeFilter').value;
        
        searchFilters.startTime = startTime;
        searchFilters.endTime = endTime;
        
        applySearchFilters();
        showNotification('已应用时间过滤', 'info');
    });
    
    // 清除时间过滤
    document.getElementById('clearTimeFilterBtn').addEventListener('click', function() {
        document.getElementById('startTimeFilter').value = '';
        document.getElementById('endTimeFilter').value = '';
        
        searchFilters.startTime = '';
        searchFilters.endTime = '';
        
        applySearchFilters();
        showNotification('已清除时间过滤', 'info');
    });
    
    // 主题切换
    document.getElementById('themeToggleBtn').addEventListener('click', function() {
        toggleTheme();
    });
    
    // 仪表板配置
    document.getElementById('dashboardConfigBtn').addEventListener('click', function() {
        openDashboardConfig();
    });
    
    // 显示统计图表
    document.getElementById('showStatsBtn').addEventListener('click', function() {
        showStatsSection();
    });
    
    // 关闭统计图表
    document.getElementById('closeStatsBtn').addEventListener('click', function() {
        hideStatsSection();
    });
    
    // 仪表板配置相关事件
    document.getElementById('saveDashboardConfig').addEventListener('click', function() {
        saveDashboardConfig();
    });
    
    document.getElementById('resetDashboardConfig').addEventListener('click', function() {
        resetDashboardConfig();
    });
    
    document.getElementById('cancelDashboardConfig').addEventListener('click', function() {
        closeDashboardConfig();
    });
    
    // 高级搜索模态框相关事件
    document.getElementById('saveSearchCondition').addEventListener('click', function() {
        saveSearchCondition();
    });
    
    document.getElementById('applyAdvancedSearch').addEventListener('click', function() {
        applyAdvancedSearch();
    });
    
    document.getElementById('resetAdvancedSearch').addEventListener('click', function() {
        resetAdvancedSearch();
    });
    
    document.getElementById('cancelAdvancedSearch').addEventListener('click', function() {
        closeAdvancedSearchModal();
    });
    
    document.getElementById('addSearchCondition').addEventListener('click', function() {
        addSearchCondition();
    });
    
    document.getElementById('clearSearchHistory').addEventListener('click', function() {
        clearSearchHistory();
    });
    
    // 高级搜索相关控件事件
    document.getElementById('enableRegexSearch').addEventListener('change', function() {
        toggleRegexHelp();
    });
    
    // 快速过滤按钮
    document.getElementById('quickFilterBtn').addEventListener('click', function() {
        openQuickFilterModal();
    });
    
    // 快速过滤模态框相关事件
    document.getElementById('applyQuickFilter').addEventListener('click', function() {
        applyQuickFilter();
    });
    
    document.getElementById('clearQuickFilter').addEventListener('click', function() {
        clearQuickFilter();
    });
    
    document.getElementById('cancelQuickFilter').addEventListener('click', function() {
        closeQuickFilterModal();
    });
    
    document.getElementById('addCustomFilter').addEventListener('click', function() {
        addCustomFilter();
    });
    
    document.getElementById('searchOperator').addEventListener('change', function() {
        updateSearchOperator();
    });
}

// 加载Webhook列表
async function loadWebhooks() {
    try {
        console.log('正在加载Webhook列表...');
        const response = await fetch('/api/webhooks');
        console.log('Webhook列表响应状态:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('接收到的Webhook数据:', data);
        
        if (data.webhooks) {
            // 新格式：包含内存信息
            allWebhooks = data.webhooks;
            updateMemoryDisplay(data.memoryInfo);
        } else {
            // 兼容旧格式
            allWebhooks = data;
        }
        
        console.log('Webhook列表加载成功，共', allWebhooks.length, '个');
        applyWebhookSearchFilter();
        updateWebhookFilter();
    } catch (error) {
        console.error('加载Webhook列表失败:', error);
        showNotification(`加载Webhook列表失败: ${error.message}`, 'error');
        
        // 显示错误信息
        const container = document.getElementById('webhookContainer');
        container.innerHTML = `
            <div class="no-logs">
                <div style="color: #e74c3c; margin-bottom: 10px;">❌ 加载失败</div>
                <div style="font-size: 14px; color: #7f8c8d;">错误信息: ${error.message}</div>
                <div style="font-size: 12px; color: #95a5a6; margin-top: 10px;">请检查服务器是否正常运行</div>
            </div>
        `;
    }
}

// 开始内存监控
function startMemoryMonitoring() {
    // 每30秒更新一次内存信息
    setInterval(updateSystemStatus, 30000);
    // 立即更新一次
    updateSystemStatus();
}

// 更新系统状态
async function updateSystemStatus() {
    try {
        const response = await fetch('/api/system/status');
        const data = await response.json();
        updateMemoryDisplay(data.memory);
        checkMemoryWarning(data.memory.heapUsed, data.totalLogs);
    } catch (error) {
        console.error('获取系统状态失败:', error);
    }
}

// 更新内存显示
function updateMemoryDisplay(memoryInfo) {
    if (!memoryInfo) return;
    
    const memoryValueEl = document.getElementById('memoryValue');
    const heapUsed = memoryInfo.heapUsed;
    
    memoryValueEl.textContent = heapUsed + ' MB';
    
    // 根据内存使用情况设置样式
    memoryValueEl.className = 'memory-value';
    if (heapUsed > 200) {
        memoryValueEl.classList.add('danger');
    } else if (heapUsed > 100) {
        memoryValueEl.classList.add('warning');
    }
}

// 检查内存警告
function checkMemoryWarning(heapUsed, totalLogs) {
    const memoryWarning = document.getElementById('memoryWarning');
    const clearAllBtn = document.getElementById('clearAllLogsBtn');
    
    // 当内存使用超过150MB或日志数量超过5000条时显示警告
    if (heapUsed > 150 || totalLogs > 5000) {
        memoryWarning.style.display = 'inline';
        clearAllBtn.style.display = 'inline-block';
        
        if (heapUsed > 200) {
            showNotification('内存使用过高(' + heapUsed + 'MB)，建议清理日志！', 'warning');
        }
    } else {
        memoryWarning.style.display = 'none';
        clearAllBtn.style.display = 'none';
    }
}

// 清理所有日志
async function clearAllLogs() {
    if (!confirm('确定要清理所有Webhook的日志吗？这将释放内存空间，但所有历史记录将丢失。')) {
        return;
    }
    
    try {
        // 获取所有webhook并清空它们的日志
        const clearPromises = webhooks.map(webhook => 
            fetch(`/api/webhooks/${webhook.id}/logs`, { method: 'DELETE' })
        );
        
        await Promise.all(clearPromises);
        
        // 清空前端缓存
        logs = [];
        allLogs = [];
        renderLogs();
        
        // 重新加载数据
        await loadWebhooks();
        await updateSystemStatus();
        
        showNotification('所有日志已清理完成，内存已释放', 'success');
    } catch (error) {
        console.error('清理日志失败:', error);
        showNotification('清理日志失败', 'error');
    }
}

// 应用Webhook搜索过滤器
function applyWebhookSearchFilter() {
    if (!webhookSearchFilter) {
        webhooks = [...allWebhooks];
    } else {
        webhooks = allWebhooks.filter(webhook => 
            webhook.name.toLowerCase().includes(webhookSearchFilter.toLowerCase())
        );
    }
    
    renderWebhooks();
    updateSearchResultInfo();
}

// 切换清空搜索按钮显示
function toggleClearWebhookSearchBtn() {
    const clearBtn = document.getElementById('clearWebhookSearchBtn');
    if (webhookSearchFilter) {
        clearBtn.style.display = 'inline-block';
    } else {
        clearBtn.style.display = 'none';
    }
}

// 更新搜索结果信息
function updateSearchResultInfo() {
    if (webhookSearchFilter && webhooks.length === 0) {
        return true; // 表示没有搜索结果
    }
    return false;
}

// 渲染Webhook列表
function renderWebhooks() {
    const container = document.getElementById('webhookContainer');
    
    // 检查搜索结果
    if (updateSearchResultInfo()) {
        return;
    }
    
    if (webhooks.length === 0) {
        const message = webhookSearchFilter ? 
            '未找到匹配的Webhook' : 
            '暂无Webhook，点击新建按钮创建第一个';
        container.innerHTML = `<div class="no-logs">${message}</div>`;
        return;
    }
    
    // 生成搜索结果信息
    let searchInfoHtml = '';
    if (webhookSearchFilter && webhooks.length > 0) {
        searchInfoHtml = `
            <div class="search-result-info">
                🔍 找到 <strong>${webhooks.length}</strong> 个匹配的Webhook，搜索词: <span class="search-term">"${escapeHtml(webhookSearchFilter)}"</span>
            </div>
        `;
    }
    
    // 生成webhook列表
    const webhookListHtml = webhooks.map(webhook => `
        <div class="webhook-item ${selectedWebhookFilter === webhook.id ? 'selected' : ''}" 
             onclick="selectWebhook('${webhook.id}')" data-webhook-id="${webhook.id}">
            <div class="webhook-info">
                <h4>${highlightSearchTerm(escapeHtml(webhook.name), webhookSearchFilter, true)}</h4>
                <div class="webhook-url-compact">
                    /webhook/${webhook.path}
                    <button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); copyToClipboard('${window.location.origin}/webhook/${webhook.path}')">复制</button>
                </div>
                ${webhook.description ? `<div class="webhook-description">${escapeHtml(webhook.description)}</div>` : ''}
            </div>
            
            <div class="webhook-status-compact">
                <span class="status-badge ${webhook.enabled ? 'status-enabled' : 'status-disabled'}">
                    ${webhook.enabled ? '启用' : '禁用'}
                </span>
                <span class="webhook-count">共 ${webhook.logCount || 0} 条</span>
            </div>
            
            ${getTypeStatsInfoCompact(webhook)}
            
            <div class="webhook-actions-compact">
                <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); editWebhook('${webhook.id}')">编辑</button>
                <button class="btn btn-small ${webhook.enabled ? 'btn-warning' : 'btn-success'}" 
                        onclick="event.stopPropagation(); toggleWebhook('${webhook.id}', ${!webhook.enabled})">
                    ${webhook.enabled ? '禁用' : '启用'}
                </button>
                <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); deleteWebhook('${webhook.id}')">删除</button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = searchInfoHtml + webhookListHtml;
}

// 紧凑版类型统计信息
function getTypeStatsInfoCompact(webhook) {
    if (!webhook.typeStats || Object.keys(webhook.typeStats).length === 0) {
        return '';
    }
    
    const typeStatsHtml = Object.entries(webhook.typeStats).slice(0, 3).map(([type, count]) => 
        `<span class="type-badge type-${type}">${type}:${count}</span>`
    ).join(' ');
    
    const moreCount = Object.keys(webhook.typeStats).length - 3;
    const moreText = moreCount > 0 ? ` +${moreCount}种` : '';
    
    return `<div class="webhook-type-stats-compact">${typeStatsHtml}${moreText}</div>`;
}

// 选择Webhook
function selectWebhook(id) {
    // 更新选中状态
    document.querySelectorAll('.webhook-item').forEach(item => {
        item.classList.remove('selected');
    });
    document.querySelector(`[data-webhook-id="${id}"]`).classList.add('selected');
    
    // 加载该Webhook的日志
    selectedWebhookFilter = id;
    selectedMessageTypeFilter = 'all';
    document.getElementById('webhookFilter').value = id;
    document.getElementById('messageTypeFilter').value = 'all';
    
    loadLogsForWebhook();
}

// 获取消息类型统计信息显示
function getTypeStatsInfo(webhook) {
    if (!webhook.typeStats || Object.keys(webhook.typeStats).length === 0) {
        return '<div class="webhook-type-stats">暂无消息类型统计</div>';
    }
    
    const typeStatsHtml = Object.entries(webhook.typeStats).map(([type, count]) => 
        `<span class="type-count">
            <span class="type-badge type-${type}">${type}</span>: ${count}条 (最多保留1000条)
        </span>`
    ).join('');
    
    return `<div class="webhook-type-stats">${typeStatsHtml}</div>`;
}

// 获取延时信息显示
function getDelayInfo(webhook) {
    if (webhook.delayType === 'none') {
        return '<div class="webhook-delay">延时: 无</div>';
    } else if (webhook.delayType === 'fixed') {
        return `<div class="webhook-delay">延时: 固定 ${webhook.delayValue}毫秒</div>`;
    } else if (webhook.delayType === 'random') {
        return `<div class="webhook-delay">延时: 随机 ${webhook.delayMin}-${webhook.delayMax}毫秒</div>`;
    }
    return '';
}

// 加载指定Webhook的日志
async function loadLogsForWebhook() {
    if (!selectedWebhookFilter) {
        logs = [];
        allLogs = [];
        currentTypeStats = {};
        renderLogs();
        updateMessageTypeFilter();
        return;
    }
    
    try {
        const url = `/api/webhooks/${selectedWebhookFilter}/logs?type=${selectedMessageTypeFilter}`;
        console.log('正在加载日志，URL:', url);
        
        const response = await fetch(url);
        console.log('响应状态:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('接收到的日志数据:', data);
        
        allLogs = data.logs || [];
        currentTypeStats = data.typeStats || {};
        
        // 清除高级搜索状态
        if (currentAdvancedSearch) {
            currentAdvancedSearch = null;
            document.getElementById('clearAdvancedSearchBtn').style.display = 'none';
        }
        
        // 清除快速过滤状态
        if (currentQuickFilter) {
            currentQuickFilter = null;
            document.getElementById('clearQuickFilterBtn').style.display = 'none';
        }
        
        applySearchFilters();
        updateMessageTypeFilter();
        updateTypeStatsDisplay();
        
        console.log('日志加载成功，共', allLogs.length, '条');
    } catch (error) {
        console.error('加载日志失败:', error);
        showNotification(`加载日志失败: ${error.message}`, 'error');
        
        // 显示详细错误信息
        const container = document.getElementById('logsContainer');
        container.innerHTML = `
            <div class="no-logs">
                <div style="color: #e74c3c; margin-bottom: 10px;">❌ 加载日志失败</div>
                <div style="font-size: 14px; color: #7f8c8d;">错误信息: ${error.message}</div>
                <div style="font-size: 12px; color: #95a5a6; margin-top: 10px;">请检查网络连接或刷新页面重试</div>
            </div>
        `;
    }
}

// 应用搜索过滤器
function applySearchFilters() {
    // 清除高级搜索状态
    if (currentAdvancedSearch) {
        currentAdvancedSearch = null;
        document.getElementById('clearAdvancedSearchBtn').style.display = 'none';
    }
    
    // 清除快速过滤状态
    if (currentQuickFilter) {
        currentQuickFilter = null;
        document.getElementById('clearQuickFilterBtn').style.display = 'none';
    }
    
    logs = allLogs.filter(log => {
        // 检查 tenantId 搜索
        if (searchFilters.tenantId) {
            const tenantId = extractFieldFromLog(log, 'tenantId');
            if (!tenantId || !tenantId.toString().toLowerCase().includes(searchFilters.tenantId.toLowerCase())) {
                return false;
            }
        }
        
        // 检查 uniqueId 搜索
        if (searchFilters.uniqueId) {
            const uniqueId = extractFieldFromLog(log, 'uniqueId');
            if (!uniqueId || !uniqueId.toString().toLowerCase().includes(searchFilters.uniqueId.toLowerCase())) {
                return false;
            }
        }
        
        // 检查时间范围
        if (searchFilters.startTime || searchFilters.endTime) {
            const logTime = new Date(log.timestamp);
            
            if (searchFilters.startTime) {
                const startTime = new Date(searchFilters.startTime);
                if (logTime < startTime) {
                    return false;
                }
            }
            
            if (searchFilters.endTime) {
                const endTime = new Date(searchFilters.endTime);
                if (logTime > endTime) {
                    return false;
                }
            }
        }
        
        return true;
    });
    
    renderLogs();
}

// 从日志中提取字段值
function extractFieldFromLog(log, fieldName) {
    // 首先检查请求体
    if (log.body && typeof log.body === 'object' && log.body[fieldName]) {
        return log.body[fieldName];
    }
    
    // 检查查询参数
    if (log.query && log.query[fieldName]) {
        return log.query[fieldName];
    }
    
    // 检查请求头
    if (log.headers && log.headers[fieldName.toLowerCase()]) {
        return log.headers[fieldName.toLowerCase()];
    }
    
    return null;
}

// 更新消息类型过滤器
function updateMessageTypeFilter() {
    const select = document.getElementById('messageTypeFilter');
    const currentValue = select.value;
    
    let options = '<option value="all">所有类型</option>';
    
    Object.keys(currentTypeStats).forEach(type => {
        options += `<option value="${type}">${type} (${currentTypeStats[type]}条)</option>`;
    });
    
    select.innerHTML = options;
    
    if (currentValue && currentTypeStats[currentValue]) {
        select.value = currentValue;
    } else {
        selectedMessageTypeFilter = 'all';
    }
}

// 更新类型统计显示
function updateTypeStatsDisplay() {
    const container = document.getElementById('typeStats');
    
    if (Object.keys(currentTypeStats).length === 0) {
        container.innerHTML = '';
        return;
    }
    
    const statsHtml = Object.entries(currentTypeStats).map(([type, count]) => 
        `<span class="type-badge type-${type}">${type}: ${count}</span>`
    ).join('');
    
    container.innerHTML = statsHtml;
}

// 更新Webhook过滤器选项
function updateWebhookFilter() {
    const select = document.getElementById('webhookFilter');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">所有Webhook</option>' +
        webhooks.map(webhook => 
            `<option value="${webhook.id}">${escapeHtml(webhook.name)}</option>`
        ).join('');
    
    if (currentValue && webhooks.find(w => w.id === currentValue)) {
        select.value = currentValue;
    }
}

// 打开Webhook模态框
function openWebhookModal(webhook = null) {
    currentEditingWebhook = webhook;
    const modal = document.getElementById('webhookModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('webhookForm');
    
    title.textContent = webhook ? '编辑Webhook' : '创建Webhook';
    
    if (webhook) {
        document.getElementById('webhookName').value = webhook.name;
        document.getElementById('webhookDescription').value = webhook.description || '';
        document.getElementById('delayType').value = webhook.delayType || 'none';
        document.getElementById('delayValue').value = webhook.delayValue || 1;
        document.getElementById('delayMin').value = webhook.delayMin || 1;
        document.getElementById('delayMax').value = webhook.delayMax || 5;
        
        // 编辑模式下隐藏路径选择
        document.getElementById('pathType').closest('.form-group').style.display = 'none';
        document.getElementById('customPathGroup').style.display = 'none';
    } else {
        form.reset();
        document.getElementById('pathType').closest('.form-group').style.display = 'block';
        document.getElementById('pathType').value = 'auto';
        document.getElementById('delayType').value = 'none';
    }
    
    toggleCustomPath();
    toggleDelayOptions();
    modal.style.display = 'block';
}

// 切换自定义路径显示
function toggleCustomPath() {
    const pathType = document.getElementById('pathType').value;
    const customPathGroup = document.getElementById('customPathGroup');
    
    if (pathType === 'custom') {
        customPathGroup.style.display = 'block';
        document.getElementById('customPath').required = true;
    } else {
        customPathGroup.style.display = 'none';
        document.getElementById('customPath').required = false;
    }
}

// 切换延时选项显示
function toggleDelayOptions() {
    const delayType = document.getElementById('delayType').value;
    const fixedGroup = document.getElementById('fixedDelayGroup');
    const randomGroup = document.getElementById('randomDelayGroup');
    
    fixedGroup.style.display = delayType === 'fixed' ? 'block' : 'none';
    randomGroup.style.display = delayType === 'random' ? 'block' : 'none';
}

// 保存Webhook
async function saveWebhook() {
    // 验证延时输入
    const delayType = document.getElementById('delayType').value;
    let delayValue = 0, delayMin = 0, delayMax = 0;
    
    if (delayType === 'fixed') {
        delayValue = parseInt(document.getElementById('delayValue').value);
        if (!delayValue || delayValue < 1 || delayValue > 100000) {
            showNotification('延时时间必须是1-100000之间的正整数', 'error');
            return;
        }
    } else if (delayType === 'random') {
        delayMin = parseInt(document.getElementById('delayMin').value);
        delayMax = parseInt(document.getElementById('delayMax').value);
        
        if (!delayMin || delayMin < 1 || delayMin > 100000) {
            showNotification('最小延时必须是1-100000之间的正整数', 'error');
            return;
        }
        if (!delayMax || delayMax < 1 || delayMax > 100000) {
            showNotification('最大延时必须是1-100000之间的正整数', 'error');
            return;
        }
        if (delayMin >= delayMax) {
            showNotification('最小延时必须小于最大延时', 'error');
            return;
        }
    }
    
    const formData = {
        name: document.getElementById('webhookName').value,
        description: document.getElementById('webhookDescription').value,
        delayType: delayType,
        delayValue: delayValue,
        delayMin: delayMin,
        delayMax: delayMax
    };
    
    if (!currentEditingWebhook) {
        // 创建新的Webhook
        const pathType = document.getElementById('pathType').value;
        if (pathType === 'custom') {
            formData.customPath = document.getElementById('customPath').value;
        }
    } else {
        // 编辑现有Webhook
        formData.enabled = currentEditingWebhook.enabled;
    }
    
    try {
        const url = currentEditingWebhook 
            ? `/api/webhooks/${currentEditingWebhook.id}`
            : '/api/webhooks';
        const method = currentEditingWebhook ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            closeModal(document.getElementById('webhookModal'));
            loadWebhooks();
            showNotification(currentEditingWebhook ? 'Webhook更新成功' : 'Webhook创建成功', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || '操作失败', 'error');
        }
    } catch (error) {
        console.error('保存Webhook失败:', error);
        showNotification('保存失败', 'error');
    }
}

// 编辑Webhook
function editWebhook(id) {
    const webhook = webhooks.find(w => w.id === id);
    if (webhook) {
        openWebhookModal(webhook);
    }
}

// 切换Webhook启用状态
async function toggleWebhook(id, enabled) {
    try {
        const response = await fetch(`/api/webhooks/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ enabled })
        });
        
        if (response.ok) {
            loadWebhooks();
            showNotification(`Webhook已${enabled ? '启用' : '禁用'}`, 'success');
        } else {
            showNotification('操作失败', 'error');
        }
    } catch (error) {
        console.error('切换Webhook状态失败:', error);
        showNotification('操作失败', 'error');
    }
}

// 删除Webhook
async function deleteWebhook(id) {
    if (!confirm('确定要删除这个Webhook吗？此操作不可恢复。')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/webhooks/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadWebhooks();
            // 从日志中移除相关记录
            logs = logs.filter(log => log.webhookId !== id);
            renderLogs();
            showNotification('Webhook删除成功', 'success');
        } else {
            showNotification('删除失败', 'error');
        }
    } catch (error) {
        console.error('删除Webhook失败:', error);
        showNotification('删除失败', 'error');
    }
}

// 查看日志
async function viewLogs(id) {
    selectedWebhookFilter = id;
    selectedMessageTypeFilter = 'all';
    document.getElementById('webhookFilter').value = id;
    document.getElementById('messageTypeFilter').value = 'all';
    
    await loadLogsForWebhook();
    
    // 滚动到日志区域
    document.querySelector('.logs-section').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

// 添加日志到UI
function addLogToUI(log, webhookId) {
    // 如果当前正在查看这个webhook的日志，重新加载
    if (selectedWebhookFilter === webhookId) {
        loadLogsForWebhook();
    }
    
    // 重新加载webhook列表以更新统计信息
    loadWebhooks();
}

// 渲染日志
function renderLogs() {
    const container = document.getElementById('logsContainer');
    
    if (logs.length === 0) {
        const message = (searchFilters.tenantId || searchFilters.uniqueId) ? 
            '没有找到匹配的日志数据' : '暂无日志数据';
        container.innerHTML = `<div class="no-logs">${message}</div>`;
        return;
    }
    
    container.innerHTML = logs.map(log => {
        const tenantId = extractFieldFromLog(log, 'tenantId');
        const uniqueId = extractFieldFromLog(log, 'uniqueId');
        
        let searchInfo = '';
        if (tenantId || uniqueId) {
            const parts = [];
            if (tenantId) {
                const highlightedTenantId = highlightSearchTerm(tenantId.toString(), searchFilters.tenantId);
                parts.push(`tenantId: ${highlightedTenantId}`);
            }
            if (uniqueId) {
                const highlightedUniqueId = highlightSearchTerm(uniqueId.toString(), searchFilters.uniqueId);
                parts.push(`uniqueId: ${highlightedUniqueId}`);
            }
            searchInfo = `<div class="log-search-info">${parts.join(' | ')}</div>`;
        }
        
        return `
            <div class="log-item" onclick="showLogDetails('${log.id}')">
                <div class="log-header">
                    <div>
                        <span class="log-method method-${log.method}">${log.method}</span>
                        <span class="log-message-type">
                            <span class="type-badge type-${log.messageType || 'DEFAULT'}">${log.messageType || 'DEFAULT'}</span>
                        </span>
                        <span class="log-timestamp">${formatDateTime(log.timestamp)}</span>
                    </div>
                </div>
                <div class="log-url">${escapeHtml(log.url)}</div>
                ${searchInfo}
                <div class="log-preview">
                    <span>IP: ${log.ip}</span>
                    <span>Headers: ${Object.keys(log.headers).length}个</span>
                    <span>Body: ${getBodyPreview(log.body)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// 高亮搜索词
function highlightSearchTerm(text, searchTerm, isWebhookSearch = false) {
    if (!searchTerm) return text;
    
    const highlightClass = isWebhookSearch ? 'webhook-search-highlight' : 'search-highlight';
    const escapedSearchTerm = escapeHtml(searchTerm);
    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
    
    return text.replace(regex, `<span class="${highlightClass}">$1</span>`);
}

// 导出日志为Excel
async function exportLogs() {
    if (!selectedWebhookFilter) {
        showNotification('请先选择要导出日志的Webhook', 'warning');
        return;
    }
    
    try {
        // 构建导出URL
        let url = `/api/webhooks/${selectedWebhookFilter}/export`;
        if (selectedMessageTypeFilter !== 'all') {
            url += `?type=${selectedMessageTypeFilter}`;
        }
        
        showNotification('正在准备导出数据，请稍候...', 'info');
        
        // 使用window.open直接下载文件
        window.open(url, '_blank');
        
        showNotification('导出请求已发送，如果数据量较大，可能需要等待几秒钟', 'success');
    } catch (error) {
        console.error('导出日志失败:', error);
        showNotification('导出失败: ' + error.message, 'error');
    }
}

// 清空日志
async function clearLogs() {
    if (selectedWebhookFilter) {
        let confirmMessage = '确定要清空该Webhook的';
        let url = `/api/webhooks/${selectedWebhookFilter}/logs`;
        
        if (selectedMessageTypeFilter !== 'all') {
            confirmMessage += `${selectedMessageTypeFilter}类型的`;
            url += `?type=${selectedMessageTypeFilter}`;
        } else {
            confirmMessage += '所有';
        }
        confirmMessage += '日志吗？';
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        try {
            const response = await fetch(url, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                await loadLogsForWebhook();
                await loadWebhooks(); // 更新统计信息
                showNotification('日志已清空', 'success');
            } else {
                showNotification('清空失败', 'error');
            }
        } catch (error) {
            console.error('清空日志失败:', error);
            showNotification('清空失败', 'error');
        }
    } else {
        showNotification('请先选择要清空日志的Webhook', 'warning');
    }
}

// 显示日志详情
function showLogDetails(logId) {
    const log = logs.find(l => l.id === logId);
    if (!log) return;
    
    const modal = document.getElementById('logModal');
    
    // 基本信息
    document.getElementById('logBasicInfo').innerHTML = `
        <div class="info-row">
            <span class="info-label">时间:</span>
            <span class="info-value">${formatDateTime(log.timestamp)}</span>
        </div>
        <div class="info-row">
            <span class="info-label">方法:</span>
            <span class="info-value">${log.method}</span>
        </div>
        <div class="info-row">
            <span class="info-label">URL:</span>
            <span class="info-value">${log.url}</span>
        </div>
        <div class="info-row">
            <span class="info-label">IP:</span>
            <span class="info-value">${log.ip}</span>
        </div>
    `;
    
    // 请求头
    document.getElementById('logHeaders').textContent = JSON.stringify(log.headers, null, 2);
    
    // 请求体
    const bodyText = typeof log.body === 'object' 
        ? JSON.stringify(log.body, null, 2)
        : log.body || '(空)';
    document.getElementById('logBody').textContent = bodyText;
    
    modal.style.display = 'block';
}

// 显示统计图表区域
function showStatsSection() {
    const statsSection = document.getElementById('statsSection');
    statsSection.style.display = 'block';
    
    // 初始化仪表板配置
    initDashboardConfig();
    
    // 初始化图表
    initCharts();
    
    // 加载告警信息
    loadAlerts();
}

// 加载告警信息
async function loadAlerts() {
    if (!selectedWebhookFilter) {
        if (allWebhooks.length > 0) {
            selectedWebhookFilter = allWebhooks[0].id;
        } else {
            document.getElementById('alertsContainer').innerHTML = '<div class="no-alerts">暂无告警信息</div>';
            return;
        }
    }
    
    try {
        const response = await fetch(`/api/webhooks/${selectedWebhookFilter}/alerts`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        alerts = data.alerts || [];
        
        renderAlerts();
    } catch (error) {
        console.error('加载告警信息失败:', error);
        document.getElementById('alertsContainer').innerHTML = `
            <div class="no-alerts">
                <div style="color: #e74c3c; margin-bottom: 10px;">❌ 加载告警信息失败</div>
                <div style="font-size: 14px; color: #7f8c8d;">错误信息: ${error.message}</div>
            </div>
        `;
    }
}

// 处理新的告警信息
function handleNewAlerts(newAlerts, webhookId) {
    if (webhookId === selectedWebhookFilter) {
        // 将新告警添加到列表前面
        alerts = [...newAlerts, ...alerts];
        
        // 最多保留100条告警
        if (alerts.length > 100) {
            alerts = alerts.slice(0, 100);
        }
        
        // 重新渲染告警列表
        renderAlerts();
        
        // 显示通知
        newAlerts.forEach(alert => {
            showNotification(`告警: ${alert.message}`, alert.level);
        });
    }
}

// 渲染告警列表
function renderAlerts() {
    const container = document.getElementById('alertsContainer');
    
    if (!alerts || alerts.length === 0) {
        container.innerHTML = '<div class="no-alerts">暂无告警信息</div>';
        return;
    }
    
    const alertsHtml = alerts.map(alert => `
        <div class="alert-item">
            <div class="alert-header">
                <span class="alert-type alert-type-${alert.type}">${formatAlertType(alert.type)}</span>
                <span class="alert-timestamp">${formatDateTime(alert.timestamp)}</span>
            </div>
            <div class="alert-message">${alert.message}</div>
            ${alert.details ? `
                <div class="alert-details">
                    ${formatAlertDetails(alert.details)}
                </div>
            ` : ''}
        </div>
    `).join('');
    
    container.innerHTML = alertsHtml;
}

// 格式化告警类型
function formatAlertType(type) {
    switch (type) {
        case 'HIGH_FREQUENCY':
            return '高频请求';
        case 'ERROR_RATE':
            return '错误率';
        default:
            return type;
    }
}

// 格式化告警详情
function formatAlertDetails(details) {
    if (!details) return '';
    
    if (typeof details === 'object') {
        return Object.entries(details).map(([key, value]) => {
            return `${key}: ${value}`;
        }).join('<br>');
    }
    
    return String(details);
}

// 隐藏统计图表区域
function hideStatsSection() {
    const statsSection = document.getElementById('statsSection');
    statsSection.style.display = 'none';
    
    // 清除刷新定时器
    if (dashboardRefreshTimer) {
        clearInterval(dashboardRefreshTimer);
        dashboardRefreshTimer = null;
    }
}

// 初始化图表
function initCharts() {
    // 销毁旧图表
    if (successRateChart) {
        successRateChart.destroy();
    }
    if (responseTimeChart) {
        responseTimeChart.destroy();
    }
    if (requestTrendChart) {
        requestTrendChart.destroy();
    }
    if (ipSourceChart) {
        ipSourceChart.destroy();
    }
    if (userAgentChart) {
        userAgentChart.destroy();
    }
    if (responseTimeDistChart) {
        responseTimeDistChart.destroy();
    }
    if (performanceChart) {
        performanceChart.destroy();
    }
    if (errorTypeChart) {
        errorTypeChart.destroy();
    }
    if (errorTrendChart) {
        errorTrendChart.destroy();
    }
    
    // 获取当前选中的webhook数据
    let webhookData = [];
    if (selectedWebhookFilter) {
        webhookData = allLogs;
    } else if (allWebhooks.length > 0) {
        // 如果没有选中webhook，使用第一个webhook的数据
        selectedWebhookFilter = allWebhooks[0].id;
        loadLogsForWebhook().then(() => {
            webhookData = allLogs;
            createCharts(webhookData);
        });
        return;
    }
    
    createCharts(webhookData);
}

// 创建图表
function createCharts(webhookData) {
    // 准备数据
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);
    
    // 按小时分组数据
    const hourlyData = {};
    for (let i = 0; i < 24; i++) {
        const hour = new Date(last24Hours);
        hour.setHours(hour.getHours() + i);
        const hourKey = hour.toISOString().slice(0, 13);
        hourlyData[hourKey] = {
            total: 0,
            success: 0,
            responseTimes: []
        };
    }
    
    // 处理日志数据
    webhookData.forEach(log => {
        const logTime = new Date(log.timestamp);
        if (logTime >= last24Hours) {
            const hourKey = logTime.toISOString().slice(0, 13);
            if (hourlyData[hourKey]) {
                hourlyData[hourKey].total++;
                
                // 假设状态码200-299为成功
                const statusCode = log.body && log.body.statusCode ? log.body.statusCode : 200;
                if (statusCode >= 200 && statusCode < 300) {
                    hourlyData[hourKey].success++;
                }
                
                // 记录响应时间
                const responseTime = log.body && log.body.responseTime ? log.body.responseTime : Math.random() * 100;
                hourlyData[hourKey].responseTimes.push(responseTime);
            }
        }
    });
    
    // 准备图表数据
    const labels = Object.keys(hourlyData).map(key => {
        const date = new Date(key);
        return `${date.getHours()}:00`;
    });
    
    const successRates = Object.values(hourlyData).map(data => {
        return data.total > 0 ? (data.success / data.total) * 100 : 0;
    });
    
    const avgResponseTimes = Object.values(hourlyData).map(data => {
        if (data.responseTimes.length === 0) return 0;
        const sum = data.responseTimes.reduce((a, b) => a + b, 0);
        return sum / data.responseTimes.length;
    });
    
    const requestCounts = Object.values(hourlyData).map(data => {
        return data.total;
    });
    
    // 创建成功率图表
    const successRateCtx = document.getElementById('successRateChart').getContext('2d');
    successRateChart = new Chart(successRateCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '成功率 (%)',
                data: successRates,
                backgroundColor: 'rgba(39, 174, 96, 0.2)',
                borderColor: 'rgba(39, 174, 96, 1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: '成功率 (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '时间 (小时)'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: '24小时请求成功率'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `成功率: ${context.parsed.y.toFixed(2)}%`;
                        }
                    }
                }
            }
        }
    });
    
    // 创建响应时间图表
    const responseTimeCtx = document.getElementById('responseTimeChart').getContext('2d');
    responseTimeChart = new Chart(responseTimeCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '平均响应时间 (ms)',
                data: avgResponseTimes,
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '响应时间 (ms)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '时间 (小时)'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: '24小时平均响应时间'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `平均响应时间: ${context.parsed.y.toFixed(2)} ms`;
                        }
                    }
                }
            }
        }
    });
    
    // 创建请求趋势图
    const requestTrendCtx = document.getElementById('requestTrendChart').getContext('2d');
    requestTrendChart = new Chart(requestTrendCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '请求数量',
                data: requestCounts,
                backgroundColor: 'rgba(155, 89, 182, 0.2)',
                borderColor: 'rgba(155, 89, 182, 1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '请求数量'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '时间 (小时)'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: '24小时请求趋势'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `请求数量: ${context.parsed.y}`;
                        }
                    }
                }
            }
        }
    });
    
    // 分析来源数据
    const ipStats = {};
    const userAgentStats = {};
    
    webhookData.forEach(log => {
        // 统计IP地址
        const ip = log.ip || 'unknown';
        ipStats[ip] = (ipStats[ip] || 0) + 1;
        
        // 统计User-Agent
        const userAgent = log.headers && log.headers['user-agent'] ? 
            parseUserAgent(log.headers['user-agent']) : 'unknown';
        userAgentStats[userAgent] = (userAgentStats[userAgent] || 0) + 1;
    });
    
    // 准备IP来源图表数据（取前10个）
    const topIPs = Object.entries(ipStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
    
    const ipLabels = topIPs.map(([ip]) => ip);
    const ipCounts = topIPs.map(([,count]) => count);
    
    // 创建IP来源图表
    const ipSourceCtx = document.getElementById('ipSourceChart').getContext('2d');
    ipSourceChart = new Chart(ipSourceCtx, {
        type: 'doughnut',
        data: {
            labels: ipLabels,
            datasets: [{
                data: ipCounts,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 205, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)',
                    'rgba(255, 159, 64, 0.8)',
                    'rgba(199, 199, 199, 0.8)',
                    'rgba(83, 102, 255, 0.8)',
                    'rgba(255, 99, 255, 0.8)',
                    'rgba(99, 255, 132, 0.8)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Top 10 IP地址来源'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: {
                            size: 10
                        }
                    }
                }
            }
        }
    });
    
    // 准备User-Agent图表数据（取前8个）
    const topUserAgents = Object.entries(userAgentStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8);
    
    const uaLabels = topUserAgents.map(([ua]) => ua);
    const uaCounts = topUserAgents.map(([,count]) => count);
    
    // 创建User-Agent图表
    const userAgentCtx = document.getElementById('userAgentChart').getContext('2d');
    userAgentChart = new Chart(userAgentCtx, {
        type: 'bar',
        data: {
            labels: uaLabels,
            datasets: [{
                label: '请求数量',
                data: uaCounts,
                backgroundColor: 'rgba(255, 159, 64, 0.6)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '请求数量'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'User-Agent'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Top 8 User-Agent来源'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed.x} 次请求`;
                        }
                    }
                }
            }
        }
    });
    
    // 分析响应时间数据
    const responseTimes = [];
    webhookData.forEach(log => {
        // 从日志中提取响应时间，如果没有则生成模拟数据
        let responseTime = 0;
        if (log.body && log.body.responseTime) {
            responseTime = log.body.responseTime;
        } else {
            // 生成模拟响应时间数据（实际项目中应该从真实数据获取）
            responseTime = Math.random() * 500 + 10; // 10-510ms
        }
        responseTimes.push(responseTime);
    });
    
    // 创建响应时间分布区间
    const distributionRanges = [
        { label: '0-50ms', min: 0, max: 50, count: 0 },
        { label: '50-100ms', min: 50, max: 100, count: 0 },
        { label: '100-200ms', min: 100, max: 200, count: 0 },
        { label: '200-500ms', min: 200, max: 500, count: 0 },
        { label: '500ms+', min: 500, max: Infinity, count: 0 }
    ];
    
    // 统计各区间的数量
    responseTimes.forEach(time => {
        for (let range of distributionRanges) {
            if (time >= range.min && time < range.max) {
                range.count++;
                break;
            }
        }
    });
    
    // 创建响应时间分布图表
    const responseTimeDistCtx = document.getElementById('responseTimeDistChart').getContext('2d');
    responseTimeDistChart = new Chart(responseTimeDistCtx, {
        type: 'bar',
        data: {
            labels: distributionRanges.map(r => r.label),
            datasets: [{
                label: '请求数量',
                data: distributionRanges.map(r => r.count),
                backgroundColor: [
                    'rgba(39, 174, 96, 0.8)',
                    'rgba(52, 152, 219, 0.8)',
                    'rgba(243, 156, 18, 0.8)',
                    'rgba(230, 126, 34, 0.8)',
                    'rgba(231, 76, 60, 0.8)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '请求数量'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '响应时间区间'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: '响应时间分布'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.parsed.y / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${context.parsed.y} 次 (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    // 计算性能指标
    const avgResponseTime = responseTimes.length > 0 ? 
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
    const p95ResponseTime = responseTimes.length > 0 ? 
        calculatePercentile(responseTimes, 95) : 0;
    const p99ResponseTime = responseTimes.length > 0 ? 
        calculatePercentile(responseTimes, 99) : 0;
    const maxResponseTime = responseTimes.length > 0 ? 
        Math.max(...responseTimes) : 0;
    
    // 创建性能监控图表
    const performanceCtx = document.getElementById('performanceChart').getContext('2d');
    performanceChart = new Chart(performanceCtx, {
        type: 'radar',
        data: {
            labels: ['平均响应时间', 'P95响应时间', 'P99响应时间', '最大响应时间', '请求成功率'],
            datasets: [{
                label: '性能指标',
                data: [
                    Math.min(avgResponseTime / 10, 100), // 归一化到0-100
                    Math.min(p95ResponseTime / 10, 100),
                    Math.min(p99ResponseTime / 10, 100),
                    Math.min(maxResponseTime / 10, 100),
                    webhookData.length > 0 ? (successRates.reduce((a, b) => a + b, 0) / successRates.length) : 0
                ],
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(54, 162, 235, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 20
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: '性能监控雷达图'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const labels = ['平均响应时间', 'P95响应时间', 'P99响应时间', '最大响应时间', '请求成功率'];
                            const values = [avgResponseTime, p95ResponseTime, p99ResponseTime, maxResponseTime, 
                                          successRates.reduce((a, b) => a + b, 0) / successRates.length];
                            const index = context.dataIndex;
                            
                            if (index < 4) {
                                return `${labels[index]}: ${values[index].toFixed(2)} ms`;
                            } else {
                                return `${labels[index]}: ${values[index].toFixed(2)}%`;
                            }
                        }
                    }
                }
            }
        }
    });
    
    // 分析错误数据
    const errorStats = {};
    const errorsByHour = {};
    
    // 初始化每小时的错误统计
    for (let i = 0; i < 24; i++) {
        const hour = new Date(last24Hours);
        hour.setHours(hour.getHours() + i);
        const hourKey = hour.toISOString().slice(0, 13);
        errorsByHour[hourKey] = 0;
    }
    
    webhookData.forEach(log => {
        // 判断是否为错误请求
        let isError = false;
        let errorType = 'Unknown';
        
        if (log.messageType === 'ERROR' || log.messageType === 'ALARM') {
            isError = true;
            errorType = log.messageType;
        } else if (log.body && log.body.error) {
            isError = true;
            errorType = 'Application Error';
        } else if (log.body && log.body.statusCode) {
            const statusCode = log.body.statusCode;
            if (statusCode >= 400 && statusCode < 500) {
                isError = true;
                errorType = '4xx Client Error';
            } else if (statusCode >= 500) {
                isError = true;
                errorType = '5xx Server Error';
            }
        } else if (log.body && log.body.exception) {
            isError = true;
            errorType = 'Exception';
        }
        
        if (isError) {
            // 统计错误类型
            errorStats[errorType] = (errorStats[errorType] || 0) + 1;
            
            // 统计每小时的错误数量
            const logTime = new Date(log.timestamp);
            if (logTime >= last24Hours) {
                const hourKey = logTime.toISOString().slice(0, 13);
                if (errorsByHour[hourKey] !== undefined) {
                    errorsByHour[hourKey]++;
                }
            }
        }
    });
    
    // 创建错误类型统计图表
    const errorTypeCtx = document.getElementById('errorTypeChart').getContext('2d');
    const errorTypes = Object.keys(errorStats);
    const errorCounts = Object.values(errorStats);
    
    if (errorTypes.length > 0) {
        errorTypeChart = new Chart(errorTypeCtx, {
            type: 'pie',
            data: {
                labels: errorTypes,
                datasets: [{
                    data: errorCounts,
                    backgroundColor: [
                        'rgba(231, 76, 60, 0.8)',
                        'rgba(230, 126, 34, 0.8)',
                        'rgba(241, 196, 15, 0.8)',
                        'rgba(155, 89, 182, 0.8)',
                        'rgba(52, 73, 94, 0.8)',
                        'rgba(149, 165, 166, 0.8)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '错误类型分布'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                            }
                        }
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            font: {
                                size: 10
                            }
                        }
                    }
                }
            }
        });
    } else {
        // 如果没有错误数据，显示空状态
        errorTypeChart = new Chart(errorTypeCtx, {
            type: 'pie',
            data: {
                labels: ['无错误'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['rgba(39, 174, 96, 0.8)'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '错误类型分布 - 无错误记录'
                    },
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    // 创建错误趋势图表
    const errorTrendCtx = document.getElementById('errorTrendChart').getContext('2d');
    const errorTrendLabels = Object.keys(errorsByHour).map(key => {
        const date = new Date(key);
        return `${date.getHours()}:00`;
    });
    const errorTrendData = Object.values(errorsByHour);
    
    errorTrendChart = new Chart(errorTrendCtx, {
        type: 'line',
        data: {
            labels: errorTrendLabels,
            datasets: [{
                label: '错误数量',
                data: errorTrendData,
                backgroundColor: 'rgba(231, 76, 60, 0.2)',
                borderColor: 'rgba(231, 76, 60, 1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '错误数量'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '时间 (小时)'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: '24小时错误趋势'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `错误数量: ${context.parsed.y}`;
                        }
                    }
                }
            }
        }
    });
}

// 计算百分位数
function calculatePercentile(arr, percentile) {
    if (arr.length === 0) return 0;
    
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
}

// 解析User-Agent字符串，提取浏览器/客户端信息
function parseUserAgent(userAgent) {
    if (!userAgent) return 'unknown';
    
    // 简化的User-Agent解析
    if (userAgent.includes('Chrome')) {
        return 'Chrome';
    } else if (userAgent.includes('Firefox')) {
        return 'Firefox';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        return 'Safari';
    } else if (userAgent.includes('Edge')) {
        return 'Edge';
    } else if (userAgent.includes('curl')) {
        return 'curl';
    } else if (userAgent.includes('Postman')) {
        return 'Postman';
    } else if (userAgent.includes('Python')) {
        return 'Python';
    } else if (userAgent.includes('Node.js')) {
        return 'Node.js';
    } else if (userAgent.includes('Java')) {
        return 'Java';
    } else if (userAgent.includes('Go-http-client')) {
        return 'Go';
    } else if (userAgent.includes('bot') || userAgent.includes('Bot')) {
        return 'Bot/Crawler';
    } else {
        // 截取前20个字符作为标识
        return userAgent.substring(0, 20) + (userAgent.length > 20 ? '...' : '');
    }
}

// 工具函数
function closeModal(modal) {
    modal.style.display = 'none';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
}

function getBodyPreview(body) {
    if (!body) return '(空)';
    if (typeof body === 'object') {
        const keys = Object.keys(body);
        return keys.length > 0 ? `${keys.length}个字段` : '(空对象)';
    }
    const str = String(body);
    return str.length > 50 ? str.substring(0, 50) + '...' : str;
}

function copyToClipboard(text) {
    // 兼容性更好的复制方法
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function() {
            showNotification('已复制到剪贴板', 'success');
        }).catch(function(err) {
            console.error('复制失败:', err);
            fallbackCopyTextToClipboard(text);
        });
    } else {
        fallbackCopyTextToClipboard(text);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showNotification('已复制到剪贴板', 'success');
        } else {
            showNotification('复制失败，请手动复制', 'error');
        }
    } catch (err) {
        console.error('复制失败:', err);
        showNotification('复制失败，请手动复制', 'error');
    }
    
    document.body.removeChild(textArea);
}

// 过滤日志（兼容旧代码）
function filterLogs() {
    loadLogsForWebhook();
}

function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // 添加样式
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    // 根据类型设置背景色
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#27ae60';
            break;
        case 'error':
            notification.style.backgroundColor = '#e74c3c';
            break;
        case 'warning':
            notification.style.backgroundColor = '#f39c12';
            break;
        default:
            notification.style.backgroundColor = '#3498db';
    }
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 主题切换相关函数
function initTheme() {
    // 从localStorage读取主题设置
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // 如果有保存的主题设置，使用保存的；否则根据系统偏好设置
    const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;
    
    if (isDark) {
        document.body.classList.add('dark-theme');
        updateThemeButton(true);
    } else {
        document.body.classList.remove('dark-theme');
        updateThemeButton(false);
    }
}

function toggleTheme() {
    const isDark = document.body.classList.contains('dark-theme');
    
    if (isDark) {
        // 切换到亮色主题
        document.body.classList.remove('dark-theme');
        localStorage.setItem('theme', 'light');
        updateThemeButton(false);
        showNotification('已切换到亮色主题', 'success');
    } else {
        // 切换到暗色主题
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
        updateThemeButton(true);
        showNotification('已切换到暗色主题', 'success');
    }
}

function updateThemeButton(isDark) {
    const themeBtn = document.getElementById('themeToggleBtn');
    if (isDark) {
        themeBtn.textContent = '☀️ 亮色主题';
        themeBtn.title = '切换到亮色主题';
    } else {
        themeBtn.textContent = '🌙 暗色主题';
        themeBtn.title = '切换到暗色主题';
    }
}

// 仪表板配置相关函数
let dashboardConfig = {
    charts: {
        showSuccessRate: true,
        showResponseTime: true,
        showRequestTrend: true,
        showIpSource: true,
        showUserAgent: true,
        showResponseTimeDist: true,
        showPerformance: true,
        showErrorType: true,
        showErrorTrend: true,
        showAlerts: true
    },
    layout: {
        type: 'grid',
        columns: 2
    },
    refresh: {
        interval: 10000
    }
};

let dashboardRefreshTimer = null;

function initDashboardConfig() {
    // 从localStorage读取配置
    const savedConfig = localStorage.getItem('dashboardConfig');
    if (savedConfig) {
        try {
            dashboardConfig = { ...dashboardConfig, ...JSON.parse(savedConfig) };
        } catch (error) {
            console.error('读取仪表板配置失败:', error);
        }
    }
    
    // 应用配置
    applyDashboardConfig();
}

function openDashboardConfig() {
    const modal = document.getElementById('dashboardConfigModal');
    
    // 加载当前配置到表单
    loadConfigToForm();
    
    modal.style.display = 'block';
}

function closeDashboardConfig() {
    const modal = document.getElementById('dashboardConfigModal');
    modal.style.display = 'none';
}

function loadConfigToForm() {
    // 加载图表显示配置
    Object.keys(dashboardConfig.charts).forEach(key => {
        const checkbox = document.getElementById(key);
        if (checkbox) {
            checkbox.checked = dashboardConfig.charts[key];
        }
    });
    
    // 加载布局配置
    document.getElementById('dashboardLayout').value = dashboardConfig.layout.type;
    document.getElementById('columnsCount').value = dashboardConfig.layout.columns;
    
    // 加载刷新配置
    document.getElementById('refreshInterval').value = dashboardConfig.refresh.interval;
}

function saveDashboardConfig() {
    // 保存图表显示配置
    Object.keys(dashboardConfig.charts).forEach(key => {
        const checkbox = document.getElementById(key);
        if (checkbox) {
            dashboardConfig.charts[key] = checkbox.checked;
        }
    });
    
    // 保存布局配置
    dashboardConfig.layout.type = document.getElementById('dashboardLayout').value;
    dashboardConfig.layout.columns = parseInt(document.getElementById('columnsCount').value);
    
    // 保存刷新配置
    dashboardConfig.refresh.interval = parseInt(document.getElementById('refreshInterval').value);
    
    // 保存到localStorage
    localStorage.setItem('dashboardConfig', JSON.stringify(dashboardConfig));
    
    // 应用配置
    applyDashboardConfig();
    
    // 关闭模态框
    closeDashboardConfig();
    
    showNotification('仪表板配置已保存', 'success');
}

function resetDashboardConfig() {
    if (!confirm('确定要重置为默认配置吗？')) {
        return;
    }
    
    // 重置为默认配置
    dashboardConfig = {
        charts: {
            showSuccessRate: true,
            showResponseTime: true,
            showRequestTrend: true,
            showIpSource: true,
            showUserAgent: true,
            showResponseTimeDist: true,
            showPerformance: true,
            showErrorType: true,
            showErrorTrend: true,
            showAlerts: true
        },
        layout: {
            type: 'grid',
            columns: 2
        },
        refresh: {
            interval: 10000
        }
    };
    
    // 更新表单
    loadConfigToForm();
    
    showNotification('已重置为默认配置', 'info');
}

function applyDashboardConfig() {
    // 应用图表显示配置
    applyChartVisibility();
    
    // 应用布局配置
    applyLayoutConfig();
    
    // 应用刷新配置
    applyRefreshConfig();
}

function applyChartVisibility() {
    const chartMappings = {
        showSuccessRate: 'successRateChart',
        showResponseTime: 'responseTimeChart',
        showRequestTrend: 'requestTrendChart',
        showIpSource: 'ipSourceChart',
        showUserAgent: 'userAgentChart',
        showResponseTimeDist: 'responseTimeDistChart',
        showPerformance: 'performanceChart',
        showErrorType: 'errorTypeChart',
        showErrorTrend: 'errorTrendChart',
        showAlerts: 'alertsContainer'
    };
    
    Object.keys(chartMappings).forEach(configKey => {
        const chartId = chartMappings[configKey];
        const chartElement = document.getElementById(chartId);
        
        if (chartElement) {
            const statsCard = chartElement.closest('.stats-card');
            if (statsCard) {
                if (dashboardConfig.charts[configKey]) {
                    statsCard.style.display = 'block';
                } else {
                    statsCard.style.display = 'none';
                }
            }
        }
    });
}

function applyLayoutConfig() {
    const statsContent = document.querySelector('.stats-content');
    if (!statsContent) return;
    
    // 清除所有布局类
    statsContent.classList.remove('layout-grid', 'layout-list', 'layout-compact');
    statsContent.classList.remove('columns-1', 'columns-2', 'columns-3', 'columns-4');
    
    // 应用布局类型
    statsContent.classList.add(`layout-${dashboardConfig.layout.type}`);
    
    // 应用列数配置（仅对网格布局有效）
    if (dashboardConfig.layout.type === 'grid') {
        statsContent.classList.add(`columns-${dashboardConfig.layout.columns}`);
    }
}

function applyRefreshConfig() {
    // 清除现有定时器
    if (dashboardRefreshTimer) {
        clearInterval(dashboardRefreshTimer);
        dashboardRefreshTimer = null;
    }
    
    // 设置新的定时器
    if (dashboardConfig.refresh.interval > 0) {
        dashboardRefreshTimer = setInterval(() => {
            // 只有在统计图表显示时才刷新
            const statsSection = document.getElementById('statsSection');
            if (statsSection && statsSection.style.display !== 'none') {
                initCharts();
                loadAlerts();
            }
        }, dashboardConfig.refresh.interval);
    }
}

// 批量操作相关变量
let batchMode = false;
let selectedWebhooks = new Set();
let sortableInstance = null;

// 初始化拖拽排序
function initSortable() {
    const container = document.getElementById('webhookContainer');
    if (container && typeof Sortable !== 'undefined') {
        sortableInstance = Sortable.create(container, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            disabled: batchMode, // 批量模式下禁用拖拽
            onEnd: function(evt) {
                // 获取新的排序
                const newOrder = Array.from(container.children).map(item => item.dataset.webhookId);
                // 保存新的排序到localStorage
                localStorage.setItem('webhookOrder', JSON.stringify(newOrder));
                // 重新渲染webhook列表以应用新排序
                loadWebhooks();
            }
        });
    }
}

// 切换批量操作模式
function toggleBatchMode() {
    batchMode = !batchMode;
    const container = document.getElementById('webhookContainer');
    const batchActions = document.getElementById('batchActions');
    const batchModeBtn = document.getElementById('batchModeBtn');
    
    if (batchMode) {
        container.classList.add('batch-mode');
        batchActions.style.display = 'flex';
        batchModeBtn.textContent = '📋 退出批量';
        batchModeBtn.classList.add('btn-warning');
        batchModeBtn.classList.remove('btn-secondary');
        
        // 禁用拖拽排序
        if (sortableInstance) {
            sortableInstance.option('disabled', true);
        }
        
        // 为每个webhook项添加点击事件
        document.querySelectorAll('.webhook-item').forEach(item => {
            item.addEventListener('click', handleWebhookSelection);
        });
    } else {
        exitBatchMode();
    }
}

// 退出批量操作模式
function exitBatchMode() {
    batchMode = false;
    selectedWebhooks.clear();
    const container = document.getElementById('webhookContainer');
    const batchActions = document.getElementById('batchActions');
    const batchModeBtn = document.getElementById('batchModeBtn');
    
    container.classList.remove('batch-mode');
    batchActions.style.display = 'none';
    batchModeBtn.textContent = '📋 批量操作';
    batchModeBtn.classList.remove('btn-warning');
    batchModeBtn.classList.add('btn-secondary');
    
    // 启用拖拽排序
    if (sortableInstance) {
        sortableInstance.option('disabled', false);
    }
    
    // 移除选中状态
    document.querySelectorAll('.webhook-item').forEach(item => {
        item.classList.remove('selected');
        item.removeEventListener('click', handleWebhookSelection);
    });
}

// 处理webhook选择
function handleWebhookSelection(event) {
    if (!batchMode) return;
    
    event.stopPropagation();
    const webhookItem = event.currentTarget;
    const webhookId = webhookItem.dataset.webhookId;
    
    if (selectedWebhooks.has(webhookId)) {
        selectedWebhooks.delete(webhookId);
        webhookItem.classList.remove('selected');
    } else {
        selectedWebhooks.add(webhookId);
        webhookItem.classList.add('selected');
    }
    
    updateBatchActionButtons();
}

// 全选/取消全选
function selectAllWebhooks() {
    const webhookItems = document.querySelectorAll('.webhook-item');
    const selectAllBtn = document.getElementById('selectAllBtn');
    
    if (selectedWebhooks.size === webhookItems.length) {
        // 取消全选
        selectedWebhooks.clear();
        webhookItems.forEach(item => item.classList.remove('selected'));
        selectAllBtn.textContent = '全选';
    } else {
        // 全选
        selectedWebhooks.clear();
        webhookItems.forEach(item => {
            const webhookId = item.dataset.webhookId;
            selectedWebhooks.add(webhookId);
            item.classList.add('selected');
        });
        selectAllBtn.textContent = '取消全选';
    }
    
    updateBatchActionButtons();
}

// 更新批量操作按钮状态
function updateBatchActionButtons() {
    const hasSelection = selectedWebhooks.size > 0;
    const webhookItems = document.querySelectorAll('.webhook-item');
    const selectAllBtn = document.getElementById('selectAllBtn');
    
    document.getElementById('batchEnableBtn').disabled = !hasSelection;
    document.getElementById('batchDisableBtn').disabled = !hasSelection;
    document.getElementById('batchDeleteBtn').disabled = !hasSelection;
    
    selectAllBtn.textContent = selectedWebhooks.size === webhookItems.length ? '取消全选' : '全选';
}

// 批量操作
async function batchOperation(operation) {
    if (selectedWebhooks.size === 0) {
        showNotification('请先选择要操作的Webhook', 'warning');
        return;
    }
    
    const webhookIds = Array.from(selectedWebhooks);
    let confirmMessage = '';
    
    switch (operation) {
        case 'enable':
            confirmMessage = `确定要启用选中的 ${webhookIds.length} 个Webhook吗？`;
            break;
        case 'disable':
            confirmMessage = `确定要禁用选中的 ${webhookIds.length} 个Webhook吗？`;
            break;
        case 'delete':
            confirmMessage = `确定要删除选中的 ${webhookIds.length} 个Webhook吗？此操作不可撤销！`;
            break;
    }
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        const promises = webhookIds.map(async (webhookId) => {
            const webhook = webhooks.find(w => w.id === webhookId);
            if (!webhook) return;
            
            switch (operation) {
                case 'enable':
                    return fetch(`/api/webhooks/${webhookId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...webhook, enabled: true })
                    });
                case 'disable':
                    return fetch(`/api/webhooks/${webhookId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...webhook, enabled: false })
                    });
                case 'delete':
                    return fetch(`/api/webhooks/${webhookId}`, {
                        method: 'DELETE'
                    });
            }
        });
        
        await Promise.all(promises);
        
        // 刷新webhook列表
        loadWebhooks();
        
        // 清空选择
        selectedWebhooks.clear();
        updateBatchActionButtons();
        
        const operationText = operation === 'enable' ? '启用' : operation === 'disable' ? '禁用' : '删除';
        showNotification(`批量${operationText}操作完成！`, 'success');
        
    } catch (error) {
        console.error('批量操作失败:', error);
        showNotification('批量操作失败，请重试', 'error');
    }
}

// 快捷键支持
const shortcuts = {
    'ctrl+n': () => openWebhookModal(),
    'ctrl+s': () => toggleStats(),
    'ctrl+e': () => exportExcel(),
    'ctrl+b': () => toggleBatchMode(),
    'ctrl+a': (e) => {
        if (batchMode) {
            e.preventDefault();
            selectAllWebhooks();
        }
    },
    'ctrl+t': () => toggleTheme(),
    'escape': () => {
        // 关闭所有模态框
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        // 退出批量模式
        if (batchMode) {
            exitBatchMode();
        }
    },
    'ctrl+f': (e) => {
        e.preventDefault();
        const searchInput = document.getElementById('webhookSearch');
        searchInput.focus();
        searchInput.select();
    },
    'f5': (e) => {
        e.preventDefault();
        loadWebhooks();
        showNotification('数据已刷新', 'success');
    }
};

// 绑定快捷键事件
function bindShortcuts() {
    document.addEventListener('keydown', (e) => {
        const key = [];
        if (e.ctrlKey) key.push('ctrl');
        if (e.altKey) key.push('alt');
        if (e.shiftKey) key.push('shift');
        key.push(e.key.toLowerCase());
        
        const shortcut = key.join('+');
        
        if (shortcuts[shortcut]) {
            shortcuts[shortcut](e);
        }
    });
}

// 显示快捷键帮助
function showShortcutHelp() {
    const helpContent = `
        <div class="shortcut-help">
            <h4>快捷键说明</h4>
            <div class="shortcut-list">
                <div class="shortcut-item">
                    <kbd>Ctrl + N</kbd>
                    <span>创建新Webhook</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Ctrl + S</kbd>
                    <span>打开/关闭统计图表</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Ctrl + E</kbd>
                    <span>导出Excel</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Ctrl + B</kbd>
                    <span>切换批量操作模式</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Ctrl + A</kbd>
                    <span>全选（批量模式下）</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Ctrl + T</kbd>
                    <span>切换主题</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Ctrl + F</kbd>
                    <span>聚焦搜索框</span>
                </div>
                <div class="shortcut-item">
                    <kbd>F5</kbd>
                    <span>刷新数据</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Esc</kbd>
                    <span>关闭模态框/退出批量模式</span>
                </div>
            </div>
        </div>
    `;
    
    showNotification(helpContent, 'info', 8000);
}

// 操作引导功能
let tourStep = 0;
const tourSteps = [
    {
        element: '#createBtn2',
        title: '创建Webhook',
        content: '点击这里创建一个新的Webhook回调地址',
        position: 'bottom'
    },
    {
        element: '#webhookSearch',
        title: '搜索功能',
        content: '在这里输入关键词搜索Webhook',
        position: 'bottom'
    },
    {
        element: '#showStatsBtn',
        title: '统计图表',
        content: '查看详细的统计数据和图表分析',
        position: 'bottom'
    },
    {
        element: '#batchModeBtn',
        title: '批量操作',
        content: '启用批量操作模式，可以同时管理多个Webhook',
        position: 'bottom'
    },
    {
        element: '#themeToggle',
        title: '主题切换',
        content: '切换暗色/亮色主题',
        position: 'bottom'
    }
];

// 显示操作引导
function startTour() {
    if (localStorage.getItem('tourCompleted') === 'true') {
        return;
    }
    
    tourStep = 0;
    showTourStep();
}

function showTourStep() {
    if (tourStep >= tourSteps.length) {
        endTour();
        return;
    }
    
    const step = tourSteps[tourStep];
    const element = document.querySelector(step.element);
    
    if (!element) {
        tourStep++;
        showTourStep();
        return;
    }
    
    // 创建引导提示框
    const tooltip = document.createElement('div');
    tooltip.className = 'tour-tooltip';
    tooltip.innerHTML = `
        <div class="tour-content">
            <h4>${step.title}</h4>
            <p>${step.content}</p>
            <div class="tour-actions">
                <button class="btn btn-small btn-secondary" onclick="skipTour()">跳过引导</button>
                <button class="btn btn-small btn-primary" onclick="nextTourStep()">下一步 (${tourStep + 1}/${tourSteps.length})</button>
            </div>
        </div>
        <div class="tour-arrow"></div>
    `;
    
    // 定位提示框
    const rect = element.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.zIndex = '10000';
    
    switch (step.position) {
        case 'bottom':
            tooltip.style.top = (rect.bottom + 10) + 'px';
            tooltip.style.left = (rect.left + rect.width / 2) + 'px';
            tooltip.style.transform = 'translateX(-50%)';
            break;
        case 'top':
            tooltip.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
            tooltip.style.left = (rect.left + rect.width / 2) + 'px';
            tooltip.style.transform = 'translateX(-50%)';
            break;
        case 'left':
            tooltip.style.top = (rect.top + rect.height / 2) + 'px';
            tooltip.style.right = (window.innerWidth - rect.left + 10) + 'px';
            tooltip.style.transform = 'translateY(-50%)';
            break;
        case 'right':
            tooltip.style.top = (rect.top + rect.height / 2) + 'px';
            tooltip.style.left = (rect.right + 10) + 'px';
            tooltip.style.transform = 'translateY(-50%)';
            break;
    }
    
    // 高亮目标元素
    element.classList.add('tour-highlight');
    
    document.body.appendChild(tooltip);
    
    // 添加遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    overlay.onclick = nextTourStep;
    document.body.appendChild(overlay);
}

function nextTourStep() {
    // 清理当前步骤
    const tooltip = document.querySelector('.tour-tooltip');
    const overlay = document.querySelector('.tour-overlay');
    const highlighted = document.querySelector('.tour-highlight');
    
    if (tooltip) tooltip.remove();
    if (overlay) overlay.remove();
    if (highlighted) highlighted.classList.remove('tour-highlight');
    
    tourStep++;
    setTimeout(showTourStep, 300);
}

function skipTour() {
    endTour();
}

function endTour() {
    // 清理所有引导元素
    const tooltip = document.querySelector('.tour-tooltip');
    const overlay = document.querySelector('.tour-overlay');
    const highlighted = document.querySelector('.tour-highlight');
    
    if (tooltip) tooltip.remove();
    if (overlay) overlay.remove();
    if (highlighted) highlighted.classList.remove('tour-highlight');
    
    localStorage.setItem('tourCompleted', 'true');
    showNotification('引导完成！按 ? 键可随时查看快捷键帮助', 'success');
}

// 性能优化相关
let performanceMetrics = {
    renderTime: 0,
    memoryUsage: 0,
    requestCount: 0
};

// 虚拟滚动实现（用于大量日志数据）
class VirtualScroll {
    constructor(container, itemHeight, renderItem) {
        this.container = container;
        this.itemHeight = itemHeight;
        this.renderItem = renderItem;
        this.data = [];
        this.visibleStart = 0;
        this.visibleEnd = 0;
        this.scrollTop = 0;
        
        this.init();
    }
    
    init() {
        this.container.style.position = 'relative';
        this.container.addEventListener('scroll', this.onScroll.bind(this));
        
        // 创建虚拟容器
        this.virtualContainer = document.createElement('div');
        this.virtualContainer.style.position = 'absolute';
        this.virtualContainer.style.top = '0';
        this.virtualContainer.style.left = '0';
        this.virtualContainer.style.right = '0';
        this.container.appendChild(this.virtualContainer);
        
        // 创建占位容器
        this.spacer = document.createElement('div');
        this.container.appendChild(this.spacer);
    }
    
    setData(data) {
        this.data = data;
        this.spacer.style.height = (data.length * this.itemHeight) + 'px';
        this.render();
    }
    
    onScroll() {
        this.scrollTop = this.container.scrollTop;
        this.render();
    }
    
    render() {
        const containerHeight = this.container.clientHeight;
        const startIndex = Math.floor(this.scrollTop / this.itemHeight);
        const endIndex = Math.min(
            startIndex + Math.ceil(containerHeight / this.itemHeight) + 1,
            this.data.length
        );
        
        this.visibleStart = startIndex;
        this.visibleEnd = endIndex;
        
        // 清空虚拟容器
        this.virtualContainer.innerHTML = '';
        this.virtualContainer.style.transform = `translateY(${startIndex * this.itemHeight}px)`;
        
        // 渲染可见项
        for (let i = startIndex; i < endIndex; i++) {
            if (this.data[i]) {
                const item = this.renderItem(this.data[i], i);
                this.virtualContainer.appendChild(item);
            }
        }
    }
}

// 分页管理器
class PaginationManager {
    constructor(container, itemsPerPage = 50) {
        this.container = container;
        this.itemsPerPage = itemsPerPage;
        this.currentPage = 1;
        this.totalPages = 1;
        this.data = [];
        this.filteredData = [];
        this.renderItem = null;
        
        this.createPaginationControls();
    }
    
    createPaginationControls() {
        this.paginationContainer = document.createElement('div');
        this.paginationContainer.className = 'pagination-controls';
        this.paginationContainer.innerHTML = `
            <div class="pagination-info">
                <span id="paginationInfo">显示 0-0 条，共 0 条</span>
            </div>
            <div class="pagination-buttons">
                <button id="firstPageBtn" class="btn btn-small btn-secondary">首页</button>
                <button id="prevPageBtn" class="btn btn-small btn-secondary">上一页</button>
                <span id="pageNumbers" class="page-numbers"></span>
                <button id="nextPageBtn" class="btn btn-small btn-secondary">下一页</button>
                <button id="lastPageBtn" class="btn btn-small btn-secondary">末页</button>
            </div>
            <div class="pagination-size">
                <select id="pageSizeSelect" class="form-control">
                    <option value="25">25条/页</option>
                    <option value="50" selected>50条/页</option>
                    <option value="100">100条/页</option>
                    <option value="200">200条/页</option>
                </select>
            </div>
        `;
        
        this.container.parentNode.insertBefore(this.paginationContainer, this.container.nextSibling);
        this.bindPaginationEvents();
    }
    
    bindPaginationEvents() {
        document.getElementById('firstPageBtn').addEventListener('click', () => this.goToPage(1));
        document.getElementById('prevPageBtn').addEventListener('click', () => this.goToPage(this.currentPage - 1));
        document.getElementById('nextPageBtn').addEventListener('click', () => this.goToPage(this.currentPage + 1));
        document.getElementById('lastPageBtn').addEventListener('click', () => this.goToPage(this.totalPages));
        document.getElementById('pageSizeSelect').addEventListener('change', (e) => {
            this.itemsPerPage = parseInt(e.target.value);
            this.currentPage = 1;
            this.render();
        });
    }
    
    setData(data, renderItem) {
        this.data = data;
        this.filteredData = data;
        this.renderItem = renderItem;
        this.currentPage = 1;
        this.render();
    }
    
    setFilteredData(filteredData) {
        this.filteredData = filteredData;
        this.currentPage = 1;
        this.render();
    }
    
    goToPage(page) {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        this.render();
    }
    
    render() {
        this.totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
        if (this.totalPages === 0) this.totalPages = 1;
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredData.length);
        const pageData = this.filteredData.slice(startIndex, endIndex);
        
        // 渲染数据
        this.container.innerHTML = '';
        if (pageData.length === 0) {
            this.container.innerHTML = '<div class="no-logs">暂无数据</div>';
        } else {
            pageData.forEach((item, index) => {
                const element = this.renderItem(item, startIndex + index);
                this.container.appendChild(element);
            });
        }
        
        // 更新分页控件
        this.updatePaginationControls();
    }
    
    updatePaginationControls() {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endIndex = Math.min(this.currentPage * this.itemsPerPage, this.filteredData.length);
        
        document.getElementById('paginationInfo').textContent = 
            `显示 ${startIndex}-${endIndex} 条，共 ${this.filteredData.length} 条`;
        
        document.getElementById('firstPageBtn').disabled = this.currentPage === 1;
        document.getElementById('prevPageBtn').disabled = this.currentPage === 1;
        document.getElementById('nextPageBtn').disabled = this.currentPage === this.totalPages;
        document.getElementById('lastPageBtn').disabled = this.currentPage === this.totalPages;
        
        // 生成页码按钮
        this.generatePageNumbers();
    }
    
    generatePageNumbers() {
        const pageNumbers = document.getElementById('pageNumbers');
        pageNumbers.innerHTML = '';
        
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `btn btn-small ${i === this.currentPage ? 'btn-primary' : 'btn-secondary'}`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => this.goToPage(i));
            pageNumbers.appendChild(pageBtn);
        }
    }
}

// 视图切换管理器
class ViewManager {
    constructor() {
        this.currentView = localStorage.getItem('logView') || 'list';
        this.createViewControls();
    }
    
    createViewControls() {
        const logsHeader = document.querySelector('.logs-header');
        const viewControls = document.createElement('div');
        viewControls.className = 'view-controls';
        viewControls.innerHTML = `
            <div class="view-toggle">
                <button id="listViewBtn" class="btn btn-small ${this.currentView === 'list' ? 'btn-primary' : 'btn-secondary'}">
                    📋 列表视图
                </button>
                <button id="cardViewBtn" class="btn btn-small ${this.currentView === 'card' ? 'btn-primary' : 'btn-secondary'}">
                    🗃️ 卡片视图
                </button>
                <button id="compactViewBtn" class="btn btn-small ${this.currentView === 'compact' ? 'btn-primary' : 'btn-secondary'}">
                    📄 紧凑视图
                </button>
            </div>
        `;
        
        logsHeader.appendChild(viewControls);
        this.bindViewEvents();
        this.applyView();
    }
    
    bindViewEvents() {
        document.getElementById('listViewBtn').addEventListener('click', () => this.switchView('list'));
        document.getElementById('cardViewBtn').addEventListener('click', () => this.switchView('card'));
        document.getElementById('compactViewBtn').addEventListener('click', () => this.switchView('compact'));
    }
    
    switchView(view) {
        this.currentView = view;
        localStorage.setItem('logView', view);
        
        // 更新按钮状态
        document.querySelectorAll('.view-toggle .btn').forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
        });
        
        document.getElementById(`${view}ViewBtn`).classList.remove('btn-secondary');
        document.getElementById(`${view}ViewBtn`).classList.add('btn-primary');
        
        this.applyView();
        
        // 重新渲染日志
        if (typeof loadLogs === 'function') {
            loadLogs();
        }
    }
    
    applyView() {
        const logsContainer = document.getElementById('logsContainer');
        logsContainer.className = `logs-container view-${this.currentView}`;
    }
    
    getCurrentView() {
        return this.currentView;
    }
}

// JSON格式化器
class JSONFormatter {
    static format(obj, collapsed = false) {
        if (typeof obj === 'string') {
            try {
                obj = JSON.parse(obj);
            } catch (e) {
                return obj;
            }
        }
        
        return this.createJsonElement(obj, 0, collapsed);
    }
    
    static createJsonElement(obj, depth = 0, collapsed = false) {
        const container = document.createElement('div');
        container.className = 'json-formatter';
        
        if (obj === null) {
            container.innerHTML = '<span class="json-null">null</span>';
            return container;
        }
        
        if (typeof obj === 'boolean') {
            container.innerHTML = `<span class="json-boolean">${obj}</span>`;
            return container;
        }
        
        if (typeof obj === 'number') {
            container.innerHTML = `<span class="json-number">${obj}</span>`;
            return container;
        }
        
        if (typeof obj === 'string') {
            container.innerHTML = `<span class="json-string">"${this.escapeHtml(obj)}"</span>`;
            return container;
        }
        
        if (Array.isArray(obj)) {
            return this.createArrayElement(obj, depth, collapsed);
        }
        
        if (typeof obj === 'object') {
            return this.createObjectElement(obj, depth, collapsed);
        }
        
        return container;
    }
    
    static createArrayElement(arr, depth, collapsed) {
        const container = document.createElement('div');
        container.className = 'json-array';
        
        const toggle = document.createElement('span');
        toggle.className = 'json-toggle';
        toggle.textContent = collapsed ? '▶' : '▼';
        toggle.addEventListener('click', () => this.toggleCollapse(container));
        
        const bracket = document.createElement('span');
        bracket.className = 'json-bracket';
        bracket.textContent = `[${arr.length}]`;
        
        const header = document.createElement('div');
        header.className = 'json-header';
        header.appendChild(toggle);
        header.appendChild(bracket);
        
        const content = document.createElement('div');
        content.className = 'json-content';
        content.style.display = collapsed ? 'none' : 'block';
        
        arr.forEach((item, index) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'json-item';
            itemElement.style.marginLeft = `${(depth + 1) * 20}px`;
            
            const indexSpan = document.createElement('span');
            indexSpan.className = 'json-index';
            indexSpan.textContent = `${index}: `;
            
            itemElement.appendChild(indexSpan);
            itemElement.appendChild(this.createJsonElement(item, depth + 1, false));
            
            if (index < arr.length - 1) {
                itemElement.appendChild(document.createTextNode(','));
            }
            
            content.appendChild(itemElement);
        });
        
        container.appendChild(header);
        container.appendChild(content);
        
        return container;
    }
    
    static createObjectElement(obj, depth, collapsed) {
        const container = document.createElement('div');
        container.className = 'json-object';
        
        const keys = Object.keys(obj);
        
        const toggle = document.createElement('span');
        toggle.className = 'json-toggle';
        toggle.textContent = collapsed ? '▶' : '▼';
        toggle.addEventListener('click', () => this.toggleCollapse(container));
        
        const bracket = document.createElement('span');
        bracket.className = 'json-bracket';
        bracket.textContent = `{${keys.length}}`;
        
        const header = document.createElement('div');
        header.className = 'json-header';
        header.appendChild(toggle);
        header.appendChild(bracket);
        
        const content = document.createElement('div');
        content.className = 'json-content';
        content.style.display = collapsed ? 'none' : 'block';
        
        keys.forEach((key, index) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'json-item';
            itemElement.style.marginLeft = `${(depth + 1) * 20}px`;
            
            const keySpan = document.createElement('span');
            keySpan.className = 'json-key';
            keySpan.textContent = `"${key}": `;
            
            itemElement.appendChild(keySpan);
            itemElement.appendChild(this.createJsonElement(obj[key], depth + 1, false));
            
            if (index < keys.length - 1) {
                itemElement.appendChild(document.createTextNode(','));
            }
            
            content.appendChild(itemElement);
        });
        
        container.appendChild(header);
        container.appendChild(content);
        
        return container;
    }
    
    static toggleCollapse(container) {
        const toggle = container.querySelector('.json-toggle');
        const content = container.querySelector('.json-content');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            toggle.textContent = '▼';
        } else {
            content.style.display = 'none';
            toggle.textContent = '▶';
        }
    }
    
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 全局变量
let paginationManager = null;
let viewManager = null;

// 修改原有的bindEvents函数，添加批量操作事件绑定
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 页面加载完成，开始初始化...');
    testServerConnection();
    initializeSocket();
    loadWebhooks();
    bindEvents();
    startMemoryMonitoring();
    initTheme();
    
    // 初始化拖拽排序
    setTimeout(() => {
        initSortable();
    }, 1000);
    
    // 绑定批量操作事件
    document.getElementById('batchModeBtn').addEventListener('click', toggleBatchMode);
    document.getElementById('selectAllBtn').addEventListener('click', selectAllWebhooks);
    document.getElementById('batchEnableBtn').addEventListener('click', () => batchOperation('enable'));
    document.getElementById('batchDisableBtn').addEventListener('click', () => batchOperation('disable'));
    document.getElementById('batchDeleteBtn').addEventListener('click', () => batchOperation('delete'));
    document.getElementById('exitBatchBtn').addEventListener('click', exitBatchMode);
    
    // 绑定快捷键
    bindShortcuts();
    
    // 绑定帮助快捷键
    document.addEventListener('keydown', (e) => {
        if (e.key === '?' && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            showShortcutHelp();
        }
    });
    
    // 启动操作引导
    setTimeout(startTour, 2000);
});

// ==================== 高级搜索功能 ====================

// 打开高级搜索模态框
function openAdvancedSearchModal() {
    document.getElementById('advancedSearchModal').style.display = 'block';
    loadSearchHistory();
    initializeAdvancedSearch();
}

// 关闭高级搜索模态框
function closeAdvancedSearchModal() {
    document.getElementById('advancedSearchModal').style.display = 'none';
    resetAdvancedSearch();
}

// 初始化高级搜索
function initializeAdvancedSearch() {
    // 重置搜索条件
    advancedSearchConditions = [];
    
    // 添加第一个搜索条件
    addSearchCondition();
    
    // 重置表单
    document.getElementById('searchField').value = 'all';
    document.getElementById('searchValue').value = '';
    document.getElementById('searchOperator').value = 'contains';
    document.getElementById('caseSensitive').checked = false;
    document.getElementById('enableRegexSearch').checked = false;
    document.getElementById('conditionLogic').value = 'AND';
    
    // 隐藏正则表达式帮助
    document.getElementById('regexHelp').style.display = 'none';
}

// 添加搜索条件
function addSearchCondition() {
    const conditionId = Date.now() + Math.random();
    const condition = {
        id: conditionId,
        field: 'all',
        value: '',
        operator: 'contains',
        caseSensitive: false
    };
    
    advancedSearchConditions.push(condition);
    renderSearchConditions();
}

// 渲染搜索条件
function renderSearchConditions() {
    const container = document.getElementById('searchConditions');
    container.innerHTML = '';
    
    advancedSearchConditions.forEach((condition, index) => {
        const conditionElement = createSearchConditionElement(condition, index);
        container.appendChild(conditionElement);
    });
}

// 创建搜索条件元素
function createSearchConditionElement(condition, index) {
    const div = document.createElement('div');
    div.className = 'search-condition';
    div.innerHTML = `
        <div class="search-condition-header">
            <span class="search-condition-title">条件 ${index + 1}</span>
            <button class="remove-condition" onclick="removeSearchCondition(${condition.id})" title="删除条件">×</button>
        </div>
        <div class="search-condition-fields">
            <div class="form-group">
                <label>字段：</label>
                <select onchange="updateSearchCondition(${condition.id}, 'field', this.value)">
                    <option value="all" ${condition.field === 'all' ? 'selected' : ''}>所有字段</option>
                    <option value="tenantId" ${condition.field === 'tenantId' ? 'selected' : ''}>Tenant ID</option>
                    <option value="uniqueId" ${condition.field === 'uniqueId' ? 'selected' : ''}>Unique ID</option>
                    <option value="url" ${condition.field === 'url' ? 'selected' : ''}>请求URL</option>
                    <option value="method" ${condition.field === 'method' ? 'selected' : ''}>请求方法</option>
                    <option value="status" ${condition.field === 'status' ? 'selected' : ''}>响应状态</option>
                    <option value="ip" ${condition.field === 'ip' ? 'selected' : ''}>客户端IP</option>
                    <option value="userAgent" ${condition.field === 'userAgent' ? 'selected' : ''}>User-Agent</option>
                    <option value="body" ${condition.field === 'body' ? 'selected' : ''}>请求体内容</option>
                    <option value="headers" ${condition.field === 'headers' ? 'selected' : ''}>请求头</option>
                </select>
            </div>
            <div class="form-group">
                <label>操作符：</label>
                <select onchange="updateSearchCondition(${condition.id}, 'operator', this.value)">
                    <option value="contains" ${condition.operator === 'contains' ? 'selected' : ''}>包含</option>
                    <option value="equals" ${condition.operator === 'equals' ? 'selected' : ''}>等于</option>
                    <option value="startsWith" ${condition.operator === 'startsWith' ? 'selected' : ''}>开头是</option>
                    <option value="endsWith" ${condition.operator === 'endsWith' ? 'selected' : ''}>结尾是</option>
                    <option value="regex" ${condition.operator === 'regex' ? 'selected' : ''}>正则匹配</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label>搜索值：</label>
            <input type="text" value="${condition.value}" 
                   onchange="updateSearchCondition(${condition.id}, 'value', this.value)"
                   placeholder="输入搜索关键词或正则表达式">
        </div>
        <div class="form-group">
            <label>
                <input type="checkbox" ${condition.caseSensitive ? 'checked' : ''}
                       onchange="updateSearchCondition(${condition.id}, 'caseSensitive', this.checked)">
                区分大小写
            </label>
        </div>
    `;
    
    return div;
}

// 更新搜索条件
function updateSearchCondition(conditionId, field, value) {
    const condition = advancedSearchConditions.find(c => c.id === conditionId);
    if (condition) {
        condition[field] = value;
    }
}

// 删除搜索条件
function removeSearchCondition(conditionId) {
    advancedSearchConditions = advancedSearchConditions.filter(c => c.id !== conditionId);
    renderSearchConditions();
}

// 切换正则表达式帮助
function toggleRegexHelp() {
    const enableRegex = document.getElementById('enableRegexSearch').checked;
    const regexHelp = document.getElementById('regexHelp');
    regexHelp.style.display = enableRegex ? 'block' : 'none';
}

// 更新搜索操作符
function updateSearchOperator() {
    const operator = document.getElementById('searchOperator').value;
    const regexHelp = document.getElementById('regexHelp');
    regexHelp.style.display = operator === 'regex' ? 'block' : 'none';
}

// 应用高级搜索
function applyAdvancedSearch() {
    if (advancedSearchConditions.length === 0) {
        showNotification('请至少添加一个搜索条件', 'warning');
        return;
    }
    
    // 验证搜索条件
    for (const condition of advancedSearchConditions) {
        if (!condition.value.trim()) {
            showNotification(`条件 ${advancedSearchConditions.indexOf(condition) + 1} 的搜索值不能为空`, 'warning');
            return;
        }
    }
    
    // 保存当前搜索
    const searchName = `高级搜索_${new Date().toLocaleString()}`;
    const searchConfig = {
        name: searchName,
        conditions: [...advancedSearchConditions],
        logic: document.getElementById('conditionLogic').value,
        timestamp: Date.now()
    };
    
    // 添加到搜索历史
    searchHistory.unshift(searchConfig);
    if (searchHistory.length > 20) {
        searchHistory.pop(); // 最多保存20条搜索历史
    }
    
    // 保存到本地存储
    localStorage.setItem('webhookSearchHistory', JSON.stringify(searchHistory));
    
    // 应用搜索
    currentAdvancedSearch = searchConfig;
    applyAdvancedSearchToLogs();
    
    // 关闭模态框
    closeAdvancedSearchModal();
    
    showNotification('高级搜索已应用', 'success');
}

// 应用高级搜索到日志
function applyAdvancedSearchToLogs() {
    if (!currentAdvancedSearch) return;
    
    const { conditions, logic } = currentAdvancedSearch;
    
    logs = allLogs.filter(log => {
        if (logic === 'AND') {
            // 所有条件都必须满足
            return conditions.every(condition => evaluateSearchCondition(log, condition));
        } else {
            // 任一条件满足即可
            return conditions.some(condition => evaluateSearchCondition(log, condition));
        }
    });
    
    renderLogs();
    updateSearchResultInfo();
    
    // 显示清除高级搜索按钮
    document.getElementById('clearAdvancedSearchBtn').style.display = 'inline-block';
}

// 评估搜索条件
function evaluateSearchCondition(log, condition) {
    const { field, value, operator, caseSensitive } = condition;
    const searchValue = value.trim();
    
    if (!searchValue) return true;
    
    let fieldValue = '';
    
    // 根据字段获取值
    if (field === 'all') {
        // 搜索所有字段
        fieldValue = JSON.stringify(log).toLowerCase();
    } else if (field === 'tenantId') {
        fieldValue = extractFieldFromLog(log, 'tenantId') || '';
    } else if (field === 'uniqueId') {
        fieldValue = extractFieldFromLog(log, 'uniqueId') || '';
    } else if (field === 'url') {
        fieldValue = log.url || '';
    } else if (field === 'method') {
        fieldValue = log.method || '';
    } else if (field === 'status') {
        fieldValue = log.status || '';
    } else if (field === 'ip') {
        fieldValue = log.ip || '';
    } else if (field === 'userAgent') {
        fieldValue = log.userAgent || '';
    } else if (field === 'body') {
        fieldValue = JSON.stringify(log.body || {});
    } else if (field === 'headers') {
        fieldValue = JSON.stringify(log.headers || {});
    }
    
    // 转换为字符串
    fieldValue = String(fieldValue);
    
    // 根据操作符进行匹配
    if (operator === 'regex') {
        try {
            const flags = caseSensitive ? 'g' : 'gi';
            const regex = new RegExp(searchValue, flags);
            return regex.test(fieldValue);
        } catch (error) {
            console.error('正则表达式错误:', error);
            return false;
        }
    } else {
        // 非正则表达式搜索
        if (!caseSensitive) {
            fieldValue = fieldValue.toLowerCase();
            searchValue = searchValue.toLowerCase();
        }
        
        switch (operator) {
            case 'contains':
                return fieldValue.includes(searchValue);
            case 'equals':
                return fieldValue === searchValue;
            case 'startsWith':
                return fieldValue.startsWith(searchValue);
            case 'endsWith':
                return fieldValue.endsWith(searchValue);
            default:
                return fieldValue.includes(searchValue);
        }
    }
}

// 保存搜索条件
function saveSearchCondition() {
    const name = prompt('请输入搜索条件名称：');
    if (!name) return;
    
    const searchConfig = {
        name: name,
        conditions: [...advancedSearchConditions],
        logic: document.getElementById('conditionLogic').value,
        timestamp: Date.now()
    };
    
    // 添加到搜索历史
    searchHistory.unshift(searchConfig);
    if (searchHistory.length > 20) {
        searchHistory.pop();
    }
    
    // 保存到本地存储
    localStorage.setItem('webhookSearchHistory', JSON.stringify(searchHistory));
    
    showNotification('搜索条件已保存', 'success');
    loadSearchHistory();
}

// 重置高级搜索
function resetAdvancedSearch() {
    advancedSearchConditions = [];
    renderSearchConditions();
    document.getElementById('searchField').value = 'all';
    document.getElementById('searchValue').value = '';
    document.getElementById('searchOperator').value = 'contains';
    document.getElementById('caseSensitive').checked = false;
    document.getElementById('enableRegexSearch').checked = false;
    document.getElementById('conditionLogic').value = 'AND';
    document.getElementById('regexHelp').style.display = 'none';
}

// 加载搜索历史
function loadSearchHistory() {
    try {
        const saved = localStorage.getItem('webhookSearchHistory');
        if (saved) {
            searchHistory = JSON.parse(saved);
        }
    } catch (error) {
        console.error('加载搜索历史失败:', error);
        searchHistory = [];
    }
    
    renderSearchHistory();
}

// 渲染搜索历史
function renderSearchHistory() {
    const container = document.getElementById('searchHistory');
    
    if (searchHistory.length === 0) {
        container.innerHTML = '<div class="no-history">暂无搜索历史</div>';
        return;
    }
    
    container.innerHTML = searchHistory.map((item, index) => `
        <div class="search-history-item" onclick="loadSearchFromHistory(${index})">
            <div class="history-name">${item.name}</div>
            <div class="history-details">
                条件数: ${item.conditions.length} | 
                逻辑: ${item.logic} | 
                时间: ${new Date(item.timestamp).toLocaleString()}
            </div>
            <div class="history-actions">
                <button onclick="event.stopPropagation(); deleteSearchHistory(${index})" class="btn btn-small btn-danger">删除</button>
            </div>
        </div>
    `).join('');
}

// 从历史记录加载搜索
function loadSearchFromHistory(index) {
    const searchConfig = searchHistory[index];
    if (!searchConfig) return;
    
    // 加载搜索条件
    advancedSearchConditions = [...searchConfig.conditions];
    renderSearchConditions();
    
    // 设置逻辑
    document.getElementById('conditionLogic').value = searchConfig.logic;
    
    showNotification('已加载搜索条件', 'info');
}

// 删除搜索历史
function deleteSearchHistory(index) {
    searchHistory.splice(index, 1);
    localStorage.setItem('webhookSearchHistory', JSON.stringify(searchHistory));
    renderSearchHistory();
    showNotification('搜索历史已删除', 'success');
}

// 清空搜索历史
function clearSearchHistory() {
    if (confirm('确定要清空所有搜索历史吗？')) {
        searchHistory = [];
        localStorage.setItem('webhookSearchHistory', JSON.stringify(searchHistory));
        renderSearchHistory();
        showNotification('搜索历史已清空', 'success');
    }
}

// 清除当前高级搜索
function clearAdvancedSearch() {
    currentAdvancedSearch = null;
    logs = [...allLogs];
    renderLogs();
    updateSearchResultInfo();
    
    // 隐藏清除高级搜索按钮
    document.getElementById('clearAdvancedSearchBtn').style.display = 'none';
    
    showNotification('已清除高级搜索', 'info');
}

// ==================== 快速过滤功能 ====================

// 打开快速过滤模态框
function openQuickFilterModal() {
    document.getElementById('quickFilterModal').style.display = 'block';
    loadSavedQuickFilters();
    initializeQuickFilters();
}

// 关闭快速过滤模态框
function closeQuickFilterModal() {
    document.getElementById('quickFilterModal').style.display = 'none';
    resetQuickFilterSelection();
}

// 初始化快速过滤
function initializeQuickFilters() {
    // 清除之前的选择
    resetQuickFilterSelection();
    
    // 绑定快速过滤项点击事件
    document.querySelectorAll('.quick-filter-item').forEach(item => {
        item.addEventListener('click', function() {
            toggleQuickFilterSelection(this);
        });
    });
}

// 重置快速过滤选择
function resetQuickFilterSelection() {
    document.querySelectorAll('.quick-filter-item').forEach(item => {
        item.classList.remove('selected');
    });
    quickFilters = [];
}

// 切换快速过滤选择
function toggleQuickFilterSelection(element) {
    const filterType = element.dataset.filter;
    
    if (element.classList.contains('selected')) {
        // 取消选择
        element.classList.remove('selected');
        quickFilters = quickFilters.filter(f => f.type !== filterType);
    } else {
        // 选择
        element.classList.add('selected');
        quickFilters.push({
            type: filterType,
            name: element.querySelector('.filter-title').textContent,
            description: element.querySelector('.filter-desc').textContent
        });
    }
}

// 应用快速过滤
function applyQuickFilter() {
    if (quickFilters.length === 0) {
        showNotification('请选择至少一个过滤条件', 'warning');
        return;
    }
    
    // 保存当前过滤到历史
    saveQuickFilterToHistory();
    
    // 应用过滤到日志
    applyQuickFilterToLogs();
    
    // 关闭模态框
    closeQuickFilterModal();
    
    showNotification(`已应用 ${quickFilters.length} 个快速过滤条件`, 'success');
}

// 应用快速过滤到日志
function applyQuickFilterToLogs() {
    if (quickFilters.length === 0) return;
    
    // 保存当前过滤状态
    currentQuickFilter = [...quickFilters];
    
    // 过滤日志
    logs = allLogs.filter(log => {
        return quickFilters.every(filter => {
            return evaluateQuickFilter(log, filter);
        });
    });
    
    // 渲染过滤后的日志
    renderLogs();
    updateSearchResultInfo();
    
    // 显示清除快速过滤按钮
    document.getElementById('clearQuickFilterBtn').style.display = 'inline-block';
}

// 评估快速过滤条件
function evaluateQuickFilter(log, filter) {
    switch (filter.type) {
        case 'success':
            return log.status >= 200 && log.status < 300;
        case 'error':
            return log.status >= 400 && log.status < 600;
        case 'timeout':
            return log.responseTime > 5000; // 5秒
        case 'recent':
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            return log.timestamp > oneHourAgo;
        case 'mobile':
            return log.headers && log.headers['user-agent'] && 
                   log.headers['user-agent'].toLowerCase().includes('mobile');
        case 'bot':
            return log.headers && log.headers['user-agent'] && 
                   log.headers['user-agent'].toLowerCase().includes('bot');
        case 'api':
            return log.headers && log.headers['content-type'] && 
                   log.headers['content-type'].toLowerCase().includes('json');
        case 'large':
            return log.body && log.body.length > 1024 * 1024; // 1MB
        default:
            return true;
    }
}

// 清除快速过滤
function clearQuickFilter() {
    currentQuickFilter = null;
    logs = [...allLogs];
    renderLogs();
    updateSearchResultInfo();
    
    // 隐藏清除快速过滤按钮
    document.getElementById('clearQuickFilterBtn').style.display = 'none';
    
    showNotification('已清除快速过滤', 'info');
}

// 添加自定义过滤
function addCustomFilter() {
    const name = document.getElementById('customFilterName').value.trim();
    const condition = document.getElementById('customFilterCondition').value.trim();
    
    if (!name || !condition) {
        showNotification('请填写过滤名称和条件', 'warning');
        return;
    }
    
    // 验证条件格式
    if (!validateCustomFilterCondition(condition)) {
        showNotification('过滤条件格式不正确', 'error');
        return;
    }
    
    // 添加到已保存的快速过滤
    const customFilter = {
        name: name,
        condition: condition,
        timestamp: Date.now()
    };
    
    savedQuickFilters.push(customFilter);
    localStorage.setItem('webhookQuickFilters', JSON.stringify(savedQuickFilters));
    
    // 清空表单
    document.getElementById('customFilterName').value = '';
    document.getElementById('customFilterCondition').value = '';
    
    // 重新渲染
    renderSavedQuickFilters();
    
    showNotification('自定义过滤已添加', 'success');
}

// 验证自定义过滤条件
function validateCustomFilterCondition(condition) {
    // 简单的条件格式验证
    const validOperators = ['=', '!=', '>', '<', '>=', '<=', 'contains', 'startsWith', 'endsWith'];
    const hasValidOperator = validOperators.some(op => condition.includes(op));
    
    return hasValidOperator && condition.includes('AND') || condition.includes('OR') || !condition.includes('AND') && !condition.includes('OR');
}

// 保存快速过滤到历史
function saveQuickFilterToHistory() {
    const filterHistory = {
        filters: [...quickFilters],
        timestamp: Date.now()
    };
    
    // 从localStorage加载历史
    let history = [];
    try {
        const saved = localStorage.getItem('webhookQuickFilterHistory');
        if (saved) {
            history = JSON.parse(saved);
        }
    } catch (error) {
        console.error('加载快速过滤历史失败:', error);
    }
    
    // 添加到历史开头
    history.unshift(filterHistory);
    
    // 只保留最近20条记录
    if (history.length > 20) {
        history = history.slice(0, 20);
    }
    
    // 保存到localStorage
    localStorage.setItem('webhookQuickFilterHistory', JSON.stringify(history));
}

// 加载已保存的快速过滤
function loadQuickFilters() {
    try {
        const saved = localStorage.getItem('webhookQuickFilters');
        if (saved) {
            savedQuickFilters = JSON.parse(saved);
        }
    } catch (error) {
        console.error('加载快速过滤失败:', error);
        savedQuickFilters = [];
    }
}

// 加载已保存的快速过滤到界面
function loadSavedQuickFilters() {
    loadQuickFilters();
    renderSavedQuickFilters();
}

// 渲染已保存的快速过滤
function renderSavedQuickFilters() {
    const container = document.getElementById('savedQuickFilters');
    
    if (savedQuickFilters.length === 0) {
        container.innerHTML = '<div class="no-filters">暂无已保存的快速过滤</div>';
        return;
    }
    
    container.innerHTML = savedQuickFilters.map((filter, index) => `
        <div class="saved-filter-item">
            <div class="filter-name">${filter.name}</div>
            <div class="filter-condition">${filter.condition}</div>
            <div class="filter-actions">
                <button onclick="applySavedQuickFilter(${index})" class="btn btn-small btn-primary">应用</button>
                <button onclick="deleteSavedQuickFilter(${index})" class="btn btn-small btn-danger">删除</button>
            </div>
        </div>
    `).join('');
}

// 应用已保存的快速过滤
function applySavedQuickFilter(index) {
    const filter = savedQuickFilters[index];
    if (!filter) return;
    
    // 解析自定义条件并应用
    try {
        const parsedCondition = parseCustomFilterCondition(filter.condition);
        if (parsedCondition) {
            // 应用自定义过滤
            applyCustomFilterCondition(parsedCondition);
            closeQuickFilterModal();
            showNotification(`已应用自定义过滤: ${filter.name}`, 'success');
        }
    } catch (error) {
        console.error('应用自定义过滤失败:', error);
        showNotification('应用自定义过滤失败', 'error');
    }
}

// 删除已保存的快速过滤
function deleteSavedQuickFilter(index) {
    if (confirm('确定要删除这个快速过滤吗？')) {
        savedQuickFilters.splice(index, 1);
        localStorage.setItem('webhookQuickFilters', JSON.stringify(savedQuickFilters));
        renderSavedQuickFilters();
        showNotification('快速过滤已删除', 'success');
    }
}

// 解析自定义过滤条件
function parseCustomFilterCondition(condition) {
    // 简单的条件解析器
    // 支持格式: field = value AND field2 != value2 OR field3 > value3
    try {
        const parts = condition.split(/\s+(AND|OR)\s+/i);
        const result = {
            conditions: [],
            logic: 'AND'
        };
        
        for (let i = 0; i < parts.length; i++) {
            if (parts[i].toUpperCase() === 'AND' || parts[i].toUpperCase() === 'OR') {
                result.logic = parts[i].toUpperCase();
            } else if (parts[i].trim()) {
                const conditionPart = parts[i].trim();
                const match = conditionPart.match(/(\w+)\s*([=!<>]=?|contains|startsWith|endsWith)\s*(.+)/);
                if (match) {
                    result.conditions.push({
                        field: match[1],
                        operator: match[2],
                        value: match[3].replace(/['"]/g, '')
                    });
                }
            }
        }
        
        return result.conditions.length > 0 ? result : null;
    } catch (error) {
        console.error('解析自定义过滤条件失败:', error);
        return null;
    }
}

// 应用自定义过滤条件
function applyCustomFilterCondition(parsedCondition) {
    if (!parsedCondition || !parsedCondition.conditions) return;
    
    // 过滤日志
    logs = allLogs.filter(log => {
        return parsedCondition.conditions.every(condition => {
            return evaluateCustomFilterCondition(log, condition);
        });
    });
    
    // 渲染过滤后的日志
    renderLogs();
    updateSearchResultInfo();
    
    // 显示清除快速过滤按钮
    document.getElementById('clearQuickFilterBtn').style.display = 'inline-block';
}

// 评估自定义过滤条件
function evaluateCustomFilterCondition(log, condition) {
    const field = condition.field;
    const operator = condition.operator;
    const value = condition.value;
    
    let fieldValue;
    
    // 获取字段值
    switch (field.toLowerCase()) {
        case 'tenantid':
            fieldValue = log.tenantId;
            break;
        case 'uniqueid':
            fieldValue = log.uniqueId;
            break;
        case 'status':
            fieldValue = log.status;
            break;
        case 'method':
            fieldValue = log.method;
            break;
        case 'url':
            fieldValue = log.url;
            break;
        case 'ip':
            fieldValue = log.ip;
            break;
        case 'responseTime':
            fieldValue = log.responseTime;
            break;
        default:
            fieldValue = '';
    }
    
    // 根据操作符进行比较
    switch (operator) {
        case '=':
            return fieldValue == value;
        case '!=':
            return fieldValue != value;
        case '>':
            return fieldValue > value;
        case '<':
            return fieldValue < value;
        case '>=':
            return fieldValue >= value;
        case '<=':
            return fieldValue <= value;
        case 'contains':
            return String(fieldValue).toLowerCase().includes(value.toLowerCase());
        case 'startsWith':
            return String(fieldValue).toLowerCase().startsWith(value.toLowerCase());
        case 'endsWith':
            return String(fieldValue).toLowerCase().endsWith(value.toLowerCase());
        default:
            return true;
    }
}

// 打开系统监控页面
function openSystemMonitor() {
    window.open('system-monitor.html', '_blank');
}
