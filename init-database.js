// Complete Database Initialization for Enhanced IT Shift Notes & Inventory System
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function initializeCompleteDatabase() {
    console.log('🚀 Setting up Enhanced IT Shift Notes & Inventory Database...\n');
    
    const connection = await mysql.createConnection({
        host: '127.0.0.1',
        user: 'shiftnotes_user',
        password: 'Zd7010us',
        database: 'shift_inventory_system'
    });
    
    console.log('✅ Database connected successfully\n');
    
    try {
        // Create users table
        console.log('📝 Creating users table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(150) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('admin', 'manager', 'technician') DEFAULT 'technician',
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        
        // Create shift_notes table
        console.log('📝 Creating shift_notes table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS shift_notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                content TEXT,
                shift_date DATE NOT NULL,
                shift_type ENUM('day', 'evening', 'night', 'weekend') DEFAULT 'day',
                created_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )
        `);
        
        // Create enhanced inventory table with categories
        console.log('📝 Creating inventory table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS inventory (
                id INT AUTO_INCREMENT PRIMARY KEY,
                vendor VARCHAR(100) NOT NULL,
                product VARCHAR(200) NOT NULL,
                part_number VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                quantity INT DEFAULT 0,
                min_quantity INT DEFAULT 0,
                category VARCHAR(100) DEFAULT 'Uncategorized',
                location VARCHAR(200),
                last_inventoried DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_part_number (part_number),
                INDEX idx_category (category),
                INDEX idx_vendor (vendor)
            )
        `);
        
        // Create shift_tasks table for task management
        console.log('📝 Creating shift_tasks table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS shift_tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shift_id INT NOT NULL,
                title VARCHAR(200) NOT NULL,
                description TEXT,
                status ENUM('active', 'blocked', 'completed') DEFAULT 'active',
                blocker_reason VARCHAR(500),
                tickets JSON,
                parts_used JSON,
                created_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (shift_id) REFERENCES shift_notes(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES users(id),
                INDEX idx_shift_status (shift_id, status)
            )
        `);
        
        // Create daily_audits table
        console.log('📝 Creating daily_audits table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS daily_audits (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shift_id INT NOT NULL UNIQUE,
                tel_lane BOOLEAN DEFAULT FALSE,
                gate_lane BOOLEAN DEFAULT FALSE,
                tel_simulation BOOLEAN DEFAULT FALSE,
                quickbase_dashboard BOOLEAN DEFAULT FALSE,
                mechanics_availability BOOLEAN DEFAULT FALSE,
                completed_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (shift_id) REFERENCES shift_notes(id) ON DELETE CASCADE,
                FOREIGN KEY (completed_by) REFERENCES users(id)
            )
        `);
        
        // Create inventory_transactions table
        console.log('📝 Creating inventory_transactions table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS inventory_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                inventory_id INT NOT NULL,
                part_number VARCHAR(100) NOT NULL,
                transaction_type ENUM('add', 'remove', 'adjust') NOT NULL,
                quantity_change INT NOT NULL,
                old_quantity INT NOT NULL,
                new_quantity INT NOT NULL,
                notes TEXT,
                user_id INT NOT NULL,
                shift_note_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (inventory_id) REFERENCES inventory(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (shift_note_id) REFERENCES shift_notes(id),
                INDEX idx_part_date (part_number, created_at),
                INDEX idx_shift_note (shift_note_id)
            )
        `);
        
        // Create file_attachments table
        console.log('📝 Creating file_attachments table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS file_attachments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                original_filename VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size INT NOT NULL,
                mime_type VARCHAR(100) NOT NULL,
                shift_note_id INT,
                uploaded_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (shift_note_id) REFERENCES shift_notes(id) ON DELETE CASCADE,
                FOREIGN KEY (uploaded_by) REFERENCES users(id)
            )
        `);
        
        // Create activity_log table
        console.log('📝 Creating activity_log table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS activity_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                action VARCHAR(100) NOT NULL,
                entity_type ENUM('shift_note', 'inventory', 'user', 'file', 'task', 'audit') NOT NULL,
                entity_id INT,
                details JSON,
                ip_address VARCHAR(45),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                INDEX idx_user_date (user_id, created_at),
                INDEX idx_action (action)
            )
        `);
        
        console.log('✅ All tables created successfully\n');
        
        // Check if users exist, if not create sample users
        const [existingUsers] = await connection.execute('SELECT COUNT(*) as count FROM users');
        
        if (existingUsers[0].count === 0) {
            console.log('👥 Creating sample users...');
            
            const users = [
                {
                    name: 'System Administrator',
                    email: 'admin@company.com',
                    password: 'admin123',
                    role: 'admin'
                },
                {
                    name: 'John Smith',
                    email: 'john@company.com',
                    password: 'password123',
                    role: 'technician'
                },
                {
                    name: 'Sarah Johnson',
                    email: 'sarah@company.com',
                    password: 'password123',
                    role: 'manager'
                },
                {
                    name: 'Mike Davis',
                    email: 'mike@company.com',
                    password: 'password123',
                    role: 'technician'
                },
                {
                    name: 'Lisa Chen',
                    email: 'lisa@company.com',
                    password: 'password123',
                    role: 'technician'
                }
            ];
            
            for (const user of users) {
                const passwordHash = await bcrypt.hash(user.password, 12);
                await connection.execute(
                    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
                    [user.name, user.email, passwordHash, user.role]
                );
                console.log(`   ✅ Created user: ${user.name} (${user.email}) - ${user.role}`);
            }
            console.log('');
        }
        
        // Check if inventory exists, if not create sample inventory with categories
        const [existingInventory] = await connection.execute('SELECT COUNT(*) as count FROM inventory');
        
        if (existingInventory[0].count === 0) {
            console.log('📦 Creating sample inventory with categories...');
            
            const inventoryItems = [
                // Network Equipment
                {
                    vendor: 'Cisco',
                    product: 'Catalyst Switch',
                    part_number: 'CSC-2960X-48',
                    description: '48-port Gigabit switch with PoE+',
                    quantity: 5,
                    min_quantity: 2,
                    category: 'Network Equipment',
                    location: 'Server Room A - Rack 1'
                },
                {
                    vendor: 'Cisco',
                    product: 'Router',
                    part_number: 'CSC-ISR4331',
                    description: 'Integrated Services Router',
                    quantity: 3,
                    min_quantity: 1,
                    category: 'Network Equipment',
                    location: 'Server Room A - Rack 2'
                },
                
                // Antennas & RF
                {
                    vendor: 'Nokia',
                    product: '5G Antenna',
                    part_number: 'NOK-5G-001',
                    description: '5G cellular antenna for outdoor use',
                    quantity: 8,
                    min_quantity: 3,
                    category: 'Antennas & RF',
                    location: 'RF Equipment Storage'
                },
                {
                    vendor: 'Nokia',
                    product: 'RF Connector',
                    part_number: 'NOK-RF-CONN-N',
                    description: 'N-type RF connector',
                    quantity: 25,
                    min_quantity: 10,
                    category: 'Antennas & RF',
                    location: 'RF Equipment Storage'
                },
                
                // Computer Hardware
                {
                    vendor: 'Dell',
                    product: '4K Monitor',
                    part_number: 'DELL-U2720Q',
                    description: '27-inch 4K USB-C monitor',
                    quantity: 12,
                    min_quantity: 4,
                    category: 'Computer Hardware',
                    location: 'Warehouse B - Shelf 3'
                },
                {
                    vendor: 'HP',
                    product: 'Business Laptop',
                    part_number: 'HP-PB450G9',
                    description: 'ProBook 450 G9 laptop',
                    quantity: 8,
                    min_quantity: 3,
                    category: 'Computer Hardware',
                    location: 'IT Storage Cabinet'
                },
                
                // Test Equipment
                {
                    vendor: 'Fluke',
                    product: 'Network Tester',
                    part_number: 'FLUKE-NT-Pro',
                    description: 'Professional network cable tester',
                    quantity: 4,
                    min_quantity: 2,
                    category: 'Test Equipment',
                    location: 'Tool Storage'
                },
                {
                    vendor: 'Generic',
                    product: 'Test Cable',
                    part_number: 'TEST-CAT6-3FT',
                    description: '3ft CAT6 test cable',
                    quantity: 15,
                    min_quantity: 5,
                    category: 'Test Equipment',
                    location: 'Tool Storage'
                },
                
                // Consumables
                {
                    vendor: 'Panduit',
                    product: 'CAT6 Cable',
                    part_number: 'PAN-CAT6-1000FT',
                    description: '1000ft CAT6 cable spool',
                    quantity: 6,
                    min_quantity: 2,
                    category: 'Consumables',
                    location: 'Cable Storage'
                },
                {
                    vendor: 'Generic',
                    product: 'RJ45 Connectors',
                    part_number: 'RJ45-CAT6-100PK',
                    description: 'CAT6 RJ45 connectors, 100-pack',
                    quantity: 20,
                    min_quantity: 8,
                    category: 'Consumables',
                    location: 'Small Parts Storage'
                },
                {
                    vendor: 'Generic',
                    product: 'R150 Connector',
                    part_number: 'R150-CONN',
                    description: 'R150 equipment connector',
                    quantity: 12,
                    min_quantity: 5,
                    category: 'Consumables',
                    location: 'Small Parts Storage'
                }
            ];
            
            for (const item of inventoryItems) {
                await connection.execute(
                    'INSERT INTO inventory (vendor, product, part_number, description, quantity, min_quantity, category, location, last_inventoried) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())',
                    [item.vendor, item.product, item.part_number, item.description, item.quantity, item.min_quantity, item.category, item.location]
                );
                console.log(`   ✅ Added: ${item.part_number} - ${item.vendor} ${item.product} (${item.quantity})`);
            }
            console.log('');
        }
        
        // Create sample shift note and tasks for testing
        const [existingNotes] = await connection.execute('SELECT COUNT(*) as count FROM shift_notes');
        
        if (existingNotes[0].count === 0) {
            console.log('📋 Creating sample shift note and tasks...');
            
            // Get the first technician user
            const [techUsers] = await connection.execute('SELECT id FROM users WHERE role = "technician" LIMIT 1');
            
            if (techUsers.length > 0) {
                const userId = techUsers[0].id;
                const today = new Date().toISOString().split('T')[0];
                
                // Create sample shift note
                const [shiftResult] = await connection.execute(
                    'INSERT INTO shift_notes (title, content, shift_date, shift_type, created_by) VALUES (?, ?, ?, ?, ?)',
                    [`Sample Shift - ${today}`, 'This is a sample shift note for testing the enhanced system.', today, 'day', userId]
                );
                
                const shiftId = shiftResult.insertId;
                
                // Create sample daily audits
                await connection.execute(
                    'INSERT INTO daily_audits (shift_id, tel_lane, gate_lane, tel_simulation, quickbase_dashboard, mechanics_availability, completed_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [shiftId, true, true, true, false, false, userId]
                );
                
                // Create sample tasks
                const sampleTasks = [
                    {
                        title: 'Antenna installation for Sean',
                        description: 'Install 5G antenna at the specified location',
                        status: 'completed',
                        tickets: ['RITM8042334'],
                        parts_used: [{ part_number: 'NOK-5G-001', quantity: 1 }]
                    },
                    {
                        title: 'Network diagnostics - Server Room A',
                        description: 'Investigate connectivity issues',
                        status: 'active',
                        tickets: ['RITM8042335'],
                        parts_used: []
                    },
                    {
                        title: 'R150 connector installation',
                        description: 'Install connector - waiting for safety partner',
                        status: 'blocked',
                        blocker_reason: '👥 Need additional person',
                        tickets: [],
                        parts_used: []
                    }
                ];
                
                for (const task of sampleTasks) {
                    await connection.execute(
                        'INSERT INTO shift_tasks (shift_id, title, description, status, blocker_reason, tickets, parts_used, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [shiftId, task.title, task.description, task.status, task.blocker_reason || null, JSON.stringify(task.tickets), JSON.stringify(task.parts_used), userId]
                    );
                    
                    // Update inventory for parts used
                    for (const part of task.parts_used) {
                        const [inventoryItem] = await connection.execute('SELECT id, quantity FROM inventory WHERE part_number = ?', [part.part_number]);
                        if (inventoryItem.length > 0) {
                            const newQuantity = inventoryItem[0].quantity - part.quantity;
                            await connection.execute('UPDATE inventory SET quantity = ? WHERE id = ?', [newQuantity, inventoryItem[0].id]);
                            
                            // Log transaction
                            await connection.execute(
                                'INSERT INTO inventory_transactions (inventory_id, part_number, transaction_type, quantity_change, old_quantity, new_quantity, notes, user_id, shift_note_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                                [inventoryItem[0].id, part.part_number, 'remove', -part.quantity, inventoryItem[0].quantity, newQuantity, `Used in task: ${task.title}`, userId, shiftId]
                            );
                        }
                    }
                }
                
                console.log(`   ✅ Created sample shift with ${sampleTasks.length} tasks`);
                console.log('');
            }
        }
        
        // Test queries to ensure everything works
        console.log('🧪 Testing database queries...');
        
        // Test dashboard query
        const [dashboardTest] = await connection.execute(`
            SELECT 
                COUNT(*) as total_items,
                COALESCE(SUM(quantity), 0) as total_quantity,
                COUNT(CASE WHEN quantity <= min_quantity THEN 1 END) as low_stock_items,
                COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_items
            FROM inventory
        `);
        console.log('   ✅ Dashboard query:', dashboardTest[0]);
        
        // Test search functionality
        const [searchTest] = await connection.execute(`
            SELECT COUNT(*) as searchable_notes FROM shift_notes sn
            LEFT JOIN shift_tasks st ON sn.id = st.shift_id
            WHERE sn.title LIKE '%sample%' OR st.title LIKE '%antenna%'
        `);
        console.log('   ✅ Search functionality:', searchTest[0]);
        
        // Test inventory categories
        const [categoriesTest] = await connection.execute(`
            SELECT category, COUNT(*) as item_count 
            FROM inventory 
            GROUP BY category 
            ORDER BY category
        `);
        console.log('   ✅ Inventory categories:');
        categoriesTest.forEach(cat => {
            console.log(`      - ${cat.category}: ${cat.item_count} items`);
        });
        
        console.log('\n🎉 Database initialization completed successfully!');
        console.log('\n📋 Summary:');
        console.log(`   👥 Users: ${existingUsers[0].count > 0 ? 'Already existed' : '5 sample users created'}`);
        console.log(`   📦 Inventory: ${existingInventory[0].count > 0 ? 'Already existed' : inventoryItems.length + ' items created with categories'}`);
        console.log(`   📝 Shift Notes: ${existingNotes[0].count > 0 ? 'Already existed' : 'Sample shift with tasks created'}`);
        console.log('\n🚀 System is ready for testing!');
        console.log('\n💡 Login credentials:');
        console.log('   Admin: admin@company.com / admin123');
        console.log('   Manager: sarah@company.com / password123');
        console.log('   Technician: john@company.com / password123');
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

// Run initialization if called directly
if (require.main === module) {
    initializeCompleteDatabase().catch(console.error);
}

module.exports = initializeCompleteDatabase;
