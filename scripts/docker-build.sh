#!/bin/bash

# Docker构建脚本
# 用于构建和部署Webhook工具的Docker镜像

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
IMAGE_NAME="webhook-tool"
IMAGE_TAG="latest"
REGISTRY=""
FULL_IMAGE_NAME=""

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# 显示帮助信息
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help              显示此帮助信息"
    echo "  -t, --tag TAG           指定镜像标签 (默认: latest)"
    echo "  -r, --registry REGISTRY 指定镜像仓库地址"
    echo "  -p, --push              构建完成后推送到仓库"
    echo "  -c, --clean             清理本地镜像和容器"
    echo "  -d, --dev               构建开发环境镜像"
    echo "  -s, --start             构建完成后启动服务"
    echo ""
    echo "示例:"
    echo "  $0                      # 构建最新版本镜像"
    echo "  $0 -t v1.0.0           # 构建指定标签的镜像"
    echo "  $0 -r myregistry.com   # 推送到指定仓库"
    echo "  $0 -p -s               # 构建、推送并启动服务"
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -t|--tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            -r|--registry)
                REGISTRY="$2"
                shift 2
                ;;
            -p|--push)
                PUSH_IMAGE=true
                shift
                ;;
            -c|--clean)
                CLEAN_IMAGES=true
                shift
                ;;
            -d|--dev)
                BUILD_DEV=true
                shift
                ;;
            -s|--start)
                START_SERVICE=true
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

# 清理本地镜像和容器
clean_local() {
    print_message $YELLOW "清理本地Docker资源..."
    
    # 停止并删除容器
    docker-compose down --remove-orphans 2>/dev/null || true
    
    # 删除镜像
    docker rmi ${IMAGE_NAME}:${IMAGE_TAG} 2>/dev/null || true
    docker rmi ${IMAGE_NAME}:dev 2>/dev/null || true
    
    # 清理未使用的镜像
    docker image prune -f
    
    print_message $GREEN "清理完成"
}

# 构建镜像
build_image() {
    local dockerfile="Dockerfile"
    local context="."
    
    if [[ "$BUILD_DEV" == "true" ]]; then
        dockerfile="Dockerfile.dev"
        IMAGE_TAG="dev"
        print_message $BLUE "构建开发环境镜像..."
    else
        print_message $BLUE "构建生产环境镜像..."
    fi
    
    # 设置完整镜像名称
    if [[ -n "$REGISTRY" ]]; then
        FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    else
        FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
    fi
    
    print_message $BLUE "构建镜像: $FULL_IMAGE_NAME"
    
    # 构建镜像
    docker build -f "$dockerfile" -t "$FULL_IMAGE_NAME" "$context"
    
    if [[ $? -eq 0 ]]; then
        print_message $GREEN "镜像构建成功: $FULL_IMAGE_NAME"
    else
        print_message $RED "镜像构建失败"
        exit 1
    fi
}

# 推送镜像
push_image() {
    if [[ "$PUSH_IMAGE" != "true" ]]; then
        return
    fi
    
    if [[ -z "$REGISTRY" ]]; then
        print_message $YELLOW "未指定镜像仓库，跳过推送"
        return
    fi
    
    print_message $BLUE "推送镜像到仓库: $FULL_IMAGE_NAME"
    
    docker push "$FULL_IMAGE_NAME"
    
    if [[ $? -eq 0 ]]; then
        print_message $GREEN "镜像推送成功"
    else
        print_message $RED "镜像推送失败"
        exit 1
    fi
}

# 启动服务
start_service() {
    if [[ "$START_SERVICE" != "true" ]]; then
        return
    fi
    
    local compose_file="docker-compose.yml"
    
    if [[ "$BUILD_DEV" == "true" ]]; then
        compose_file="docker-compose.dev.yml"
        print_message $BLUE "启动开发环境服务..."
    else
        print_message $BLUE "启动生产环境服务..."
    fi
    
    # 启动服务
    docker-compose -f "$compose_file" up -d
    
    if [[ $? -eq 0 ]]; then
        print_message $GREEN "服务启动成功"
        print_message $BLUE "服务地址: http://localhost:3000"
        
        if [[ "$BUILD_DEV" == "true" ]]; then
            print_message $BLUE "Redis管理界面: http://localhost:8081"
        fi
    else
        print_message $RED "服务启动失败"
        exit 1
    fi
}

# 显示构建信息
show_build_info() {
    print_message $GREEN "=== 构建信息 ==="
    print_message $BLUE "镜像名称: $FULL_IMAGE_NAME"
    print_message $BLUE "构建时间: $(date)"
    print_message $BLUE "Docker版本: $(docker --version)"
    print_message $BLUE "Docker Compose版本: $(docker-compose --version)"
    
    if [[ "$BUILD_DEV" == "true" ]]; then
        print_message $YELLOW "环境: 开发环境"
    else
        print_message $YELLOW "环境: 生产环境"
    fi
    
    print_message $GREEN "================"
}

# 主函数
main() {
    print_message $GREEN "开始构建Webhook工具Docker镜像..."
    
    # 检查Docker是否运行
    if ! docker info >/dev/null 2>&1; then
        print_message $RED "Docker未运行，请先启动Docker服务"
        exit 1
    fi
    
    # 显示构建信息
    show_build_info
    
    # 清理本地资源（如果需要）
    if [[ "$CLEAN_IMAGES" == "true" ]]; then
        clean_local
    fi
    
    # 构建镜像
    build_image
    
    # 推送镜像（如果需要）
    push_image
    
    # 启动服务（如果需要）
    start_service
    
    print_message $GREEN "Docker构建和部署完成！"
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    parse_args "$@"
    main
fi
