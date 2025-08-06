#!/bin/bash

# Notentory Production Deployment Script
# This script automates the deployment of the Notentory application

set -e  # Exit on any error

# Configuration
APP_NAME="notentory"
APP_DIR="/opt/shift-notes"
DB_NAME="shift_notes_db"
DB_USER="shift_user"
DB_PASSWORD="your_secure_database_password"
NODE_VERSION="18"
DOMAIN="yourdomain.com"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error "This script should not be run as root"
   exit 1
fi

log "Starting Notentory deployment..."

# Update system packages
log "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install required packages
log "Installing required packages..."
sudo apt install -y curl wget git nginx mysql-server certbot python3-certbot-nginx fail2ban ufw

# Install Node.js
log "Installing Node.js ${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
sudo apt-get install -y nodejs

# Verify Node.js installation
log "Verifying Node.js installation..."
node --version
npm --version

# Create application directory
log "Creating application directory..."
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Clone or copy application files
log "Setting up application files..."
if [ -d "$APP_DIR/.git" ]; then
    log "Updating existing repository..."
    cd $APP_DIR
    git pull origin main
else
    log "Cloning repository..."
    git clone <repository-url> $APP_DIR
    cd $APP_DIR
fi

# Install Node.js dependencies
log "Installing Node.js dependencies..."
npm install --production

# Secure MySQL installation
log "Securing MySQL installation..."
sudo mysql_secure_installation

# Create database and user
log "Setting up database..."
sudo mysql -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');"
sudo mysql -e "DELETE FROM mysql.user WHERE User='';"
sudo mysql -e "FLUSH PRIVILEGES;"
sudo mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';"
sudo mysql -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

# Create environment file
log "Creating environment configuration..."
cat > $APP_DIR/.env << EOF
# Database Configuration
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME

# JWT Configuration
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

# Server Configuration
PORT=3000
NODE_ENV=production

# CORS Configuration
CORS_ORIGIN=https://$DOMAIN
EOF

# Create required directories
log "Creating required directories..."
mkdir -p $APP_DIR/uploads
mkdir -p $APP_DIR/backups
chmod 755 $APP_DIR/uploads
chmod 755 $APP_DIR/backups

# Initialize database
log "Initializing database..."
node $APP_DIR/database-init.js

# Create systemd service
log "Creating systemd service..."
sudo tee /etc/systemd/system/$APP_NAME.service > /dev/null << EOF
[Unit]
Description=Notentory Shift Notes Application
Documentation=https://github.com/your-company/shift-notes
After=network.target mysql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$APP_NAME

# Environment variables
Environment=DB_HOST=127.0.0.1
Environment=DB_PORT=3306
Environment=DB_USER=$DB_USER
Environment=DB_PASSWORD=$DB_PASSWORD
Environment=DB_NAME=$DB_NAME
Environment=NODE_ENV=production

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target
EOF

# Set proper permissions
log "Setting file permissions..."
sudo chown -R www-data:www-data $APP_DIR
sudo chmod -R 755 $APP_DIR
sudo chmod 600 $APP_DIR/.env

# Enable and start service
log "Starting application service..."
sudo systemctl daemon-reload
sudo systemctl enable $APP_NAME
sudo systemctl start $APP_NAME

# Configure Nginx
log "Configuring Nginx..."
sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null << EOF
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
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss;
    
    # Client max body size for file uploads
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # Static file caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable Nginx site
sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Configure firewall
log "Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Configure Fail2ban
log "Configuring Fail2ban..."
sudo tee /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-botsearch]
enabled = true
filter = nginx-botsearch
port = http,https
logpath = /var/log/nginx/access.log
EOF

sudo systemctl restart fail2ban

# Create backup script
log "Setting up backup system..."
sudo tee $APP_DIR/backup.sh > /dev/null << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/shift-notes/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
mysqldump -u shift_user -p'your_secure_database_password' shift_notes_db > $BACKUP_DIR/db_backup_$DATE.sql

# Uploads backup
tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz uploads/

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
EOF

sudo chmod +x $APP_DIR/backup.sh

# Add backup to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * $APP_DIR/backup.sh") | crontab -

# Install SSL certificate if domain is provided
if [ "$DOMAIN" != "yourdomain.com" ]; then
    log "Installing SSL certificate for $DOMAIN..."
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
else
    warn "Domain not configured. SSL certificate not installed."
    warn "Update DOMAIN variable and run: sudo certbot --nginx -d yourdomain.com"
fi

# Health check
log "Performing health check..."
sleep 10

if curl -s http://localhost/health > /dev/null; then
    log "✅ Application is running successfully!"
else
    warn "⚠️  Health check failed. Checking service status..."
    sudo systemctl status $APP_NAME
fi

# Final status
log "Deployment completed!"
log "Application URL: http://localhost (or https://$DOMAIN if SSL is configured)"
log "Service status: sudo systemctl status $APP_NAME"
log "Application logs: sudo journalctl -u $APP_NAME -f"
log ""
log "Default login credentials:"
echo "   Admin: admin@company.com / your_admin_password_here"
echo "   Manager: sarah@company.com / your_manager_password_here"
echo "   Technician: john@company.com / your_technician_password_here"
log ""
warn "⚠️  IMPORTANT: Change default passwords after first login!"
warn "⚠️  IMPORTANT: Update domain configuration if using custom domain!"
log ""
log "🎉 Notentory deployment completed successfully!"
