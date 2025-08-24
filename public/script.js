// 全局变量
let socket;
let webhooks = [];
let logs = [];
let allLogs = []; // 保存所有日志用于搜索
let currentEditingWebhook = null;
let selectedWebhookFilter = '';
let selectedMessageTypeFilter = 'all';
let currentTypeStats = {};
let searchFilters = {
    tenantId: '',
    uniqueId: ''
};

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 页面加载完成，开始初始化...');
    testServerConnection();
    initializeSocket();
    loadWebhooks();
    bindEvents();
    startMemoryMonitoring();
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
    
    // 清空所有日志按钮
    document.getElementById('clearAllLogsBtn').addEventListener('click', function() {
        clearAllLogs();
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
            webhooks = data.webhooks;
            updateMemoryDisplay(data.memoryInfo);
        } else {
            // 兼容旧格式
            webhooks = data;
        }
        
        console.log('Webhook列表加载成功，共', webhooks.length, '个');
        renderWebhooks();
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

// 渲染Webhook列表
function renderWebhooks() {
    const container = document.getElementById('webhookContainer');
    
    if (webhooks.length === 0) {
        container.innerHTML = '<div class="no-logs">暂无Webhook，点击新建按钮创建第一个</div>';
        return;
    }
    
    container.innerHTML = webhooks.map(webhook => `
        <div class="webhook-item ${selectedWebhookFilter === webhook.id ? 'selected' : ''}" 
             onclick="selectWebhook('${webhook.id}')" data-webhook-id="${webhook.id}">
            <div class="webhook-info">
                <h4>${escapeHtml(webhook.name)}</h4>
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
function highlightSearchTerm(text, searchTerm) {
    if (!searchTerm) return escapeHtml(text);
    
    const escapedText = escapeHtml(text);
    const escapedSearchTerm = escapeHtml(searchTerm);
    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
    
    return escapedText.replace(regex, '<span class="search-highlight">$1</span>');
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
