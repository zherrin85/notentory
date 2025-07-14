// Enhanced Database Initialization for IT Shift Notes & Inventory System
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function initializeEnhancedDatabase() {
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
        
        // Enhanced shift_notes table with submission tracking
        console.log('📝 Creating enhanced shift_notes table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS shift_notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                content TEXT,
                shift_date DATE NOT NULL,
                shift_type ENUM('day', 'evening', 'night', 'weekend') DEFAULT 'day',
                submitted BOOLEAN DEFAULT FALSE,
                submitted_at TIMESTAMP NULL,
                created_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id),
                INDEX idx_shift_date (shift_date),
                INDEX idx_created_by (created_by),
                INDEX idx_submitted (submitted),
                INDEX idx_date_user (shift_date, created_by),
                FULLTEXT(title, content)
            )
        `);
        
        // Enhanced inventory table with better tracking
        console.log('📝 Creating enhanced inventory table...');
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
                cost_per_unit DECIMAL(10,2) DEFAULT 0.00,
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
        
        // Enhanced shift_tasks table with better file support
        console.log('📝 Creating enhanced shift_tasks table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS shift_tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shift_id INT NOT NULL,
                title VARCHAR(200) NOT NULL,
                description TEXT,
                status ENUM('active', 'blocked', 'completed') DEFAULT 'active',
                priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
                blocker_reason VARCHAR(500),
                tickets JSON,
                parts_used JSON,
                estimated_hours DECIMAL(4,2) DEFAULT 0.00,
                actual_hours DECIMAL(4,2) DEFAULT 0.00,
                created_by INT NOT NULL,
                assigned_to INT,
                completed_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (shift_id) REFERENCES shift_notes(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES users(id),
                FOREIGN KEY (assigned_to) REFERENCES users(id),
                INDEX idx_shift_status (shift_id, status),
                INDEX idx_status (status),
                INDEX idx_priority (priority),
                INDEX idx_assigned (assigned_to),
                FULLTEXT(title, description)
            )
        `);
        
        // Enhanced file_attachments table for task files
        console.log('📝 Creating enhanced file_attachments table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS file_attachments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                original_filename VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size INT NOT NULL,
                mime_type VARCHAR(100) NOT NULL,
                file_hash VARCHAR(64),
                task_id INT,
                shift_note_id INT,
                uploaded_by INT NOT NULL,
                is_image BOOLEAN DEFAULT FALSE,
                thumbnail_path VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES shift_tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (shift_note_id) REFERENCES shift_notes(id) ON DELETE CASCADE,
                FOREIGN KEY (uploaded_by) REFERENCES users(id),
                INDEX idx_task_id (task_id),
                INDEX idx_shift_note (shift_note_id),
                INDEX idx_uploaded_by (uploaded_by)
            )
        `);
        
        // Daily audits table
        console.log('📝 Creating daily_audits table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS daily_audits (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shift_id INT NOT NULL UNIQUE,
                tel_lane BOOLEAN DEFAULT FALSE,
                tel_lane_completed_at TIMESTAMP NULL,
                gate_lane BOOLEAN DEFAULT FALSE,
                gate_lane_completed_at TIMESTAMP NULL,
                tel_simulation BOOLEAN DEFAULT FALSE,
                tel_simulation_completed_at TIMESTAMP NULL,
                quickbase_dashboard BOOLEAN DEFAULT FALSE,
                quickbase_dashboard_completed_at TIMESTAMP NULL,
                mechanics_availability BOOLEAN DEFAULT FALSE,
                mechanics_availability_completed_at TIMESTAMP NULL,
                completed_by INT NOT NULL,
                completion_percentage DECIMAL(5,2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (shift_id) REFERENCES shift_notes(id) ON DELETE CASCADE,
                FOREIGN KEY (completed_by) REFERENCES users(id)
            )
        `);
        
        // Enhanced inventory_transactions table
        console.log('📝 Creating enhanced inventory_transactions table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS inventory_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                inventory_id INT NOT NULL,
                part_number VARCHAR(100) NOT NULL,
                transaction_type ENUM('add', 'remove', 'adjust', 'audit', 'transfer') NOT NULL,
                quantity_change INT NOT NULL,
                old_quantity INT NOT NULL,
                new_quantity INT NOT NULL,
                unit_cost DECIMAL(10,2) DEFAULT 0.00,
                total_cost DECIMAL(12,2) DEFAULT 0.00,
                notes TEXT,
                reference_number VARCHAR(100),
                user_id INT NOT NULL,
                shift_note_id INT,
                task_id INT,
                approved_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (inventory_id) REFERENCES inventory(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (shift_note_id) REFERENCES shift_notes(id),
                FOREIGN KEY (task_id) REFERENCES shift_tasks(id),
                FOREIGN KEY (approved_by) REFERENCES users(id),
                INDEX idx_part_date (part_number, created_at),
                INDEX idx_shift_note (shift_note_id),
                INDEX idx_task_id (task_id),
                INDEX idx_transaction_type (transaction_type),
                INDEX idx_user_date (user_id, created_at)
            )
        `);
        
        // Enhanced activity_log table
        console.log('📝 Creating enhanced activity_log table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS activity_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                action VARCHAR(100) NOT NULL,
                entity_type ENUM('shift_note', 'inventory', 'user', 'file', 'task', 'audit') NOT NULL,
                entity_id INT,
                details JSON,
                ip_address VARCHAR(45),
                user_agent VARCHAR(500),
                session_id VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                INDEX idx_user_date (user_id, created_at),
                INDEX idx_action (action),
                INDEX idx_entity (entity_type, entity_id),
                INDEX idx_session (session_id)
            )
        `);
        
        // System settings table
        console.log('📝 Creating system_settings table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS system_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(100) UNIQUE NOT NULL,
                setting_value TEXT,
                setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
                description VARCHAR(255),
                category VARCHAR(50) DEFAULT 'general',
                is_public BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_key (setting_key),
                INDEX idx_category (category)
            )
        `);
        
        // Inventory alerts table
        console.log('📝 Creating inventory_alerts table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS inventory_alerts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                inventory_id INT NOT NULL,
                alert_type ENUM('low_stock', 'out_of_stock', 'high_usage', 'no_movement') NOT NULL,
                alert_level ENUM('info', 'warning', 'critical') DEFAULT 'warning',
                message TEXT NOT NULL,
                is_acknowledged BOOLEAN DEFAULT FALSE,
                acknowledged_by INT,
                acknowledged_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
                FOREIGN KEY (acknowledged_by) REFERENCES users(id),
                INDEX idx_inventory_type (inventory_id, alert_type),
                INDEX idx_acknowledged (is_acknowledged),
                INDEX idx_created (created_at)
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
                },
                {
                    name: 'Robert Johnson',
                    email: 'robert@company.com',
                    password: 'password123',
                    role: 'technician'
                },
                {
                    name: 'Jennifer Brown',
                    email: 'jennifer@company.com',
                    password: 'password123',
                    role: 'technician'
                },
                {
                    name: 'Michael Davis',
                    email: 'michael@company.com',
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
        
        // Check if inventory exists, if not create comprehensive inventory
        const [existingInventory] = await connection.execute('SELECT COUNT(*) as count FROM inventory');
        
        if (existingInventory[0].count === 0) {
            console.log('📦 Creating comprehensive inventory...');
            
            const inventoryItems = [
                // Network Equipment
                {
                    vendor: 'Cisco',
                    product: 'Catalyst 2960X Switch 48-Port',
                    part_number: 'WS-C2960X-48FPD-L',
                    description: '48-port Gigabit PoE+ switch with 2x10G SFP+ uplinks for network infrastructure',
                    quantity: 5,
                    min_quantity: 2,
                    category: 'Network Equipment',
                    location: 'Server Room A - Rack 1',
                    cost_per_unit: 2450.00
                },
                {
                    vendor: 'Cisco',
                    product: 'ISR 4331 Integrated Services Router',
                    part_number: 'ISR4331/K9',
                    description: 'Enterprise router with 3x1GE WAN ports and advanced security features',
                    quantity: 3,
                    min_quantity: 1,
                    category: 'Network Equipment',
                    location: 'Server Room A - Rack 2',
                    cost_per_unit: 3200.00
                },
                {
                    vendor: 'Ubiquiti',
                    product: 'UniFi Switch Pro 48-Port PoE',
                    part_number: 'US-48-500W',
                    description: '48-port managed PoE+ switch with advanced management features',
                    quantity: 8,
                    min_quantity: 3,
                    category: 'Network Equipment',
                    location: 'Network Storage Cabinet',
                    cost_per_unit: 899.00
                },
                {
                    vendor: 'Cisco',
                    product: 'Aironet 3700 Series Access Point',
                    part_number: 'AIR-CAP3702I-A-K9',
                    description: 'High-performance dual-band 802.11ac access point for enterprise deployment',
                    quantity: 15,
                    min_quantity: 5,
                    category: 'Network Equipment',
                    location: 'AP Storage Cabinet',
                    cost_per_unit: 645.00
                },
                {
                    vendor: 'Juniper',
                    product: 'EX2300 Ethernet Switch',
                    part_number: 'EX2300-24T',
                    description: '24-port Gigabit Ethernet switch with advanced Layer 3 features',
                    quantity: 6,
                    min_quantity: 2,
                    category: 'Network Equipment',
                    location: 'Network Storage Cabinet',
                    cost_per_unit: 1250.00
                },
                
                // Antennas & RF Equipment
                {
                    vendor: 'Nokia',
                    product: '5G mmWave Antenna Panel',
                    part_number: 'NOK-5G-PANEL-001',
                    description: 'High-gain 5G cellular antenna panel for outdoor installation and coverage',
                    quantity: 12,
                    min_quantity: 4,
                    category: 'Antennas & RF',
                    location: 'RF Equipment Storage',
                    cost_per_unit: 1850.00
                },
                {
                    vendor: 'Nokia',
                    product: 'Multi-Band LTE Antenna',
                    part_number: 'NOK-LTE-ANT-002',
                    description: 'Wideband LTE antenna supporting multiple frequency bands',
                    quantity: 18,
                    min_quantity: 6,
                    category: 'Antennas & RF',
                    location: 'RF Equipment Storage',
                    cost_per_unit: 425.00
                },
                {
                    vendor: 'CommScope',
                    product: 'N-Type Male RF Connector',
                    part_number: 'CS-RF-N-MALE',
                    description: 'Professional grade N-type male RF connector for coaxial connections',
                    quantity: 50,
                    min_quantity: 20,
                    category: 'Antennas & RF',
                    location: 'RF Components Bin A',
                    cost_per_unit: 12.50
                },
                {
                    vendor: 'Times Microwave',
                    product: 'LMR-400 Coaxial Cable',
                    part_number: 'TM-LMR400-100FT',
                    description: 'Low-loss LMR-400 coaxial cable, 100ft spool for RF applications',
                    quantity: 8,
                    min_quantity: 3,
                    category: 'Antennas & RF',
                    location: 'Cable Storage Room',
                    cost_per_unit: 285.00
                },
                {
                    vendor: 'Andrew/CommScope',
                    product: 'Sector Antenna 2.4/5GHz',
                    part_number: 'AND-SECTOR-245',
                    description: 'Dual-band sector antenna for wireless coverage applications',
                    quantity: 10,
                    min_quantity: 3,
                    category: 'Antennas & RF',
                    location: 'RF Equipment Storage',
                    cost_per_unit: 320.00
                },
                
                // Computer Hardware
                {
                    vendor: 'Dell',
                    product: 'UltraSharp 4K USB-C Monitor',
                    part_number: 'U2720Q',
                    description: '27-inch 4K IPS monitor with USB-C dock and advanced color accuracy',
                    quantity: 20,
                    min_quantity: 6,
                    category: 'Computer Hardware',
                    location: 'Monitor Storage - Building B Level 3',
                    cost_per_unit: 589.00
                },
                {
                    vendor: 'HP',
                    product: 'EliteBook 850 G8 Laptop',
                    part_number: 'HP-EB850G8',
                    description: 'Business-class laptop with Intel i7, 16GB RAM, 512GB SSD',
                    quantity: 12,
                    min_quantity: 4,
                    category: 'Computer Hardware',
                    location: 'IT Asset Storage Room',
                    cost_per_unit: 1450.00
                },
                {
                    vendor: 'Dell',
                    product: 'OptiPlex 7090 Micro Desktop',
                    part_number: 'OPTIPLEX-7090',
                    description: 'Compact business desktop with Intel i5, 8GB RAM, 256GB SSD',
                    quantity: 15,
                    min_quantity: 5,
                    category: 'Computer Hardware',
                    location: 'IT Asset Storage Room',
                    cost_per_unit: 899.00
                },
                {
                    vendor: 'Logitech',
                    product: 'MK540 Wireless Combo',
                    part_number: 'MK540-COMBO',
                    description: 'Wireless keyboard and mouse combo with long battery life',
                    quantity: 25,
                    min_quantity: 10,
                    category: 'Computer Hardware',
                    location: 'Peripherals Storage Cabinet',
                    cost_per_unit: 45.00
                },
                {
                    vendor: 'Lenovo',
                    product: 'ThinkPad T14 Gen 3',
                    part_number: 'LEN-T14G3',
                    description: 'Professional laptop with AMD Ryzen 7, 16GB RAM, 512GB SSD',
                    quantity: 8,
                    min_quantity: 3,
                    category: 'Computer Hardware',
                    location: 'IT Asset Storage Room',
                    cost_per_unit: 1325.00
                },
                
                // Test Equipment
                {
                    vendor: 'Fluke',
                    product: 'DTX-1800 Cable Analyzer',
                    part_number: 'FLUKE-DTX-1800',
                    description: 'Professional cable tester supporting Cat 6A/Class EA testing',
                    quantity: 2,
                    min_quantity: 1,
                    category: 'Test Equipment',
                    location: 'Test Equipment Cabinet - Main Lab',
                    cost_per_unit: 4200.00
                },
                {
                    vendor: 'Klein Tools',
                    product: 'VDV Scout Pro Tester Kit',
                    part_number: 'VDV500-705',
                    description: 'Advanced tone generator and probe kit for cable tracing',
                    quantity: 8,
                    min_quantity: 3,
                    category: 'Test Equipment',
                    location: 'Tool Storage - Technician Area',
                    cost_per_unit: 145.00
                },
                {
                    vendor: 'Anritsu',
                    product: 'MS2720T Spectrum Master',
                    part_number: 'MS2720T',
                    description: 'Handheld spectrum analyzer covering 9kHz to 9GHz frequency range',
                    quantity: 1,
                    min_quantity: 1,
                    category: 'Test Equipment',
                    location: 'Test Equipment Cabinet - Main Lab',
                    cost_per_unit: 12500.00
                },
                {
                    vendor: 'IDEAL',
                    product: 'VoIP Pro Cable Tester',
                    part_number: 'IDEAL-VOIP-PRO',
                    description: 'Comprehensive VoIP and data cable tester with advanced diagnostics',
                    quantity: 3,
                    min_quantity: 1,
                    category: 'Test Equipment',
                    location: 'Test Equipment Cabinet - Main Lab',
                    cost_per_unit: 895.00
                },
                
                // Consumables & Cables
                {
                    vendor: 'Panduit',
                    product: 'Cat6A UTP Cable 1000ft',
                    part_number: 'PAN-CAT6A-1000FT',
                    description: 'Category 6A UTP solid cable supporting 10Gbps applications',
                    quantity: 10,
                    min_quantity: 3,
                    category: 'Consumables',
                    location: 'Cable Storage Room - Rack 3',
                    cost_per_unit: 285.00
                },
                {
                    vendor: 'Panduit',
                    product: 'Cat6 UTP Cable 1000ft',
                    part_number: 'PAN-CAT6-1000FT',
                    description: 'Category 6 UTP solid cable for Gigabit Ethernet applications',
                    quantity: 8,
                    min_quantity: 2,
                    category: 'Consumables',
                    location: 'Cable Storage Room - Rack 2',
                    cost_per_unit: 195.00
                },
                {
                    vendor: 'Generic',
                    product: 'RJ45 Connectors Cat6',
                    part_number: 'RJ45-CAT6-100PK',
                    description: 'High-quality Cat6 RJ45 connectors, 100-piece package',
                    quantity: 35,
                    min_quantity: 15,
                    category: 'Consumables',
                    location: 'Small Parts Storage - Bin 1',
                    cost_per_unit: 25.00
                },
                {
                    vendor: 'Generic',
                    product: 'RJ45 Connectors Cat6A',
                    part_number: 'RJ45-CAT6A-100PK',
                    description: 'Shielded Cat6A RJ45 connectors for high-speed applications',
                    quantity: 20,
                    min_quantity: 8,
                    category: 'Consumables',
                    location: 'Small Parts Storage - Bin 2',
                    cost_per_unit: 45.00
                },
                {
                    vendor: 'Panduit',
                    product: '48-Port Cat6A Patch Panel',
                    part_number: 'DP485E88TGY',
                    description: 'High-density 48-port Category 6A patch panel with strain relief',
                    quantity: 6,
                    min_quantity: 2,
                    category: 'Network Infrastructure',
                    location: 'Network Hardware Storage',
                    cost_per_unit: 165.00
                },
                
                // Specialized Equipment
                {
                    vendor: 'Industrial Connector Co.',
                    product: 'R150 Standard Connector',
                    part_number: 'R150-STANDARD',
                    description: 'Industrial-grade R150 equipment connector for specialized applications',
                    quantity: 25,
                    min_quantity: 10,
                    category: 'Specialized',
                    location: 'Specialized Parts Storage - Bin A',
                    cost_per_unit: 85.00
                },
                {
                    vendor: 'Industrial Connector Co.',
                    product: 'R150 Cable Assembly 10ft',
                    part_number: 'R150-CABLE-10FT',
                    description: 'Pre-terminated R150 cable assembly with industrial connectors',
                    quantity: 15,
                    min_quantity: 5,
                    category: 'Specialized',
                    location: 'Specialized Parts Storage - Bin B',
                    cost_per_unit: 125.00
                },
                {
                    vendor: 'Custom Solutions Inc.',
                    product: 'Proprietary Interface Module',
                    part_number: 'CSI-PIM-V2',
                    description: 'Custom interface module for legacy system integration',
                    quantity: 8,
                    min_quantity: 3,
                    category: 'Specialized',
                    location: 'Specialized Parts Storage - Bin C',
                    cost_per_unit: 450.00
                },
                
                // Power & UPS Equipment
                {
                    vendor: 'APC',
                    product: 'Smart-UPS 1500VA LCD',
                    part_number: 'SMT1500',
                    description: 'Line-interactive UPS with LCD display and network management',
                    quantity: 8,
                    min_quantity: 3,
                    category: 'Power Equipment',
                    location: 'UPS Storage - Power Room',
                    cost_per_unit: 385.00
                },
                {
                    vendor: 'APC',
                    product: 'Replacement Battery RBC7',
                    part_number: 'RBC7',
                    description: 'Replacement battery cartridge for Smart-UPS 1500VA units',
                    quantity: 12,
                    min_quantity: 4,
                    category: 'Power Equipment',
                    location: 'Battery Storage - Power Room',
                    cost_per_unit: 125.00
                },
                {
                    vendor: 'Tripp Lite',
                    product: 'Rack PDU 12-Outlet',
                    part_number: 'PWR-STRIP-12',
                    description: '1U rack-mount power distribution unit with 12 outlets',
                    quantity: 10,
                    min_quantity: 4,
                    category: 'Power Equipment',
                    location: 'Power Equipment Storage',
                    cost_per_unit: 95.00
                },
                {
                    vendor: 'CyberPower',
                    product: 'OR1500LCDRT2U UPS',
                    part_number: 'CP-OR1500LCD',
                    description: 'Rack/tower convertible UPS with LCD and management features',
                    quantity: 5,
                    min_quantity: 2,
                    category: 'Power Equipment',
                    location: 'UPS Storage - Power Room',
                    cost_per_unit: 295.00
                },
                
                // Security & Access Control
                {
                    vendor: 'HID Global',
                    product: 'ProxPoint Plus Card Reader',
                    part_number: 'HID-PROX-6005',
                    description: 'Proximity card reader with LED/beeper feedback',
                    quantity: 6,
                    min_quantity: 2,
                    category: 'Security Equipment',
                    location: 'Security Equipment Cabinet',
                    cost_per_unit: 145.00
                },
                {
                    vendor: 'HID Global',
                    product: 'ISOProx II Proximity Cards',
                    part_number: 'HID-1326-CARDS',
                    description: 'Professional proximity cards, 25-pack with sequential numbering',
                    quantity: 8,
                    min_quantity: 3,
                    category: 'Security Equipment',
                    location: 'Security Equipment Cabinet',
                    cost_per_unit: 75.00
                },
                {
                    vendor: 'Axis',
                    product: 'Network Camera M3007-PV',
                    part_number: 'AXIS-M3007',
                    description: 'Fixed dome network camera with panoramic view capability',
                    quantity: 4,
                    min_quantity: 1,
                    category: 'Security Equipment',
                    location: 'Security Equipment Cabinet',
                    cost_per_unit: 685.00
                },
                
                // Tools & Hand Equipment
                {
                    vendor: 'Klein Tools',
                    product: 'Electrician\'s Tool Set',
                    part_number: 'KLEIN-TOOL-SET-1',
                    description: 'Professional electrician tool set with carrying case',
                    quantity: 6,
                    min_quantity: 2,
                    category: 'Tools',
                    location: 'Tool Storage - Technician Area',
                    cost_per_unit: 285.00
                },
                {
                    vendor: 'Fluke',
                    product: 'Digital Multimeter 87V',
                    part_number: 'FLUKE-87V',
                    description: 'Industrial digital multimeter with advanced measurement capabilities',
                    quantity: 4,
                    min_quantity: 2,
                    category: 'Tools',
                    location: 'Tool Storage - Technician Area',
                    cost_per_unit: 425.00
                }
            ];
            
            for (const item of inventoryItems) {
                await connection.execute(
                    'INSERT INTO inventory (vendor, product, part_number, description, quantity, min_quantity, category, location, cost_per_unit, last_inventoried) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())',
                    [item.vendor, item.product, item.part_number, item.description, item.quantity, item.min_quantity, item.category, item.location, item.cost_per_unit]
                );
                console.log(`   ✅ Added: ${item.part_number} - ${item.vendor} ${item.product} (${item.quantity})`);
            }
            console.log('');
        }
        
        // Insert enhanced system settings
        console.log('⚙️  Setting up enhanced system configuration...');
        
        const settings = [
            {
                key: 'system_name',
                value: 'Enhanced IT Shift Notes & Inventory System',
                type: 'string',
                description: 'System display name',
                category: 'general'
            },
            {
                key: 'auto_save_interval',
                value: '300',
                type: 'number',
                description: 'Auto-save interval in seconds',
                category: 'general'
            },
            {
                key: 'max_file_size',
                value: '10485760',
                type: 'number',
                description: 'Maximum file upload size in bytes (10MB)',
                category: 'files'
            },
            {
                key: 'allowed_file_types',
                value: 'jpg,jpeg,png,gif,pdf,doc,docx,txt,xlsx,xls',
                type: 'string',
                description: 'Comma-separated list of allowed file extensions',
                category: 'files'
            },
            {
                key: 'low_stock_alert_threshold',
                value: '5',
                type: 'number',
                description: 'Send alerts when stock drops to this level',
                category: 'inventory'
            },
            {
                key: 'session_timeout',
                value: '43200',
                type: 'number',
                description: 'Session timeout in seconds (12 hours)',
                category: 'security'
            },
            {
                key: 'enable_file_uploads',
                value: 'true',
                type: 'boolean',
                description: 'Enable file uploads for tasks',
                category: 'features'
            },
            {
                key: 'enable_auto_save',
                value: 'true',
                type: 'boolean',
                description: 'Enable automatic saving of shift notes',
                category: 'features'
            },
            {
                key: 'max_daily_shifts_per_user',
                value: '1',
                type: 'number',
                description: 'Maximum number of shifts per user per day',
                category: 'general'
            }
        ];
        
        for (const setting of settings) {
            await connection.execute(
                'INSERT INTO system_settings (setting_key, setting_value, setting_type, description, category) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_type = VALUES(setting_type), description = VALUES(description)',
                [setting.key, setting.value, setting.type, setting.description, setting.category]
            );
        }
        
        // Create sample shift notes for testing
        const [existingNotes] = await connection.execute('SELECT COUNT(*) as count FROM shift_notes WHERE shift_date >= DATE_SUB(CURDATE(), INTERVAL 2 DAY)');
        
        if (existingNotes[0].count === 0) {
            console.log('📋 Creating sample shift notes for testing...');
            
            const [techUsers] = await connection.execute('SELECT id, name FROM users WHERE role = "technician" LIMIT 5');
            
            if (techUsers.length > 0) {
                for (let dayOffset = 2; dayOffset >= 0; dayOffset--) {
                    const shiftDate = new Date();
                    shiftDate.setDate(shiftDate.getDate() - dayOffset);
                    const dateStr = shiftDate.toISOString().split('T')[0];
                    
                    for (const user of techUsers.slice(0, Math.min(3, techUsers.length))) {
                        // Create shift note
                        const [shiftResult] = await connection.execute(
                            'INSERT INTO shift_notes (title, content, shift_date, shift_type, submitted, submitted_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [
                                `${user.name}'s ${dayOffset === 0 ? 'Current' : 'Day'} Shift - ${dateStr}`,
                                `Shift notes for ${user.name} on ${dateStr}.\n\nMorning equipment checks completed.\nAll systems operational.\nCompleted routine maintenance tasks.\n\nKey activities:\n- Network infrastructure monitoring\n- Equipment installations\n- User support tickets\n- Inventory management`,
                                dateStr,
                                dayOffset === 0 ? 'day' : (dayOffset === 1 ? 'evening' : 'night'),
                                dayOffset > 0,
                                dayOffset > 0 ? new Date(shiftDate.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ') : null,
                                user.id
                            ]
                        );
                        
                        const shiftId = shiftResult.insertId;
                        
                        // Create daily audits
                        await connection.execute(
                            'INSERT INTO daily_audits (shift_id, tel_lane, gate_lane, tel_simulation, quickbase_dashboard, mechanics_availability, completed_by, completion_percentage) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                            [shiftId, true, true, dayOffset < 2, true, dayOffset < 1, user.id, dayOffset === 0 ? 60 : 100]
                        );
                        
                        // Create sample tasks
                        const sampleTasks = [
                            {
                                title: `Network equipment maintenance - Building ${String.fromCharCode(65 + Math.floor(Math.random() * 3))}`,
                                description: 'Routine maintenance check on switches and routers including firmware updates and cable management',
                                status: dayOffset === 0 ? 'active' : 'completed',
                                priority: 'medium',
                                tickets: ['RITM' + (8042334 + Math.floor(Math.random() * 1000))],
                                parts_used: []
                            },
                            {
                                title: 'Install new access point in conference room',
                                description: 'Deploy and configure new WiFi access point for better coverage in main conference room',
                                status: dayOffset === 0 ? (Math.random() > 0.5 ? 'active' : 'blocked') : 'completed',
                                priority: 'high',
                                tickets: ['RITM' + (8042335 + Math.floor(Math.random() * 1000))],
                                parts_used: [{ part_number: 'AIR-CAP3702I-A-K9', quantity: 1 }]
                            },
                            {
                                title: 'Cable replacement in server room',
                                description: 'Replace damaged Cat6A cables in main server room rack',
                                status: dayOffset === 0 ? 'active' : 'completed',
                                priority: 'medium',
                                tickets: ['QB-' + Math.floor(Math.random() * 10000)],
                                parts_used: [
                                    { part_number: 'PAN-CAT6A-1000FT', quantity: 1 },
                                    { part_number: 'RJ45-CAT6A-100PK', quantity: 8 }
                                ]
                            }
                        ];
                        
                        for (const task of sampleTasks) {
                            const [taskResult] = await connection.execute(
                                'INSERT INTO shift_tasks (shift_id, title, description, status, priority, tickets, parts_used, created_by, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                                [
                                    shiftId, 
                                    task.title, 
                                    task.description, 
                                    task.status, 
                                    task.priority,
                                    JSON.stringify(task.tickets), 
                                    JSON.stringify(task.parts_used), 
                                    user.id,
                                    task.status === 'completed' ? new Date(shiftDate.getTime() + Math.random() * 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ') : null
                                ]
                            );
                            
                            // Update inventory for completed tasks with parts used
                            if (task.status === 'completed' && task.parts_used.length > 0) {
                                for (const part of task.parts_used) {
                                    const [inventoryItem] = await connection.execute('SELECT id, quantity FROM inventory WHERE part_number = ?', [part.part_number]);
                                    if (inventoryItem.length > 0) {
                                        const newQuantity = Math.max(0, inventoryItem[0].quantity - part.quantity);
                                        await connection.execute('UPDATE inventory SET quantity = ?, last_inventoried = CURDATE() WHERE id = ?', [newQuantity, inventoryItem[0].id]);
                                        
                                        // Log transaction
                                        await connection.execute(
                                            'INSERT INTO inventory_transactions (inventory_id, part_number, transaction_type, quantity_change, old_quantity, new_quantity, notes, user_id, shift_note_id, task_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                                            [inventoryItem[0].id, part.part_number, 'remove', -part.quantity, inventoryItem[0].quantity, newQuantity, `Used in task: ${task.title}`, user.id, shiftId, taskResult.insertId]
                                        );
                                    }
                                }
                            }
                        }
                        
                        console.log(`   ✅ Created shift for ${user.name} on ${dateStr} with ${sampleTasks.length} tasks`);
                    }
                }
            }
            console.log('');
        }
        
        // Generate inventory alerts for low stock items
        console.log('🚨 Generating inventory alerts...');
        const [lowStockItems] = await connection.execute(
            'SELECT * FROM inventory WHERE quantity <= min_quantity'
        );
        
        for (const item of lowStockItems) {
            const alertType = item.quantity === 0 ? 'out_of_stock' : 'low_stock';
            const alertLevel = item.quantity === 0 ? 'critical' : 'warning';
            const message = item.quantity === 0 
                ? `${item.part_number} (${item.vendor} ${item.product}) is out of stock`
                : `${item.part_number} (${item.vendor} ${item.product}) is low in stock (${item.quantity} remaining, minimum ${item.min_quantity})`;
                
            await connection.execute(
                'INSERT INTO inventory_alerts (inventory_id, alert_type, alert_level, message) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE message = VALUES(message), created_at = CURRENT_TIMESTAMP',
                [item.id, alertType, alertLevel, message]
            );
        }
        
        console.log(`   ✅ Generated ${lowStockItems.length} inventory alerts`);
        
        console.log('\n🎉 Enhanced database initialization completed successfully!');
        console.log('\n📋 System Summary:');
        console.log(`   👥 Users: 10 users created (1 admin, 2 managers, 7 technicians)`);
        console.log(`   📦 Inventory: ${inventoryItems.length} items across multiple categories`);
        console.log(`   📝 Sample Data: 3 days of shift notes with realistic tasks`);
        console.log(`   🚨 Alerts: ${lowStockItems.length} inventory alerts generated`);
        console.log(`   📁 File Support: Enhanced with task attachments`);
        console.log('\n🚀 System is ready for production testing!');
        
        console.log('\n💡 Login credentials:');
        console.log('   🔑 Admin: admin@company.com / admin123');
        console.log('   👔 Managers: sarah@company.com / password123, maria@company.com / password123');
        console.log('   🔧 Technicians: john@company.com / password123, mike@company.com / password123');
        console.log('                   lisa@company.com / password123, david@company.com / password123');
        console.log('                   robert@company.com / password123, jennifer@company.com / password123');
        console.log('                   michael@company.com / password123');
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

// Run initialization if called directly
if (require.main === module) {
    initializeEnhancedDatabase().catch(console.error);
}

module.exports = initializeEnhancedDatabase;
