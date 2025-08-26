# Webhook工具 Docker 部署指南

本文档介绍如何使用Docker部署和运行Webhook工具。

## 目录

- [快速开始](#快速开始)
- [环境要求](#环境要求)
- [部署方式](#部署方式)
- [配置说明](#配置说明)
- [监控和日志](#监控和日志)
- [备份和恢复](#备份和恢复)
- [故障排除](#故障排除)
- [常见问题](#常见问题)

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd webhook-tool
```

### 2. 构建并启动服务

```bash
# 使用构建脚本
./scripts/docker-build.sh -s

# 或手动构建
docker-compose up -d --build
```

### 3. 访问服务

- Webhook工具: http://localhost:3000
- 开发环境Redis管理: http://localhost:8081
- 生产环境Grafana: http://localhost:3001
- 生产环境Prometheus: http://localhost:9090

## 环境要求

- Docker 20.10+
- Docker Compose 2.0+
- 至少 2GB 可用内存
- 至少 10GB 可用磁盘空间

## 部署方式

### 开发环境

```bash
# 启动开发环境
./scripts/docker-deploy.sh start -e dev

# 查看状态
./scripts/docker-deploy.sh status -e dev

# 查看日志
./scripts/docker-deploy.sh logs -e dev
```

**特点：**
- 代码热重载
- 开发依赖完整
- Redis管理界面
- 可选PostgreSQL数据库

### 生产环境

```bash
# 启动生产环境
./scripts/docker-deploy.sh start -e prod

# 查看状态
./scripts/docker-deploy.sh status -e prod

# 备份数据
./scripts/docker-deploy.sh backup -e prod
```

**特点：**
- 性能优化
- 监控告警
- 负载均衡
- 数据持久化
- 安全加固

### 自定义配置

```bash
# 使用自定义compose文件
./scripts/docker-deploy.sh start -f custom-compose.yml

# 指定服务名称
./scripts/docker-deploy.sh start -s webhook-service
```

## 配置说明

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| NODE_ENV | production | 运行环境 |
| PORT | 3000 | 服务端口 |
| HOST | 0.0.0.0 | 绑定地址 |
| LOG_LEVEL | info | 日志级别 |
| MAX_LOG_SIZE | 100MB | 最大日志大小 |
| LOG_RETENTION_DAYS | 30 | 日志保留天数 |

### 端口映射

| 服务 | 容器端口 | 主机端口 | 说明 |
|------|----------|----------|------|
| Webhook工具 | 3000 | 3000 | 主服务 |
| Redis | 6379 | 6379 | 缓存服务 |
| Nginx | 80,443 | 80,443 | 反向代理 |
| Grafana | 3000 | 3001 | 监控界面 |
| Prometheus | 9090 | 9090 | 监控数据 |

### 数据卷

| 卷名 | 说明 | 持久化 |
|------|------|--------|
| webhook-logs | 日志数据 | ✅ |
| webhook-config | 配置文件 | ✅ |
| redis-data | Redis数据 | ✅ |
| nginx-logs | Nginx日志 | ✅ |
| prometheus-data | 监控数据 | ✅ |
| grafana-data | 仪表板配置 | ✅ |

## 监控和日志

### 健康检查

```bash
# 检查服务健康状态
curl http://localhost:3000/health

# 查看容器健康状态
docker ps --filter "health=healthy"
```

### 日志管理

```bash
# 查看实时日志
./scripts/docker-deploy.sh logs

# 查看特定服务日志
docker-compose logs -f webhook-tool

# 查看Nginx访问日志
docker exec webhook-nginx tail -f /var/log/nginx/access.log
```

### 监控指标

- **应用指标**: 请求量、响应时间、错误率
- **系统指标**: CPU、内存、磁盘、网络
- **业务指标**: Webhook接收量、处理成功率
- **告警规则**: 服务不可用、性能异常、资源不足

## 备份和恢复

### 数据备份

```bash
# 备份所有数据
./scripts/docker-deploy.sh backup

# 备份特定环境
./scripts/docker-deploy.sh backup -e prod
```

**备份内容：**
- 日志数据
- 配置文件
- Redis数据（生产环境）
- 监控数据

### 数据恢复

```bash
# 恢复数据
./scripts/docker-deploy.sh restore

# 恢复特定环境
./scripts/docker-deploy.sh restore -e prod
```

**注意事项：**
- 恢复会覆盖现有数据
- 建议先备份当前数据
- 恢复后需要重启服务

## 故障排除

### 常见问题

#### 1. 服务无法启动

```bash
# 检查Docker状态
docker info

# 查看详细错误信息
docker-compose logs

# 检查端口占用
netstat -tulpn | grep :3000
```

#### 2. 内存不足

```bash
# 查看容器资源使用
docker stats

# 调整内存限制
docker-compose -f docker-compose.prod.yml up -d --scale webhook-tool=2
```

#### 3. 磁盘空间不足

```bash
# 清理未使用的镜像和容器
docker system prune -a

# 清理日志文件
docker-compose logs --tail=1000 > recent-logs.txt
```

### 调试模式

```bash
# 进入容器调试
docker exec -it webhook-tool sh

# 查看进程
ps aux

# 检查网络
netstat -tulpn
```

## 常见问题

### Q: 如何修改Nginx配置？

A: 修改 `nginx/nginx.conf` 文件后，重启Nginx容器：

```bash
docker-compose restart nginx
```

### Q: 如何添加新的监控指标？

A: 修改 `monitoring/prometheus.yml` 和 `monitoring/grafana/dashboards/` 下的配置文件，然后重启监控服务。

### Q: 如何升级Webhook工具？

A: 使用更新命令：

```bash
./scripts/docker-deploy.sh update
```

### Q: 如何扩展服务实例？

A: 使用扩展命令：

```bash
./scripts/docker-deploy.sh scale -n 3
```

### Q: 如何配置SSL证书？

A: 将SSL证书文件放在 `nginx/ssl/` 目录下，然后重启Nginx服务。

## 性能优化

### 资源限制

```yaml
# docker-compose.prod.yml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
    reservations:
      memory: 256M
      cpus: '0.25'
```

### 缓存策略

- Redis缓存热点数据
- Nginx静态文件缓存
- 浏览器缓存优化

### 负载均衡

- 多实例部署
- 健康检查
- 故障转移

## 安全配置

### 网络安全

- 容器网络隔离
- 端口限制
- 防火墙规则

### 访问控制

- IP白名单
- 认证授权
- 日志审计

### 数据安全

- 数据加密
- 备份加密
- 访问日志

## 联系支持

如果在使用过程中遇到问题，请：

1. 查看本文档的故障排除部分
2. 检查服务日志
3. 提交Issue到项目仓库
4. 联系技术支持团队

---

**注意**: 生产环境部署前，请仔细阅读安全配置部分，并根据实际需求调整配置参数。
