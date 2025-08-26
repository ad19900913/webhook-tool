#!/bin/bash

# Docker测试脚本
# 用于测试Docker配置是否正确

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# 测试Docker环境
test_docker_environment() {
    print_message $BLUE "测试Docker环境..."
    
    # 检查Docker是否运行
    if ! docker info >/dev/null 2>&1; then
        print_message $RED "❌ Docker未运行"
        return 1
    else
        print_message $GREEN "✅ Docker运行正常"
    fi
    
    # 检查Docker Compose
    if ! docker-compose --version >/dev/null 2>&1; then
        print_message $RED "❌ Docker Compose未安装"
        return 1
    else
        print_message $GREEN "✅ Docker Compose可用"
        docker-compose --version
    fi
    
    return 0
}

# 测试Dockerfile
test_dockerfile() {
    print_message $BLUE "测试Dockerfile..."
    
    if [[ ! -f "Dockerfile" ]]; then
        print_message $RED "❌ Dockerfile不存在"
        return 1
    fi
    
    if [[ ! -f "Dockerfile.dev" ]]; then
        print_message $RED "❌ Dockerfile.dev不存在"
        return 1
    fi
    
    print_message $GREEN "✅ Dockerfile文件存在"
    return 0
}

# 测试Docker Compose文件
test_compose_files() {
    print_message $BLUE "测试Docker Compose文件..."
    
    local files=("docker-compose.yml" "docker-compose.prod.yml" "docker-compose.dev.yml")
    local all_exist=true
    
    for file in "${files[@]}"; do
        if [[ ! -f "$file" ]]; then
            print_message $RED "❌ $file 不存在"
            all_exist=false
        else
            print_message $GREEN "✅ $file 存在"
        fi
    done
    
    if [[ "$all_exist" == "false" ]]; then
        return 1
    fi
    
    # 验证compose文件语法
    for file in "${files[@]}"; do
        print_message $BLUE "验证 $file 语法..."
        if docker-compose -f "$file" config >/dev/null 2>&1; then
            print_message $GREEN "✅ $file 语法正确"
        else
            print_message $RED "❌ $file 语法错误"
            return 1
        fi
    done
    
    return 0
}

# 测试配置文件
test_config_files() {
    print_message $BLUE "测试配置文件..."
    
    local dirs=("nginx" "monitoring" "monitoring/grafana" "monitoring/grafana/dashboards" "monitoring/grafana/datasources")
    local all_exist=true
    
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            print_message $RED "❌ 目录不存在: $dir"
            all_exist=false
        else
            print_message $GREEN "✅ 目录存在: $dir"
        fi
    done
    
    # 检查关键配置文件
    local config_files=(
        "nginx/nginx.conf"
        "nginx/nginx.prod.conf"
        "monitoring/prometheus.yml"
        "monitoring/grafana/dashboards/webhook-dashboard.json"
        "monitoring/grafana/datasources/prometheus.yml"
    )
    
    for file in "${config_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            print_message $RED "❌ 配置文件不存在: $file"
            all_exist=false
        else
            print_message $GREEN "✅ 配置文件存在: $file"
        fi
    done
    
    if [[ "$all_exist" == "false" ]]; then
        return 1
    fi
    
    return 0
}

# 测试脚本文件
test_scripts() {
    print_message $BLUE "测试脚本文件..."
    
    local scripts=("scripts/docker-build.sh" "scripts/docker-deploy.sh" "scripts/test-docker.sh")
    local all_exist=true
    
    for script in "${scripts[@]}"; do
        if [[ ! -f "$script" ]]; then
            print_message $RED "❌ 脚本不存在: $script"
            all_exist=false
        else
            print_message $GREEN "✅ 脚本存在: $script"
            
            # 检查脚本权限
            if [[ -x "$script" ]]; then
                print_message $GREEN "✅ $script 可执行"
            else
                print_message $YELLOW "⚠️ $script 需要执行权限"
                chmod +x "$script"
                print_message $GREEN "✅ 已设置执行权限"
            fi
        fi
    done
    
    if [[ "$all_exist" == "false" ]]; then
        return 1
    fi
    
    return 0
}

# 测试Docker镜像构建（可选）
test_image_build() {
    print_message $BLUE "测试Docker镜像构建..."
    
    read -p "是否测试镜像构建？这可能需要几分钟时间 (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_message $YELLOW "跳过镜像构建测试"
        return 0
    fi
    
    print_message $BLUE "开始构建测试镜像..."
    
    # 构建开发环境镜像
    if docker build -f Dockerfile.dev -t webhook-tool:test .; then
        print_message $GREEN "✅ 开发环境镜像构建成功"
        
        # 清理测试镜像
        docker rmi webhook-tool:test
        print_message $GREEN "✅ 测试镜像已清理"
    else
        print_message $RED "❌ 开发环境镜像构建失败"
        return 1
    fi
    
    return 0
}

# 显示测试结果摘要
show_summary() {
    local passed=$1
    local total=$2
    
    echo ""
    print_message $GREEN "=== 测试结果摘要 ==="
    print_message $BLUE "总测试项: $total"
    print_message $GREEN "通过: $passed"
    
    if [[ $passed -eq $total ]]; then
        print_message $GREEN "失败: 0"
        print_message $GREEN "🎉 所有测试通过！Docker配置正确。"
    else
        local failed=$((total - passed))
        print_message $RED "失败: $failed"
        print_message $YELLOW "⚠️ 请检查失败的测试项。"
    fi
    
    print_message $GREEN "=================="
}

# 主函数
main() {
    print_message $GREEN "开始Docker配置测试..."
    echo ""
    
    local passed=0
    local total=5
    
    # 测试Docker环境
    if test_docker_environment; then
        ((passed++))
    fi
    echo ""
    
    # 测试Dockerfile
    if test_dockerfile; then
        ((passed++))
    fi
    echo ""
    
    # 测试Docker Compose文件
    if test_compose_files; then
        ((passed++))
    fi
    echo ""
    
    # 测试配置文件
    if test_config_files; then
        ((passed++))
    fi
    echo ""
    
    # 测试脚本文件
    if test_scripts; then
        ((passed++))
    fi
    echo ""
    
    # 测试镜像构建（可选）
    if test_image_build; then
        print_message $GREEN "✅ 镜像构建测试通过"
    else
        print_message $YELLOW "⚠️ 镜像构建测试失败或跳过"
    fi
    echo ""
    
    # 显示测试结果
    show_summary $passed $total
    
    # 返回退出码
    if [[ $passed -eq $total ]]; then
        exit 0
    else
        exit 1
    fi
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main
fi
