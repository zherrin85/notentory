# Production Setup Guide - Notentory

This guide provides step-by-step instructions for deploying the Notentory application in a production environment.

## Prerequisites

- Ubuntu 20.04+ or CentOS 8+ server
- Root or sudo access
- Domain name (optional but recommended)

## 1. System Updates

```bash
sudo apt update && sudo apt upgrade -y
```

## 2. Install Node.js

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

## 3. Install MySQL

```bash
# Install MySQL
sudo apt install mysql-server -y

# Secure MySQL installation
sudo mysql_secure_installation
```

## 4. Database Setup

```sql
-- Create database
CREATE DATABASE shift_notes_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user (replace with your actual username and password)
CREATE USER 'shift_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON shift_notes_db.* TO 'shift_user'@'localhost';
FLUSH PRIVILEGES;

-- Create tables
USE shift_notes_db;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'manager', 'technician') DEFAULT 'technician',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE shift_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    shift_type ENUM('day', 'night', 'swing') NOT NULL,
    user_id INT NOT NULL,
    completed_audits JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shift_note_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('in_progress', 'completed', 'blocked') DEFAULT 'in_progress',
    ticket_number VARCHAR(100),
    parts_used JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (shift_note_id) REFERENCES shift_notes(id)
);

CREATE TABLE inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    part_number VARCHAR(100) UNIQUE NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    vendor VARCHAR(255),
    description TEXT,
    quantity INT DEFAULT 0,
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE inventory_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inventory_id INT NOT NULL,
    user_id INT NOT NULL,
    transaction_type ENUM('add', 'remove', 'set') NOT NULL,
    quantity_change INT NOT NULL,
    previous_quantity INT NOT NULL,
    new_quantity INT NOT NULL,
    reason TEXT,
    shift_note_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (shift_note_id) REFERENCES shift_notes(id)
);

CREATE TABLE activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id INT,
    details JSON,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE file_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shift_note_id INT,
    task_id INT,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100),
    uploaded_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shift_note_id) REFERENCES shift_notes(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default admin user (replace with your actual credentials)
INSERT INTO users (name, email, password_hash, role, active) VALUES
('Administrator', 'admin@company.com', '$2b$10$your_hashed_password_here', 'admin', TRUE);
```

## 5. Application Setup

```bash
# Clone or upload application files
cd /opt
sudo mkdir shift-notes
sudo chown $USER:$USER shift-notes
cd shift-notes

# Install dependencies
npm install

# Create environment file
cat > .env << EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=shift_user
DB_PASSWORD=your_secure_password
DB_NAME=shift_notes_db

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here

# Server Configuration
PORT=3000
NODE_ENV=production

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com
EOF

# Create uploads directory
mkdir uploads
mkdir backups
```

## 6. Nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 7. SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

## 8. Systemd Service

```bash
# Create service file
sudo tee /etc/systemd/system/shift-notes.service > /dev/null << EOF
[Unit]
Description=Notentory Shift Notes Application
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/shift-notes
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable shift-notes
sudo systemctl start shift-notes
```

## 9. Security Hardening

```bash
# Configure firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Secure MySQL
sudo mysql -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');"
sudo mysql -e "DELETE FROM mysql.user WHERE User='';"
sudo mysql -e "FLUSH PRIVILEGES;"

# Set up automatic security updates
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

## 10. Monitoring and Logs

```bash
# View application logs
sudo journalctl -u shift-notes -f

# Monitor system resources
htop
df -h
free -h
```

## 11. Backup Strategy

```bash
# Create backup script
sudo tee /opt/shift-notes/backup.sh > /dev/null << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/shift-notes/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
mysqldump -u shift_user -p'your_secure_password' shift_notes_db > $BACKUP_DIR/db_backup_$DATE.sql

# Uploads backup
tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz uploads/

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
EOF

# Make executable and add to crontab
chmod +x /opt/shift-notes/backup.sh
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/shift-notes/backup.sh") | crontab -
```

## 12. Performance Optimization

```bash
# Install PM2 for process management
sudo npm install -g pm2

# Configure PM2
pm2 start server.js --name "shift-notes"
pm2 startup
pm2 save
```

## Troubleshooting

### Common Issues

1. **Port already in use**: Check if another service is using port 3000
2. **Database connection failed**: Verify MySQL credentials and permissions
3. **Permission denied**: Ensure proper file permissions for uploads directory

### Log Locations

- Application logs: `/var/log/syslog` or `journalctl -u shift-notes`
- Nginx logs: `/var/log/nginx/access.log` and `/var/log/nginx/error.log`
- MySQL logs: `/var/log/mysql/error.log`

### Performance Monitoring

```bash
# Monitor Node.js application
pm2 monit

# Monitor system resources
htop
iotop
```

## Security Checklist

- [ ] Firewall configured
- [ ] SSL certificate installed
- [ ] Database secured
- [ ] Regular backups configured
- [ ] Automatic updates enabled
- [ ] Strong passwords set
- [ ] File permissions configured
- [ ] Log monitoring enabled

## Support

For issues and support, please refer to the application documentation or contact your system administrator. 