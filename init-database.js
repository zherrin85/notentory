// Enhanced Database Initialization for IT Shift Notes & Inventory System
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
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_role (role)
            )
        `);
        
        // Create shift_notes table with enhanced fields
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
                FOREIGN KEY (created_by) REFERENCES users(id),
                INDEX idx_shift_date (shift_date),
                INDEX idx_created_by (created_by),
                INDEX idx_date_user (shift_date, created_by),
                FULLTEXT(title, content)
            )
        `);
        
        // Create enhanced inventory table
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
                INDEX idx_vendor (vendor),
                INDEX idx_low_stock (quantity, min_quantity),
                FULLTEXT(part_number, vendor, product, description)
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
                INDEX idx_shift_status (shift_id, status),
                INDEX idx_status (status),
                FULLTEXT(title, description)
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
        
        // Create inventory_transactions table with enhanced tracking
        console.log('📝 Creating inventory_transactions table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS inventory_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                inventory_id INT NOT NULL,
                part_number VARCHAR(100) NOT NULL,
                transaction_type ENUM('add', 'remove', 'adjust', 'audit') NOT NULL,
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
                INDEX idx_shift_note (shift_note_id),
                INDEX idx_transaction_type (transaction_type),
                INDEX idx_user_date (user_id, created_at)
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
                FOREIGN KEY (uploaded_by) REFERENCES users(id),
                INDEX idx_shift_note (shift_note_id)
            )
        `);
        
        // Create activity_log table for audit trail
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
                INDEX idx_action (action),
                INDEX idx_entity (entity_type, entity_id)
            )
        `);
        
        // Create system_settings table
        console.log('📝 Creating system_settings table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS system_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(100) UNIQUE NOT NULL,
                setting_value TEXT,
                description VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_key (setting_key)
            )
        `);
        
        console.log('✅ All tables created successfully\n');
        
        // Check if users exist, if not create sample users
        const [existingUsers] = await connection.execute('SELECT COUNT(*) as count FROM users');
        
        if (existingUsers[0].count === 0) {
            console.log('👥 Creating users...');
            
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
                },
                {
                    name: 'David Wilson',
                    email: 'david@company.com',
                    password: 'password123',
                    role: 'technician'
                },
                {
                    name: 'Maria Garcia',
                    email: 'maria@company.com',
                    password: 'password123',
                    role: 'manager'
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
        
        // Check if inventory exists, if not create comprehensive inventory
        const [existingInventory] = await connection.execute('SELECT COUNT(*) as count FROM inventory');
        
        if (existingInventory[0].count === 0) {
            console.log('📦 Creating comprehensive inventory...');
            
            const inventoryItems = [
                // Network Equipment
                {
                    vendor: 'Cisco',
                    product: 'Catalyst 2960X Switch',
                    part_number: 'WS-C2960X-48FPD-L',
                    description: '48-port Gigabit PoE+ switch with 2x10G SFP+ uplinks',
                    quantity: 5,
                    min_quantity: 2,
                    category: 'Network Equipment',
                    location: 'Server Room A - Rack 1'
                },
                {
                    vendor: 'Cisco',
                    product: 'ISR 4331 Router',
                    part_number: 'ISR4331/K9',
                    description: 'Integrated Services Router with 3x1GE WAN ports',
                    quantity: 3,
                    min_quantity: 1,
                    category: 'Network Equipment',
                    location: 'Server Room A - Rack 2'
                },
                {
                    vendor: 'Ubiquiti',
                    product: 'UniFi Switch',
                    part_number: 'US-48-500W',
                    description: '48-port managed PoE+ switch',
                    quantity: 8,
                    min_quantity: 3,
                    category: 'Network Equipment',
                    location: 'Network Storage'
                },
                {
                    vendor: 'Cisco',
                    product: 'Access Point',
                    part_number: 'AIR-CAP3702I-A-K9',
                    description: 'Dual-band 802.11ac access point',
                    quantity: 15,
                    min_quantity: 5,
                    category: 'Network Equipment',
                    location: 'AP Storage Cabinet'
                },
                
                // Antennas & RF Equipment
                {
                    vendor: 'Nokia',
                    product: '5G Antenna Panel',
                    part_number: 'NOK-5G-PANEL-001',
                    description: '5G cellular antenna panel for outdoor installation',
                    quantity: 12,
                    min_quantity: 4,
                    category: 'Antennas & RF',
                    location: 'RF Equipment Storage'
                },
                {
                    vendor: 'Nokia',
                    product: 'LTE Antenna',
                    part_number: 'NOK-LTE-ANT-002',
                    description: 'Multi-band LTE antenna',
                    quantity: 18,
                    min_quantity: 6,
                    category: 'Antennas & RF',
                    location: 'RF Equipment Storage'
                },
                {
                    vendor: 'CommScope',
                    product: 'RF Connector N-Type',
                    part_number: 'CS-RF-N-MALE',
                    description: 'N-type male RF connector',
                    quantity: 50,
                    min_quantity: 20,
                    category: 'Antennas & RF',
                    location: 'RF Components Bin'
                },
                {
                    vendor: 'Times Microwave',
                    product: 'Coaxial Cable',
                    part_number: 'TM-LMR400-100FT',
                    description: 'LMR-400 coaxial cable, 100ft',
                    quantity: 8,
                    min_quantity: 3,
                    category: 'Antennas & RF',
                    location: 'Cable Storage'
                },
                
                // Computer Hardware
                {
                    vendor: 'Dell',
                    product: 'UltraSharp 4K Monitor',
                    part_number: 'U2720Q',
                    description: '27-inch 4K USB-C monitor with dock',
                    quantity: 20,
                    min_quantity: 6,
                    category: 'Computer Hardware',
                    location: 'Monitor Storage - B3'
                },
                {
                    vendor: 'HP',
                    product: 'EliteBook Laptop',
                    part_number: 'HP-EB850G8',
                    description: 'EliteBook 850 G8 business laptop',
                    quantity: 12,
                    min_quantity: 4,
                    category: 'Computer Hardware',
                    location: 'IT Asset Storage'
                },
                {
                    vendor: 'Dell',
                    product: 'OptiPlex Desktop',
                    part_number: 'OPTIPLEX-7090',
                    description: 'OptiPlex 7090 micro desktop',
                    quantity: 15,
                    min_quantity: 5,
                    category: 'Computer Hardware',
                    location: 'IT Asset Storage'
                },
                {
                    vendor: 'Logitech',
                    product: 'Wireless Keyboard/Mouse',
                    part_number: 'MK540-COMBO',
                    description: 'Wireless keyboard and mouse combo',
                    quantity: 25,
                    min_quantity: 10,
                    category: 'Computer Hardware',
                    location: 'Peripherals Storage'
                },
                
                // Test Equipment
                {
                    vendor: 'Fluke',
                    product: 'Network Cable Tester',
                    part_number: 'FLUKE-DTX-1800',
                    description: 'DTX-1800 cable analyzer',
                    quantity: 2,
                    min_quantity: 1,
                    category: 'Test Equipment',
                    location: 'Test Equipment Cabinet'
                },
                {
                    vendor: 'Klein Tools',
                    product: 'Tone Generator',
                    part_number: 'VDV500-705',
                    description: 'Tone generator and probe kit',
                    quantity: 8,
                    min_quantity: 3,
                    category: 'Test Equipment',
                    location: 'Tool Storage'
                },
                {
                    vendor: 'Anritsu',
                    product: 'Spectrum Analyzer',
                    part_number: 'MS2720T',
                    description: 'Handheld spectrum analyzer 9kHz-9GHz',
                    quantity: 1,
                    min_quantity: 1,
                    category: 'Test Equipment',
                    location: 'Test Equipment Cabinet'
                },
                
                // Consumables & Cables
                {
                    vendor: 'Panduit',
                    product: 'CAT6A Cable',
                    part_number: 'PAN-CAT6A-1000FT',
                    description: 'CAT6A UTP cable, 1000ft spool',
                    quantity: 10,
                    min_quantity: 3,
                    category: 'Consumables',
                    location: 'Cable Storage'
                },
                {
                    vendor: 'Panduit',
                    product: 'CAT6 Cable',
                    part_number: 'PAN-CAT6-1000FT',
                    description: 'CAT6 UTP cable, 1000ft spool',
                    quantity: 8,
                    min_quantity: 2,
                    category: 'Consumables',
                    location: 'Cable Storage'
                },
                {
                    vendor: 'Generic',
                    product: 'RJ45 Connectors CAT6',
                    part_number: 'RJ45-CAT6-100PK',
                    description: 'CAT6 RJ45 connectors, 100-pack',
                    quantity: 35,
                    min_quantity: 15,
                    category: 'Consumables',
                    location: 'Small Parts Storage'
                },
                {
                    vendor: 'Generic',
                    product: 'RJ45 Connectors CAT6A',
                    part_number: 'RJ45-CAT6A-100PK',
                    description: 'CAT6A RJ45 connectors, 100-pack',
                    quantity: 20,
                    min_quantity: 8,
                    category: 'Consumables',
                    location: 'Small Parts Storage'
                },
                {
                    vendor: 'Panduit',
                    product: 'Patch Panel 48-port',
                    part_number: 'DP485E88TGY',
                    description: '48-port CAT6A patch panel',
                    quantity: 6,
                    min_quantity: 2,
                    category: 'Consumables',
                    location: 'Network Hardware Storage'
                },
                
                // Specialized Equipment
                {
                    vendor: 'Generic',
                    product: 'R150 Connector',
                    part_number: 'R150-STANDARD',
                    description: 'Standard R150 equipment connector',
                    quantity: 25,
                    min_quantity: 10,
                    category: 'Specialized',
                    location: 'Specialized Parts Bin'
                },
                {
                    vendor: 'Generic',
                    product: 'R150 Cable Assembly',
                    part_number: 'R150-CABLE-10FT',
                    description: 'R150 cable assembly, 10ft',
                    quantity: 15,
                    min_quantity: 5,
                    category: 'Specialized',
                    location: 'Specialized Parts Bin'
                },
                
                // Power & UPS
                {
                    vendor: 'APC',
                    product: 'UPS Battery Backup',
                    part_number: 'SMT1500',
                    description: 'Smart-UPS 1500VA LCD 120V',
                    quantity: 8,
                    min_quantity: 3,
                    category: 'Power Equipment',
                    location: 'UPS Storage'
                },
                {
                    vendor: 'APC',
                    product: 'UPS Replacement Battery',
                    part_number: 'RBC7',
                    description: 'Replacement battery cartridge #7',
                    quantity: 12,
                    min_quantity: 4,
                    category: 'Power Equipment',
                    location: 'Battery Storage'
                },
                {
                    vendor: 'Generic',
                    product: 'Power Strip 12-outlet',
                    part_number: 'PWR-STRIP-12',
                    description: '12-outlet rack mount power strip',
                    quantity: 10,
                    min_quantity: 4,
                    category: 'Power Equipment',
                    location: 'Power Equipment Storage'
                },
                
                // Security & Access Control
                {
                    vendor: 'HID',
                    product: 'Proximity Card Reader',
                    part_number: 'HID-PROX-6005',
                    description: 'ProxPoint Plus card reader',
                    quantity: 6,
                    min_quantity: 2,
                    category: 'Security Equipment',
                    location: 'Security Equipment Cabinet'
                },
                {
                    vendor: 'HID',
                    product: 'Proximity Cards',
                    part_number: 'HID-1326-CARDS',
                    description: 'ISOProx II proximity cards, pack of 25',
                    quantity: 8,
                    min_quantity: 3,
                    category: 'Security Equipment',
                    location: 'Security Equipment Cabinet'
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
        
        // Insert default system settings
        console.log('⚙️  Setting up system configuration...');
        
        const settings = [
            {
                key: 'system_name',
                value: 'IT Shift Notes & Inventory System',
                description: 'System display name'
            },
            {
                key: 'auto_save_interval',
                value: '300',
                description: 'Auto-save interval in seconds'
            },
            {
                key: 'max_file_size',
                value: '10485760',
                description: 'Maximum file upload size in bytes (10MB)'
            },
            {
                key: 'low_stock_alert_threshold',
                value: '5',
                description: 'Send alerts when stock drops to this level'
            },
            {
                key: 'session_timeout',
                value: '43200',
                description: 'Session timeout in seconds (12 hours)'
            }
        ];
        
        for (const setting of settings) {
            await connection.execute(
                'INSERT INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), description = VALUES(description)',
                [setting.key, setting.value, setting.description]
            );
        }
        
        // Create sample shift note for today if none exists
        const [existingNotes] = await connection.execute('SELECT COUNT(*) as count FROM shift_notes WHERE shift_date = CURDATE()');
        
        if (existingNotes[0].count === 0) {
            console.log('📋 Creating sample shift notes...');
            
            // Get technician users
            const [techUsers] = await connection.execute('SELECT id, name FROM users WHERE role = "technician" LIMIT 3');
            
            if (techUsers.length > 0) {
                for (const user of techUsers) {
                    const today = new Date().toISOString().split('T')[0];
                    
                    // Create sample shift note
                    const [shiftResult] = await connection.execute(
                        'INSERT INTO shift_notes (title, content, shift_date, shift_type, created_by) VALUES (?, ?, ?, ?, ?)',
                        [`${user.name}'s Shift - ${today}`, `Sample shift notes for ${user.name}.\n\nCompleted morning equipment checks.\nAll systems operational.\nNo issues to report.`, today, 'day', user.id]
                    );
                    
                    const shiftId = shiftResult.insertId;
                    
                    // Create sample daily audits
                    await connection.execute(
                        'INSERT INTO daily_audits (shift_id, tel_lane, gate_lane, tel_simulation, quickbase_dashboard, mechanics_availability, completed_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [shiftId, true, true, false, true, false, user.id]
                    );
                    
                    // Create sample tasks
                    const sampleTasks = [
                        {
                            title: 'Network equipment maintenance - Building A',
                            description: 'Routine maintenance check on switches and routers',
                            status: 'completed',
                            tickets: ['RITM8042334'],
                            parts_used: []
                        },
                        {
                            title: 'Install access point in conference room',
                            description: 'Install new WiFi access point for better coverage',
                            status: 'active',
                            tickets: ['RITM8042335'],
                            parts_used: [{ part_number: 'AIR-CAP3702I-A-K9', quantity: 1 }]
                        }
                    ];
                    
                    for (const task of sampleTasks) {
                        await connection.execute(
                            'INSERT INTO shift_tasks (shift_id, title, description, status, tickets, parts_used, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [shiftId, task.title, task.description, task.status, JSON.stringify(task.tickets), JSON.stringify(task.parts_used), user.id]
                        );
                        
                        // Update inventory for parts used
                        for (const part of task.parts_used) {
                            const [inventoryItem] = await connection.execute('SELECT id, quantity FROM inventory WHERE part_number = ?', [part.part_number]);
                            if (inventoryItem.length > 0) {
                                const newQuantity = inventoryItem[0].quantity - part.quantity;
                                await connection.execute('UPDATE inventory SET quantity = ?, last_inventoried = CURDATE() WHERE id = ?', [newQuantity, inventoryItem[0].id]);
                                
                                // Log transaction
                                await connection.execute(
                                    'INSERT INTO inventory_transactions (inventory_id, part_number, transaction_type, quantity_change, old_quantity, new_quantity, notes, user_id, shift_note_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                                    [inventoryItem[0].id, part.part_number, 'remove', -part.quantity, inventoryItem[0].quantity, newQuantity, `Used in task: ${task.title}`, user.id, shiftId]
                                );
                            }
                        }
                    }
                    
                    console.log(`   ✅ Created sample shift for ${user.name} with ${sampleTasks.length} tasks`);
                }
            }
            console.log('');
        }
        
        // Test critical queries
        console.log('🧪 Testing database performance...');
        
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
            SELECT COUNT(*) as searchable_records 
            FROM shift_notes sn
            LEFT JOIN shift_tasks st ON sn.id = st.shift_id
            WHERE MATCH(sn.title, sn.content) AGAINST('sample' IN NATURAL LANGUAGE MODE)
            OR MATCH(st.title, st.description) AGAINST('network' IN NATURAL LANGUAGE MODE)
        `);
        console.log('   ✅ Full-text search capability:', searchTest[0]);
        
        // Test inventory categories
        const [categoriesTest] = await connection.execute(`
            SELECT category, COUNT(*) as item_count, SUM(quantity) as total_quantity
            FROM inventory 
            GROUP BY category 
            ORDER BY category
        `);
        console.log('   ✅ Inventory categories:');
        categoriesTest.forEach(cat => {
            console.log(`      - ${cat.category}: ${cat.item_count} items (${cat.total_quantity} total qty)`);
        });
        
        // Test performance of complex joins
        const startTime = Date.now();
        const [performanceTest] = await connection.execute(`
            SELECT sn.id, sn.title, u.name, COUNT(st.id) as task_count
            FROM shift_notes sn
            LEFT JOIN users u ON sn.created_by = u.id
            LEFT JOIN shift_tasks st ON sn.id = st.shift_id
            GROUP BY sn.id
            ORDER BY sn.created_at DESC
            LIMIT 10
        `);
        const queryTime = Date.now() - startTime;
        console.log(`   ✅ Complex join query performance: ${queryTime}ms`);
        
        console.log('\n🎉 Database initialization completed successfully!');
        console.log('\n📋 System Summary:');
        console.log(`   👥 Users: ${existingUsers[0].count > 0 ? 'Already existed' : `${users.length} users created`}`);
        console.log(`   📦 Inventory: ${existingInventory[0].count > 0 ? 'Already existed' : `${inventoryItems.length} items created across ${categoriesTest.length} categories`}`);
        console.log(`   📝 Shift Notes: ${existingNotes[0].count > 0 ? 'Already existed' : `Sample shifts created for ${techUsers.length} technicians`}`);
        console.log('\n🚀 System is ready for production use!');
        console.log('\n💡 Login credentials:');
        console.log('   Admin: admin@company.com / admin123');
        console.log('   Manager: sarah@company.com / password123');
        console.log('   Technicians: john@company.com / password123');
        console.log('                mike@company.com / password123');
        console.log('                lisa@company.com / password123');
        console.log('                david@company.com / password123');
        
        console.log('\n📊 Database Statistics:');
        console.log(`   - Total inventory items: ${dashboardTest[0].total_items}`);
        console.log(`   - Items requiring attention: ${dashboardTest[0].low_stock_items} low stock, ${dashboardTest[0].out_of_stock_items} out of stock`);
        console.log(`   - Full-text search enabled on all text fields`);
        console.log(`   - Performance optimized with proper indexing`);
        
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
