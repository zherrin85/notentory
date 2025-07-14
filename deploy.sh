#!/bin/bash

# IT Shift Notes & Inventory System - Deployment Script for Debian
# This script sets up the complete system on a fresh Debian installation
# Run as root: sudo ./deploy.sh

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="shift-notes"
APP_DIR="/opt/shift-notes"
APP_USER="shiftnotes"
DB_NAME="shift_inventory_system"
DB_USER="shiftnotes_user"
DB_PASSWORD="Zd7010us"  # Change this in production!
NODE_VERSION="18"

echo -e "${BLUE}🚀 IT Shift Notes & Inventory System Deployment Script${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
   exit 1
fi

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Update system packages
echo -e "${BLUE}📦 Updating system packages...${NC}"
apt update && apt upgrade -y
print_status "System packages updated"

# Install required packages
echo -e "${BLUE}📦 Installing required packages...${NC}"
apt install -y curl wget gnupg2 software-properties-common apt-transport-https ca-certificates \
               nginx mariadb-server mariadb-client ufw fail2ban logrotate git

print_status "Required packages installed"

# Install Node.js
echo -e "${BLUE}📦 Installing Node.js ${NODE_VERSION}...${NC}"
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt install -y nodejs
print_status "Node.js $(node --version) installed"

# Create application user
echo -e "${BLUE}👤 Creating application user...${NC}"
if ! id "$APP_USER" &>/dev/null; then
    useradd --system --shell /bin/bash --home-dir $APP_DIR --create-home $APP_USER
    print_status "User $APP_USER created"
else
    print_warning "User $APP_USER already exists"
fi

# Create application directory structure
echo -e "${BLUE}📁 Setting up application directories...${NC}"
mkdir -p $APP_DIR/{logs,uploads,backups}
chown -R $APP_USER:$APP_USER $APP_DIR
chmod 755 $APP_DIR
chmod 755 $APP_DIR/uploads
print_status "Application directories created"

# Setup MariaDB
echo -e "${BLUE}🗄️  Configuring MariaDB...${NC}"
systemctl start mariadb
systemctl enable mariadb

# Secure MariaDB installation (automated)
mysql -e "DELETE FROM mysql.user WHERE User='';"
mysql -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');"
mysql -e "DROP DATABASE IF EXISTS test;"
mysql -e "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';"
mysql -e "FLUSH PRIVILEGES;"

# Create database and user
mysql -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';"
mysql -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

print_status "MariaDB configured and database created"

# Copy application files (assuming they're in current directory)
echo -e "${BLUE}📂 Copying application files...${NC}"
if [ -f "server.js" ]; then
    cp server.js $APP_DIR/
    cp package.json $APP_DIR/
    cp init-database.js $APP_DIR/
    cp -r public $APP_DIR/
    chown -R $APP_USER:$APP_USER $APP_DIR
    print_status "Application files copied"
else
    print_warning "Application files not found in current directory"
    print_warning "Please copy server.js, package.json, init-database.js, and public/ to $APP_DIR manually"
fi

# Install Node.js dependencies
echo -e "${BLUE}📦 Installing Node.js dependencies...${NC}"
cd $APP_DIR
sudo -u $APP_USER npm install --production
print_status "Node.js dependencies installed"

# Initialize database
echo -e "${BLUE}🗄️  Initializing database...${NC}"
sudo -u $APP_USER node init-database.js
print_status "Database initialized with sample data"

# Create systemd service
echo -e "${BLUE}⚙️  Creating systemd service...${NC}"
cat > /etc/systemd/system/$APP_NAME.service << EOF
[Unit]
Description=IT Shift Notes & Inventory Management System
Documentation=https://github.com/your-company/shift-notes
After=network.target mariadb.service
Wants=mariadb.service

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node server.js
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
TimeoutStopSec=30

# Environment variables
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=JWT_SECRET=$(openssl rand -base64 32)
Environment=DB_HOST=127.0.0.1
Environment=DB_USER=$DB_USER
Environment=DB_PASSWORD=$DB_PASSWORD
Environment=DB_NAME=$DB_NAME

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
ReadWritePaths=$APP_DIR/uploads
ReadWritePaths=$APP_DIR/logs

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$APP_NAME

# Graceful shutdown
KillMode=mixed
KillSignal=SIGTERM
TimeoutSec=30

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable $APP_NAME
print_status "Systemd service created and enabled"

# Configure Nginx
echo -e "${BLUE}🌐 Configuring Nginx...${NC}"
cat > /etc/nginx/sites-available/$APP_NAME << EOF
server {
    listen 80;
    server_name localhost;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/json
        application/xml+rss;
    
    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=login:10m rate=5r/m;
    
    # Root directory
    root $APP_DIR/public;
    index index.html;
    
    # Serve static files
    location / {
        try_files \$uri \$uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }
    
    # API proxy
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        location /api/login {
            limit_req zone=login burst=5 nodelay;
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_cache_bypass \$http_upgrade;
            proxy_read_timeout 60s;
            proxy_send_timeout 60s;
        }
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
        proxy_connect_timeout 30s;
    }
    
    # Uploads
    location /uploads/ {
        alias $APP_DIR/uploads/;
        expires 1d;
        add_header Cache-Control "private";
        internal;
    }
    
    # Security
    location ~ /\\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    location ~* \\.(env|log|ini)\$ {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # Health check
    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
    
    # Logging
    access_log /var/log/nginx/${APP_NAME}-access.log;
    error_log /var/log/nginx/${APP_NAME}-error.log;
    
    # Upload limits
    client_max_body_size 10M;
    client_body_timeout 60s;
    client_header_timeout 60s;
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default  # Remove default site
nginx -t  # Test configuration
systemctl restart nginx
systemctl enable nginx
print_status "Nginx configured and restarted"

# Configure firewall
echo -e "${BLUE}🔥 Configuring firewall...${NC}"
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
print_status "Firewall configured"

# Configure fail2ban
echo -e "${BLUE}🛡️  Configuring fail2ban...${NC}"
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/${APP_NAME}-error.log
maxretry = 10
EOF

systemctl restart fail2ban
systemctl enable fail2ban
print_status "Fail2ban configured"

# Setup log rotation
echo -e "${BLUE}📄 Setting up log rotation...${NC}"
cat > /etc/logrotate.d/$APP_NAME << EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $APP_USER $APP_USER
    postrotate
        systemctl reload $APP_NAME
    endscript
}
EOF
print_status "Log rotation configured"

# Create backup script
echo -e "${BLUE}💾 Creating backup script...${NC}"
cat > $APP_DIR/backup.sh << 'EOF'
#!/bin/bash

# Backup script for IT Shift Notes & Inventory System
BACKUP_DIR="/opt/shift-notes/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="shift_inventory_system"
DB_USER="shiftnotes_user"
DB_PASSWORD="Zd7010us"

# Create database backup
mysqldump -u$DB_USER -p$DB_PASSWORD $DB_NAME > $BACKUP_DIR/database_backup_$DATE.sql

# Create uploads backup
tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz -C /opt/shift-notes uploads/

# Keep only last 30 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
EOF

chmod +x $APP_DIR/backup.sh
chown $APP_USER:$APP_USER $APP_DIR/backup.sh

# Add backup to crontab
(crontab -u $APP_USER -l 2>/dev/null; echo "0 2 * * * $APP_DIR/backup.sh >> $APP_DIR/logs/backup.log 2>&1") | crontab -u $APP_USER -
print_status "Backup script created and scheduled"

# Start services
echo -e "${BLUE}🚀 Starting services...${NC}"
systemctl start $APP_NAME
sleep 5

# Check if service is running
if systemctl is-active --quiet $APP_NAME; then
    print_status "Application service started successfully"
else
    print_error "Application service failed to start"
    journalctl -u $APP_NAME --no-pager -l
    exit 1
fi

# Final status check
echo -e "${BLUE}🔍 Performing final health checks...${NC}"

# Check if application responds
if curl -s http://localhost/health > /dev/null; then
    print_status "Application is responding to HTTP requests"
else
    print_warning "Application may not be responding correctly"
fi

# Check database connection
if mysql -u$DB_USER -p$DB_PASSWORD -e "USE $DB_NAME; SHOW TABLES;" > /dev/null 2>&1; then
    print_status "Database connection successful"
else
    print_error "Database connection failed"
fi

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""
echo -e "${BLUE}📋 System Information:${NC}"
echo "   Application URL: http://$(hostname -I | awk '{print $1}')"
echo "   Application Directory: $APP_DIR"
echo "   Log Files: $APP_DIR/logs/ and /var/log/nginx/"
echo "   Service Status: systemctl status $APP_NAME"
echo ""
echo -e "${BLUE}🔑 Default Login Credentials:${NC}"
echo "   Admin: admin@company.com / admin123"
echo "   Manager: sarah@company.com / password123"
echo "   Technician: john@company.com / password123"
echo ""
echo -e "${BLUE}⚙️  Management Commands:${NC}"
echo "   Start service: systemctl start $APP_NAME"
echo "   Stop service: systemctl stop $APP_NAME"
echo "   Restart service: systemctl restart $APP_NAME"
echo "   View logs: journalctl -u $APP_NAME -f"
echo "   Backup data: $APP_DIR/backup.sh"
echo ""
echo -e "${YELLOW}⚠️  Security Reminders:${NC}"
echo "   1. Change the default database password in production"
echo "   2. Update the JWT secret in the systemd service file"
echo "   3. Configure SSL/TLS certificates for HTTPS"
echo "   4. Regularly update the system and dependencies"
echo "   5. Monitor logs for suspicious activity"
echo ""
echo -e "${GREEN}✅ Your IT Shift Notes & Inventory System is ready for use!${NC}"
