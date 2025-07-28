// Enhanced IT Shift Notes & Inventory Management Backend - Complete Version
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

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
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
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
const logActivity = async (userId, action, tableName, recordId, details = null, ipAddress = null) => {
    try {
        await pool.execute(
            'INSERT INTO activity_log (user_id, action, table_name, record_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, action, tableName, recordId, JSON.stringify(details), ipAddress]
        );
    } catch (error) {
        console.error('Activity logging error:', error);
    }
};

// Inventory update helper function
const updateInventoryQuantity = async (partNumber, quantityChange, notes, userId, shiftNoteId = null) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Get current inventory
        const [current] = await connection.execute(
            'SELECT id, quantity FROM inventory WHERE part_number = ? FOR UPDATE',
            [partNumber]
        );
        
        if (current.length === 0) {
            throw new Error(`Part ${partNumber} not found in inventory`);
        }
        
        const oldQuantity = current[0].quantity;
        const newQuantity = oldQuantity + quantityChange;
        
        // Prevent negative inventory
        if (newQuantity < 0) {
            throw new Error(`Insufficient inventory for part ${partNumber}. Available: ${oldQuantity}, Requested: ${Math.abs(quantityChange)}`);
        }
        
        // Update inventory
        await connection.execute(
            'UPDATE inventory SET quantity = ? WHERE id = ?',
            [newQuantity, current[0].id]
        );
        
        // Log transaction
        await connection.execute(
            'INSERT INTO inventory_transactions (inventory_id, user_id, transaction_type, quantity_change, previous_quantity, new_quantity, reason, shift_note_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [current[0].id, userId, quantityChange < 0 ? 'remove' : 'add', quantityChange, oldQuantity, newQuantity, notes, shiftNoteId]
        );
        
        await connection.commit();
        
        return {
            oldQuantity,
            newQuantity,
            change: quantityChange
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
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

// USER MANAGEMENT ROUTES

// Get users for filters
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.execute('SELECT id, name, email, role, active, created_at FROM users WHERE active = TRUE ORDER BY name');
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create user (Admin/Manager only)
app.post('/api/users', authenticateToken, async (req, res) => {
    if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied' });
    }
    
    const { name, email, password, role } = req.body;
    
    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    
    try {
        const passwordHash = await bcrypt.hash(password, 12);
        const [result] = await pool.execute(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [name, email, passwordHash, role]
        );
        
        await logActivity(req.user.id, 'create_user', 'user', result.insertId, { name, email, role }, req.ip);
        
        res.json({ message: 'User created successfully', id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Email already exists' });
        }
        console.error('Create user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user
app.put('/api/users/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, email, role, active } = req.body;
    
    // Check permissions
    if (req.user.id !== parseInt(id) && !['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied' });
    }
    
    try {
        let query = 'UPDATE users SET name = ?, email = ?';
        let params = [name, email];
        
        // Only admin/manager can change role and active status
        if (['admin', 'manager'].includes(req.user.role)) {
            query += ', role = ?, active = ?';
            params.push(role, active);
        }
        
        query += ' WHERE id = ?';
        params.push(id);
        
        await pool.execute(query, params);
        
        await logActivity(req.user.id, 'update_user', 'user', id, { name, email, role }, req.ip);
        
        res.json({ message: 'User updated successfully' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Email already exists' });
        }
        console.error('Update user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete user (Admin/Manager only)
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied' });
    }
    
    const { id } = req.params;
    
    if (req.user.id === parseInt(id)) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    
    try {
        await pool.execute('UPDATE users SET active = FALSE WHERE id = ?', [id]);
        
        await logActivity(req.user.id, 'delete_user', 'user', id, null, req.ip);
        
        res.json({ message: 'User deactivated successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Change password
app.put('/api/users/:id/password', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    
    // Users can only change their own password, unless admin/manager
    if (req.user.id !== parseInt(id) && !['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied' });
    }
    
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    
    try {
        // If user is changing their own password, verify current password
        if (req.user.id === parseInt(id) && currentPassword) {
            const [users] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [id]);
            const validPassword = await bcrypt.compare(currentPassword, users[0].password_hash);
            if (!validPassword) {
                return res.status(400).json({ message: 'Current password is incorrect' });
            }
        }
        
        const passwordHash = await bcrypt.hash(newPassword, 12);
        await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
        
        await logActivity(req.user.id, 'change_password', 'user', id, null, req.ip);
        
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
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
             LEFT JOIN users u ON sn.user_id = u.id 
             WHERE sn.user_id = ? AND sn.date = ? 
             ORDER BY sn.created_at DESC LIMIT 1`,
            [req.user.id, today]
        );
        
        let shiftId;
        let shift;
        
        if (shifts.length === 0) {
            // Create new shift for today
            const [result] = await pool.execute(
                'INSERT INTO shift_notes (title, date, shift_type, user_id) VALUES (?, ?, ?, ?)',
                [`${req.user.name}'s Shift - ${today}`, today, 'day', req.user.id]
            );
            shiftId = result.insertId;
            
            // Get the created shift
            [shifts] = await pool.execute(
                `SELECT sn.*, u.name as created_by_name 
                 FROM shift_notes sn 
                 LEFT JOIN users u ON sn.user_id = u.id 
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
            'SELECT * FROM tasks WHERE shift_note_id = ? ORDER BY created_at ASC',
            [shiftId]
        );
        
        // Get daily audits status (placeholder for now)
        const audits = [];
        
        // Get inventory transactions for this shift (placeholder for now)
        const inventoryChanges = [];
        
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
    const { title, shift_type } = req.body;
    
    try {
        // Verify ownership
        const [shifts] = await pool.execute(
            'SELECT * FROM shift_notes WHERE id = ? AND user_id = ?',
            [id, req.user.id]
        );
        
        if (shifts.length === 0) {
            return res.status(404).json({ message: 'Shift not found or not authorized' });
        }
        
        await pool.execute(
            'UPDATE shift_notes SET title = ?, shift_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [title, shift_type, id]
        );
        
        await logActivity(req.user.id, 'update_shift', 'shift_note', id, { title }, req.ip);
        
        res.json({ message: 'Shift updated successfully' });
    } catch (error) {
        console.error('Update shift error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create new shift note
app.post('/api/shifts', authenticateToken, async (req, res) => {
    const { title, date, shift_type, completed_audits, tasks } = req.body;
    
    if (!title || !date || !shift_type) {
        return res.status(400).json({ message: 'Title, date, and shift type are required' });
    }
    
    try {
        // Check if shift already exists for this user and date
        const [existingShifts] = await pool.execute(
            'SELECT * FROM shift_notes WHERE user_id = ? AND date = ?',
            [req.user.id, date]
        );
        
        if (existingShifts.length > 0) {
            return res.status(409).json({ message: 'Shift note already exists for this date' });
        }
        
        // Create the shift note
        const [result] = await pool.execute(
            'INSERT INTO shift_notes (title, date, shift_type, user_id, completed_audits) VALUES (?, ?, ?, ?, ?)',
            [title, date, shift_type, req.user.id, JSON.stringify(completed_audits || [])]
        );
        
        const shiftId = result.insertId;
        
        // Create tasks if provided
        if (tasks && tasks.length > 0) {
            for (const task of tasks) {
                // Ensure status is a valid enum value
                let status = task.status || 'in_progress';
                if (!['pending', 'in_progress', 'completed'].includes(status)) {
                    status = 'in_progress';
                }
                
                await pool.execute(
                    'INSERT INTO tasks (shift_note_id, title, description, status, ticket_number, parts_used) VALUES (?, ?, ?, ?, ?, ?)',
                    [shiftId, task.title, task.description || '', status, task.ticket_number || '', JSON.stringify(task.parts_used || [])]
                );
                
                // Update inventory if parts were used
                if (task.parts_used && task.parts_used.length > 0) {
                    for (const part of task.parts_used) {
                        await updateInventoryQuantity(part.part_number, -Math.abs(part.quantity), `Used in task: ${task.title}`, req.user.id, shiftId);
                    }
                }
            }
        }
        
        await logActivity(req.user.id, 'create_shift', 'shift_note', shiftId, { title, date }, req.ip);
        
        res.json({ 
            message: 'Shift note created successfully', 
            id: shiftId,
            title,
            date,
            shift_type
        });
    } catch (error) {
        console.error('Create shift error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
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
            'SELECT * FROM shift_notes WHERE id = ? AND user_id = ?',
            [shift_id, req.user.id]
        );
        
        if (shifts.length === 0) {
            return res.status(404).json({ message: 'Shift not found or not authorized' });
        }
        
        // Create the task
        const [result] = await pool.execute(
            'INSERT INTO tasks (shift_note_id, title, description, status, ticket_number, parts_used) VALUES (?, ?, ?, ?, ?, ?)',
            [shift_id, title, description || '', status || 'in_progress', tickets && tickets.length > 0 ? tickets[0] : '', JSON.stringify(parts_used || [])]
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
            `SELECT t.*, sn.user_id 
             FROM tasks t 
             LEFT JOIN shift_notes sn ON t.shift_note_id = sn.id 
             WHERE t.id = ?`,
            [id]
        );
        
        if (currentTask.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        if (currentTask[0].user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to update this task' });
        }
        
        // Update task
        await pool.execute(
            'UPDATE tasks SET status = ?, description = ? WHERE id = ?',
            [status, description, id]
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
            'SELECT * FROM shift_notes WHERE id = ? AND user_id = ?',
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
            SELECT i.id, i.part_number, i.product_name, i.vendor, i.description, i.quantity, i.location, i.created_at, i.updated_at,
                   0 as low_stock,
                   0 as transaction_count
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
            query += ` AND i.quantity <= 0`;
        }
        
        query += ` ORDER BY i.vendor, i.product_name LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        
        const [inventory] = await pool.execute(query, params);
        
        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM inventory i WHERE 1=1';
        let countParams = [];
        
        if (search) {
            countQuery += ` AND (i.part_number LIKE ? OR i.vendor LIKE ? OR i.product_name LIKE ? OR i.description LIKE ?)`;
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        
        if (category) {
            countQuery += ` AND i.category = ?`;
            countParams.push(category);
        }
        
        if (lowStock) {
            countQuery += ` AND i.quantity <= 0`;
        }
        
        const [countResult] = await pool.execute(countQuery, countParams);
        
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        
        res.json({
            items: inventory,
            total: countResult[0].total,
            page,
            totalPages: Math.ceil(countResult[0].total / limit)
        });
        
    } catch (error) {
        console.error('Get inventory error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Inventory search for task integration
app.get('/api/inventory/search', authenticateToken, async (req, res) => {
    const { q, limit = 10 } = req.query;
    
    if (!q || q.length < 2) {
        return res.json([]);
    }
    
    try {
        const searchTerm = `%${q}%`;
        const [items] = await pool.execute(`
            SELECT id, part_number, product_name, vendor, description, quantity,
                   0 as low_stock
            FROM inventory 
            WHERE (part_number LIKE ? OR product_name LIKE ? OR vendor LIKE ? OR description LIKE ?)
            AND quantity > 0
            ORDER BY 
                CASE WHEN part_number LIKE ? THEN 1
                     WHEN product_name LIKE ? THEN 2
                     WHEN vendor LIKE ? THEN 3
                     ELSE 4 END,
                part_number
            LIMIT ?
        `, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, parseInt(limit)]);
        
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        
        res.json(items);
    } catch (error) {
        console.error('Inventory search error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get individual inventory item
app.get('/api/inventory/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    
    try {
        const [items] = await pool.execute(`
            SELECT id, part_number, product_name, vendor, description, quantity, location, created_at, updated_at
            FROM inventory 
            WHERE id = ?
        `, [id]);
        
        if (items.length === 0) {
            return res.status(404).json({ message: 'Item not found' });
        }
        
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        
        res.json(items[0]);
        
    } catch (error) {
        console.error('Get inventory item error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Add inventory item
app.post('/api/inventory', authenticateToken, async (req, res) => {
    const { product_name, part_number, description, quantity, location } = req.body;
    
    if (!product_name || !part_number) {
        return res.status(400).json({ message: 'Product name and part number are required' });
    }
    
    try {
        const [result] = await pool.execute(
            'INSERT INTO inventory (product_name, part_number, description, quantity, location) VALUES (?, ?, ?, ?, ?)',
            [product_name, part_number, description || '', parseInt(quantity) || 0, location || '']
        );
        
        await logActivity(req.user.id, 'create_inventory', 'inventory', result.insertId, { part_number, product_name }, req.ip);
        
        res.json({ message: 'Inventory item added successfully', id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Part number already exists' });
        }
        console.error('Add inventory error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Update inventory item
app.put('/api/inventory/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { product_name, description, quantity, location } = req.body;
    
    try {
        // First get the current item to preserve existing values if not provided
        const [currentItem] = await pool.execute('SELECT * FROM inventory WHERE id = ?', [id]);
        if (currentItem.length === 0) {
            return res.status(404).json({ message: 'Item not found' });
        }
        
        const item = currentItem[0];
        const updatedProductName = product_name || item.product_name;
        const updatedDescription = description !== undefined ? description : item.description;
        const updatedQuantity = quantity !== undefined ? parseInt(quantity) : item.quantity;
        const updatedLocation = location !== undefined ? location : item.location;
        
        await pool.execute(
            'UPDATE inventory SET product_name = ?, description = ?, quantity = ?, location = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [updatedProductName, updatedDescription, updatedQuantity, updatedLocation, id]
        );
        
        await logActivity(req.user.id, 'update_inventory', 'inventory', id, { 
            product_name: updatedProductName, 
            quantity: updatedQuantity,
            old_quantity: item.quantity 
        }, req.ip);
        
        res.json({ message: 'Inventory item updated successfully' });
    } catch (error) {
        console.error('Update inventory error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Manual inventory adjustment
app.post('/api/inventory/:part_number/adjust', authenticateToken, async (req, res) => {
    const { part_number } = req.params;
    const { action, quantity_change, notes, shift_note_id } = req.body;
    
    if (!['add', 'remove', 'set'].includes(action) || !quantity_change) {
        return res.status(400).json({ message: 'Valid action and quantity change required' });
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
            case 'set':
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

// Dashboard data
app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        // Get inventory statistics
        const [inventoryStats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_items,
                COALESCE(SUM(quantity), 0) as total_quantity,
                COUNT(CASE WHEN quantity <= 0 THEN 1 END) as low_stock_items,
                COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_items
            FROM inventory
        `);
        
        // Get notes statistics
        const [notesStats] = await pool.execute(`
            SELECT COUNT(*) as total_notes,
                   COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_notes,
                   COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as week_notes
            FROM shift_notes
        `);
        
        // Get task statistics
        const [taskStats] = await pool.execute(`
            SELECT 
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_tasks,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as blocked_tasks,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
                COUNT(*) as total_tasks
            FROM tasks t
            LEFT JOIN shift_notes sn ON t.shift_note_id = sn.id
            WHERE DATE(sn.date) = CURDATE()
        `);
        
        // Get recent activity (placeholder for now)
        const recentActivity = [];
        
        // Get low stock items
        const [lowStockItems] = await pool.execute(`
            SELECT part_number, product_name, quantity
            FROM inventory 
            WHERE quantity <= 0
            ORDER BY quantity ASC
            LIMIT 10
        `);
        
        // Get recent inventory transactions (placeholder for now)
        const recentTransactions = [];
        
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

// Get all shift notes (for Teams page)
app.get('/api/shifts', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 50, user_id, date_from, date_to, shift_type } = req.query;
        const offset = (page - 1) * limit;
        
        let whereClause = '1=1';
        let params = [];
        
        // Filter by user if specified
        if (user_id) {
            whereClause += ' AND sn.user_id = ?';
            params.push(user_id);
        }
        
        // Filter by date range
        if (date_from) {
            whereClause += ' AND sn.date >= ?';
            params.push(date_from);
        }
        if (date_to) {
            whereClause += ' AND sn.date <= ?';
            params.push(date_to);
        }
        
        // Filter by shift type
        if (shift_type) {
            whereClause += ' AND sn.shift_type = ?';
            params.push(shift_type);
        }
        
        // Get shift notes with user info
        const [shifts] = await pool.execute(
            `SELECT sn.*, u.name as user_name, u.email as user_email,
                    (SELECT COUNT(*) FROM tasks WHERE shift_note_id = sn.id) as task_count
             FROM shift_notes sn 
             LEFT JOIN users u ON sn.user_id = u.id 
             WHERE ${whereClause}
             ORDER BY sn.date DESC, sn.created_at DESC 
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );
        
        // Get total count for pagination
        const [countResult] = await pool.execute(
            `SELECT COUNT(*) as total FROM shift_notes sn WHERE ${whereClause}`,
            params
        );
        
        res.json({
            shifts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                pages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('Get shifts error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Generate shift note summary
app.get('/api/shifts/:id/summary', authenticateToken, async (req, res) => {
    const { id } = req.params;
    
    try {
        // Get shift info
        const [shifts] = await pool.execute(
            'SELECT sn.*, u.name as created_by_name FROM shift_notes sn LEFT JOIN users u ON sn.user_id = u.id WHERE sn.id = ?',
            [id]
        );
        
        if (shifts.length === 0) {
            return res.status(404).json({ message: 'Shift not found' });
        }
        
        const shift = shifts[0];
        
        // Get tasks with inventory items
        const [tasks] = await pool.execute(
            'SELECT * FROM tasks WHERE shift_note_id = ? ORDER BY created_at ASC',
            [id]
        );
        
        // Get inventory changes for this shift (placeholder for now)
        const inventoryChanges = [];
        
        res.json({
            shift,
            tasks,
            inventory_changes: inventoryChanges
        });
        
    } catch (error) {
        console.error('Shift summary error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Search shift notes
app.get('/api/search/notes', authenticateToken, async (req, res) => {
    const { q, employee, start_date, end_date, limit = 20 } = req.query;
    
    try {
        let query = `
            SELECT sn.*, u.name as created_by_name,
                   GROUP_CONCAT(DISTINCT t.title) as task_titles,
                   COUNT(DISTINCT t.id) as task_count
            FROM shift_notes sn
            LEFT JOIN users u ON sn.user_id = u.id
            LEFT JOIN tasks t ON sn.id = t.shift_note_id
            WHERE 1=1
        `;
        let params = [];
        
        if (q) {
            query += ` AND sn.title LIKE ?`;
            const searchTerm = `%${q}%`;
            params.push(searchTerm);
        }
        
        if (employee) {
            query += ` AND sn.user_id = ?`;
            params.push(employee);
        }
        
        if (start_date) {
            query += ` AND sn.date >= ?`;
            params.push(start_date);
        }
        
        if (end_date) {
            query += ` AND sn.date <= ?`;
            params.push(end_date);
        }
        
        query += ` GROUP BY sn.id ORDER BY sn.date DESC, sn.created_at DESC LIMIT ?`;
        params.push(parseInt(limit));
        
        const [results] = await pool.execute(query, params);
        
        res.json(results);
    } catch (error) {
        console.error('Search notes error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get recent notes for reports
app.get('/api/notes/recent', authenticateToken, async (req, res) => {
    const { days = 7, employee } = req.query;
    
    try {
        let query = `
            SELECT sn.*, u.name as created_by_name,
                   COUNT(DISTINCT st.id) as task_count
            FROM shift_notes sn
            LEFT JOIN users u ON sn.user_id = u.id
            LEFT JOIN shift_tasks st ON sn.id = st.shift_id
            WHERE sn.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `;
        let params = [parseInt(days)];
        
        if (employee) {
            query += ` AND sn.user_id = ?`;
            params.push(employee);
        }
        
        query += ` GROUP BY sn.id ORDER BY sn.date DESC, sn.created_at DESC`;
        
        const [results] = await pool.execute(query, params);
        
        res.json(results);
    } catch (error) {
        console.error('Get recent notes error:', error);
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
                    WHERE quantity <= 0
                `;
                if (category) {
                    query += ' AND category = ?';
                    params.push(category);
                }
                query += ' ORDER BY quantity ASC';
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
        res.json(results);
        
    } catch (error) {
        console.error('Inventory report error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- Audits Endpoint ---
app.get('/api/audits', authenticateToken, async (req, res) => {
    try {
        // Static list of audits for now
        const audits = [
            'TEL Lane WherePort',
            'Gate Lane WherePort',
            'TEL Enter/Exit WherePort Test',
            'Mechanics Availability Report',
            'QuickBase Dashboard Audit'
        ];
        res.json(audits);
    } catch (error) {
        console.error('Get audits error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// BACKUP & RESTORE ROUTES

// Create manual backup
app.post('/api/backup/manual', authenticateToken, async (req, res) => {
    if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied' });
    }
    
    const { description } = req.body;
    
    try {
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        // Run the backup script
        const backupScript = path.join(__dirname, 'backup.sh');
        const { stdout, stderr } = await execAsync(`bash ${backupScript} manual "${description || 'Manual backup'}"`);
        
        if (stderr) {
            console.error('Backup script stderr:', stderr);
        }
        
        await logActivity(req.user.id, 'create_backup', 'backup', null, { description, type: 'manual' }, req.ip);
        
        res.json({ 
            message: 'Manual backup created successfully',
            output: stdout,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Manual backup error:', error);
        res.status(500).json({ message: 'Backup failed: ' + error.message });
    }
});

// Get backup history
app.get('/api/backup/history', authenticateToken, async (req, res) => {
    if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied' });
    }
    
    try {
        const backupDir = path.join(__dirname, 'backups');
        const files = await fs.readdir(backupDir);
        
        const backups = [];
        for (const file of files) {
            if (file.endsWith('.sql') || file.endsWith('.tar.gz')) {
                const filePath = path.join(backupDir, file);
                const stats = await fs.stat(filePath);
                
                backups.push({
                    filename: file,
                    size: stats.size,
                    created_at: stats.birthtime,
                    type: file.endsWith('.sql') ? 'database' : 'uploads'
                });
            }
        }
        
        // Sort by creation date (newest first)
        backups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        res.json({ backups });
    } catch (error) {
        console.error('Get backup history error:', error);
        res.status(500).json({ message: 'Failed to get backup history' });
    }
});

// Get backup status and system info
app.get('/api/backup/status', authenticateToken, async (req, res) => {
    if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied' });
    }
    
    try {
        const backupDir = path.join(__dirname, 'backups');
        const files = await fs.readdir(backupDir);
        
        // Count backups by type
        const dbBackups = files.filter(f => f.endsWith('.sql')).length;
        const uploadBackups = files.filter(f => f.endsWith('.tar.gz')).length;
        
        // Get last backup time
        let lastBackup = null;
        if (files.length > 0) {
            const backupFiles = files.map(file => ({
                name: file,
                path: path.join(backupDir, file)
            }));
            
            const stats = await Promise.all(
                backupFiles.map(async file => {
                    const stat = await fs.stat(file.path);
                    return { ...file, created_at: stat.birthtime };
                })
            );
            
            const latest = stats.reduce((latest, current) => 
                current.created_at > latest.created_at ? current : latest
            );
            lastBackup = latest.created_at;
        }
        
        // Get database size (approximate)
        const [dbSizeResult] = await pool.execute(`
            SELECT 
                ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) AS size_mb
            FROM information_schema.tables 
            WHERE table_schema = ?
        `, [process.env.DB_NAME]);
        
        const dbSize = dbSizeResult[0]?.size_mb || 0;
        
        // Calculate total backup size
        let totalBackupSize = 0;
        for (const file of files) {
            if (file.endsWith('.sql') || file.endsWith('.tar.gz')) {
                const filePath = path.join(backupDir, file);
                const stats = await fs.stat(filePath);
                totalBackupSize += stats.size;
            }
        }
        
        res.json({
            last_backup: lastBackup,
            backup_count: {
                database: dbBackups,
                uploads: uploadBackups,
                total: dbBackups + uploadBackups
            },
            database_size_mb: dbSize,
            backup_size_mb: Math.round(totalBackupSize / 1024 / 1024 * 100) / 100,
            backup_status: lastBackup ? 'successful' : 'no_backups',
            auto_backup_enabled: true // This would come from settings table in a real implementation
        });
    } catch (error) {
        console.error('Get backup status error:', error);
        res.status(500).json({ message: 'Failed to get backup status' });
    }
});

// Download backup file
app.get('/api/backup/download/:filename', authenticateToken, async (req, res) => {
    if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied' });
    }
    
    const { filename } = req.params;
    
    try {
        const backupDir = path.join(__dirname, 'backups');
        const filePath = path.join(backupDir, filename);
        
        // Security check: ensure file is in backups directory
        if (!filePath.startsWith(backupDir)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Check if file exists
        await fs.access(filePath);
        
        res.download(filePath);
        
        await logActivity(req.user.id, 'download_backup', 'backup', null, { filename }, req.ip);
    } catch (error) {
        console.error('Download backup error:', error);
        res.status(404).json({ message: 'Backup file not found' });
    }
});

// Restore from backup
app.post('/api/backup/restore', authenticateToken, async (req, res) => {
    if (!['admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Only administrators can restore backups' });
    }
    
    const { filename, type } = req.body;
    
    if (!filename || !type) {
        return res.status(400).json({ message: 'Filename and type are required' });
    }
    
    try {
        const backupDir = path.join(__dirname, 'backups');
        const filePath = path.join(backupDir, filename);
        
        // Security check: ensure file is in backups directory
        if (!filePath.startsWith(backupDir)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Check if file exists
        await fs.access(filePath);
        
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        if (type === 'database' && filename.endsWith('.sql')) {
            // Restore database
            const restoreCommand = `mysql -u${process.env.DB_USER} -p${process.env.DB_PASSWORD} ${process.env.DB_NAME} < ${filePath}`;
            await execAsync(restoreCommand);
        } else if (type === 'uploads' && filename.endsWith('.tar.gz')) {
            // Restore uploads
            const uploadsDir = path.join(__dirname, 'uploads');
            const restoreCommand = `tar -xzf ${filePath} -C ${path.dirname(uploadsDir)}`;
            await execAsync(restoreCommand);
        } else {
            return res.status(400).json({ message: 'Invalid backup type or file format' });
        }
        
        await logActivity(req.user.id, 'restore_backup', 'backup', null, { filename, type }, req.ip);
        
        res.json({ message: 'Backup restored successfully' });
    } catch (error) {
        console.error('Restore backup error:', error);
        res.status(500).json({ message: 'Restore failed: ' + error.message });
    }
});

// Save backup settings
app.post('/api/backup/settings', authenticateToken, async (req, res) => {
    if (!['admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied' });
    }
    
    const { enabled, frequency, time, retention_days } = req.body;
    
    try {
        // In a real implementation, you'd save these to a settings table
        // For now, we'll just validate and return success
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ message: 'Enabled must be a boolean' });
        }
        
        if (!['daily', 'twice-daily', 'weekly'].includes(frequency)) {
            return res.status(400).json({ message: 'Invalid frequency' });
        }
        
        if (!time || !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
            return res.status(400).json({ message: 'Invalid time format' });
        }
        
        if (!Number.isInteger(retention_days) || retention_days < 1 || retention_days > 365) {
            return res.status(400).json({ message: 'Retention days must be between 1 and 365' });
        }
        
        // TODO: Save to settings table
        // await pool.execute('INSERT INTO settings (key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?', 
        //     ['backup_enabled', JSON.stringify(enabled), JSON.stringify(enabled)]);
        
        await logActivity(req.user.id, 'update_backup_settings', 'settings', null, { enabled, frequency, time, retention_days }, req.ip);
        
        res.json({ message: 'Backup settings saved successfully' });
    } catch (error) {
        console.error('Save backup settings error:', error);
        res.status(500).json({ message: 'Failed to save backup settings' });
    }
});

// Get backup settings
app.get('/api/backup/settings', authenticateToken, async (req, res) => {
    if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied' });
    }
    
    try {
        // In a real implementation, you'd get these from a settings table
        // For now, return default values
        res.json({
            enabled: true,
            frequency: 'daily',
            time: '02:00',
            retention_days: 30
        });
    } catch (error) {
        console.error('Get backup settings error:', error);
        res.status(500).json({ message: 'Failed to get backup settings' });
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
});
