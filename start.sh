#!/bin/bash

# =============================================
# DataQ Analyzer - Quick Start Script
# =============================================
# Simplified wrapper for docker-compose commands
# =============================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}ℹ${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Check if .env exists
check_env_file() {
    if [ ! -f .env ]; then
        print_error ".env file not found!"
        echo
        echo "Please run the setup script first:"
        echo -e "  ${BLUE}./setup.sh${NC}"
        echo
        exit 1
    fi
}

# Detect if bundled MongoDB should be used
use_bundled_mongo() {
    if [ -f .env ]; then
        # Check if MONGODB_URI is set and not empty
        if grep -q "^MONGODB_URI=mongodb" .env 2>/dev/null; then
            return 1  # External MongoDB
        fi
    fi
    return 0  # Bundled MongoDB (default)
}

# Show usage
usage() {
    cat << EOF
Usage: ./start.sh [command]

Commands:
  start       Start all services (auto-detects MongoDB setup)
  stop        Stop all services
  restart     Restart all services
  logs        Follow logs from all services
  status      Show status of all containers
  clean       Stop and remove all containers and volumes
  help        Show this help message

Examples:
  ./start.sh start          # Start the application
  ./start.sh logs           # View logs
  ./start.sh stop           # Stop the application
  ./start.sh clean          # Complete cleanup

Note: Run ./setup.sh first if you haven't configured .env yet
EOF
}

# Main commands
case "${1:-start}" in
    start)
        print_header "Starting DataQ Analyzer"
        check_env_file

        if use_bundled_mongo; then
            print_info "Using bundled MongoDB"
            docker-compose -f docker/docker-compose.yml --env-file .env --profile with-mongodb up -d
        else
            print_info "Using external MongoDB"
            docker-compose -f docker/docker-compose.yml --env-file .env up -d
        fi

        echo
        print_info "Waiting for services to start..."
        sleep 5

        echo
        print_info "Services started successfully!"
        echo
        echo "Access the application:"
        echo -e "  Admin UI: ${BLUE}http://localhost:3000/admin${NC}"
        echo -e "  API:      ${BLUE}http://localhost:3000/api${NC}"
        echo
        echo "View logs:"
        echo -e "  ${BLUE}./start.sh logs${NC}"
        echo
        ;;

    stop)
        print_header "Stopping DataQ Analyzer"
        docker-compose -f docker/docker-compose.yml --env-file .env down
        print_info "Services stopped"
        ;;

    restart)
        print_header "Restarting DataQ Analyzer"
        docker-compose -f docker/docker-compose.yml --env-file .env restart
        print_info "Services restarted"
        ;;

    logs)
        print_info "Following logs (Ctrl+C to exit)..."
        docker-compose -f docker/docker-compose.yml --env-file .env logs -f
        ;;

    status)
        print_header "Service Status"
        docker-compose -f docker/docker-compose.yml --env-file .env ps
        echo
        print_info "Health check:"
        curl -s http://localhost:3000/api/health | python3 -m json.tool || echo "Service not responding"
        ;;

    clean)
        echo -e "${YELLOW}⚠${NC} This will stop and remove all containers and volumes!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_header "Cleaning Up"
            docker-compose -f docker/docker-compose.yml --env-file .env down -v
            print_info "Cleanup complete"
        else
            print_info "Cleanup cancelled"
        fi
        ;;

    help|--help|-h)
        usage
        ;;

    *)
        print_error "Unknown command: $1"
        echo
        usage
        exit 1
        ;;
esac
