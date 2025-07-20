# 🚀 Production Deployment Guide

## 📋 Pre-Deployment Checklist

### ✅ **System Requirements**
- **Node.js**: Version 16.0.0 or higher
- **MySQL**: Version 8.0 or higher
- **Nginx** (recommended for reverse proxy)
- **SSL Certificate** (for HTTPS)
- **Domain Name** (optional but recommended)

### ✅ **Server Setup**

#### **1. Update System Packages**
```bash
sudo apt update && sudo apt upgrade -y
```

#### **2. Install Node.js (if not already installed)**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### **3. Install MySQL**
```bash
sudo apt install mysql-server -y
sudo mysql_secure_installation
```

#### **4. Install Nginx (for reverse proxy)**
```bash
sudo apt install nginx -y
```

## 🗄️ **Database Setup**

### **1. Create Database and User**
```bash
sudo mysql -u root -p
```

In MySQL console:
```sql
CREATE DATABASE shift_notes_db;
CREATE USER 'shift_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON shift_notes_db.* TO 'shift_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### **2. Create Database Tables**
```sql
USE shift_notes_db;

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'manager', 'admin') DEFAULT 'user',
    active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default administrator
INSERT INTO users (name, email, password_hash, role, active) VALUES 
('Administrator', 'admin@company.com', '$2b$10$your_hashed_password_here', 'admin', TRUE);

-- Shift notes table
CREATE TABLE shift_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    shift_type ENUM('day', 'night') NOT NULL,
    completed_audits JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tasks table
CREATE TABLE tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shift_note_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
    ticket_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shift_note_id) REFERENCES shift_notes(id)
);

-- Inventory table
CREATE TABLE inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    part_number VARCHAR(100) UNIQUE NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity INT DEFAULT 0,
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Task inventory usage table
CREATE TABLE task_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    inventory_id INT NOT NULL,
    quantity_used INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (inventory_id) REFERENCES inventory(id)
);
```

## 🔧 **Application Setup**

### **1. Create Environment File**
```bash
cp .env.example .env
nano .env
```

Update with your production values:
```env
DB_HOST=localhost
DB_USER=shift_user
DB_PASSWORD=your_secure_password
DB_NAME=shift_notes_db
DB_PORT=3306
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=24h
PORT=3000
NODE_ENV=production
SESSION_SECRET=your_session_secret_here
CORS_ORIGIN=https://yourdomain.com
BACKUP_PATH=/opt/backups
BACKUP_RETENTION_DAYS=30
```

### **2. Install Dependencies**
```bash
npm install --production
```

### **3. Generate Secure Passwords**
```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🌐 **Nginx Configuration**

### **1. Create Nginx Site Configuration**
```bash
sudo nano /etc/nginx/sites-available/shift-notes
```

Add this configuration:
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

### **2. Enable Site**
```bash
sudo ln -s /etc/nginx/sites-available/shift-notes /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 🔒 **SSL Certificate (Let's Encrypt)**

### **1. Install Certbot**
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### **2. Obtain SSL Certificate**
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 🚀 **Application Deployment**

### **1. Create Systemd Service**
```bash
sudo nano /etc/systemd/system/shift-notes.service
```

Add this configuration:
```ini
[Unit]
Description=Shift Notes Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/shift-notes
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### **2. Start and Enable Service**
```bash
sudo systemctl daemon-reload
sudo systemctl enable shift-notes
sudo systemctl start shift-notes
sudo systemctl status shift-notes
```

## 🔧 **Security Hardening**

### **1. Firewall Configuration**
```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### **2. Database Security**
```bash
sudo mysql -u root -p
```

In MySQL:
```sql
DELETE FROM mysql.user WHERE User='';
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';
FLUSH PRIVILEGES;
EXIT;
```

## 📊 **Monitoring and Logs**

### **1. View Application Logs**
```bash
sudo journalctl -u shift-notes -f
```

### **2. View Nginx Logs**
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 🔄 **Backup Setup**

### **1. Create Backup Directory**
```bash
sudo mkdir -p /opt/backups
sudo chown www-data:www-data /opt/backups
```

### **2. Create Backup Script**
```bash
sudo nano /opt/backups/backup.sh
```

Add this script:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"
DB_NAME="shift_notes_db"
DB_USER="shift_user"
DB_PASS="your_secure_password"

# Database backup
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql

# Application backup
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz /opt/shift-notes

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

### **3. Make Script Executable and Schedule**
```bash
sudo chmod +x /opt/backups/backup.sh
sudo crontab -e
```

Add this line for daily backups at 2 AM:
```
0 2 * * * /opt/backups/backup.sh
```

## ✅ **Post-Deployment Checklist**

- [ ] Application accessible via HTTPS
- [ ] Database connection working
- [ ] Login functionality working
- [ ] User management working
- [ ] Backup system configured
- [ ] Monitoring and logging set up
- [ ] Firewall configured
- [ ] SSL certificate installed
- [ ] Systemd service running
- [ ] Nginx reverse proxy working

## 🆘 **Troubleshooting**

### **Common Issues:**

1. **Application won't start:**
   ```bash
   sudo systemctl status shift-notes
   sudo journalctl -u shift-notes -f
   ```

2. **Database connection failed:**
   ```bash
   mysql -u shift_user -p shift_notes_db
   ```

3. **Nginx not serving:**
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   ```

4. **SSL certificate issues:**
   ```bash
   sudo certbot certificates
   sudo certbot renew --dry-run
   ```

## 📞 **Support**

For issues or questions:
1. Check application logs: `sudo journalctl -u shift-notes -f`
2. Check nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify database connection
4. Check firewall settings 