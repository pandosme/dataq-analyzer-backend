#!/bin/bash

# =============================================
# DataQ Analyzer Backend - Interactive Setup
# =============================================
# This script helps you configure the .env file
# for running the DataQ Analyzer with Docker Compose
# =============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_info() {
    echo -e "${GREEN}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Generate random secure string
generate_secret() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Validate IP address
validate_ip() {
    local ip=$1
    if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        return 0
    else
        return 1
    fi
}

# Validate port number
validate_port() {
    local port=$1
    if [[ $port =~ ^[0-9]+$ ]] && [ $port -ge 1 ] && [ $port -le 65535 ]; then
        return 0
    else
        return 1
    fi
}

# Validate URL
validate_url() {
    local url=$1
    if [[ $url =~ ^(http|https|mqtt|mqtts|mongodb|mongodb\+srv):// ]]; then
        return 0
    else
        return 1
    fi
}

# Prompt for input with default value
prompt_with_default() {
    local prompt=$1
    local default=$2
    local value

    if [ -n "$default" ]; then
        echo -ne "${GREEN}?${NC} $prompt [${BLUE}$default${NC}]: " >&2
        read value
        echo "${value:-$default}"
    else
        echo -ne "${GREEN}?${NC} $prompt: " >&2
        read value
        echo "$value"
    fi
}

# Prompt for yes/no
prompt_yes_no() {
    local prompt=$1
    local default=$2
    local value

    if [ "$default" = "y" ]; then
        echo -ne "${GREEN}?${NC} $prompt [${BLUE}Y/n${NC}]: " >&2
        read value
        value=${value:-y}
    else
        echo -ne "${GREEN}?${NC} $prompt [${BLUE}y/N${NC}]: " >&2
        read value
        value=${value:-n}
    fi

    if [[ "$value" =~ ^[Yy]$ ]]; then
        return 0
    else
        return 1
    fi
}

# Prompt for password (hidden input)
prompt_password() {
    local prompt=$1
    local password
    local password_confirm

    while true; do
        echo -ne "${GREEN}?${NC} $prompt: " >&2
        read -s password
        echo >&2
        echo -ne "${GREEN}?${NC} Confirm password: " >&2
        read -s password_confirm
        echo >&2

        if [ "$password" = "$password_confirm" ]; then
            echo "$password"
            return 0
        else
            print_error "Passwords do not match. Please try again."
        fi
    done
}

# Main setup function
main() {
    clear
    print_header "DataQ Analyzer Backend Setup"
    echo
    print_info "This script will help you configure your .env file for deployment."
    print_info "Press Ctrl+C at any time to cancel."
    echo

    # Check if .env already exists
    if [ -f .env ]; then
        print_warning ".env file already exists!"
        if ! prompt_yes_no "Do you want to overwrite it?" "n"; then
            print_info "Setup cancelled. Your existing .env file was not modified."
            exit 0
        fi
        # Backup existing .env
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        print_success "Existing .env backed up"
    fi

    echo
    print_header "1. General Configuration"
    echo

    # Environment
    NODE_ENV=$(prompt_with_default "Environment (production/development)" "production")

    # Port
    while true; do
        PORT=$(prompt_with_default "Server port" "3000")
        if validate_port "$PORT"; then
            break
        else
            print_error "Invalid port number. Please enter a value between 1 and 65535."
        fi
    done

    echo
    print_header "2. Authentication Configuration"
    echo

    # Generate JWT secret
    print_info "Generating secure JWT secret..."
    JWT_SECRET=$(generate_secret 64)
    print_success "JWT secret generated (64 characters)"

    # JWT expiration
    JWT_EXPIRES_IN=$(prompt_with_default "JWT token expiration (e.g., 7d, 24h)" "7d")

    echo
    print_header "3. Admin Account Configuration"
    echo

    print_info "Configure the initial admin account (stored in .env, not database)"
    echo

    ADMIN_USERNAME=$(prompt_with_default "Admin username" "admin")
    ADMIN_EMAIL=$(prompt_with_default "Admin email" "admin@example.com")
    ADMIN_PASSWORD=$(prompt_password "Admin password")

    print_info "Hashing admin password..."
    ADMIN_PASSWORD_HASH=$(node -e "const bcrypt = require('bcrypt'); console.log(bcrypt.hashSync('$ADMIN_PASSWORD', 10));")
    print_success "Admin password hashed"

    echo
    print_header "4. MongoDB Configuration"
    echo

    print_info "Choose your MongoDB setup:"
    echo "  1. Use bundled MongoDB (runs in Docker alongside the app)"
    echo "  2. Use external MongoDB (already running elsewhere)"
    echo

    MONGO_CHOICE=$(prompt_with_default "Enter choice (1 or 2)" "1")

    if [ "$MONGO_CHOICE" = "1" ]; then
        print_info "Using bundled MongoDB"

        MONGODB_HOST="mongodb"
        MONGODB_PORT="27017"
        MONGODB_DATABASE=$(prompt_with_default "Database name" "dataq-analyzer")

        print_info "Setting up MongoDB credentials..."
        MONGODB_USERNAME=$(prompt_with_default "MongoDB admin username" "admin")
        MONGODB_PASSWORD=$(prompt_password "MongoDB admin password")
        MONGODB_AUTH_REQUIRED="true"

        # Docker-specific variables for bundled MongoDB
        MONGO_ROOT_USER="$MONGODB_USERNAME"
        MONGO_ROOT_PASSWORD="$MONGODB_PASSWORD"
        MONGO_PORT="27017"

        MONGODB_URI=""  # Not used with bundled setup
        USE_BUNDLED_MONGO="true"
    else
        print_info "Using external MongoDB"
        echo

        # MongoDB server address
        while true; do
            MONGODB_HOST=$(prompt_with_default "MongoDB server address (host or IP)" "localhost")
            if [ -n "$MONGODB_HOST" ]; then
                break
            else
                print_error "MongoDB server address is required"
            fi
        done

        while true; do
            MONGODB_PORT=$(prompt_with_default "MongoDB server port" "27017")
            if validate_port "$MONGODB_PORT"; then
                break
            else
                print_error "Invalid port number. Please enter a value between 1 and 65535."
            fi
        done

        MONGODB_DATABASE=$(prompt_with_default "Database name" "dataq-analyzer")

        # MongoDB credentials (optional)
        MONGODB_USERNAME=$(prompt_with_default "MongoDB username (leave empty for no auth)" "")
        if [ -n "$MONGODB_USERNAME" ]; then
            MONGODB_PASSWORD=$(prompt_password "MongoDB password")
            MONGODB_AUTH_REQUIRED="true"
            # Build URI with credentials and authSource
            MONGODB_URI="mongodb://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_DATABASE}?authSource=admin"
        else
            MONGODB_PASSWORD=""
            MONGODB_AUTH_REQUIRED="false"
            # Build URI without credentials
            MONGODB_URI="mongodb://${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_DATABASE}"
        fi

        # Clear Docker-specific vars
        MONGO_ROOT_USER=""
        MONGO_ROOT_PASSWORD=""
        MONGO_PORT=""
        USE_BUNDLED_MONGO="false"
    fi

    echo
    print_header "5. MQTT Configuration"
    echo

    print_info "Configure connection to your MQTT broker"
    echo

    # MQTT server address
    while true; do
        MQTT_HOST=$(prompt_with_default "MQTT server address (host or IP)" "localhost")
        if [ -n "$MQTT_HOST" ]; then
            break
        else
            print_error "MQTT server address is required"
        fi
    done

    while true; do
        MQTT_PORT=$(prompt_with_default "MQTT server port" "1883")
        if validate_port "$MQTT_PORT"; then
            break
        else
            print_error "Invalid port number. Please enter a value between 1 and 65535."
        fi
    done

    # MQTT credentials (optional)
    MQTT_USERNAME=$(prompt_with_default "MQTT username (leave empty for no auth)" "")
    if [ -n "$MQTT_USERNAME" ]; then
        MQTT_PASSWORD=$(prompt_password "MQTT password")
    else
        MQTT_PASSWORD=""
    fi

    # MQTT TLS
    if prompt_yes_no "Use TLS for MQTT connection?" "n"; then
        MQTT_USE_TLS="true"
        MQTT_PROTOCOL="mqtts"
    else
        MQTT_USE_TLS="false"
        MQTT_PROTOCOL="mqtt"
    fi

    # Build MQTT broker URL
    if [ -n "$MQTT_USERNAME" ]; then
        MQTT_BROKER_URL="${MQTT_PROTOCOL}://${MQTT_USERNAME}:${MQTT_PASSWORD}@${MQTT_HOST}:${MQTT_PORT}"
    else
        MQTT_BROKER_URL="${MQTT_PROTOCOL}://${MQTT_HOST}:${MQTT_PORT}"
    fi

    MQTT_TOPIC_PREFIX=$(prompt_with_default "MQTT topic prefix" "dataq/#")

    echo
    print_header "6. CORS Configuration"
    echo

    print_info "Configure allowed origins for API requests"
    print_warning "Using '*' (wildcard) is insecure for production!"

    CORS_ORIGIN=$(prompt_with_default "CORS allowed origins (comma-separated or *)" "*")

    if [ "$CORS_ORIGIN" = "*" ] && [ "$NODE_ENV" = "production" ]; then
        print_warning "WARNING: CORS is set to wildcard in production mode."
        print_warning "Consider setting specific origins for better security."
    fi

    echo
    print_header "Generating .env file..."
    echo

    # Generate .env file
    cat > .env << EOF
# =============================================
# DataQ Analyzer Backend Configuration
# Generated by setup.sh on $(date)
# =============================================

# ----- Server Configuration -----
NODE_ENV=$NODE_ENV
PORT=$PORT

# ----- Authentication -----
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=$JWT_EXPIRES_IN

# ----- Admin Account (Environment-based) -----
# Admin account stored in .env, not database
ADMIN_USERNAME=$ADMIN_USERNAME
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD_HASH=$ADMIN_PASSWORD_HASH

EOF

    # MongoDB configuration
    if [ "$USE_BUNDLED_MONGO" = "true" ]; then
        cat >> .env << EOF
# =============================================
# MongoDB Configuration (Bundled)
# =============================================
MONGODB_HOST=$MONGODB_HOST
MONGODB_PORT=$MONGODB_PORT
MONGODB_DATABASE=$MONGODB_DATABASE
MONGODB_USERNAME=$MONGODB_USERNAME
MONGODB_PASSWORD=$MONGODB_PASSWORD
MONGODB_AUTH_REQUIRED=$MONGODB_AUTH_REQUIRED

# Docker MongoDB Configuration
MONGO_ROOT_USER=$MONGO_ROOT_USER
MONGO_ROOT_PASSWORD=$MONGO_ROOT_PASSWORD
MONGO_PORT=$MONGO_PORT

EOF
    else
        cat >> .env << EOF
# =============================================
# MongoDB Configuration (External)
# =============================================
MONGODB_URI=$MONGODB_URI

EOF
    fi

    # MQTT configuration
    cat >> .env << EOF
# ----- MQTT Configuration -----
MQTT_BROKER_URL=$MQTT_BROKER_URL
MQTT_USERNAME=$MQTT_USERNAME
MQTT_PASSWORD=$MQTT_PASSWORD
MQTT_USE_TLS=$MQTT_USE_TLS
MQTT_TOPIC_PREFIX=$MQTT_TOPIC_PREFIX

# ----- CORS Configuration -----
CORS_ORIGIN=$CORS_ORIGIN
EOF

    print_success ".env file created successfully!"
    echo

    # Show summary
    print_header "Configuration Summary"
    echo
    echo "Environment:        $NODE_ENV"
    echo "Port:              $PORT"
    echo
    if [ "$USE_BUNDLED_MONGO" = "true" ]; then
        echo "MongoDB:           Bundled (Docker)"
        echo "  - Database:      $MONGODB_DATABASE"
        echo "  - Auth:          $([ -n "$MONGODB_USERNAME" ] && echo "Enabled (user: $MONGODB_USERNAME)" || echo "Disabled")"
    else
        echo "MongoDB:           External"
        echo "  - Server:        $MONGODB_HOST:$MONGODB_PORT"
        echo "  - Database:      $MONGODB_DATABASE"
        echo "  - Auth:          $([ -n "$MONGODB_USERNAME" ] && echo "Enabled (user: $MONGODB_USERNAME)" || echo "Disabled")"
    fi
    echo
    echo "MQTT Broker:       $MQTT_HOST:$MQTT_PORT"
    echo "  - TLS:           $([ "$MQTT_USE_TLS" = "true" ] && echo "Enabled" || echo "Disabled")"
    echo "  - Auth:          $([ -n "$MQTT_USERNAME" ] && echo "Enabled (user: $MQTT_USERNAME)" || echo "Disabled")"
    echo "  - Topic Prefix:  $MQTT_TOPIC_PREFIX"
    echo
    echo "CORS:              $CORS_ORIGIN"
    echo

    # Show next steps
    print_header "Next Steps"
    echo
    print_info "Your .env file has been created. To start the application:"
    echo

    if [ "$USE_BUNDLED_MONGO" = "true" ]; then
        echo "  1. Start with bundled MongoDB:"
        echo "     ${BLUE}docker-compose -f docker/docker-compose.yml --profile with-mongodb up -d${NC}"
        echo
        echo "  2. View logs:"
        echo "     ${BLUE}docker-compose -f docker/docker-compose.yml logs -f${NC}"
        echo
        echo "  3. Stop services:"
        echo "     ${BLUE}docker-compose -f docker/docker-compose.yml down${NC}"
    else
        echo "  1. Make sure your external MongoDB is running and accessible"
        echo
        echo "  2. Start the application:"
        echo "     ${BLUE}docker-compose -f docker/docker-compose.yml up -d${NC}"
        echo
        echo "  3. View logs:"
        echo "     ${BLUE}docker-compose -f docker/docker-compose.yml logs -f${NC}"
        echo
        echo "  4. Stop services:"
        echo "     ${BLUE}docker-compose -f docker/docker-compose.yml down${NC}"
    fi

    echo
    echo "  Access the admin UI: ${BLUE}http://localhost:$PORT/admin${NC}"
    echo "  Access the API:      ${BLUE}http://localhost:$PORT/api${NC}"
    echo

    print_success "Admin account configured:"
    echo "  Username: $ADMIN_USERNAME"
    echo "  Email:    $ADMIN_EMAIL"
    echo "  (Password is securely hashed in .env)"
    echo

    if [ "$NODE_ENV" = "production" ]; then
        print_warning "SECURITY REMINDER:"
        print_warning "- Your JWT secret has been generated and should remain confidential"
        print_warning "- Review BACKLOG.md for security hardening tasks before production deployment"
        print_warning "- Do not commit .env file to version control"
        echo
    fi

    print_success "Setup complete!"
}

# Check for required commands
check_requirements() {
    local missing=()

    if ! command -v openssl &> /dev/null; then
        missing+=("openssl")
    fi

    if ! command -v node &> /dev/null; then
        missing+=("node")
    fi

    if ! command -v docker &> /dev/null; then
        missing+=("docker")
    fi

    if ! command -v docker-compose &> /dev/null; then
        if ! docker compose version &> /dev/null; then
            missing+=("docker-compose")
        fi
    fi

    if [ ${#missing[@]} -ne 0 ]; then
        print_error "Missing required commands: ${missing[*]}"
        print_error "Please install the missing dependencies and try again."
        exit 1
    fi
}

# Entry point
echo
check_requirements
main
