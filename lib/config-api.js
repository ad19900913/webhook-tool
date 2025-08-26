const express = require('express');
const configManager = require('./config');
const fs = require('fs');
const path = require('path');

/**
 * 配置管理API路由
 */
const router = express.Router();

/**
 * 获取配置信息
 * GET /api/config
 */
router.get('/', (req, res) => {
    try {
        const config = configManager.getAll();
        const summary = configManager.getSummary();
        const envInfo = configManager.getEnvironmentInfo();
        
        res.json({
            success: true,
            data: {
                config,
                summary,
                environment: envInfo,
                isValid: configManager.isValid()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 获取配置摘要
 * GET /api/config/summary
 */
router.get('/summary', (req, res) => {
    try {
        const summary = configManager.getSummary();
        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 获取环境信息
 * GET /api/config/environment
 */
router.get('/environment', (req, res) => {
    try {
        const envInfo = configManager.getEnvironmentInfo();
        res.json({
            success: true,
            data: envInfo
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 获取特定配置值
 * GET /api/config/:path
 */
router.get('/:path(*)', (req, res) => {
    try {
        const configPath = req.params.path;
        const value = configManager.get(configPath);
        
        if (value === undefined) {
            return res.status(404).json({
                success: false,
                error: `配置路径 ${configPath} 不存在`
            });
        }
        
        res.json({
            success: true,
            data: {
                path: configPath,
                value
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 设置配置值
 * PUT /api/config/:path
 */
router.put('/:path(*)', (req, res) => {
    try {
        const configPath = req.params.path;
        const { value } = req.body;
        
        if (value === undefined) {
            return res.status(400).json({
                success: false,
                error: '缺少配置值'
            });
        }
        
        configManager.setConfigValue(configPath, value);
        
        // 验证配置
        if (!configManager.isValid()) {
            return res.status(400).json({
                success: false,
                error: '配置验证失败'
            });
        }
        
        res.json({
            success: true,
            data: {
                path: configPath,
                value,
                message: '配置更新成功'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 重新加载配置
 * POST /api/config/reload
 */
router.post('/reload', (req, res) => {
    try {
        configManager.reload();
        res.json({
            success: true,
            data: {
                message: '配置重新加载成功',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 获取配置文件列表
 * GET /api/config/files
 */
router.get('/files/list', (req, res) => {
    try {
        const configPath = configManager.configPath;
        const files = fs.readdirSync(configPath)
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const filePath = path.join(configPath, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    path: filePath,
                    size: stats.size,
                    modified: stats.mtime,
                    isReadable: fs.accessSync(filePath, fs.constants.R_OK) === undefined
                };
            });
        
        res.json({
            success: true,
            data: files
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 获取配置文件内容
 * GET /api/config/files/:filename
 */
router.get('/files/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(configManager.configPath, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: `配置文件 ${filename} 不存在`
            });
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        const config = JSON.parse(content);
        
        res.json({
            success: true,
            data: {
                filename,
                content,
                config,
                size: content.length,
                modified: fs.statSync(filePath).mtime
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 保存配置文件
 * POST /api/config/files/:filename
 */
router.post('/files/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const { config } = req.body;
        
        if (!config) {
            return res.status(400).json({
                success: false,
                error: '缺少配置数据'
            });
        }
        
        // 验证配置
        const tempConfig = { ...configManager.config, ...config };
        const originalConfig = configManager.config;
        configManager.config = tempConfig;
        
        if (!configManager.isValid()) {
            configManager.config = originalConfig;
            return res.status(400).json({
                success: false,
                error: '配置验证失败'
            });
        }
        
        // 保存配置
        configManager.saveConfig(filename, config);
        
        res.json({
            success: true,
            data: {
                filename,
                message: '配置文件保存成功'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 删除配置文件
 * DELETE /api/config/files/:filename
 */
router.delete('/files/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        
        // 不允许删除默认配置文件
        if (['default.json', 'schema.json'].includes(filename)) {
            return res.status(403).json({
                success: false,
                error: '不能删除默认配置文件'
            });
        }
        
        const filePath = path.join(configManager.configPath, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: `配置文件 ${filename} 不存在`
            });
        }
        
        fs.unlinkSync(filePath);
        
        res.json({
            success: true,
            data: {
                filename,
                message: '配置文件删除成功'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 验证配置
 * POST /api/config/validate
 */
router.post('/validate', (req, res) => {
    try {
        const { config } = req.body;
        
        if (!config) {
            return res.status(400).json({
                success: false,
                error: '缺少配置数据'
            });
        }
        
        // 临时设置配置进行验证
        const originalConfig = configManager.config;
        configManager.config = config;
        
        const isValid = configManager.isValid();
        const errors = [];
        
        if (!isValid) {
            try {
                configManager.validateConfiguration();
            } catch (error) {
                errors.push(error.message);
            }
        }
        
        // 恢复原始配置
        configManager.config = originalConfig;
        
        res.json({
            success: true,
            data: {
                isValid,
                errors
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 导出配置
 * GET /api/config/export
 */
router.get('/export/:format', (req, res) => {
    try {
        const format = req.params.format;
        const config = configManager.getAll();
        
        switch (format) {
            case 'json':
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', 'attachment; filename="config.json"');
                res.json(config);
                break;
                
            case 'env':
                const envContent = Object.entries(config)
                    .map(([key, value]) => {
                        if (typeof value === 'object') {
                            return Object.entries(value)
                                .map(([subKey, subValue]) => {
                                    const envKey = `${key.toUpperCase()}_${subKey.toUpperCase()}`;
                                    return `${envKey}=${JSON.stringify(subValue)}`;
                                })
                                .join('\n');
                        }
                        return `${key.toUpperCase()}=${JSON.stringify(value)}`;
                    })
                    .join('\n');
                
                res.setHeader('Content-Type', 'text/plain');
                res.setHeader('Content-Disposition', 'attachment; filename="config.env"');
                res.send(envContent);
                break;
                
            default:
                res.status(400).json({
                    success: false,
                    error: `不支持的导出格式: ${format}`
                });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
