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
let currentAdvancedSearch = null; // 当前应用的高级搜索

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
    initializeAdvancedSearch(); // 初始化高级搜索
    startMemoryMonitoring();
    
    // 初始化拖拽排序
    setTimeout(() => {
        initSortable();
    }, 1000);
});

// ==================== 高级搜索功能 ====================

// 初始化高级搜索
function initializeAdvancedSearch() {
    // 重置搜索条件
    advancedSearchConditions = [];
    updateAdvancedSearchDisplay();
}

// 添加搜索条件
function addSearchCondition() {
    const condition = {
        id: Date.now(),
        field: 'tenantId',
        operator: 'equals',
        value: '',
        logic: 'AND'
    };
    
    advancedSearchConditions.push(condition);
    updateAdvancedSearchDisplay();
}

// 更新高级搜索显示
function updateAdvancedSearchDisplay() {
    const container = document.getElementById('advancedSearchConditions');
    if (!container) return;
    
    container.innerHTML = '';
    
    advancedSearchConditions.forEach((condition, index) => {
        const conditionElement = createConditionElement(condition, index);
        container.appendChild(conditionElement);
    });
    
    // 如果没有条件，显示添加按钮
    if (advancedSearchConditions.length === 0) {
        const addButton = document.createElement('button');
        addButton.className = 'ant-btn ant-btn-dashed';
        addButton.innerHTML = '<span class="anticon">➕</span> 添加搜索条件';
        addButton.onclick = addSearchCondition;
        container.appendChild(addButton);
    }
}

// 创建条件元素
function createConditionElement(condition, index) {
    const div = document.createElement('div');
    div.className = 'search-condition';
    
    const fields = [
        { value: 'tenantId', label: 'Tenant ID' },
        { value: 'uniqueId', label: 'Unique ID' },
        { value: 'url', label: 'URL' },
        { value: 'method', label: '请求方法' },
        { value: 'statusCode', label: '状态码' },
        { value: 'responseTime', label: '响应时间' },
        { value: 'timestamp', label: '时间戳' },
        { value: 'ip', label: 'IP地址' },
        { value: 'userAgent', label: 'User Agent' }
    ];
    
    const operators = [
        { value: 'equals', label: '等于' },
        { value: 'contains', label: '包含' },
        { value: 'startsWith', label: '开始于' },
        { value: 'endsWith', label: '结束于' },
        { value: 'gt', label: '大于' },
        { value: 'lt', label: '小于' },
        { value: 'gte', label: '大于等于' },
        { value: 'lte', label: '小于等于' },
        { value: 'between', label: '介于' },
        { value: 'regex', label: '正则表达式' }
    ];
    
    div.innerHTML = `
        ${index > 0 ? `
            <select class="ant-select logic-select" onchange="updateCondition(${condition.id}, 'logic', this.value)">
                <option value="AND" ${condition.logic === 'AND' ? 'selected' : ''}>AND</option>
                <option value="OR" ${condition.logic === 'OR' ? 'selected' : ''}>OR</option>
            </select>
        ` : ''}
        
        <select class="ant-select field-select" onchange="updateCondition(${condition.id}, 'field', this.value)">
            ${fields.map(field => 
                `<option value="${field.value}" ${condition.field === field.value ? 'selected' : ''}>${field.label}</option>`
            ).join('')}
        </select>
        
        <select class="ant-select operator-select" onchange="updateCondition(${condition.id}, 'operator', this.value)">
            ${operators.map(op => 
                `<option value="${op.value}" ${condition.operator === op.value ? 'selected' : ''}>${op.label}</option>`
            ).join('')}
        </select>
        
        <input type="text" class="ant-input value-input" placeholder="输入值" 
               value="${condition.value}" 
               onchange="updateCondition(${condition.id}, 'value', this.value)">
        
        <button class="ant-btn ant-btn-danger ant-btn-sm" onclick="removeCondition(${condition.id})">
            <span class="anticon">🗑️</span>
        </button>
    `;
    
    return div;
}

// 更新条件
function updateCondition(id, field, value) {
    const condition = advancedSearchConditions.find(c => c.id === id);
    if (condition) {
        condition[field] = value;
    }
}

// 移除条件
function removeCondition(id) {
    advancedSearchConditions = advancedSearchConditions.filter(c => c.id !== id);
    updateAdvancedSearchDisplay();
}

// 执行高级搜索
function executeAdvancedSearch() {
    if (advancedSearchConditions.length === 0) {
        showNotification('请添加至少一个搜索条件', 'warning');
        return;
    }
    
    // 验证条件
    const invalidConditions = advancedSearchConditions.filter(c => !c.value.trim());
    if (invalidConditions.length > 0) {
        showNotification('请填写所有搜索条件的值', 'warning');
        return;
    }
    
    // 应用搜索
    const filteredLogs = allLogs.filter(log => {
        return evaluateConditions(log, advancedSearchConditions);
    });
    
    // 保存当前搜索
    currentAdvancedSearch = JSON.parse(JSON.stringify(advancedSearchConditions));
    
    // 保存到搜索历史
    saveToSearchHistory();
    
    // 显示结果
    displayLogs(filteredLogs);
    
    // 关闭搜索面板
    document.getElementById('advancedSearchPanel').style.display = 'none';
    
    showNotification(`高级搜索完成，找到 ${filteredLogs.length} 条记录`, 'success');
}

// 评估搜索条件
function evaluateConditions(log, conditions) {
    if (conditions.length === 0) return true;
    
    let result = evaluateCondition(log, conditions[0]);
    
    for (let i = 1; i < conditions.length; i++) {
        const condition = conditions[i];
        const conditionResult = evaluateCondition(log, condition);
        
        if (condition.logic === 'AND') {
            result = result && conditionResult;
        } else {
            result = result || conditionResult;
        }
    }
    
    return result;
}

// 评估单个条件
function evaluateCondition(log, condition) {
    const fieldValue = getFieldValue(log, condition.field);
    const searchValue = condition.value;
    
    switch (condition.operator) {
        case 'equals':
            return String(fieldValue).toLowerCase() === searchValue.toLowerCase();
        case 'contains':
            return String(fieldValue).toLowerCase().includes(searchValue.toLowerCase());
        case 'startsWith':
            return String(fieldValue).toLowerCase().startsWith(searchValue.toLowerCase());
        case 'endsWith':
            return String(fieldValue).toLowerCase().endsWith(searchValue.toLowerCase());
        case 'gt':
            return Number(fieldValue) > Number(searchValue);
        case 'lt':
            return Number(fieldValue) < Number(searchValue);
        case 'gte':
            return Number(fieldValue) >= Number(searchValue);
        case 'lte':
            return Number(fieldValue) <= Number(searchValue);
        case 'between':
            const [min, max] = searchValue.split(',').map(v => Number(v.trim()));
            return Number(fieldValue) >= min && Number(fieldValue) <= max;
        case 'regex':
            try {
                const regex = new RegExp(searchValue, 'i');
                return regex.test(String(fieldValue));
            } catch (e) {
                return false;
            }
        default:
            return false;
    }
}

// 获取字段值
function getFieldValue(log, field) {
    switch (field) {
        case 'tenantId':
            return log.tenantId || '';
        case 'uniqueId':
            return log.uniqueId || '';
        case 'url':
            return log.url || '';
        case 'method':
            return log.method || '';
        case 'statusCode':
            return log.statusCode || 0;
        case 'responseTime':
            return log.responseTime || 0;
        case 'timestamp':
            return log.timestamp || '';
        case 'ip':
            return log.ip || '';
        case 'userAgent':
            return (log.headers && log.headers['user-agent']) || '';
        default:
            return '';
    }
}

// 保存搜索历史
function saveToSearchHistory() {
    const searchItem = {
        id: Date.now(),
        conditions: JSON.parse(JSON.stringify(advancedSearchConditions)),
        timestamp: new Date().toISOString(),
        name: generateSearchName()
    };
    
    searchHistory.unshift(searchItem);
    
    // 限制历史记录数量
    if (searchHistory.length > 20) {
        searchHistory = searchHistory.slice(0, 20);
    }
    
    // 保存到localStorage
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    
    updateSearchHistoryDisplay();
}

// 生成搜索名称
function generateSearchName() {
    if (advancedSearchConditions.length === 1) {
        const condition = advancedSearchConditions[0];
        return `${condition.field} ${condition.operator} ${condition.value}`;
    } else {
        return `${advancedSearchConditions.length} 个条件的搜索`;
    }
}



// 清空高级搜索
function clearAdvancedSearch() {
    advancedSearchConditions = [];
    currentAdvancedSearch = null;
    updateAdvancedSearchDisplay();
    
    // 重新显示所有日志
    displayLogs(allLogs);
    
    showNotification('高级搜索已清空', 'success');
}


// ==================== 核心功能 ====================

// 测试服务器连接
async function testServerConnection() {
    try {
        const response = await fetch('/api/health');
        if (response.ok) {
            console.log('✅ 服务器连接正常');
            showNotification('服务器连接正常', 'success');
        } else {
            throw new Error('服务器响应异常');
        }
    } catch (error) {
        console.error('❌ 服务器连接失败:', error);
        showNotification('服务器连接失败，请检查服务器状态', 'error');
    }
}

// 初始化WebSocket连接
function initializeSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = function() {
        console.log('🔗 WebSocket连接已建立');
        showNotification('实时连接已建立', 'success');
    };
    
    socket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('WebSocket消息解析错误:', error);
        }
    };
    
    socket.onclose = function() {
        console.log('🔌 WebSocket连接已断开');
        showNotification('实时连接已断开，尝试重连...', 'warning');
        
        // 5秒后尝试重连
        setTimeout(() => {
            initializeSocket();
        }, 5000);
    };
    
    socket.onerror = function(error) {
        console.error('WebSocket错误:', error);
        showNotification('WebSocket连接错误', 'error');
    };
}

// 处理WebSocket消息
function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'webhook_created':
            webhooks.unshift(data.webhook);
            allWebhooks.unshift(data.webhook);
            updateWebhookList();
            showNotification(`新建Webhook: ${data.webhook.name}`, 'success');
            break;
            
        case 'webhook_updated':
            const index = webhooks.findIndex(w => w.id === data.webhook.id);
            if (index !== -1) {
                webhooks[index] = data.webhook;
                const allIndex = allWebhooks.findIndex(w => w.id === data.webhook.id);
                if (allIndex !== -1) {
                    allWebhooks[allIndex] = data.webhook;
                }
                updateWebhookList();
                showNotification(`Webhook已更新: ${data.webhook.name}`, 'info');
            }
            break;
            
        case 'webhook_deleted':
            webhooks = webhooks.filter(w => w.id !== data.webhookId);
            allWebhooks = allWebhooks.filter(w => w.id !== data.webhookId);
            updateWebhookList();
            showNotification('Webhook已删除', 'info');
            break;
            
        case 'new_log':
            logs.unshift(data.log);
            allLogs.unshift(data.log);
            
            // 限制日志数量
            if (logs.length > 1000) {
                logs = logs.slice(0, 1000);
            }
            if (allLogs.length > 1000) {
                allLogs = allLogs.slice(0, 1000);
            }
            
            updateLogDisplay();
            updateStats();
            
            // 检查告警条件
            checkAlerts(data.log);
            break;
    }
}

// 加载Webhook列表
async function loadWebhooks() {
    try {
        const response = await fetch('/api/webhooks');
        if (response.ok) {
            const data = await response.json();
            webhooks = data;
            allWebhooks = [...data]; // 创建副本用于搜索
            updateWebhookList();
            console.log(`📋 加载了 ${webhooks.length} 个Webhook`);
        } else {
            throw new Error('加载Webhook失败');
        }
    } catch (error) {
        console.error('加载Webhook错误:', error);
        showNotification('加载Webhook失败', 'error');
    }
}

// 更新Webhook列表显示
function updateWebhookList() {
    const container = document.getElementById('webhookList');
    if (!container) return;
    
    // 应用搜索过滤
    let filteredWebhooks = webhookSearchFilter ? 
        allWebhooks.filter(webhook => 
            webhook.name.toLowerCase().includes(webhookSearchFilter.toLowerCase()) ||
            webhook.url.toLowerCase().includes(webhookSearchFilter.toLowerCase())
        ) : webhooks;
    
    container.innerHTML = '';
    
    if (filteredWebhooks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <div class="empty-text">暂无Webhook</div>
                <button class="ant-btn ant-btn-primary" onclick="openWebhookModal()">创建第一个Webhook</button>
            </div>
        `;
        return;
    }
    
    filteredWebhooks.forEach(webhook => {
        const item = createWebhookItem(webhook);
        container.appendChild(item);
    });
}

// 创建Webhook项目元素
function createWebhookItem(webhook) {
    const div = document.createElement('div');
    div.className = `webhook-item ${selectedWebhookFilter === webhook.id ? 'active' : ''}`;
    div.onclick = () => selectWebhook(webhook.id);
    
    const statusClass = webhook.active ? 'status-active' : 'status-inactive';
    const statusText = webhook.active ? '活跃' : '暂停';
    
    div.innerHTML = `
        <div class="webhook-header">
            <div class="webhook-name">${webhook.name}</div>
            <div class="webhook-status ${statusClass}">${statusText}</div>
        </div>
        <div class="webhook-url">${webhook.url}</div>
        <div class="webhook-meta">
            <span class="webhook-method">${webhook.method || 'POST'}</span>
            <span class="webhook-created">创建于 ${new Date(webhook.createdAt).toLocaleDateString()}</span>
        </div>
        <div class="webhook-actions">
            <button class="ant-btn ant-btn-sm" onclick="event.stopPropagation(); editWebhook('${webhook.id}')">
                <span class="anticon">✏️</span>
            </button>
            <button class="ant-btn ant-btn-sm" onclick="event.stopPropagation(); copyWebhookUrl('${webhook.url}')">
                <span class="anticon">📋</span>
            </button>
            <button class="ant-btn ant-btn-sm ant-btn-danger" onclick="event.stopPropagation(); deleteWebhook('${webhook.id}')">
                <span class="anticon">🗑️</span>
            </button>
        </div>
    `;
    
    return div;
}

// 选择Webhook
function selectWebhook(webhookId) {
    selectedWebhookFilter = selectedWebhookFilter === webhookId ? '' : webhookId;
    updateWebhookList();
    loadLogs();
}

// 加载日志
async function loadLogs() {
    try {
        let url = '/api/logs';
        const params = new URLSearchParams();
        
        if (selectedWebhookFilter) {
            params.append('webhookId', selectedWebhookFilter);
        }
        
        if (searchFilters.tenantId) {
            params.append('tenantId', searchFilters.tenantId);
        }
        
        if (searchFilters.uniqueId) {
            params.append('uniqueId', searchFilters.uniqueId);
        }
        
        if (searchFilters.startTime) {
            params.append('startTime', searchFilters.startTime);
        }
        
        if (searchFilters.endTime) {
            params.append('endTime', searchFilters.endTime);
        }
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            logs = data;
            allLogs = [...data]; // 创建副本用于搜索
            updateLogDisplay();
            updateStats();
            console.log(`📊 加载了 ${logs.length} 条日志`);
        } else {
            throw new Error('加载日志失败');
        }
    } catch (error) {
        console.error('加载日志错误:', error);
        showNotification('加载日志失败', 'error');
    }
}

// 更新日志显示
function updateLogDisplay() {
    // 应用当前的搜索条件
    let filteredLogs = logs;
    
    // 应用高级搜索
    if (currentAdvancedSearch) {
        filteredLogs = filteredLogs.filter(log => {
            return evaluateConditions(log, currentAdvancedSearch);
        });
    }
    
    // 应用快速过滤
    if (currentQuickFilter) {
        filteredLogs = filteredLogs.filter(log => {
            return evaluateConditions(log, currentQuickFilter.conditions);
        });
    }
    
    displayLogs(filteredLogs);
}

// 显示日志
function displayLogs(logsToDisplay) {
    const container = document.getElementById('logsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (logsToDisplay.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📄</div>
                <div class="empty-text">暂无日志记录</div>
            </div>
        `;
        return;
    }
    
    logsToDisplay.forEach(log => {
        const item = createLogItem(log);
        container.appendChild(item);
    });
}

// 创建日志项目元素
function createLogItem(log) {
    const div = document.createElement('div');
    div.className = 'log-item';
    div.onclick = () => showLogDetails(log);
    
    const statusClass = getStatusClass(log.statusCode);
    const methodClass = `method-${(log.method || 'POST').toLowerCase()}`;
    
    div.innerHTML = `
        <div class="log-header">
            <div class="log-status ${statusClass}">${log.statusCode || 'N/A'}</div>
            <div class="log-method ${methodClass}">${log.method || 'POST'}</div>
            <div class="log-time">${new Date(log.timestamp).toLocaleString()}</div>
        </div>
        <div class="log-content">
            <div class="log-url">${log.url || 'N/A'}</div>
            <div class="log-meta">
                ${log.tenantId ? `<span class="log-tenant">Tenant: ${log.tenantId}</span>` : ''}
                ${log.uniqueId ? `<span class="log-unique">ID: ${log.uniqueId}</span>` : ''}
                ${log.responseTime ? `<span class="log-response-time">${log.responseTime}ms</span>` : ''}
            </div>
        </div>
    `;
    
    return div;
}

// 获取状态样式类
function getStatusClass(statusCode) {
    if (!statusCode) return 'status-unknown';
    if (statusCode >= 200 && statusCode < 300) return 'status-success';
    if (statusCode >= 300 && statusCode < 400) return 'status-redirect';
    if (statusCode >= 400 && statusCode < 500) return 'status-client-error';
    if (statusCode >= 500) return 'status-server-error';
    return 'status-unknown';
}

// 显示日志详情
function showLogDetails(log) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>日志详情</h3>
                <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="log-details">
                    <div class="detail-section">
                        <h4>基本信息</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>状态码:</label>
                                <span class="${getStatusClass(log.statusCode)}">${log.statusCode || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>请求方法:</label>
                                <span>${log.method || 'POST'}</span>
                            </div>
                            <div class="detail-item">
                                <label>URL:</label>
                                <span>${log.url || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>时间:</label>
                                <span>${new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                            <div class="detail-item">
                                <label>响应时间:</label>
                                <span>${log.responseTime || 'N/A'}ms</span>
                            </div>
                            <div class="detail-item">
                                <label>IP地址:</label>
                                <span>${log.ip || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${log.tenantId || log.uniqueId ? `
                        <div class="detail-section">
                            <h4>标识信息</h4>
                            <div class="detail-grid">
                                ${log.tenantId ? `
                                    <div class="detail-item">
                                        <label>Tenant ID:</label>
                                        <span>${log.tenantId}</span>
                                    </div>
                                ` : ''}
                                ${log.uniqueId ? `
                                    <div class="detail-item">
                                        <label>Unique ID:</label>
                                        <span>${log.uniqueId}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${log.headers ? `
                        <div class="detail-section">
                            <h4>请求头</h4>
                            <pre class="detail-code">${JSON.stringify(log.headers, null, 2)}</pre>
                        </div>
                    ` : ''}
                    
                    ${log.body ? `
                        <div class="detail-section">
                            <h4>请求体</h4>
                            <pre class="detail-code">${typeof log.body === 'string' ? log.body : JSON.stringify(log.body, null, 2)}</pre>
                        </div>
                    ` : ''}
                    
                    ${log.response ? `
                        <div class="detail-section">
                            <h4>响应内容</h4>
                            <pre class="detail-code">${typeof log.response === 'string' ? log.response : JSON.stringify(log.response, null, 2)}</pre>
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="modal-footer">
                <button class="ant-btn ant-btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">关闭</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// 更新统计信息
function updateStats() {
    const totalLogs = logs.length;
    const successLogs = logs.filter(log => log.statusCode >= 200 && log.statusCode < 300).length;
    const errorLogs = logs.filter(log => log.statusCode >= 400).length;
    const avgResponseTime = logs.length > 0 ? 
        logs.reduce((sum, log) => sum + (log.responseTime || 0), 0) / logs.length : 0;
    
    // 更新统计显示
    document.getElementById('totalRequests').textContent = totalLogs;
    document.getElementById('successRate').textContent = totalLogs > 0 ? 
        ((successLogs / totalLogs) * 100).toFixed(1) + '%' : '0%';
    document.getElementById('errorCount').textContent = errorLogs;
    document.getElementById('avgResponseTime').textContent = avgResponseTime.toFixed(0) + 'ms';
}

// 绑定事件
function bindEvents() {
    // 创建Webhook按钮
    document.getElementById('createBtn').addEventListener('click', openWebhookModal);
    document.getElementById('createBtn2').addEventListener('click', openWebhookModal);
    
    // 搜索框
    document.getElementById('webhookSearch').addEventListener('input', function(e) {
        webhookSearchFilter = e.target.value;
        updateWebhookList();
    });
    
    // 统计图表按钮
    document.getElementById('showStatsBtn').addEventListener('click', toggleStats);
    
    // 导出Excel按钮
    document.getElementById('exportBtn').addEventListener('click', exportExcel);
    
    // 高级搜索按钮
    document.getElementById('advancedSearchBtn').addEventListener('click', function() {
        document.getElementById('advancedSearchPanel').style.display = 'block';
    });
    
    // 搜索过滤器
    document.getElementById('tenantIdFilter').addEventListener('input', function(e) {
        searchFilters.tenantId = e.target.value;
        loadLogs();
    });
    
    document.getElementById('uniqueIdFilter').addEventListener('input', function(e) {
        searchFilters.uniqueId = e.target.value;
        loadLogs();
    });
    
    document.getElementById('startTimeFilter').addEventListener('change', function(e) {
        searchFilters.startTime = e.target.value;
        loadLogs();
    });
    
    document.getElementById('endTimeFilter').addEventListener('change', function(e) {
        searchFilters.endTime = e.target.value;
        loadLogs();
    });
    
    // 刷新按钮
    document.getElementById('refreshBtn').addEventListener('click', function() {
        loadWebhooks();
        loadLogs();
        showNotification('数据已刷新', 'success');
    });
}

// 打开Webhook模态框
function openWebhookModal(webhook = null) {
    currentEditingWebhook = webhook;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${webhook ? '编辑Webhook' : '创建Webhook'}</h3>
                <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="modal-body">
                <form id="webhookForm">
                    <div class="form-group">
                        <label for="webhookName">名称 *</label>
                        <input type="text" id="webhookName" class="ant-input" required 
                               value="${webhook ? webhook.name : ''}" placeholder="输入Webhook名称">
                    </div>
                    
                    <div class="form-group">
                        <label for="webhookUrl">URL *</label>
                        <input type="url" id="webhookUrl" class="ant-input" required 
                               value="${webhook ? webhook.url : ''}" placeholder="https://example.com/webhook">
                    </div>
                    
                    <div class="form-group">
                        <label for="webhookMethod">请求方法</label>
                        <select id="webhookMethod" class="ant-select">
                            <option value="POST" ${!webhook || webhook.method === 'POST' ? 'selected' : ''}>POST</option>
                            <option value="GET" ${webhook && webhook.method === 'GET' ? 'selected' : ''}>GET</option>
                            <option value="PUT" ${webhook && webhook.method === 'PUT' ? 'selected' : ''}>PUT</option>
                            <option value="DELETE" ${webhook && webhook.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="webhookHeaders">请求头 (JSON格式)</label>
                        <textarea id="webhookHeaders" class="ant-input" rows="4" 
                                  placeholder='{"Content-Type": "application/json"}'>${webhook && webhook.headers ? JSON.stringify(webhook.headers, null, 2) : ''}</textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="webhookActive" ${!webhook || webhook.active ? 'checked' : ''}>
                            启用此Webhook
                        </label>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="ant-btn ant-btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">取消</button>
                <button class="ant-btn ant-btn-primary" onclick="saveWebhook()">${webhook ? '更新' : '创建'}</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// 保存Webhook
async function saveWebhook() {
    const form = document.getElementById('webhookForm');
    const formData = new FormData(form);
    
    const webhookData = {
        name: document.getElementById('webhookName').value,
        url: document.getElementById('webhookUrl').value,
        method: document.getElementById('webhookMethod').value,
        active: document.getElementById('webhookActive').checked
    };
    
    // 解析请求头
    const headersText = document.getElementById('webhookHeaders').value.trim();
    if (headersText) {
        try {
            webhookData.headers = JSON.parse(headersText);
        } catch (error) {
            showNotification('请求头格式错误，请使用有效的JSON格式', 'error');
            return;
        }
    }
    
    try {
        const url = currentEditingWebhook ? 
            `/api/webhooks/${currentEditingWebhook.id}` : 
            '/api/webhooks';
        const method = currentEditingWebhook ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(webhookData)
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(currentEditingWebhook ? 'Webhook已更新' : 'Webhook已创建', 'success');
            
            // 关闭模态框
            document.querySelector('.modal').remove();
            
            // 重新加载列表
            loadWebhooks();
        } else {
            const error = await response.json();
            throw new Error(error.message || '保存失败');
        }
    } catch (error) {
        console.error('保存Webhook错误:', error);
        showNotification('保存失败: ' + error.message, 'error');
    }
}

// 编辑Webhook
function editWebhook(webhookId) {
    const webhook = webhooks.find(w => w.id === webhookId);
    if (webhook) {
        openWebhookModal(webhook);
    }
}

// 删除Webhook
async function deleteWebhook(webhookId) {
    if (!confirm('确定要删除这个Webhook吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/webhooks/${webhookId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Webhook已删除', 'success');
            loadWebhooks();
            
            // 如果删除的是当前选中的webhook，清除选择
            if (selectedWebhookFilter === webhookId) {
                selectedWebhookFilter = '';
                loadLogs();
            }
        } else {
            throw new Error('删除失败');
        }
    } catch (error) {
        console.error('删除Webhook错误:', error);
        showNotification('删除失败', 'error');
    }
}

// 复制Webhook URL
function copyWebhookUrl(url) {
    navigator.clipboard.writeText(url).then(() => {
        showNotification('URL已复制到剪贴板', 'success');
    }).catch(() => {
        showNotification('复制失败', 'error');
    });
}

// 切换统计图表显示
function toggleStats() {
    const statsSection = document.getElementById('statsSection');
    const isVisible = statsSection.style.display !== 'none';
    
    if (isVisible) {
        statsSection.style.display = 'none';
        document.getElementById('showStatsBtn').innerHTML = '<span class="anticon">📊</span> 统计图表';
    } else {
        statsSection.style.display = 'block';
        document.getElementById('showStatsBtn').innerHTML = '<span class="anticon">📈</span> 隐藏图表';
        updateCharts();
    }
}

// 更新图表
function updateCharts() {
    if (!logs.length) return;
    
    // 准备数据
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogs = logs.filter(log => new Date(log.timestamp) > last24Hours);
    
    // 按小时分组
    const hourlyData = {};
    for (let i = 0; i < 24; i++) {
        const hour = new Date(Date.now() - (23 - i) * 60 * 60 * 1000).getHours();
        hourlyData[hour] = {
            total: 0,
            success: 0,
            error: 0,
            responseTime: []
        };
    }
    
    recentLogs.forEach(log => {
        const hour = new Date(log.timestamp).getHours();
        if (hourlyData[hour]) {
            hourlyData[hour].total++;
            if (log.statusCode >= 200 && log.statusCode < 300) {
                hourlyData[hour].success++;
            } else if (log.statusCode >= 400) {
                hourlyData[hour].error++;
            }
            if (log.responseTime) {
                hourlyData[hour].responseTime.push(log.responseTime);
            }
        }
    });
    
    // 准备图表数据
    const labels = Object.keys(hourlyData).map(hour => `${hour}:00`);
    const successRates = Object.values(hourlyData).map(data => 
        data.total > 0 ? (data.success / data.total * 100) : 0
    );
    const avgResponseTimes = Object.values(hourlyData).map(data => 
        data.responseTime.length > 0 ? 
        data.responseTime.reduce((a, b) => a + b, 0) / data.responseTime.length : 0
    );
    const requestCounts = Object.values(hourlyData).map(data => data.total);
    
    // 创建成功率图表
    const successRateCtx = document.getElementById('successRateChart').getContext('2d');
    if (successRateChart) {
        successRateChart.destroy();
    }
    successRateChart = new Chart(successRateCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '成功率 (%)',
                data: successRates,
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                borderColor: 'rgba(76, 175, 80, 1)',
                borderWidth: 2,
                tension: 0.4
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
                    text: '24小时成功率趋势'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `成功率: ${context.parsed.y.toFixed(1)}%`;
                        }
                    }
                }
            }
        }
    });
    
    // 创建响应时间图表
    const responseTimeCtx = document.getElementById('responseTimeChart').getContext('2d');
    if (responseTimeChart) {
        responseTimeChart.destroy();
    }
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
    if (requestTrendChart) {
        requestTrendChart.destroy();
    }
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
}

// 导出Excel
function exportExcel() {
    if (logs.length === 0) {
        showNotification('没有数据可导出', 'warning');
        return;
    }
    
    // 准备导出数据
    const exportData = logs.map(log => ({
        '时间': new Date(log.timestamp).toLocaleString(),
        '状态码': log.statusCode || 'N/A',
        '请求方法': log.method || 'POST',
        'URL': log.url || 'N/A',
        'Tenant ID': log.tenantId || '',
        'Unique ID': log.uniqueId || '',
        '响应时间(ms)': log.responseTime || '',
        'IP地址': log.ip || '',
        'User Agent': (log.headers && log.headers['user-agent']) || ''
    }));
    
    // 创建工作簿
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Webhook日志');
    
    // 导出文件
    const fileName = `webhook-logs-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    showNotification('Excel文件已导出', 'success');
}

// 显示通知
function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // 自动隐藏
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

// 内存监控
function startMemoryMonitoring() {
    setInterval(() => {
        if (performance.memory) {
            const used = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
            const total = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
            console.log(`内存使用: ${used}MB / ${total}MB`);
            
            // 如果内存使用超过100MB，清理旧日志
            if (used > 100) {
                if (logs.length > 500) {
                    logs = logs.slice(0, 500);
                    console.log('清理旧日志以释放内存');
                }
                if (allLogs.length > 500) {
                    allLogs = allLogs.slice(0, 500);
                }
            }
        }
    }, 30000); // 每30秒检查一次
}

// 初始化拖拽排序
function initSortable() {
    const webhookList = document.getElementById('webhookList');
    if (webhookList && typeof Sortable !== 'undefined') {
        new Sortable(webhookList, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function(evt) {
                // 这里可以添加保存排序的逻辑
                console.log('Webhook排序已更改');
            }
        });
    }
}




// 告警检查
function checkAlerts(log) {
    // 检查响应时间告警
    if (log.responseTime && log.responseTime > 5000) {
        addAlert({
            type: 'warning',
            message: `响应时间过长: ${log.responseTime}ms`,
            timestamp: new Date().toISOString(),
            log: log
        });
    }
    
    // 检查错误状态码告警
    if (log.statusCode >= 500) {
        addAlert({
            type: 'error',
            message: `服务器错误: ${log.statusCode}`,
            timestamp: new Date().toISOString(),
            log: log
        });
    }
    
    // 检查频率告警
    const recentLogs = logs.filter(l => 
        new Date(l.timestamp) > new Date(Date.now() - 60000) // 最近1分钟
    );
    
    if (recentLogs.length > 100) {
        addAlert({
            type: 'warning',
            message: `请求频率过高: ${recentLogs.length}/分钟`,
            timestamp: new Date().toISOString()
        });
    }
}

// 添加告警
function addAlert(alert) {
    alerts.unshift(alert);
    
    // 限制告警数量
    if (alerts.length > 50) {
        alerts = alerts.slice(0, 50);
    }
    
    // 显示通知
    showNotification(alert.message, alert.type);
    
    // 更新告警显示
    updateAlertsDisplay();
}

// 更新告警显示
function updateAlertsDisplay() {
    const container = document.getElementById('alertsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    alerts.forEach(alert => {
        const div = document.createElement('div');
        div.className = `alert alert-${alert.type}`;
        div.innerHTML = `
            <div class="alert-content">
                <div class="alert-message">${alert.message}</div>
                <div class="alert-time">${new Date(alert.timestamp).toLocaleString()}</div>
            </div>
            <button class="alert-close" onclick="removeAlert('${alert.timestamp}')">×</button>
        `;
        container.appendChild(div);
    });
}

// 移除告警
function removeAlert(timestamp) {
    alerts = alerts.filter(alert => alert.timestamp !== timestamp);
    updateAlertsDisplay();
}

// 智能过滤功能
function showSmartFilter() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>智能过滤</h3>
                <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="smart-filter-options">
                    <div class="filter-category">
                        <h4>按状态过滤</h4>
                        <div class="filter-buttons">
                            <button class="ant-btn ant-btn-sm" onclick="applySmartFilter('status', 'success')">成功请求</button>
                            <button class="ant-btn ant-btn-sm" onclick="applySmartFilter('status', 'error')">错误请求</button>
                            <button class="ant-btn ant-btn-sm" onclick="applySmartFilter('status', 'pending')">待处理</button>
                        </div>
                    </div>
                    
                    <div class="filter-category">
                        <h4>按时间过滤</h4>
                        <div class="filter-buttons">
                            <button class="ant-btn ant-btn-sm" onclick="applySmartFilter('time', 'today')">今天</button>
                            <button class="ant-btn ant-btn-sm" onclick="applySmartFilter('time', 'week')">本周</button>
                            <button class="ant-btn ant-btn-sm" onclick="applySmartFilter('time', 'month')">本月</button>
                        </div>
                    </div>
                    
                    <div class="filter-category">
                        <h4>按内容过滤</h4>
                        <div class="filter-buttons">
                            <button class="ant-btn ant-btn-sm" onclick="applySmartFilter('content', 'large')">大文件</button>
                            <button class="ant-btn ant-btn-sm" onclick="applySmartFilter('content', 'json')">JSON数据</button>
                            <button class="ant-btn ant-btn-sm" onclick="applySmartFilter('content', 'form')">表单数据</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="ant-btn ant-btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">关闭</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// 应用智能过滤
function applySmartFilter(type, value) {
    let filterFunction;
    
    switch (type) {
        case 'status':
            filterFunction = (log) => {
                if (value === 'success') return log.statusCode >= 200 && log.statusCode < 300;
                if (value === 'error') return log.statusCode >= 400;
                if (value === 'pending') return log.statusCode === 0;
                return true;
            };
            break;
        case 'time':
            filterFunction = (log) => {
                const logTime = new Date(log.timestamp);
                const now = new Date();
                if (value === 'today') {
                    return logTime.toDateString() === now.toDateString();
                } else if (value === 'week') {
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    return logTime >= weekAgo;
                } else if (value === 'month') {
                    return logTime.getMonth() === now.getMonth() && logTime.getFullYear() === now.getFullYear();
                }
                return true;
            };
            break;
        case 'content':
            filterFunction = (log) => {
                if (value === 'large') return log.contentLength > 1024 * 1024; // 1MB
                if (value === 'json') return log.contentType && log.contentType.includes('json');
                if (value === 'form') return log.contentType && log.contentType.includes('form');
                return true;
            };
            break;
    }
    
    if (filterFunction) {
        // 应用过滤
        const filteredLogs = logs.filter(filterFunction);
        displayLogs(filteredLogs);
        
        // 关闭模态框
        document.querySelector('.modal').remove();
        
        showNotification(`智能过滤已应用: ${type} = ${value}`, 'success');
    }
}