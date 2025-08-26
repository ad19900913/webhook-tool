const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

/**
 * 配置管理类
 * 支持多环境配置、环境变量覆盖、配置验证等功能
 */
class ConfigManager {
    constructor() {
        this.config = {};
        this.env = process.env.NODE_ENV || 'development';
        this.configPath = path.join(__dirname, '..', 'config');
        this.schemaPath = path.join(this.configPath, 'schema.json');
        
        // 初始化JSON Schema验证器
        this.ajv = new Ajv({
            allErrors: true,
            verbose: true,
            coerceTypes: true
        });
        addFormats(this.ajv);
        
        this.loadConfiguration();
    }

    /**
     * 加载配置文件
     */
    loadConfiguration() {
        try {
            // 加载默认配置
            const defaultConfig = this.loadConfigFile('default.json');
            
            // 加载环境特定配置
            const envConfig = this.loadConfigFile(`${this.env}.json`);
            
            // 加载本地配置（如果存在）
            const localConfig = this.loadConfigFile('local.json');
            
            // 合并配置
            this.config = this.mergeConfigs(defaultConfig, envConfig, localConfig);
            
            // 应用环境变量覆盖
            this.applyEnvironmentOverrides();
            
            // 验证配置
            this.validateConfiguration();
            
            console.log(`配置加载完成，环境: ${this.env}`);
        } catch (error) {
            console.error('配置加载失败:', error.message);
            process.exit(1);
        }
    }

    /**
     * 加载配置文件
     * @param {string} filename 文件名
     * @returns {object} 配置对象
     */
    loadConfigFile(filename) {
        const filePath = path.join(this.configPath, filename);
        
        if (!fs.existsSync(filePath)) {
            return {};
        }
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.warn(`配置文件 ${filename} 解析失败:`, error.message);
            return {};
        }
    }

    /**
     * 合并多个配置对象
     * @param {...object} configs 配置对象列表
     * @returns {object} 合并后的配置
     */
    mergeConfigs(...configs) {
        return configs.reduce((result, config) => {
            return this.deepMerge(result, config);
        }, {});
    }

    /**
     * 深度合并对象
     * @param {object} target 目标对象
     * @param {object} source 源对象
     * @returns {object} 合并后的对象
     */
    deepMerge(target, source) {
        if (!source || typeof source !== 'object') {
            return target;
        }
        
        if (Array.isArray(source)) {
            return [...source];
        }
        
        const result = { ...target };
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = this.deepMerge(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        
        return result;
    }

    /**
     * 应用环境变量覆盖
     */
    applyEnvironmentOverrides() {
        const envMappings = {
            'SERVER_PORT': 'server.port',
            'SERVER_HOST': 'server.host',
            'SERVER_TIMEOUT': 'server.timeout',
            'SERVER_MAX_BODY_SIZE': 'server.maxBodySize',
            'WEBHOOK_MAX_PAYLOAD_SIZE': 'webhook.maxPayloadSize',
            'WEBHOOK_RATE_LIMIT_WINDOW_MS': 'webhook.rateLimit.windowMs',
            'WEBHOOK_RATE_LIMIT_MAX': 'webhook.rateLimit.max',
            'WEBHOOK_SECURITY_ENABLE_IP_WHITELIST': 'webhook.security.enableIpWhitelist',
            'WEBHOOK_SECURITY_ENABLE_SIGNATURE': 'webhook.security.enableSignature',
            'WEBHOOK_SECURITY_SIGNATURE_SECRET': 'webhook.security.signatureSecret',
            'WEBHOOK_SECURITY_ENABLE_RATE_LIMIT': 'webhook.security.enableRateLimit',
            'LOGGING_LEVEL': 'logging.level',
            'LOGGING_MAX_SIZE': 'logging.maxSize',
            'LOGGING_MAX_FILES': 'logging.maxFiles',
            'LOGGING_RETENTION_DAYS': 'logging.retentionDays',
            'STORAGE_TYPE': 'storage.type',
            'STORAGE_MAX_LOGS': 'storage.maxLogs',
            'STORAGE_CLEANUP_INTERVAL': 'storage.cleanupInterval',
            'MONITORING_ENABLE_METRICS': 'monitoring.enableMetrics',
            'MONITORING_METRICS_PATH': 'monitoring.metricsPath',
            'MONITORING_HEALTH_CHECK_PATH': 'monitoring.healthCheckPath',
            'MONITORING_ENABLE_HEALTH_CHECK': 'monitoring.enableHealthCheck',
            'UI_THEME': 'ui.theme',
            'UI_LANGUAGE': 'ui.language',
            'UI_PAGE_SIZE': 'ui.pageSize',
            'UI_AUTO_REFRESH': 'ui.autoRefresh',
            'UI_REFRESH_INTERVAL': 'ui.refreshInterval',
            'EXPORT_MAX_RECORDS': 'export.maxRecords',
            'EXPORT_DEFAULT_FORMAT': 'export.defaultFormat'
        };

        for (const [envKey, configPath] of Object.entries(envMappings)) {
            const envValue = process.env[envKey];
            if (envValue !== undefined) {
                this.setConfigValue(configPath, this.parseEnvironmentValue(envValue));
            }
        }
    }

    /**
     * 解析环境变量值
     * @param {string} value 环境变量值
     * @returns {any} 解析后的值
     */
    parseEnvironmentValue(value) {
        // 布尔值
        if (value === 'true') return true;
        if (value === 'false') return false;
        
        // 数字
        if (!isNaN(value) && value !== '') {
            return Number(value);
        }
        
        // 数组（逗号分隔）
        if (value.includes(',')) {
            return value.split(',').map(item => item.trim());
        }
        
        // 字符串
        return value;
    }

    /**
     * 设置配置值
     * @param {string} path 配置路径（点分隔）
     * @param {any} value 配置值
     */
    setConfigValue(path, value) {
        const keys = path.split('.');
        let current = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    }

    /**
     * 获取配置值
     * @param {string} path 配置路径（点分隔）
     * @param {any} defaultValue 默认值
     * @returns {any} 配置值
     */
    get(path, defaultValue = undefined) {
        const keys = path.split('.');
        let current = this.config;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }
        
        return current;
    }

    /**
     * 获取整个配置对象
     * @returns {object} 配置对象
     */
    getAll() {
        return { ...this.config };
    }

    /**
     * 验证配置
     */
    validateConfiguration() {
        try {
            const schema = JSON.parse(fs.readFileSync(this.schemaPath, 'utf8'));
            const validate = this.ajv.compile(schema);
            
            if (!validate(this.config)) {
                const errors = validate.errors.map(error => 
                    `${error.instancePath} ${error.message}`
                ).join(', ');
                
                throw new Error(`配置验证失败: ${errors}`);
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.warn('配置模式文件不存在，跳过验证');
            } else {
                throw error;
            }
        }
    }

    /**
     * 重新加载配置
     */
    reload() {
        console.log('重新加载配置...');
        this.loadConfiguration();
    }

    /**
     * 保存配置到文件
     * @param {string} filename 文件名
     * @param {object} config 配置对象
     */
    saveConfig(filename, config) {
        try {
            const filePath = path.join(this.configPath, filename);
            const content = JSON.stringify(config, null, 2);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`配置已保存到: ${filePath}`);
        } catch (error) {
            console.error('保存配置失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取环境信息
     * @returns {object} 环境信息
     */
    getEnvironmentInfo() {
        return {
            environment: this.env,
            configPath: this.configPath,
            nodeEnv: process.env.NODE_ENV,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 检查配置是否有效
     * @returns {boolean} 配置是否有效
     */
    isValid() {
        try {
            this.validateConfiguration();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取配置摘要
     * @returns {object} 配置摘要
     */
    getSummary() {
        return {
            server: {
                port: this.get('server.port'),
                host: this.get('server.host')
            },
            webhook: {
                maxPayloadSize: this.get('webhook.maxPayloadSize'),
                rateLimitEnabled: this.get('webhook.security.enableRateLimit'),
                ipWhitelistEnabled: this.get('webhook.security.enableIpWhitelist')
            },
            logging: {
                level: this.get('logging.level'),
                maxSize: this.get('logging.maxSize')
            },
            storage: {
                type: this.get('storage.type'),
                maxLogs: this.get('storage.maxLogs')
            },
            monitoring: {
                metricsEnabled: this.get('monitoring.enableMetrics'),
                healthCheckEnabled: this.get('monitoring.enableHealthCheck')
            }
        };
    }
}

// 创建单例实例
const configManager = new ConfigManager();

module.exports = configManager;
