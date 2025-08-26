#!/bin/bash

# Docker部署脚本
# 用于部署和管理Webhook工具的Docker服务

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
COMPOSE_FILE="docker-compose.yml"
ENVIRONMENT="production"
SERVICE_NAME="webhook-tool"

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# 显示帮助信息
show_help() {
    echo "用法: $0 [命令] [选项]"
    echo ""
    echo "命令:"
    echo "  start                   启动服务"
    echo "  stop                    停止服务"
    echo "  restart                 重启服务"
    echo "  status                  查看服务状态"
    echo "  logs                    查看服务日志"
    echo "  update                  更新服务"
    echo "  backup                  备份数据"
    echo "  restore                 恢复数据"
    echo "  scale                   扩展服务实例"
    echo ""
    echo "选项:"
    echo "  -e, --env ENV          指定环境 (dev|prod, 默认: prod)"
    echo "  -f, --file FILE        指定compose文件"
    echo "  -s, --service SERVICE  指定服务名称"
    echo "  -n, --instances NUM    指定实例数量 (用于scale命令)"
    echo "  -h, --help             显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 start                # 启动生产环境服务"
    echo "  $0 start -e dev         # 启动开发环境服务"
    echo "  $0 status               # 查看服务状态"
    echo "  $0 scale -n 3          # 扩展到3个实例"
    echo "  $0 backup               # 备份数据"
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -e|--env)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -f|--file)
                COMPOSE_FILE="$2"
                shift 2
                ;;
            -s|--service)
                SERVICE_NAME="$2"
                shift 2
                ;;
            -n|--instances)
                INSTANCES="$2"
                shift 2
                ;;
            start|stop|restart|status|logs|update|backup|restore|scale)
                COMMAND="$1"
                shift
                ;;
            *)
                print_message $RED "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 检查Docker环境
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_message $RED "Docker未运行，请先启动Docker服务"
        exit 1
    fi
    
    if ! docker-compose --version >/dev/null 2>&1; then
        print_message $RED "Docker Compose未安装或不可用"
        exit 1
    fi
}

# 设置环境配置
setup_environment() {
    case "$ENVIRONMENT" in
        dev|development)
            COMPOSE_FILE="docker-compose.dev.yml"
            print_message $BLUE "使用开发环境配置: $COMPOSE_FILE"
            ;;
        prod|production)
            COMPOSE_FILE="docker-compose.prod.yml"
            print_message $BLUE "使用生产环境配置: $COMPOSE_FILE"
            ;;
        *)
            print_message $YELLOW "使用默认配置: $COMPOSE_FILE"
            ;;
    esac
    
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        print_message $RED "Compose文件不存在: $COMPOSE_FILE"
        exit 1
    fi
}

# 启动服务
start_service() {
    print_message $BLUE "启动Webhook工具服务..."
    
    docker-compose -f "$COMPOSE_FILE" up -d
    
    if [[ $? -eq 0 ]]; then
        print_message $GREEN "服务启动成功"
        show_service_info
    else
        print_message $RED "服务启动失败"
        exit 1
    fi
}

# 停止服务
stop_service() {
    print_message $YELLOW "停止Webhook工具服务..."
    
    docker-compose -f "$COMPOSE_FILE" down
    
    if [[ $? -eq 0 ]]; then
        print_message $GREEN "服务已停止"
    else
        print_message $RED "服务停止失败"
        exit 1
    fi
}

# 重启服务
restart_service() {
    print_message $BLUE "重启Webhook工具服务..."
    
    docker-compose -f "$COMPOSE_FILE" restart
    
    if [[ $? -eq 0 ]]; then
        print_message $GREEN "服务重启成功"
        show_service_info
    else
        print_message $RED "服务重启失败"
        exit 1
    fi
}

# 查看服务状态
show_status() {
    print_message $BLUE "Webhook工具服务状态:"
    echo ""
    
    docker-compose -f "$COMPOSE_FILE" ps
    
    echo ""
    print_message $BLUE "容器资源使用情况:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
}

# 查看服务日志
show_logs() {
    print_message $BLUE "显示Webhook工具服务日志 (按Ctrl+C退出):"
    echo ""
    
    docker-compose -f "$COMPOSE_FILE" logs -f --tail=100
}

# 更新服务
update_service() {
    print_message $BLUE "更新Webhook工具服务..."
    
    # 拉取最新镜像
    docker-compose -f "$COMPOSE_FILE" pull
    
    # 重新构建并启动服务
    docker-compose -f "$COMPOSE_FILE" up -d --build
    
    if [[ $? -eq 0 ]]; then
        print_message $GREEN "服务更新成功"
        show_service_info
    else
        print_message $RED "服务更新失败"
        exit 1
    fi
}

# 备份数据
backup_data() {
    local backup_dir="./backups"
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="webhook_backup_${timestamp}.tar.gz"
    
    print_message $BLUE "开始备份数据..."
    
    # 创建备份目录
    mkdir -p "$backup_dir"
    
    # 备份卷数据
    docker run --rm -v webhook-logs:/data -v "$(pwd)/$backup_dir:/backup" \
        alpine tar czf "/backup/logs_${backup_file}" -C /data .
    
    docker run --rm -v webhook-config:/data -v "$(pwd)/$backup_dir:/backup" \
        alpine tar czf "/backup/config_${backup_file}" -C /data .
    
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        docker run --rm -v redis-master-data:/data -v "$(pwd)/$backup_dir:/backup" \
            alpine tar czf "/backup/redis_${backup_file}" -C /data .
    fi
    
    print_message $GREEN "数据备份完成: $backup_dir"
    ls -la "$backup_dir"
}

# 恢复数据
restore_data() {
    local backup_dir="./backups"
    
    if [[ ! -d "$backup_dir" ]]; then
        print_message $RED "备份目录不存在: $backup_dir"
        exit 1
    fi
    
    print_message $YELLOW "警告: 恢复数据将覆盖现有数据！"
    read -p "确认继续? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_message $YELLOW "取消恢复操作"
        return
    fi
    
    print_message $BLUE "开始恢复数据..."
    
    # 停止服务
    docker-compose -f "$COMPOSE_FILE" down
    
    # 恢复卷数据
    local latest_backup=$(ls -t "$backup_dir"/*.tar.gz | head -1)
    
    if [[ -n "$latest_backup" ]]; then
        print_message $BLUE "使用最新备份: $latest_backup"
        
        # 恢复日志数据
        docker run --rm -v webhook-logs:/data -v "$(pwd)/$backup_dir:/backup" \
            alpine tar xzf "/backup/logs_$(basename $latest_backup)" -C /data
        
        # 恢复配置数据
        docker run --rm -v webhook-config:/data -v "$(pwd)/$backup_dir:/backup" \
            alpine tar xzf "/backup/config_$(basename $latest_backup)" -C /data
        
        print_message $GREEN "数据恢复完成"
        
        # 重新启动服务
        start_service
    else
        print_message $RED "未找到备份文件"
        exit 1
    fi
}

# 扩展服务实例
scale_service() {
    if [[ -z "$INSTANCES" ]]; then
        print_message $RED "请指定实例数量 (-n 参数)"
        exit 1
    fi
    
    print_message $BLUE "扩展Webhook工具服务到 $INSTANCES 个实例..."
    
    docker-compose -f "$COMPOSE_FILE" up -d --scale "$SERVICE_NAME=$INSTANCES"
    
    if [[ $? -eq 0 ]]; then
        print_message $GREEN "服务扩展成功"
        show_service_info
    else
        print_message $RED "服务扩展失败"
        exit 1
    fi
}

# 显示服务信息
show_service_info() {
    echo ""
    print_message $GREEN "=== 服务信息 ==="
    print_message $BLUE "环境: $ENVIRONMENT"
    print_message $BLUE "配置文件: $COMPOSE_FILE"
    print_message $BLUE "服务名称: $SERVICE_NAME"
    
    case "$ENVIRONMENT" in
        dev|development)
            print_message $BLUE "Webhook工具: http://localhost:3000"
            print_message $BLUE "Redis管理: http://localhost:8081"
            ;;
        prod|production)
            print_message $BLUE "Webhook工具: http://localhost:3000"
            print_message $BLUE "Grafana监控: http://localhost:3001"
            print_message $BLUE "Prometheus: http://localhost:9090"
            ;;
    esac
    
    print_message $GREEN "================"
}

# 主函数
main() {
    # 检查Docker环境
    check_docker
    
    # 设置环境配置
    setup_environment
    
    # 执行命令
    case "$COMMAND" in
        start)
            start_service
            ;;
        stop)
            stop_service
            ;;
        restart)
            restart_service
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        update)
            update_service
            ;;
        backup)
            backup_data
            ;;
        restore)
            restore_data
            ;;
        scale)
            scale_service
            ;;
        *)
            print_message $RED "请指定要执行的命令"
            show_help
            exit 1
            ;;
    esac
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -eq 0 ]]; then
        show_help
        exit 1
    fi
    
    parse_args "$@"
    main
fi
