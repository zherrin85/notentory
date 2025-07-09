// Enhanced IT Shift Notes & Inventory Management Backend with Task Management
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// File upload configuration
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads');
        try {
            await fs.mkdir(uploadPath, { recursive: true });
            cb(null, uploadPath);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 10 * 1024 * 1024,
        files: 5
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|zip/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only common file types are allowed!'));
        }
    }
});

// Database connection
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'shiftnotes_user',
    password: 'Zd7010us',
    database: 'shift_inventory_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
});

// Test database connection
async function testDatabaseConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Database connection established successfully');
        console.log(`📍 Connected to: ${connection.config.host}:${connection.config.port || 3306}`);
        console.log(`🗄️  Database: ${connection.config.database}`);
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        
        try {
            const [users] = await pool.execute('SELECT * FROM users WHERE id = ? AND active = TRUE', [decoded.id]);
            if (users.length === 0) {
                return res.status(403).json({ message: 'User not found or inactive' });
            }
            
            req.user = users[0];
            next();
        } catch (error) {
            console.error('Auth middleware error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });
};

// Activity logging helper
const logActivity = async (userId, action, entityType, entityId, details = null, ipAddress = null) => {
    try {
        await pool.execute(
            'INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, action, entityType, entityId, JSON.stringify(details), ipAddress]
        );
    } catch (error) {
        console.error('Activity logging error:', error);
    }
};

// AUTHENTICATION ROUTES

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password required' });
    }
    
    try {
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ? AND active = TRUE', [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );
        
        await logActivity(user.id, 'login', 'user', user.id, null, req.ip);
        
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// TASK MANAGEMENT ROUTES

// Get active shift for user
app.get('/api/shifts/active', authenticateToken, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Get or create today's shift
        let [shifts] = await pool.execute(
            'SELECT * FROM shift_notes WHERE created_by = ? AND shift_date = ? ORDER BY created_at DESC LIMIT 1',
            [req.user.id, today]
        );
        
        let shiftId;
        if (shifts.length === 0) {
            // Create new shift for today
            const [result] = await pool.execute(
                'INSERT INTO shift_notes (title, content, shift_date, shift_type, created_by) VALUES (?, ?, ?, ?, ?)',
                [`${req.user.name}'s Shift - ${today}`, '', today, 'day', req.user.id]
            );
            shiftId = result.insertId;
        } else {
            shiftId = shifts[0].id;
        }
        
        // Get all tasks for this shift
        const [tasks] = await pool.execute(
            'SELECT * FROM shift_tasks WHERE shift_id = ? ORDER BY created_at ASC',
            [shiftId]
        );
        
        // Get daily audits status
        const [audits] = await pool.execute(
            'SELECT * FROM daily_audits WHERE shift_id = ?',
            [shiftId]
        );
        
        res.json({
            shift_id: shiftId,
            tasks: tasks,
            audits: audits.length > 0 ? audits[0] : null
        });
        
    } catch (error) {
        console.error('Get active shift error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create/Update task
app.post('/api/tasks', authenticateToken, async (req, res) => {
    const { shift_id, title, description, status, blocker_reason, tickets, parts_used } = req.body;
    
    try {
        const [result] = await pool.execute(
            'INSERT INTO shift_tasks (shift_id, title, description, status, blocker_reason, tickets, parts_used, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [shift_id, title, description, status || 'active', blocker_reason, JSON.stringify(tickets || []), JSON.stringify(parts_used || []), req.user.id]
        );
        
        // Update inventory if parts were used
        if (parts_used && parts_used.length > 0) {
            for (const part of parts_used) {
                await updateInventoryQuantity(part.part_number, -Math.abs(part.quantity), 'Task: ' + title, req.user.id, shift_id);
            }
        }
        
        await logActivity(req.user.id, 'create_task', 'task', result.insertId, { title, status }, req.ip);
        
        res.json({ message: 'Task created successfully', id: result.insertId });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update task status
app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { status, blocker_reason, parts_used, description } = req.body;
    
    try {
        // Get current task to check for parts changes
        const [currentTask] = await pool.execute('SELECT * FROM shift_tasks WHERE id = ?', [id]);
        
        if (currentTask.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        // Update task
        await pool.execute(
            'UPDATE shift_tasks SET status = ?, blocker_reason = ?, parts_used = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, blocker_reason, JSON.stringify(parts_used || []), description, id]
        );
        
        // Handle new parts usage
        if (parts_used && parts_used.length > 0) {
            const currentParts = JSON.parse(currentTask[0].parts_used || '[]');
            const newParts = parts_used.filter(newPart => 
                !currentParts.some(currentPart => currentPart.part_number === newPart.part_number)
            );
            
            for (const part of newParts) {
                await updateInventoryQuantity(part.part_number, -Math.abs(part.quantity), 'Task: ' + currentTask[0].title, req.user.id, currentTask[0].shift_id);
            }
        }
        
        await logActivity(req.user.id, 'update_task', 'task', id, { status, blocker_reason }, req.ip);
        
        res.json({ message: 'Task updated successfully' });
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update daily audits
app.post('/api/audits', authenticateToken, async (req, res) => {
    const { shift_id, tel_lane, gate_lane, tel_simulation, quickbase_dashboard, mechanics_availability } = req.body;
    
    try {
        await pool.execute(
            'INSERT INTO daily_audits (shift_id, tel_lane, gate_lane, tel_simulation, quickbase_dashboard, mechanics_availability, completed_by) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE tel_lane = VALUES(tel_lane), gate_lane = VALUES(gate_lane), tel_simulation = VALUES(tel_simulation), quickbase_dashboard = VALUES(quickbase_dashboard), mechanics_availability = VALUES(mechanics_availability)',
            [shift_id, tel_lane, gate_lane, tel_simulation, quickbase_dashboard, mechanics_availability, req.user.id]
        );
        
        await logActivity(req.user.id, 'update_audits', 'audit', shift_id, null, req.ip);
        
        res.json({ message: 'Audits updated successfully' });
    } catch (error) {
        console.error('Update audits error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// INVENTORY MANAGEMENT ROUTES

// Get inventory with categories
app.get('/api/inventory', authenticateToken, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category || '';
    
    try {
        let query = `
            SELECT i.*, 
                   CASE WHEN i.quantity <= i.min_quantity THEN 1 ELSE 0 END as low_stock
            FROM inventory i
            WHERE 1=1
        `;
        let params = [];
        
        if (search) {
            query += ` AND (i.part_number LIKE ? OR i.vendor LIKE ? OR i.product LIKE ? OR i.description LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        
        if (category) {
            query += ` AND i.category = ?`;
            params.push(category);
        }
        
        query += ` ORDER BY i.vendor, i.product LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        
        const [inventory] = await pool.execute(query, params);
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM inventory i WHERE 1=1';
        let countParams = [];
        
        if (search) {
            countQuery += ` AND (i.part_number LIKE ? OR i.vendor LIKE ? OR i.product LIKE ? OR i.description LIKE ?)`;
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        
        if (category) {
            countQuery += ` AND i.category = ?`;
            countParams.push(category);
        }
        
        const [countResult] = await pool.execute(countQuery, countParams);
        
        res.json({
            inventory,
            pagination: {
                page,
                limit,
                total: countResult[0].total,
                pages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('Inventory fetch error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get inventory categories
app.get('/api/inventory/categories', authenticateToken, async (req, res) => {
    try {
        const [categories] = await pool.execute(
            'SELECT DISTINCT category FROM inventory WHERE category IS NOT NULL AND category != "" ORDER BY category'
        );
        
        res.json(categories.map(c => c.category));
    } catch (error) {
        console.error('Categories fetch error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Helper function to update inventory quantity
async function updateInventoryQuantity(partNumber, quantityChange, notes, userId, shiftId = null) {
    try {
        await pool.execute('START TRANSACTION');
        
        const [inventory] = await pool.execute(
            'SELECT * FROM inventory WHERE part_number = ? FOR UPDATE',
            [partNumber]
        );
        
        if (inventory.length === 0) {
            await pool.execute('ROLLBACK');
            throw new Error('Part not found');
        }
        
        const item = inventory[0];
        const oldQuantity = item.quantity;
        const newQuantity = Math.max(0, oldQuantity + quantityChange);
        
        await pool.execute(
            'UPDATE inventory SET quantity = ?, last_inventoried = CURDATE(), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newQuantity, item.id]
        );
        
        await pool.execute(
            'INSERT INTO inventory_transactions (inventory_id, part_number, transaction_type, quantity_change, old_quantity, new_quantity, notes, user_id, shift_note_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [item.id, partNumber, quantityChange > 0 ? 'add' : 'remove', quantityChange, oldQuantity, newQuantity, notes, userId, shiftId]
        );
        
        await pool.execute('COMMIT');
        
        return { oldQuantity, newQuantity, change: quantityChange };
    } catch (error) {
        await pool.execute('ROLLBACK');
        throw error;
    }
}

// Update inventory quantity endpoint
app.post('/api/inventory/update-quantity', authenticateToken, async (req, res) => {
    const { part_number, quantity_change, action, notes, shift_note_id } = req.body;
    
    if (!part_number || quantity_change === undefined || !action) {
        return res.status(400).json({ message: 'Part number, quantity change, and action are required' });
    }
    
    try {
        let actualChange;
        
        switch (action) {
            case 'add':
                actualChange = Math.abs(quantity_change);
                break;
            case 'remove':
                actualChange = -Math.abs(quantity_change);
                break;
            case 'adjust':
                // For adjust, we need to get current quantity first
                const [current] = await pool.execute('SELECT quantity FROM inventory WHERE part_number = ?', [part_number]);
                if (current.length === 0) {
                    return res.status(404).json({ message: 'Part not found' });
                }
                actualChange = quantity_change - current[0].quantity;
                break;
            default:
                return res.status(400).json({ message: 'Invalid action' });
        }
        
        const result = await updateInventoryQuantity(part_number, actualChange, notes, req.user.id, shift_note_id);
        
        await logActivity(req.user.id, 'update_inventory', 'inventory', null, 
            { part_number, action, quantity_change: actualChange, old_quantity: result.oldQuantity, new_quantity: result.newQuantity }, req.ip);
        
        res.json({ 
            message: 'Inventory updated successfully',
            old_quantity: result.oldQuantity,
            new_quantity: result.newQuantity,
            change: result.change
        });
    } catch (error) {
        console.error('Inventory update error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Generate shift note summary
app.get('/api/shifts/:id/summary', authenticateToken, async (req, res) => {
    const { id } = req.params;
    
    try {
        // Get shift info
        const [shifts] = await pool.execute(
            'SELECT sn.*, u.name as created_by_name FROM shift_notes sn LEFT JOIN users u ON sn.created_by = u.id WHERE sn.id = ?',
            [id]
        );
        
        if (shifts.length === 0) {
            return res.status(404).json({ message: 'Shift not found' });
        }
        
        const shift = shifts[0];
        
        // Get tasks
        const [tasks] = await pool.execute(
            'SELECT * FROM shift_tasks WHERE shift_id = ? ORDER BY created_at ASC',
            [id]
        );
        
        // Get audits
        const [audits] = await pool.execute(
            'SELECT * FROM daily_audits WHERE shift_id = ?',
            [id]
        );
        
        // Get inventory changes
        const [inventory] = await pool.execute(
            'SELECT it.*, i.vendor, i.product FROM inventory_transactions it LEFT JOIN inventory i ON it.inventory_id = i.id WHERE it.shift_note_id = ? ORDER BY it.created_at ASC',
            [id]
        );
        
        res.json({
            shift,
            tasks,
            audits: audits.length > 0 ? audits[0] : null,
            inventory_changes: inventory
        });
        
    } catch (error) {
        console.error('Shift summary error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ENHANCED SEARCH ROUTES

// Search shift notes and tasks
app.get('/api/search', authenticateToken, async (req, res) => {
    const { query, start_date, end_date, equipment, user_id } = req.query;
    
    try {
        let searchQuery = `
            SELECT DISTINCT sn.id, sn.title, sn.shift_date, sn.shift_type, sn.created_at,
                   u.name as created_by_name,
                   GROUP_CONCAT(DISTINCT st.title SEPARATOR '; ') as task_titles,
                   GROUP_CONCAT(DISTINCT st.description SEPARATOR '; ') as task_descriptions
            FROM shift_notes sn
            LEFT JOIN users u ON sn.created_by = u.id
            LEFT JOIN shift_tasks st ON sn.id = st.shift_id
            LEFT JOIN inventory_transactions it ON sn.id = it.shift_note_id
            LEFT JOIN inventory i ON it.inventory_id = i.id
            WHERE 1=1
        `;
        
        let params = [];
        
        if (query) {
            searchQuery += ` AND (sn.title LIKE ? OR sn.content LIKE ? OR st.title LIKE ? OR st.description LIKE ?)`;
            const searchTerm = `%${query}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        
        if (start_date) {
            searchQuery += ` AND sn.shift_date >= ?`;
            params.push(start_date);
        }
        
        if (end_date) {
            searchQuery += ` AND sn.shift_date <= ?`;
            params.push(end_date);
        }
        
        if (equipment) {
            searchQuery += ` AND (i.part_number LIKE ? OR i.product LIKE ?)`;
            const equipmentTerm = `%${equipment}%`;
            params.push(equipmentTerm, equipmentTerm);
        }
        
        if (user_id) {
            searchQuery += ` AND sn.created_by = ?`;
            params.push(user_id);
        }
        
        searchQuery += ` GROUP BY sn.id ORDER BY sn.shift_date DESC, sn.created_at DESC LIMIT 50`;
        
        const [results] = await pool.execute(searchQuery, params);
        
        res.json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Dashboard with enhanced stats
app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        // Get inventory stats
        const [inventoryStats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_items,
                COALESCE(SUM(quantity), 0) as total_quantity,
                COUNT(CASE WHEN quantity <= min_quantity THEN 1 END) as low_stock_items,
                COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_items
            FROM inventory
        `);
        
        // Get recent notes count
        const [notesStats] = await pool.execute(`
            SELECT COUNT(*) as recent_notes
            FROM shift_notes 
            WHERE shift_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        `);
        
        // Get today's active tasks
        const [taskStats] = await pool.execute(`
            SELECT 
                COUNT(CASE WHEN st.status = 'active' THEN 1 END) as active_tasks,
                COUNT(CASE WHEN st.status = 'blocked' THEN 1 END) as blocked_tasks,
                COUNT(CASE WHEN st.status = 'completed' THEN 1 END) as completed_tasks
            FROM shift_tasks st
            JOIN shift_notes sn ON st.shift_id = sn.id
            WHERE sn.shift_date = CURDATE()
        `);
        
        // Get recent activity
        const [recentActivity] = await pool.execute(`
            SELECT al.*, u.name as user_name
            FROM activity_log al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.created_at DESC
            LIMIT 10
        `);
        
        // Get low stock items
        const [lowStockItems] = await pool.execute(`
            SELECT vendor, product, part_number, quantity, min_quantity, category
            FROM inventory 
            WHERE quantity <= min_quantity
            ORDER BY (quantity - min_quantity) ASC
            LIMIT 10
        `);
        
        res.json({
            inventory: inventoryStats[0],
            notes: notesStats[0],
            tasks: taskStats[0] || { active_tasks: 0, blocked_tasks: 0, completed_tasks: 0 },
            recent_activity: recentActivity,
            low_stock_items: lowStockItems
        });
        
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Initialize database tables
async function initializeDatabase() {
    try {
        // Create enhanced shift_tasks table
        await pool.execute(`
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
                FOREIGN KEY (shift_id) REFERENCES shift_notes(id) ON DELETE CASCADE
            )
        `);
        
        // Create daily_audits table
        await pool.execute(`
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
                FOREIGN KEY (shift_id) REFERENCES shift_notes(id) ON DELETE CASCADE
            )
        `);
        
        // Add category column to inventory if it doesn't exist
        await pool.execute(`
            ALTER TABLE inventory 
            ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Uncategorized'
        `);
        
        console.log('✅ Database tables initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File too large (max 10MB)' });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ message: 'Too many files (max 5)' });
        }
    }
    
    res.status(500).json({ message: 'Internal server error' });
});

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Enhanced Shift Notes & Inventory Server running on port ${PORT}`);
    
    const dbConnected = await testDatabaseConnection();
    if (dbConnected) {
        await initializeDatabase();
    } else {
        console.error('⚠️  Database connection failed - server may not function properly');
    }
    
    console.log('\n📋 Enhanced API endpoints available');
    console.log('✅ Server ready for testing!');
    console.log(`🌐 Access the application at: http://localhost:${PORT}`);
    console.log('\n💡 Login credentials:');
    console.log('   Admin: admin@company.com / admin123');
    console.log('   Technician: john@company.com / password123');
});
