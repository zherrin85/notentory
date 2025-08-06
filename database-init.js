// Database Initialization Script for Notentory
// This script sets up the database schema and initial data

const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'shift_notes_db',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

async function initializeDatabase() {
    let connection;
    
    try {
        console.log('🚀 Starting database initialization...');
        
        // Create connection
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Database connection established');
        
        // Create tables
        await createTables(connection);
        console.log('✅ Database tables created');
        
        // Insert initial data
        await insertInitialData(connection);
        console.log('✅ Initial data inserted');
        
        console.log('🎉 Database initialization completed successfully!');
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

async function createTables(connection) {
    const tables = [
        // Users table
        `CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('admin', 'manager', 'technician') DEFAULT 'technician',
            active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        
        // Shift notes table
        `CREATE TABLE IF NOT EXISTS shift_notes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            date DATE NOT NULL,
            shift_type ENUM('day', 'night', 'swing') NOT NULL,
            user_id INT NOT NULL,
            completed_audits JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
        
        // Tasks table
        `CREATE TABLE IF NOT EXISTS tasks (
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
        )`,
        
        // Inventory table
        `CREATE TABLE IF NOT EXISTS inventory (
            id INT AUTO_INCREMENT PRIMARY KEY,
            part_number VARCHAR(100) UNIQUE NOT NULL,
            product_name VARCHAR(255) NOT NULL,
            vendor VARCHAR(255),
            description TEXT,
            quantity INT DEFAULT 0,
            location VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        
        // Inventory transactions table
        `CREATE TABLE IF NOT EXISTS inventory_transactions (
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
        )`,
        
        // Activity log table
        `CREATE TABLE IF NOT EXISTS activity_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            action VARCHAR(100) NOT NULL,
            table_name VARCHAR(50) NOT NULL,
            record_id INT,
            details JSON,
            ip_address VARCHAR(45),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
        
        // File attachments table
        `CREATE TABLE IF NOT EXISTS file_attachments (
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
        )`,
        
        // Settings table
        `CREATE TABLE IF NOT EXISTS settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            setting_key VARCHAR(100) UNIQUE NOT NULL,
            setting_value TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`
    ];
    
    for (const table of tables) {
        await connection.execute(table);
    }
}

async function insertInitialData(connection) {
    const bcrypt = require('bcrypt');
    
    // Check if admin user already exists
    const [existingUsers] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE role = "admin"');
    
    if (existingUsers[0].count === 0) {
        // Create admin user
        const adminPassword = 'your_admin_password_here'; // Change this in production
        const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
        
        await connection.execute(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            ['Admin User', 'admin@shiftnotes.com', adminPasswordHash, 'admin']
        );
        
        console.log('🔑 Default admin credentials: admin@shiftnotes.com / your_admin_password_here');
        console.log('⚠️  IMPORTANT: Change the admin password after first login!');
    }
    
    // Insert default settings
    const defaultSettings = [
        ['backup_enabled', 'true'],
        ['backup_frequency', 'daily'],
        ['backup_time', '02:00'],
        ['backup_retention_days', '30']
    ];
    
    for (const [key, value] of defaultSettings) {
        await connection.execute(
            'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            [key, value, value]
        );
    }
}

// Run initialization if this script is executed directly
if (require.main === module) {
    initializeDatabase();
}

module.exports = { initializeDatabase }; 