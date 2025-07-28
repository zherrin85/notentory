const mysql = require('mysql2/promise');
require('dotenv').config();

async function initializeDatabase() {
    let connection;
    
    try {
        // Create connection without database first
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'shift_user',
            password: process.env.DB_PASSWORD || 'Zd7010us',
            port: process.env.DB_PORT || 3306
        });

        console.log('🔌 Connected to MySQL server');

        // Create database if it doesn't exist
        await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'shift_notes_db'}`);
        console.log('🗄️ Database created/verified');

        // Use the database
        await connection.execute(`USE ${process.env.DB_NAME || 'shift_notes_db'}`);

        // Drop existing tables to start fresh
        console.log('🧹 Dropping existing tables...');
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        await connection.execute('DROP TABLE IF EXISTS activity_log');
        await connection.execute('DROP TABLE IF EXISTS inventory_transactions');
        await connection.execute('DROP TABLE IF EXISTS inventory_alerts');
        await connection.execute('DROP TABLE IF EXISTS file_attachments');
        await connection.execute('DROP TABLE IF EXISTS tasks');
        await connection.execute('DROP TABLE IF EXISTS shift_notes');
        await connection.execute('DROP TABLE IF EXISTS inventory');
        await connection.execute('DROP TABLE IF EXISTS users');
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

        // Create users table
        console.log('👥 Creating users table...');
        await connection.execute(`
            CREATE TABLE users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('user', 'manager', 'admin') DEFAULT 'user',
                active BOOLEAN DEFAULT TRUE,
                last_login DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Create inventory table
        console.log('📦 Creating inventory table...');
        await connection.execute(`
            CREATE TABLE inventory (
                id INT AUTO_INCREMENT PRIMARY KEY,
                part_number VARCHAR(100) NOT NULL,
                product_name VARCHAR(255) NOT NULL,
                description TEXT,
                vendor VARCHAR(255),
                location VARCHAR(100),
                quantity INT DEFAULT 0,
                min_quantity INT DEFAULT 0,
                unit_price DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Create shift_notes table
        console.log('📝 Creating shift_notes table...');
        await connection.execute(`
            CREATE TABLE shift_notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                date DATE NOT NULL,
                shift_type ENUM('day', 'evening', 'night', 'weekend') DEFAULT 'day',
                user_id INT NOT NULL,
                completed_audits JSON,
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_date (user_id, date)
            )
        `);

        // Create tasks table
        console.log('✅ Creating tasks table...');
        await connection.execute(`
            CREATE TABLE tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shift_note_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
                ticket_number VARCHAR(100),
                parts_used TEXT,
                blocker_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (shift_note_id) REFERENCES shift_notes(id) ON DELETE CASCADE
            )
        `);

        // Create file_attachments table
        console.log('📎 Creating file_attachments table...');
        await connection.execute(`
            CREATE TABLE file_attachments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shift_note_id INT,
                task_id INT,
                filename VARCHAR(255) NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size INT,
                mime_type VARCHAR(100),
                uploaded_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (shift_note_id) REFERENCES shift_notes(id) ON DELETE CASCADE,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Create inventory_transactions table
        console.log('🔄 Creating inventory_transactions table...');
        await connection.execute(`
            CREATE TABLE inventory_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                inventory_id INT NOT NULL,
                user_id INT NOT NULL,
                transaction_type ENUM('add', 'remove', 'adjust') NOT NULL,
                quantity_change INT NOT NULL,
                previous_quantity INT NOT NULL,
                new_quantity INT NOT NULL,
                reason TEXT,
                shift_note_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (shift_note_id) REFERENCES shift_notes(id) ON DELETE SET NULL
            )
        `);

        // Create inventory_alerts table
        console.log('⚠️ Creating inventory_alerts table...');
        await connection.execute(`
            CREATE TABLE inventory_alerts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                inventory_id INT NOT NULL,
                alert_type ENUM('low_stock', 'out_of_stock', 'expiring') NOT NULL,
                message TEXT NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP NULL,
                FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
            )
        `);

        // Create activity_log table
        console.log('📊 Creating activity_log table...');
        await connection.execute(`
            CREATE TABLE activity_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                action VARCHAR(100) NOT NULL,
                table_name VARCHAR(50),
                record_id INT,
                details JSON,
                ip_address VARCHAR(45),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Create default admin user
        console.log('👑 Creating default admin user...');
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        await connection.execute(`
            INSERT INTO users (name, email, password_hash, role) 
            VALUES ('Admin User', 'admin@shiftnotes.com', ?, 'admin')
            ON DUPLICATE KEY UPDATE password_hash = ?
        `, [hashedPassword, hashedPassword]);

        // Create some sample inventory items
        console.log('📦 Creating sample inventory items...');
        await connection.execute(`
            INSERT INTO inventory (part_number, product_name, description, vendor, location, quantity, min_quantity, unit_price) VALUES
            ('A3233-32', '9300-CX Switch', 'STS Crane Switch', 'Cisco Systems', '43-S4', 8, 2, 1500.00),
            ('B21223', 'SFP-DL-LC', 'SFP Module', 'Cisco Systems', '43-S4', 20, 5, 150.00),
            ('C12345', 'PowerEdge Server', 'Rack Server', 'Dell', 'DC-1', 3, 1, 2500.00)
        `);

        console.log('✅ Database initialization completed successfully!');
        console.log('🔑 Default admin credentials: admin@shiftnotes.com / admin123');

    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run if called directly
if (require.main === module) {
    initializeDatabase()
        .then(() => {
            console.log('🎉 Database setup complete!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Database setup failed:', error);
            process.exit(1);
        });
}

module.exports = { initializeDatabase }; 