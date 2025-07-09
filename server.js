// Enhanced IT Shift Notes & Inventory Management Backend - Fixed and Improved
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here-change-in-production';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Database connection with proper error handling
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'shiftnotes_user',
    password: 'Zd7010us',
    database: 'shift_inventory_system',
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true,
    multipleStatements: false
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
            console.error('JWT verification error:', err);
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
            { expiresIn: '12h' }
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

// ENHANCED SHIFT NOTES ROUTES

// Get or create today's shift
app.get('/api/shifts/current', authenticateToken, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Get today's shift or create one
        let [shifts] = await pool.execute(
            `SELECT sn.*, u.name as created_by_name 
             FROM shift_notes sn 
             LEFT JOIN users u ON sn.created_by = u.id 
             WHERE sn.created_by = ? AND sn.shift_date = ? 
             ORDER BY sn.created_at DESC LIMIT 1`,
            [req.user.id, today]
        );
        
        let shiftId;
        let shift;
        
        if (shifts.length === 0) {
            // Create new shift for today
            const [result] = await pool.execute(
                'INSERT INTO shift_notes (title, content, shift_date, shift_type, created_by) VALUES (?, ?, ?, ?, ?)',
                [`${req.user.name}'s Shift - ${today}`, '', today, 'day', req.user.id]
            );
            shiftId = result.insertId;
            
            // Get the created shift
            [shifts] = await pool.execute(
                `SELECT sn.*, u.name as created_by_name 
                 FROM shift_notes sn 
                 LEFT JOIN users u ON sn.created_by = u.id 
                 WHERE sn.id = ?`,
                [shiftId]
            );
            shift = shifts[0];
        } else {
            shift = shifts[0];
            shiftId = shift.id;
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
        
        // Get inventory transactions for this shift
        const [inventoryChanges] = await pool.execute(
            `SELECT it.*, i.vendor, i.product, i.part_number 
             FROM inventory_transactions it 
             LEFT JOIN inventory i ON it.inventory_id = i.id 
             WHERE it.shift_note_id = ? 
             ORDER BY it.created_at ASC`,
            [shiftId]
        );
        
        res.json({
            shift: shift,
            shift_id: shiftId,
            tasks: tasks,
            audits: audits.length > 0 ? audits[0] : null,
            inventory_changes: inventoryChanges
        });
        
    } catch (error) {
        console.error('Get current shift error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Update shift content
app.put('/api/shifts/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { title, content, shift_type } = req.body;
    
    try {
        // Verify ownership
        const [shifts] = await pool.execute(
            'SELECT * FROM shift_notes WHERE id = ? AND created_by = ?',
            [id, req.user.id]
        );
        
        if (shifts.length === 0) {
            return res.status(404).json({ message: 'Shift not found or not authorized' });
        }
        
        await pool.execute(
            'UPDATE shift_notes SET title = ?, content = ?, shift_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [title, content, shift_type, id]
        );
        
        await logActivity(req.user.id, 'update_shift', 'shift_note', id, { title }, req.ip);
        
        res.json({ message: 'Shift updated successfully' });
    } catch (error) {
        console.error('Update shift error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// TASK MANAGEMENT ROUTES

// Create task with proper error handling
app.post('/api/tasks', authenticateToken, async (req, res) => {
    const { shift_id, title, description, status, tickets, parts_used } = req.body;
    
    if (!shift_id || !title) {
        return res.status(400).json({ message: 'Shift ID and title are required' });
    }
    
    try {
        // Verify shift exists and user owns it
        const [shifts] = await pool.execute(
            'SELECT * FROM shift_notes WHERE id = ? AND created_by = ?',
            [shift_id, req.user.id]
        );
        
        if (shifts.length === 0) {
            return res.status(404).json({ message: 'Shift not found or not authorized' });
        }
        
        // Create the task
        const [result] = await pool.execute(
            'INSERT INTO shift_tasks (shift_id, title, description, status, tickets, parts_used, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [shift_id, title, description || '', status || 'active', JSON.stringify(tickets || []), JSON.stringify(parts_used || []), req.user.id]
        );
        
        // Update inventory if parts were used
        if (parts_used && parts_used.length > 0) {
            for (const part of parts_used) {
                await updateInventoryQuantity(part.part_number, -Math.abs(part.quantity), `Used in task: ${title}`, req.user.id, shift_id);
            }
        }
        
        await logActivity(req.user.id, 'create_task', 'task', result.insertId, { title, status }, req.ip);
        
        res.json({ message: 'Task created successfully', id: result.insertId });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Update task status
app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { status, blocker_reason, parts_used, description } = req.body;
    
    try {
        // Get current task and verify ownership
        const [currentTask] = await pool.execute(
            `SELECT st.*, sn.created_by 
             FROM shift_tasks st 
             LEFT JOIN shift_notes sn ON st.shift_id = sn.id 
             WHERE st.id = ?`,
            [id]
        );
        
        if (currentTask.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        if (currentTask[0].created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to update this task' });
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
                await updateInventoryQuantity(part.part_number, -Math.abs(part.quantity), `Used in task: ${currentTask[0].title}`, req.user.id, currentTask[0].shift_id);
            }
        }
        
        await logActivity(req.user.id, 'update_task', 'task', id, { status, blocker_reason }, req.ip);
        
        res.json({ message: 'Task updated successfully' });
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Update daily audits
app.post('/api/audits', authenticateToken, async (req, res) => {
    const { shift_id, tel_lane, gate_lane, tel_simulation, quickbase_dashboard, mechanics_availability } = req.body;
    
    try {
        // Verify shift ownership
        const [shifts] = await pool.execute(
            'SELECT * FROM shift_notes WHERE id = ? AND created_by = ?',
            [shift_id, req.user.id]
        );
        
        if (shifts.length === 0) {
            return res.status(404).json({ message: 'Shift not found or not authorized' });
        }
        
        await pool.execute(
            `INSERT INTO daily_audits (shift_id, tel_lane, gate_lane, tel_simulation, quickbase_dashboard, mechanics_availability, completed_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             tel_lane = VALUES(tel_lane), 
             gate_lane = VALUES(gate_lane), 
             tel_simulation = VALUES(tel_simulation), 
             quickbase_dashboard = VALUES(quickbase_dashboard), 
             mechanics_availability = VALUES(mechanics_availability),
             updated_at = CURRENT_TIMESTAMP`,
            [shift_id, tel_lane, gate_lane, tel_simulation, quickbase_dashboard, mechanics_availability, req.user.id]
        );
        
        await logActivity(req.user.id, 'update_audits', 'audit', shift_id, null, req.ip);
        
        res.json({ message: 'Audits updated successfully' });
    } catch (error) {
        console.error('Update audits error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// INVENTORY MANAGEMENT ROUTES

// Get inventory with enhanced search and categorization
app.get('/api/inventory', authenticateToken, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const lowStock = req.query.low_stock === 'true';
    
    try {
        let query = `
            SELECT i.*, 
                   CASE WHEN i.quantity <= i.min_quantity THEN 1 ELSE 0 END as low_stock,
                   (SELECT COUNT(*) FROM inventory_transactions it WHERE it.inventory_id = i.id) as transaction_count
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
        
        if (lowStock) {
            query += ` AND i.quantity <= i.min_quantity`;
        }
        
        query += ` ORDER BY i.vendor, i.product LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        
        const [inventory] = await pool.execute(query, params);
        
        // Get total count for pagination
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
        
        if (lowStock) {
            countQuery += ` AND i.quantity <= i.min_quantity`;
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

// Add new inventory item with duplicate prevention
app.post('/api/inventory', authenticateToken, async (req, res) => {
    const { vendor, product, part_number, description, quantity, min_quantity, category, location } = req.body;
    
    if (!vendor || !product || !part_number) {
        return res.status(400).json({ message: 'Vendor, product, and part number are required' });
    }
    
    try {
        // Check for duplicate part number
        const [existing] = await pool.execute(
            'SELECT id FROM inventory WHERE part_number = ?',
            [part_number]
        );
        
        if (existing.length > 0) {
            return res.status(409).json({ message: 'Part number already exists' });
        }
        
        const [result] = await pool.execute(
            'INSERT INTO inventory (vendor, product, part_number, description, quantity, min_quantity, category, location, last_inventoried) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())',
            [vendor, product, part_number, description || '', quantity || 0, min_quantity || 0, category || 'Uncategorized', location || '']
        );
        
        await logActivity(req.user.id, 'add_inventory', 'inventory', result.insertId, { part_number, vendor, product }, req.ip);
        
        res.json({ message: 'Inventory item added successfully', id: result.insertId });
    } catch (error) {
        console.error('Add inventory error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Helper function to update inventory quantity with proper transaction handling
async function updateInventoryQuantity(partNumber, quantityChange, notes, userId, shiftId = null) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const [inventory] = await connection.execute(
            'SELECT * FROM inventory WHERE part_number = ? FOR UPDATE',
            [partNumber]
        );
        
        if (inventory.length === 0) {
            throw new Error(`Part not found: ${partNumber}`);
        }
        
        const item = inventory[0];
        const oldQuantity = item.quantity;
        const newQuantity = Math.max(0, oldQuantity + quantityChange);
        
        await connection.execute(
            'UPDATE inventory SET quantity = ?, last_inventoried = CURDATE(), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newQuantity, item.id]
        );
        
        await connection.execute(
            'INSERT INTO inventory_transactions (inventory_id, part_number, transaction_type, quantity_change, old_quantity, new_quantity, notes, user_id, shift_note_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [item.id, partNumber, quantityChange > 0 ? 'add' : 'remove', quantityChange, oldQuantity, newQuantity, notes, userId, shiftId]
        );
        
        await connection.commit();
        
        return { oldQuantity, newQuantity, change: quantityChange };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
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
        
        const result = await updateInventoryQuantity(part_number, actualChange, notes || 'Manual adjustment', req.user.id, shift_note_id);
        
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

// REPORTING ROUTES

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

// Inventory reporting
app.get('/api/reports/inventory', authenticateToken, async (req, res) => {
    const { start_date, end_date, category, type } = req.query;
    
    try {
        let query, params = [];
        
        switch (type) {
            case 'usage':
                query = `
                    SELECT i.part_number, i.vendor, i.product, i.category,
                           ABS(SUM(it.quantity_change)) as total_used,
                           COUNT(it.id) as transaction_count
                    FROM inventory_transactions it
                    LEFT JOIN inventory i ON it.inventory_id = i.id
                    WHERE it.transaction_type = 'remove'
                `;
                
                if (start_date) {
                    query += ' AND DATE(it.created_at) >= ?';
                    params.push(start_date);
                }
                if (end_date) {
                    query += ' AND DATE(it.created_at) <= ?';
                    params.push(end_date);
                }
                if (category) {
                    query += ' AND i.category = ?';
                    params.push(category);
                }
                
                query += ' GROUP BY i.id ORDER BY total_used DESC';
                break;
                
            case 'low_stock':
                query = `
                    SELECT * FROM inventory 
                    WHERE quantity <= min_quantity
                `;
                if (category) {
                    query += ' AND category = ?';
                    params.push(category);
                }
                query += ' ORDER BY (quantity - min_quantity) ASC';
                break;
                
            case 'transactions':
                query = `
                    SELECT it.*, i.vendor, i.product, u.name as user_name
                    FROM inventory_transactions it
                    LEFT JOIN inventory i ON it.inventory_id = i.id
                    LEFT JOIN users u ON it.user_id = u.id
                    WHERE 1=1
                `;
                
                if (start_date) {
                    query += ' AND DATE(it.created_at) >= ?';
                    params.push(start_date);
                }
                if (end_date) {
                    query += ' AND DATE(it.created_at) <= ?';
                    params.push(end_date);
                }
                if (category) {
                    query += ' AND i.category = ?';
                    params.push(category);
                }
                
                query += ' ORDER BY it.created_at DESC LIMIT 100';
                break;
                
            default:
                return res.status(400).json({ message: 'Invalid report type' });
        }
        
        const [results] = await pool.execute(query, params);
        
        res.json({
            type,
            data: results,
            generated_at: new Date().toISOString(),
            filters: { start_date, end_date, category }
        });
        
    } catch (error) {
        console.error('Inventory report error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// SEARCH ROUTES

// Enhanced search with better performance
app.get('/api/search', authenticateToken, async (req, res) => {
    const { query, start_date, end_date, user_id, category } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    
    try {
        let searchQuery = `
            SELECT DISTINCT sn.id, sn.title, sn.content, sn.shift_date, sn.shift_type, sn.created_at,
                   u.name as created_by_name,
                   GROUP_CONCAT(DISTINCT st.title SEPARATOR '; ') as task_titles,
                   GROUP_CONCAT(DISTINCT st.description SEPARATOR '; ') as task_descriptions,
                   COUNT(DISTINCT st.id) as task_count
            FROM shift_notes sn
            LEFT JOIN users u ON sn.created_by = u.id
            LEFT JOIN shift_tasks st ON sn.id = st.shift_id
            LEFT JOIN inventory_transactions it ON sn.id = it.shift_note_id
            LEFT JOIN inventory i ON it.inventory_id = i.id
            WHERE 1=1
        `;
        
        let params = [];
        
        if (query) {
            searchQuery += ` AND (sn.title LIKE ? OR sn.content LIKE ? OR st.title LIKE ? OR st.description LIKE ? OR i.part_number LIKE ?)`;
            const searchTerm = `%${query}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }
        
        if (start_date) {
            searchQuery += ` AND sn.shift_date >= ?`;
            params.push(start_date);
        }
        
        if (end_date) {
            searchQuery += ` AND sn.shift_date <= ?`;
            params.push(end_date);
        }
        
        if (user_id) {
            searchQuery += ` AND sn.created_by = ?`;
            params.push(user_id);
        }
        
        if (category) {
            searchQuery += ` AND i.category = ?`;
            params.push(category);
        }
        
        // Add pagination
        searchQuery += ` GROUP BY sn.id ORDER BY sn.shift_date DESC, sn.created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        
        const [results] = await pool.execute(searchQuery, params);
        
        // Get total count for pagination
        let countQuery = searchQuery.replace(/SELECT DISTINCT.*?FROM/, 'SELECT COUNT(DISTINCT sn.id) as total FROM');
        countQuery = countQuery.replace(/GROUP BY.*$/, '');
        const countParams = params.slice(0, -2); // Remove limit and offset
        
        const [countResult] = await pool.execute(countQuery, countParams);
        
        res.json({
            results,
            pagination: {
                page,
                limit,
                total: countResult[0].total,
                pages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all shift notes for a date range
app.get('/api/shifts', authenticateToken, async (req, res) => {
    const { start_date, end_date, user_id } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    try {
        let query = `
            SELECT sn.*, u.name as created_by_name,
                   COUNT(DISTINCT st.id) as task_count,
                   COUNT(DISTINCT CASE WHEN st.status = 'completed' THEN st.id END) as completed_tasks
            FROM shift_notes sn
            LEFT JOIN users u ON sn.created_by = u.id
            LEFT JOIN shift_tasks st ON sn.id = st.shift_id
            WHERE 1=1
        `;
        let params = [];
        
        if (start_date) {
            query += ' AND sn.shift_date >= ?';
            params.push(start_date);
        }
        
        if (end_date) {
            query += ' AND sn.shift_date <= ?';
            params.push(end_date);
        }
        
        if (user_id) {
            query += ' AND sn.created_by = ?';
            params.push(user_id);
        }
        
        query += ' GROUP BY sn.id ORDER BY sn.shift_date DESC, sn.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        const [shifts] = await pool.execute(query, params);
        
        res.json({
            shifts,
            pagination: {
                page,
                limit,
                total: shifts.length,
                pages: Math.ceil(shifts.length / limit)
            }
        });
    } catch (error) {
        console.error('Get shifts error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Dashboard with comprehensive stats
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
        
        // Get shift notes stats
        const [notesStats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_shifts,
                COUNT(CASE WHEN shift_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as recent_shifts,
                COUNT(CASE WHEN shift_date = CURDATE() THEN 1 END) as today_shifts
            FROM shift_notes
        `);
        
        // Get today's task stats
        const [taskStats] = await pool.execute(`
            SELECT 
                COUNT(CASE WHEN st.status = 'active' THEN 1 END) as active_tasks,
                COUNT(CASE WHEN st.status = 'blocked' THEN 1 END) as blocked_tasks,
                COUNT(CASE WHEN st.status = 'completed' THEN 1 END) as completed_tasks,
                COUNT(*) as total_tasks
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
        
        // Get recent inventory transactions
        const [recentTransactions] = await pool.execute(`
            SELECT it.*, i.part_number, i.vendor, i.product, u.name as user_name
            FROM inventory_transactions it
            LEFT JOIN inventory i ON it.inventory_id = i.id
            LEFT JOIN users u ON it.user_id = u.id
            ORDER BY it.created_at DESC
            LIMIT 5
        `);
        
        res.json({
            inventory: inventoryStats[0],
            notes: notesStats[0],
            tasks: taskStats[0] || { active_tasks: 0, blocked_tasks: 0, completed_tasks: 0, total_tasks: 0 },
            recent_activity: recentActivity,
            low_stock_items: lowStockItems,
            recent_transactions: recentTransactions
        });
        
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ message: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Enhanced Shift Notes & Inventory Server running on port ${PORT}`);
    
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
        console.error('⚠️  Database connection failed - server may not function properly');
        process.exit(1);
    }
    
    console.log('\n📋 Enhanced API endpoints available');
    console.log('✅ Server ready for production use!');
    console.log(`🌐 Access the application at: http://localhost:${PORT}`);
    console.log('\n💡 Login credentials:');
    console.log('   Admin: admin@company.com / admin123');
    console.log('   Technician: john@company.com / password123');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    await pool.end();
    console.log('✅ Database connections closed');
    process.exit(0);
});
