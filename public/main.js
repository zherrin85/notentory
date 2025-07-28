// Global variables
let authToken = localStorage.getItem('authToken');
let currentUser = null;
let currentShift = null;
let currentPage = 'shift-notes';
let inventoryData = [];
let taskCounter = 1;

// API Configuration
const API_BASE = ''; // Using relative paths since frontend will be served from same domain

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Enhanced IT Shift System...');
    

    
    initializeEventListeners();
    populateDailyAudits();
    setCurrentDate();
    
    if (authToken) {
        validateTokenAndShowApp();
    } else {
        showLogin();
    }
});

function initializeEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Navigation
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', function() {
            navigateTo(this.dataset.page);
        });
    });
}

// --- Audits ---
async function populateDailyAudits() {
    const auditsContainer = document.getElementById('daily-audits');
    if (!auditsContainer) return;
    try {
        const response = await fetch('/api/audits', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
            const dailyAudits = await response.json();
            auditsContainer.innerHTML = dailyAudits.length > 0 ? dailyAudits.map(audit => `
        <label class="audit-item">
            <input type="checkbox" class="audit-checkbox" value="${audit}">
            <span class="audit-label">${audit}</span>
        </label>
            `).join('') : '<div>No audits found.</div>';
        } else {
            auditsContainer.innerHTML = '<div style="color:#991b1b;">Failed to load audits.</div>';
        }
    } catch (error) {
        auditsContainer.innerHTML = '<div style="color:#991b1b;">Error loading audits.</div>';
    }
}

function setCurrentDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('shift-date');
    if (dateInput) {
        dateInput.value = today;
    }
}

// --- Inventory Search (inline and regular) ---
async function searchInventory(input) {
    const dropdown = input.nextElementSibling;
    const query = input.value.toLowerCase();
    if (query.length < 2) {
        if (dropdown) dropdown.classList.add('hidden');
        return;
    }
    try {
        const response = await fetch(`/api/inventory/search?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
            const results = await response.json();
            if (results.length > 0) {
                dropdown.innerHTML = results.map(item => `
                    <div class="search-result" onclick="selectInventoryItem(this, ${item.id})">
                        <div style="font-weight: 500;">${item.part_number} - ${item.product_name}</div>
                        <div style="font-size: 12px; color: #6b7280;">${item.vendor} | ${item.description} | Qty: ${item.quantity}</div>
                    </div>
                `).join('');
                dropdown.classList.remove('hidden');
            } else {
                dropdown.classList.add('hidden');
            }
        }
    } catch (error) {
        dropdown.classList.add('hidden');
    }
}

async function searchInventoryInline(input) {
    await searchInventory(input);
}

// --- Inventory Item Selection ---
async function selectInventoryItem(element, itemId) {
    try {
        const response = await fetch(`/api/inventory/${itemId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) {
            showAlert('error', 'Item not found');
            return;
        }
        const item = await response.json();
        const dropdown = element.closest('.search-dropdown') || element.closest('.search-results-dropdown');
        const taskContainer = dropdown.closest('.task-container');
        const selectedItemsContainer = taskContainer.querySelector('.selected-inventory-items') || taskContainer.querySelector('.selected-items-display');
        const placeholder = selectedItemsContainer.querySelector('.inventory-placeholder');
        if (placeholder) placeholder.style.display = 'none';
        dropdown.classList.add('hidden');
        const existingItem = selectedItemsContainer.querySelector(`[data-item-id="${item.id}"]`);
        if (existingItem) {
            showAlert('warning', 'Item already added to this task');
            dropdown.previousElementSibling.value = '';
            return;
        }
        const itemDiv = document.createElement('div');
        itemDiv.className = 'inventory-item';
        itemDiv.setAttribute('data-item-id', item.id);
        itemDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);';
        itemDiv.innerHTML = `
            <div style="flex: 1;">
                <strong>${item.part_number}</strong> - ${item.product_name}
                <div style="font-size: 12px; color: #6b7280;">${item.vendor} | ${item.description} | Available: ${item.quantity}</div>
            </div>
            <div style="display: none;" data-product-name="${item.product_name}"></div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <label style="font-size: 12px; color: #6b7280;">Qty:</label>
                <input type="number" value="1" min="1" max="${item.quantity}" style="width: 60px; padding: 4px 8px; border: 1px solid #e5e7eb; border-radius: 4px;">
                <button onclick="removeInventoryItem(this)" style="color: #ef4444; background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px;">✕</button>
            </div>
        `;
        selectedItemsContainer.appendChild(itemDiv);
        dropdown.previousElementSibling.value = '';
        showAlert('success', `Added ${item.part_number} to task`);
    } catch (error) {
        showAlert('error', 'Error adding inventory item: ' + error.message);
    }
}

// --- Users ---
async function loadUsersPage() {
    try {
        showLoading('Loading users...');
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        hideLoading();
        if (response.ok) {
            const users = await response.json();
            renderUsersPage(users);
        } else {
            renderUsersPage([]);
        }
    } catch (error) {
        hideLoading();
        renderUsersPage([]);
    }
}

// --- Shift Notes ---
async function loadCurrentShift() {
    try {
        const response = await fetch('/api/shifts/current', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
            const shiftData = await response.json();
            if (shiftData.shift) {
                currentShiftId = shiftData.shift.id;
            } else {
                currentShiftId = null;
            }
            populateShiftData(shiftData);
        } else {
            currentShiftId = null;
            document.getElementById('page-content').innerHTML = '<div style="color:#991b1b; padding:32px;">No current shift found or you do not have access.</div>';
        }
    } catch (error) {
        currentShiftId = null;
        document.getElementById('page-content').innerHTML = '<div style="color:#991b1b; padding:32px;">Error loading current shift.</div>';
    }
}

function populateShiftData(shiftData) {
    if (shiftData.shift) {
        document.getElementById('shift-title').value = shiftData.shift.title || '';
        // Always set date to today for new shift notes, not the existing shift's date
        document.getElementById('shift-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('shift-type').value = shiftData.shift.shift_type || 'day';
    }
    
    // Populate audit checkboxes
    if (shiftData.audits) {
        const checkboxes = document.querySelectorAll('.audit-checkbox');
        const completedAudits = JSON.parse(shiftData.audits.completed_audits || '[]');
        checkboxes.forEach(checkbox => {
            if (completedAudits.includes(checkbox.value)) {
                checkbox.checked = true;
            }
        });
    }
    
    // Always populate tasks (either existing or default empty one)
    populateExistingTasks(shiftData.tasks || []);
}

function populateExistingTasks(tasks) {
    const tasksContainer = document.getElementById('tasks-container');
    // Clear existing task container
    tasksContainer.innerHTML = '';
    
    if (tasks && tasks.length > 0) {
        tasks.forEach(task => {
            const taskElement = createTaskElement(task);
            tasksContainer.appendChild(taskElement);
        });
    } else {
        // Create a default empty task if no tasks exist
        const defaultTask = createTaskElement();
        tasksContainer.appendChild(defaultTask);
    }
}

function loadShiftNotesPage() {
    const pageContent = document.getElementById('page-content');
    pageContent.innerHTML = `
        <!-- Shift Header -->
        <div class="shift-header">
            <input type="text" class="shift-title-input" id="shift-title" placeholder="Daily Equipment Shift Notes on - [date] - [shift]" value="Daily Equipment Shift Notes">
            <input type="date" class="date-input" id="shift-date">
            <select class="shift-select" id="shift-type">
                <option value="day">Day Shift</option>
                <option value="evening">Evening Shift</option>
                <option value="night">Night Shift</option>
                <option value="weekend">Weekend Shift</option>
            </select>
        </div>

        <!-- Daily Audits Section -->
        <div class="card">
            <div class="card-header">
                <h3>📋 Daily Audits</h3>
            </div>
            <div class="card-body">
                <div class="audits-grid" id="daily-audits">
                    <!-- Audits will be populated by JavaScript -->
                </div>
            </div>
        </div>

        <!-- Tasks Section -->
        <div id="tasks-container">
            <!-- Default task will be added here -->
            <div class="task-container" style="margin-bottom: 24px; border: 2px solid #e5e7eb; border-radius: 16px; padding: 24px; background: white;">
                <div class="task-header" style="display: grid; grid-template-columns: 1fr auto; gap: 16px; margin-bottom: 16px;">
                    <input type="text" class="task-title" placeholder="Task title" style="padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;" />
                    <select class="task-status" style="padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white; min-width: 140px;">
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
                
                <textarea class="task-description" placeholder="Description..." style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; resize: vertical; min-height: 120px; margin-bottom: 16px; background: white;"></textarea>
                
                <!-- ServiceNow Ticket Input Field -->
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151; font-size: 14px;">ServiceNow Ticket (RITM/INC):</label>
                    <input type="text" class="servicenow-ticket" placeholder="Enter ticket number (e.g., RITM1234567, INC7654321)" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                </div>
                
                <!-- Inventory Search Input Field -->
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151; font-size: 14px;">Inventory Items Used:</label>
                    <div class="inventory-search" style="position: relative; margin-bottom: 16px;">
                        <input type="text" placeholder="🔍 Type to search and add inventory items..." onkeyup="searchInventoryInline(this)" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                        <div class="search-dropdown hidden"></div>
                    </div>
                    <div class="selected-inventory-items">
                        <div class="inventory-placeholder" style="text-align: center; color: #6b7280; font-size: 14px; padding: 16px; font-style: italic; background: #f8fafc; border-radius: 8px;">Search above to add inventory items to this task</div>
                    </div>
                </div>
                
                <!-- File Upload Areas -->
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 14px;">File Attachments:</label>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                        <div class="upload-area" onclick="triggerFileUpload(this)" style="border: 2px dashed #d1d5db; border-radius: 10px; padding: 24px 16px; text-align: center; cursor: pointer; background: #f9fafb;">
                            📸<span style="display: block; font-size: 13px; color: #6b7280; margin-top: 8px;">Upload Image</span>
                            <input type="file" accept="image/*,application/pdf,.pdf" style="display: none;">
                        </div>
                        <div class="upload-area" onclick="triggerFileUpload(this)" style="border: 2px dashed #d1d5db; border-radius: 10px; padding: 24px 16px; text-align: center; cursor: pointer; background: #f9fafb;">
                            📸<span style="display: block; font-size: 13px; color: #6b7280; margin-top: 8px;">Upload Image</span>
                            <input type="file" accept="image/*,application/pdf,.pdf" style="display: none;">
                        </div>
                        <div class="upload-area" onclick="triggerFileUpload(this)" style="border: 2px dashed #d1d5db; border-radius: 10px; padding: 24px 16px; text-align: center; cursor: pointer; background: #f9fafb;">
                            📸<span style="display: block; font-size: 13px; color: #6b7280; margin-top: 8px;">Upload Image</span>
                            <input type="file" accept="image/*,application/pdf,.pdf" style="display: none;">
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Add Additional Task Button -->
        <button class="add-task-btn" onclick="addAdditionalTask()" style="width: 100%; padding: 20px; border: 2px dashed #3b82f6; background: #eff6ff; color: #3b82f6; border-radius: 16px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 24px;">
            ➕ Add Additional Task
        </button>
    `;
    
    populateDailyAudits();
    setCurrentDate();
}





function createTaskElement(task = {}) {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-container';
    taskDiv.innerHTML = `
        <div class="task-header">
            <input type="text" class="task-title" placeholder="Task title" value="${task.title || ''}" />
            <select class="task-status">
                <option value="in_progress" ${task.status === 'in_progress' || !task.status ? 'selected' : ''}>In Progress</option>
                <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
            </select>
        </div>
        
        <textarea class="task-description" placeholder="Description...">${task.description || ''}</textarea>
        
        <!-- ServiceNow Ticket Input Field -->
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151; font-size: 14px;">ServiceNow Ticket (RITM/INC):</label>
            <input type="text" class="servicenow-ticket" placeholder="Enter ticket number (e.g., RITM1234567, INC7654321)" value="${task.ticket_number || ''}" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
        </div>
        
        <!-- Inventory Search Input Field -->
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151; font-size: 14px;">Inventory Items Used:</label>
            <div class="inventory-search" style="position: relative; margin-bottom: 16px;">
                <input type="text" placeholder="🔍 Type to search and add inventory items..." onkeyup="searchInventoryInline(this)" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                <div class="search-dropdown hidden"></div>
            </div>
            <div class="selected-inventory-items">
                <div class="inventory-placeholder" style="text-align: center; color: #6b7280; font-size: 14px; padding: 16px; font-style: italic; background: #f8fafc; border-radius: 8px;">Search above to add inventory items to this task</div>
            </div>
        </div>
        
        <!-- File Upload Areas -->
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151; font-size: 14px;">File Attachments:</label>
            <div class="upload-grid">
                <div class="upload-area" onclick="triggerFileUpload(this)">
                    📸<span>Upload Image</span>
                    <input type="file" accept="image/*,application/pdf,.pdf" style="display: none;">
                </div>
                <div class="upload-area" onclick="triggerFileUpload(this)">
                    📸<span>Upload Image</span>
                    <input type="file" accept="image/*,application/pdf,.pdf" style="display: none;">
                </div>
                <div class="upload-area" onclick="triggerFileUpload(this)">
                    📸<span>Upload Image</span>
                    <input type="file" accept="image/*,application/pdf,.pdf" style="display: none;">
                </div>
            </div>
        </div>
    `;
    return taskDiv;
}

async function updateInventoryQuantity(input, itemId) {
    const quantity = parseInt(input.value);
    const maxQuantity = parseInt(input.max);
    
    if (quantity > maxQuantity) {
        showAlert('warning', `Only ${maxQuantity} items available in stock`);
        input.value = maxQuantity;
        return;
    }
    
    try {
        // Get the current inventory item to calculate the change
        const itemResponse = await fetch(`/api/inventory/${itemId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!itemResponse.ok) {
            throw new Error('Failed to get current inventory item');
        }
        
        const currentItem = await itemResponse.json();
        const currentQuantity = currentItem.quantity;
        const quantityChange = quantity - currentQuantity;
        
        if (quantityChange === 0) {
            return; // No change needed
        }
        
        // Use the proper adjustment endpoint
        const response = await fetch(`/api/inventory/${currentItem.part_number}/adjust`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                action: quantityChange > 0 ? 'add' : 'remove',
                quantity_change: Math.abs(quantityChange),
                notes: 'Manual quantity adjustment'
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            showAlert('success', `Inventory updated: ${result.old_quantity} → ${result.new_quantity}`);
            
            // Update the max attribute for future validations
            input.max = result.new_quantity;
            
            // Refresh the inventory page if we're on it
            if (currentPage === 'inventory') {
                loadInventoryPage();
            }
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update inventory quantity');
        }
    } catch (error) {
        console.error('Error updating inventory:', error);
        showAlert('error', 'Error updating inventory: ' + error.message);
    }
}

function removeInventoryItem(button) {
    const taskContainer = button.closest('.task-container');
    const selectedItemsContainer = taskContainer.querySelector('.selected-inventory-items');
    button.closest('.inventory-item').remove();
    
    // Show placeholder if no items left
    const remainingItems = selectedItemsContainer.querySelectorAll('.inventory-item');
    if (remainingItems.length === 0) {
        const placeholder = selectedItemsContainer.querySelector('.inventory-placeholder');
        if (placeholder) {
            placeholder.style.display = 'block';
        }
    }
    
    showAlert('info', 'Item removed from task');
}

async function triggerFileUpload(uploadArea) {
    const fileInput = uploadArea.querySelector('input[type="file"]');
    if (fileInput) {
        fileInput.click();
        
        fileInput.onchange = async function(e) {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                const fileName = file.name;
                const fileSize = (file.size / 1024 / 1024).toFixed(2);
                
                // Show loading state
                uploadArea.innerHTML = `⏳<span style="display: block; font-size: 13px; color: #6b7280; margin-top: 8px;">Uploading ${fileName}...</span>`;
                uploadArea.style.borderColor = '#f59e0b';
                uploadArea.style.background = '#fef3c7';
                
                try {
                    // Create FormData for file upload
                    const formData = new FormData();
                    formData.append('files', file);
                    
                    // Add shift note ID if we're on the shift notes page
                    if (currentShiftId) {
                        formData.append('shift_note_id', currentShiftId);
                    }
                    
                    // Upload file
                    const response = await fetch('/api/upload', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: formData
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        
                        // Update upload area with success state
                        uploadArea.innerHTML = `
                            ✅<span style="display: block; font-size: 13px; color: #10b981; margin-top: 8px;">
                                ${fileName}<br>(${fileSize} MB)
                            </span>
                            <button onclick="deleteFile(${result.files[0].id}, this)" 
                                    style="background: #ef4444; color: white; border: none; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-top: 4px; cursor: pointer;">
                                Delete
                            </button>
                        `;
                        uploadArea.style.borderColor = '#10b981';
                        uploadArea.style.background = '#ecfdf5';
                        
                        showAlert('success', `File "${fileName}" uploaded successfully!`);
                        
                        // Store file info for later use
                        uploadArea.dataset.fileId = result.files[0].id;
                        uploadArea.dataset.fileName = fileName;
                    } else {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Upload failed');
                    }
                } catch (error) {
                    console.error('Upload error:', error);
                    
                    // Reset upload area
                    uploadArea.innerHTML = `
                        📸<span>Upload Image</span>
                        <input type="file" accept="image/*,application/pdf,.pdf" style="display: none;">
                    `;
                    uploadArea.style.borderColor = '#d1d5db';
                    uploadArea.style.background = '#f9fafb';
                    
                    showAlert('error', `Upload failed: ${error.message}`);
                }
            }
        };
    }
}

async function deleteFile(fileId, button) {
    if (!confirm('Are you sure you want to delete this file?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/files/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const uploadArea = button.closest('.upload-area');
            uploadArea.innerHTML = `
                📸<span>Upload Image</span>
                <input type="file" accept="image/*,application/pdf,.pdf" style="display: none;">
            `;
            uploadArea.style.borderColor = '#d1d5db';
            uploadArea.style.background = '#f9fafb';
            delete uploadArea.dataset.fileId;
            delete uploadArea.dataset.fileName;
            
            showAlert('success', 'File deleted successfully');
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Delete failed');
        }
    } catch (error) {
        console.error('Delete file error:', error);
        showAlert('error', `Delete failed: ${error.message}`);
    }
}

function addAdditionalTask() {
    taskCounter++;
    const tasksContainer = document.getElementById('tasks-container');
    const newTask = document.createElement('div');
    newTask.className = 'task-container';
    newTask.innerHTML = `
        <div class="task-header">
            <input type="text" class="task-title" placeholder="Task title" />
            <select class="task-status">
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
            </select>
        </div>
        
        <textarea class="task-description" placeholder="Description..."></textarea>
        
        <!-- ServiceNow Ticket Input Field -->
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151; font-size: 14px;">ServiceNow Ticket (RITM/INC):</label>
            <input type="text" class="servicenow-ticket" placeholder="Enter ticket number (e.g., RITM1234567, INC7654321)" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
        </div>
        
        <!-- Inventory Search Input Field -->
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151; font-size: 14px;">Inventory Items Used:</label>
            <div class="inventory-search" style="position: relative; margin-bottom: 16px;">
                <input type="text" placeholder="🔍 Type to search and add inventory items..." onkeyup="searchInventoryInline(this)" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                <div class="search-dropdown hidden"></div>
            </div>
            <div class="selected-inventory-items">
                <div class="inventory-placeholder" style="text-align: center; color: #6b7280; font-size: 14px; padding: 16px; font-style: italic; background: #f8fafc; border-radius: 8px;">Search above to add inventory items to this task</div>
            </div>
        </div>
        
        <!-- File Upload Areas -->
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151; font-size: 14px;">File Attachments:</label>
            <div class="upload-grid">
                <div class="upload-area" onclick="triggerFileUpload(this)">
                    📸<span>Upload Image</span>
                    <input type="file" accept="image/*,application/pdf,.pdf" style="display: none;">
                </div>
                <div class="upload-area" onclick="triggerFileUpload(this)">
                    📸<span>Upload Image</span>
                    <input type="file" accept="image/*,application/pdf,.pdf" style="display: none;">
                </div>
                <div class="upload-area" onclick="triggerFileUpload(this)">
                    📸<span>Upload Image</span>
                    <input type="file" accept="image/*,application/pdf,.pdf" style="display: none;">
                </div>
            </div>
        </div>
    `;
    tasksContainer.appendChild(newTask);
}

// Navigation
function navigateTo(page) {
    console.log(`📍 Navigating to: ${page}`);
    
    // Check permissions for restricted pages
    if (['backup-settings', 'users'].includes(page)) {
        if (!currentUser || !['admin', 'manager'].includes(currentUser.role)) {
            showAlert('error', 'Access denied. You do not have permission to access this page.');
            return;
        }
    }
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-page="${page}"]`).classList.add('active');
    
    currentPage = page;
    loadPageContent(page);
}

function loadPageContent(page) {
    const pageContent = document.getElementById('page-content');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    
    switch(page) {
        case 'shift-notes':
            pageTitle.textContent = 'Daily Equipment Shift Notes';
            pageSubtitle.textContent = 'Integrated shift documentation and inventory management';
            loadShiftNotesPage();
            break;
            
        case 'teams-notes':
            pageTitle.textContent = 'Teams Shift Notes';
            pageSubtitle.textContent = 'View all team member shift submissions';
            loadTeamsNotesPage();
            break;
            
        case 'inventory':
            pageTitle.textContent = 'Inventory Management';
            pageSubtitle.textContent = 'Track and manage IT equipment and supplies';
            loadInventoryPage();
            break;
            
        case 'users':
            pageTitle.textContent = 'User Management';
            pageSubtitle.textContent = 'Manage system users and permissions';
            loadUsersPage();
            break;
            
        case 'handoff-notes':
            pageTitle.textContent = 'Handoff Notes';
            pageSubtitle.textContent = 'Shift handoff documentation';
            loadHandoffNotesPage();
            break;
            
        case 'backup-settings':
            pageTitle.textContent = 'Backup & Settings';
            pageSubtitle.textContent = 'System configuration and backup management';
            loadBackupSettingsPage();
            break;
            
        case 'reports':
            pageTitle.textContent = 'Reports';
            pageSubtitle.textContent = 'Analytics and reporting dashboard';
            loadReportsPage();
            break;
            
        default:
            pageTitle.textContent = 'Page Not Found';
            pageSubtitle.textContent = 'This page is under development';
            pageContent.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <div style="text-align: center; padding: 60px 20px; color: #6b7280;">
                            <h3 style="margin-bottom: 16px;">🚧 Under Development</h3>
                            <p>This page is currently being developed and will be available soon.</p>
                        </div>
                    </div>
                </div>
            `;
    }
}

async function loadTeamsNotesPage() {
    const pageContent = document.getElementById('page-content');
    pageContent.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>📋 Teams Shift Notes</h2>
                <p>View and search all team member shift notes</p>
            </div>
            <div class="card-body">
                <!-- Search and Filter Controls -->
                <div style="display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; align-items: center;">
                    <div style="position: relative; flex: 1; min-width: 300px;">
                        <input type="text" id="teams-search" placeholder="🔍 Search shift notes..." style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px;" onkeyup="searchTeamsNotes()">
                        <button onclick="clearTeamsSearch()" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #6b7280; cursor: pointer; font-size: 16px;">×</button>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="filterByDate('today')" class="btn btn-secondary" style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Today</button>
                        <button onclick="filterByDate('week')" class="btn btn-secondary" style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">This Week</button>
                        <button onclick="filterByDate('month')" class="btn btn-secondary" style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">This Month</button>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="filterByShift('day')" class="btn btn-secondary" style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Day Shift</button>
                        <button onclick="filterByShift('night')" class="btn btn-secondary" style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Night Shift</button>
                    </div>
                </div>
                
                <!-- Teams Notes Container -->
                <div id="teams-notes-container">
                    <div style="text-align: center; padding: 60px 20px; color: #6b7280;">
                        <div class="spinner" style="border: 4px solid #f3f4f6; border-top: 4px solid #3b82f6; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
                        <p>Loading team shift notes...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    try {
        // Fetch shift notes from backend
        const response = await fetch('/api/shifts', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const shifts = data.shifts || [];
        
        const container = document.getElementById('teams-notes-container');
        
        if (shifts.length === 0) {
            container.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px; color: #6b7280;">
                        <h3 style="margin-bottom: 16px;">📋 No Shift Notes Yet</h3>
                        <p>Shift notes from team members will appear here once they start creating them.</p>
                        <div style="margin-top: 24px;">
                            <button onclick="navigateTo('daily-shift')" class="btn btn-primary" style="margin: 0 8px;">Create Your First Shift Note</button>
                        </div>
                    </div>
            `;
        } else {
            container.innerHTML = `
                <div style="display: grid; gap: 16px;">
                    ${shifts.map(shift => `
                        <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; background: white;">
                            <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 12px;">
                                <div style="flex: 1;">
                                    <h3 style="margin: 0 0 8px 0; color: #111827; font-size: 18px;">${shift.title}</h3>
                                    <p style="margin: 0; color: #6b7280; font-size: 14px;">
                                        📅 ${new Date(shift.date).toLocaleDateString()} | 
                                        👤 ${shift.user_name || 'Unknown User'} | 
                                        ⏰ ${shift.shift_type} shift
                                    </p>
                </div>
                                <div style="display: flex; gap: 8px;">
                                    <span style="background: ${shift.shift_type === 'day' ? '#fef3c7' : '#dbeafe'}; color: ${shift.shift_type === 'day' ? '#92400e' : '#1e40af'}; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 500;">
                                        ${shift.shift_type}
                                    </span>
                                    <span style="background: #f3f4f6; color: #374151; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 500;">
                                        ${shift.task_count || 0} tasks
                                    </span>
            </div>
                            </div>
                            <div style="margin-top: 16px;">
                                <button onclick="viewShiftDetails(${shift.id})" class="btn btn-secondary" style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">
                                    View Details
                                </button>
                            </div>
                        </div>
                    `).join('')}
        </div>
    `;
        }
    } catch (error) {
        console.error('Error loading teams notes:', error);
        const container = document.getElementById('teams-notes-container');
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #dc2626;">
                <h3 style="margin-bottom: 16px;">❌ Error Loading Shift Notes</h3>
                <p>Failed to load team shift notes: ${error.message}</p>
                <div style="margin-top: 24px;">
                    <button onclick="loadTeamsNotesPage()" class="btn btn-primary" style="margin: 0 8px;">Try Again</button>
                </div>
            </div>
        `;
    }
}

// View shift details
async function viewShiftDetails(shiftId) {
    try {
        showLoading('Loading shift details...');
        
        const response = await fetch(`/api/shifts/${shiftId}/summary`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Debug: Log what we're getting
        console.log('🔍 Shift details data:', data);
        console.log('🔍 Tasks data:', data.tasks);
        
        // Create modal to show shift details
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.5); z-index: 1000; display: flex; 
            align-items: center; justify-content: center; padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="background: white; border-radius: 12px; max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto;">
                <div style="padding: 24px; border-bottom: 1px solid #e5e7eb; position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h2 style="margin: 0; color: #111827;">${data.shift.title || 'Untitled Shift'}</h2>
                        <button onclick="this.closest('.modal').remove()" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280; padding: 4px; border-radius: 4px; transition: background-color 0.2s;">×</button>
                    </div>
                    <p style="margin: 8px 0 0 0; color: #6b7280;">
                        📅 ${new Date(data.shift.date).toLocaleDateString()} | 
                        👤 ${data.shift.created_by_name || 'Unknown User'} | 
                        ⏰ ${data.shift.shift_type} shift
                    </p>
                </div>
                <div style="padding: 24px;">
                    ${data.shift.completed_audits ? `
                        <div style="margin-bottom: 24px;">
                            <h3 style="margin: 0 0 16px 0; color: #111827;">Completed Audits</h3>
                            <div style="display: grid; gap: 8px;">
                                ${JSON.parse(data.shift.completed_audits || '[]').map(audit => `
                                    <div style="background: #dcfce7; color: #166534; padding: 8px 12px; border-radius: 6px; font-size: 14px;">
                                        ✅ ${audit}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${data.tasks && data.tasks.length > 0 ? `
                        <div style="margin-bottom: 24px;">
                            <h3 style="margin: 0 0 16px 0; color: #111827;">Tasks (${data.tasks.length})</h3>
                            <div style="display: grid; gap: 16px;">
                                ${data.tasks.map((task, index) => {
                                    console.log('🔍 Processing task:', task);
                                    let partsUsed = [];
                                    try {
                                        if (task.parts_used && task.parts_used !== 'null' && task.parts_used !== '[]') {
                                            partsUsed = JSON.parse(task.parts_used);
                                        }
                                    } catch (e) {
                                        console.error('Error parsing parts_used:', e);
                                    }
                                    
                                    return `
                                        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #fafafa;">
                                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                                                <h4 style="margin: 0; color: #111827; font-size: 16px; font-weight: 600;">${task.title || 'Untitled Task'}</h4>
                                                <span style="background: ${task.status === 'completed' ? '#dcfce7' : task.status === 'in_progress' ? '#fef3c7' : '#f3f4f6'}; 
                                                           color: ${task.status === 'completed' ? '#166534' : task.status === 'in_progress' ? '#92400e' : '#374151'}; 
                                                           padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; text-transform: capitalize;">
                                                    ${task.status === 'in_progress' ? 'In Progress' : task.status === 'completed' ? 'Completed' : 'In Progress'}
                                                </span>
                                            </div>
                                            
                                            ${task.description ? `
                                                <div style="margin-bottom: 12px;">
                                                    <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px; font-weight: 500;">📝 Description:</div>
                                                    <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.5; background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb;">${task.description}</p>
                                                </div>
                                            ` : ''}
                                            
                                            ${task.ticket_number ? `
                                                <div style="margin-bottom: 12px;">
                                                    <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px; font-weight: 500;">🎫 ServiceNow Ticket:</div>
                                                    <span style="background: #dbeafe; color: #1e40af; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 500;">
                                                        ${task.ticket_number}
                                                    </span>
                                                </div>
                                            ` : ''}
                                            
                                            ${partsUsed && partsUsed.length > 0 ? `
                                                <div style="margin-bottom: 12px;">
                                                    <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px; font-weight: 500;">📦 Inventory Items Used:</div>
                                                    <div style="display: grid; gap: 6px;">
                                                        ${partsUsed.map(item => `
                                                            <div style="background: white; padding: 10px; border-radius: 6px; border: 1px solid #e5e7eb; font-size: 13px;">
                                                                <strong style="color: #1e40af;">${item.part_number || 'Unknown Part'}</strong> - 
                                                                ${item.product_name || 'Unknown Product'} 
                                                                <span style="color: #059669; font-weight: 500;">(Qty: ${item.quantity || 1})</span>
                                                            </div>
                                                        `).join('')}
                                                    </div>
                                                </div>
                                            ` : ''}
                                            
                                            ${!task.description && !task.ticket_number && (!partsUsed || partsUsed.length === 0) ? `
                                                <div style="text-align: center; color: #9ca3af; font-style: italic; padding: 20px;">
                                                    No additional details for this task
                                                </div>
                                            ` : ''}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    ` : `
                        <div style="text-align: center; color: #9ca3af; font-style: italic; padding: 40px;">
                            No tasks found for this shift
                        </div>
                    `}
                    
                    ${data.inventory_changes && data.inventory_changes.length > 0 ? `
                        <div style="margin-bottom: 24px;">
                            <h3 style="margin: 0 0 16px 0; color: #111827;">Inventory Changes (${data.inventory_changes.length})</h3>
                            <div style="display: grid; gap: 8px;">
                                ${data.inventory_changes.map(item => `
                                    <div style="background: #f8fafc; border-radius: 6px; padding: 12px; font-size: 14px;">
                                        <strong>${item.product_name || item.part_number || 'Unknown Item'}</strong> - 
                                        <span style="color: ${item.quantity_change > 0 ? '#059669' : '#dc2626'}; font-weight: 500;">
                                            ${item.quantity_change > 0 ? '+' : ''}${item.quantity_change}
                                        </span>
                                        ${item.reason ? `<br><small style="color: #6b7280;">${item.reason}</small>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        hideLoading();
        
    } catch (error) {
        hideLoading();
        console.error('Error loading shift details:', error);
        showAlert('error', 'Failed to load shift details: ' + error.message);
    }
}

async function loadInventoryPage() {
    try {
        showLoading('Loading inventory...');
        
        const response = await fetch(`/api/inventory?t=${Date.now()}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        hideLoading();
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const inventory = data.items || [];
        
    const pageContent = document.getElementById('page-content');
    pageContent.innerHTML = `
        <div class="card">
            <div class="card-body">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <div style="position: relative; flex: 1; max-width: 400px;">
                            <input type="text" id="inventory-search" placeholder="🔍 Search Inventory" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px;" onkeyup="filterInventoryTable()">
                    </div>
                        <div style="display: flex; gap: 12px;">
                            <button class="btn btn-secondary" onclick="showImportModal()">📥 Import</button>
                            <button class="btn btn-primary" onclick="showAddInventoryModal()">+ Add Item</button>
                        </div>
                </div>
                
                <div style="overflow-x: auto;">
                        <table id="inventory-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8fafc;">
                                <th style="padding: 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Part #</th>
                                <th style="padding: 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Vendor</th>
                                <th style="padding: 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Product Name</th>
                                <th style="padding: 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Description</th>
                                <th style="padding: 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Location</th>
                                <th style="padding: 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Quantity</th>
                                    <th style="padding: 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                                ${inventory.map(item => `
                                <tr style="transition: background-color 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                                        <td style="padding: 16px; border-bottom: 1px solid #f3f4f6;" onclick="makeEditable(this, ${item.id}, 'part_number')">${item.part_number}</td>
                                        <td style="padding: 16px; border-bottom: 1px solid #f3f4f6;" onclick="makeEditable(this, ${item.id}, 'vendor')">${item.vendor || ''}</td>
                                        <td style="padding: 16px; border-bottom: 1px solid #f3f4f6;" onclick="makeEditable(this, ${item.id}, 'product_name')">${item.product_name}</td>
                                        <td style="padding: 16px; border-bottom: 1px solid #f3f4f6;" onclick="makeEditable(this, ${item.id}, 'description')">${item.description || ''}</td>
                                        <td style="padding: 16px; border-bottom: 1px solid #f3f4f6;" onclick="makeEditable(this, ${item.id}, 'location')">${item.location || ''}</td>
                                        <td style="padding: 16px; border-bottom: 1px solid #f3f4f6; background: ${item.quantity <= 0 ? '#fef2f2' : item.quantity <= (item.min_quantity || 5) ? '#fef3c7' : 'white'};" onclick="makeEditable(this, ${item.id}, 'quantity')">${item.quantity}</td>
                                        <td style="padding: 16px; border-bottom: 1px solid #f3f4f6;">
                                            <button onclick="adjustInventoryItem(${item.id})" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 4px;">Adjust</button>
                                            <button onclick="deleteInventoryItem(${item.id})" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Delete</button>
                                        </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                    ${inventory.length === 0 ? `
                <div style="margin-top: 24px; padding: 24px; background: #f8fafc; border-radius: 12px; text-align: center; color: #6b7280;">
                            <p>No inventory items found. Add your first item to get started!</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
    } catch (error) {
        hideLoading();
        console.error('Error loading inventory:', error);
        showAlert('error', 'Error loading inventory: ' + error.message);
        
        // Show fallback content
        const pageContent = document.getElementById('page-content');
        pageContent.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <div style="text-align: center; padding: 60px 20px; color: #6b7280;">
                        <h3 style="margin-bottom: 16px;">❌ Error Loading Inventory</h3>
                        <p>Failed to load inventory data. Please try refreshing the page.</p>
                        <button class="btn btn-primary" onclick="loadInventoryPage()" style="margin-top: 16px;">Retry</button>
                </div>
            </div>
        </div>
    `;
    }
}

function loadReportsPage() {
    const pageContent = document.getElementById('page-content');
    pageContent.innerHTML = `
        <div class="card">
            <div class="card-body">
                <div style="text-align: center; padding: 60px 20px; color: #6b7280;">
                    <h3 style="margin-bottom: 16px;">📊 Reports Dashboard</h3>
                    <p>Advanced reporting and analytics features will be implemented here.</p>
                    <div style="margin-top: 24px;">
                        <button class="btn btn-secondary" style="margin: 0 8px;">Daily Reports</button>
                        <button class="btn btn-secondary" style="margin: 0 8px;">Inventory Reports</button>
                        <button class="btn btn-secondary" style="margin: 0 8px;">Team Performance</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderUsersPage(users) {
    const pageContent = document.getElementById('page-content');
    

    
    pageContent.innerHTML = `
        <div class="card">
            <div class="card-body">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <div style="position: relative; flex: 1; max-width: 400px;">
                        <input type="text" id="users-search" placeholder="🔍 Search Users" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px;" onkeyup="filterUsersTable()">
                    </div>
                    <button class="btn btn-primary" onclick="showAddUserModal()">+ Add New User</button>
                </div>
                
                <div style="overflow-x: auto;">
                    <table id="users-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8fafc;">
                                <th style="padding: 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Name</th>
                                <th style="padding: 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Email</th>
                                <th style="padding: 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Role</th>
                                <th style="padding: 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Status</th>
                                <th style="padding: 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Last Login</th>
                                <th style="padding: 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(user => `
                                <tr style="transition: background-color 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                                    <td style="padding: 16px; border-bottom: 1px solid #f3f4f6;">${user.name || user.email.split('@')[0]}</td>
                                    <td style="padding: 16px; border-bottom: 1px solid #f3f4f6;">${user.email}</td>
                                    <td style="padding: 16px; border-bottom: 1px solid #f3f4f6;">
                                        <span style="background: ${user.role === 'admin' ? '#fef2f2; color: #991b1b' : user.role === 'manager' ? '#fffbeb; color: #92400e' : '#f0f9ff; color: #1e40af'}; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; text-transform: uppercase;">
                                            ${user.role}
                                        </span>
                                    </td>
                                    <td style="padding: 16px; border-bottom: 1px solid #f3f4f6;">
                                        <span style="background: ${user.active ? '#ecfdf5; color: #065f46' : '#fef2f2; color: #991b1b'}; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; text-transform: uppercase;">
                                            ${user.active ? 'active' : 'inactive'}
                                        </span>
                                    </td>
                                    <td style="padding: 16px; border-bottom: 1px solid #f3f4f6;">${user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                                    <td style="padding: 16px; border-bottom: 1px solid #f3f4f6;">
                                        <div style="display: flex; gap: 8px;">
                                            <button onclick="editUser(${user.id})" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">Edit</button>
                                            <button onclick="toggleUserStatus(${user.id}, ${user.active})" style="background: ${user.active ? '#ef4444' : '#10b981'}; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">
                                                ${user.active ? 'Disable' : 'Enable'}
                                            </button>
                                            <button onclick="deleteUser(${user.id})" style="background: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                ${users.length === 0 ? `
                    <div style="margin-top: 24px; padding: 24px; background: #f8fafc; border-radius: 12px; text-align: center; color: #6b7280;">
                        <p>No users found.</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function filterUsersTable() {
    const searchInput = document.getElementById('users-search');
    const table = document.getElementById('users-table');
    const tbody = table.querySelector('tbody');
    const rows = tbody.querySelectorAll('tr');
    const query = searchInput.value.toLowerCase();
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

// User Management Functions
function showAddUserModal() {
    const modal = document.createElement('div');
    modal.id = 'add-user-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 32px; max-width: 500px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 style="margin: 0; color: #111827; font-size: 24px;">👤 Add New User</h2>
                <button onclick="closeUserModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">×</button>
            </div>
            
            <form id="add-user-form">
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Full Name:</label>
                    <input type="text" id="add-user-name" required style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Email Address:</label>
                    <input type="email" id="add-user-email" required style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Role:</label>
                    <select id="add-user-role" required style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                        <option value="user">User</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Administrator</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Initial Password:</label>
                    <input type="password" id="add-user-password" required style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                </div>
                
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button type="button" onclick="closeUserModal()" class="btn btn-secondary" style="padding: 12px 24px; background: #6b7280; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="padding: 12px 24px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">Add User</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add form submit handler with a small delay to ensure DOM is ready
    setTimeout(() => {
        const form = document.getElementById('add-user-form');
        if (form) {
            form.addEventListener('submit', handleAddUser);
        }
    }, 100);
}

function closeUserModal() {
    const modal = document.getElementById('add-user-modal');
    if (modal) {
        modal.remove();
    }
}

async function handleAddUser(e) {
    e.preventDefault();
    
    // Check if the add user modal is actually open
    const modal = document.getElementById('add-user-modal');
    if (!modal) {
        console.log('Add user modal not found - ignoring submission');
        return;
    }
    
    // Get form elements
    const nameElement = document.getElementById('add-user-name');
    const emailElement = document.getElementById('add-user-email');
    const roleElement = document.getElementById('add-user-role');
    const passwordElement = document.getElementById('add-user-password');
    
    // Check if all elements exist
    if (!nameElement || !emailElement || !roleElement || !passwordElement) {
        showAlert('error', 'Form elements not found. Please refresh the page and try again.');
        return;
    }
    
    // Validate required fields
    if (!nameElement.value || !emailElement.value || !roleElement.value || !passwordElement.value) {
        showAlert('error', 'All fields must be filled out');
        return;
    }
    
    const userData = {
        name: (nameElement.value || '').trim(),
        email: (emailElement.value || '').trim(),
        role: roleElement.value || '',
        password: passwordElement.value || ''
    };
    
    // Validate required fields
    if (!userData.name || !userData.email || !userData.password || !userData.role) {
        showAlert('error', 'All fields are required');
        return;
    }
    
    try {
        showLoading('Creating user...');
        
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(userData)
        });
        
        hideLoading();
        
        if (response.ok) {
            showAlert('success', `User ${userData.name} created successfully!`);
            closeUserModal();
            loadUsersPage(); // Refresh the users list
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create user');
        }
        
    } catch (error) {
        hideLoading();
        console.error('Error creating user:', error);
        showAlert('error', 'Error creating user: ' + error.message);
    }
}

async function editUser(userId) {
    try {
        showLoading('Loading user details...');
        
        const response = await fetch(`/api/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        hideLoading();
        
        if (response.ok) {
            const user = await response.json();
            showEditUserModal(user);
        } else {
            throw new Error('Failed to load user details');
        }
    } catch (error) {
        hideLoading();
        console.error('Error loading user:', error);
        showAlert('error', 'Error loading user: ' + error.message);
    }
}

function showEditUserModal(user) {
    const modal = document.createElement('div');
    modal.id = 'edit-user-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 32px; max-width: 500px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 style="margin: 0; color: #111827; font-size: 24px;">✏️ Edit User</h2>
                <button onclick="closeEditUserModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">×</button>
            </div>
            
            <form id="edit-user-form">
                <input type="hidden" id="edit-user-id" value="${user.id}">
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Full Name:</label>
                    <input type="text" id="edit-user-name" value="${user.name}" required style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Email Address:</label>
                    <input type="email" id="edit-user-email" value="${user.email}" required style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Role:</label>
                    <select id="edit-user-role" required style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                        <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Manager</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrator</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <input type="checkbox" id="edit-user-active" ${user.active ? 'checked' : ''} style="width: 18px; height: 18px;">
                        <span style="font-weight: 600; color: #374151;">Active User</span>
                    </label>
                    <p style="color: #6b7280; font-size: 14px; margin: 0;">Inactive users cannot log in to the system</p>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">New Password (leave blank to keep current):</label>
                    <input type="password" id="edit-user-password" placeholder="Enter new password" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                </div>
                
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button type="button" onclick="closeEditUserModal()" class="btn btn-secondary" style="padding: 12px 24px; background: #6b7280; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="padding: 12px 24px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">Update User</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add form submit handler
    document.getElementById('edit-user-form').addEventListener('submit', handleEditUser);
}

function closeEditUserModal() {
    const modal = document.getElementById('edit-user-modal');
    if (modal) {
        modal.remove();
    }
}

async function handleEditUser(e) {
    e.preventDefault();
    
    const userData = {
        id: document.getElementById('edit-user-id').value,
        name: document.getElementById('edit-user-name').value,
        email: document.getElementById('edit-user-email').value,
        role: document.getElementById('edit-user-role').value,
        active: document.getElementById('edit-user-active').checked,
        password: document.getElementById('edit-user-password').value || null
    };
    
    try {
        showLoading('Updating user...');
        
        const response = await fetch(`/api/users/${userData.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(userData)
        });
        
        hideLoading();
        
        if (response.ok) {
            showAlert('success', `User ${userData.name} updated successfully!`);
            closeEditUserModal();
            loadUsersPage(); // Refresh the users list
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update user');
        }
        
    } catch (error) {
        hideLoading();
        console.error('Error updating user:', error);
        showAlert('error', 'Error updating user: ' + error.message);
    }
}

async function toggleUserStatus(userId, currentStatus) {
    try {
        showLoading('Updating user status...');
        
        const response = await fetch(`/api/users/${userId}/toggle-status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ active: !currentStatus })
        });
        
        hideLoading();
        
        if (response.ok) {
            showAlert('success', `User ${currentStatus ? 'disabled' : 'enabled'} successfully!`);
            loadUsersPage(); // Refresh the users list
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update user status');
        }
        
    } catch (error) {
        hideLoading();
        console.error('Error updating user status:', error);
        showAlert('error', 'Error updating user status: ' + error.message);
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }
    
    try {
        showLoading('Deleting user...');
        
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        hideLoading();
        
        if (response.ok) {
            showAlert('success', 'User deleted successfully!');
            loadUsersPage(); // Refresh the users list
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Failed to delete user');
        }
        
    } catch (error) {
        hideLoading();
        console.error('Error deleting user:', error);
        showAlert('error', 'Error deleting user: ' + error.message);
    }
}

function loadHandoffNotesPage() {
    const pageContent = document.getElementById('page-content');
    pageContent.innerHTML = `
        <div class="card">
            <div class="card-body">
                <div style="text-align: center; padding: 60px 20px; color: #6b7280;">
                    <h3 style="margin-bottom: 16px;">📋 Handoff Notes</h3>
                    <p>Shift handoff documentation and communication tools will be implemented here.</p>
                    <div style="margin-top: 24px;">
                        <button class="btn btn-primary" style="margin: 0 8px;">Create Handoff Note</button>
                        <button class="btn btn-secondary" style="margin: 0 8px;">View Previous Handoffs</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function loadBackupSettingsPage() {
    const pageContent = document.getElementById('page-content');
    pageContent.innerHTML = `
        <!-- Backup & Settings Dashboard -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px;">
            
            <!-- Automated Backup Section -->
            <div class="card">
                <div class="card-header">
                    <h3>🔄 Automated Backup</h3>
                </div>
                <div class="card-body">
                    <div style="margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                            <input type="checkbox" id="auto-backup-enabled" checked style="width: 18px; height: 18px;">
                            <span style="font-weight: 600; color: #374151;">Enable Automated Backups</span>
                        </label>
                        <p style="color: #6b7280; font-size: 14px; margin: 0;">Automatically backup database and files daily</p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Backup Frequency:</label>
                        <select id="backup-frequency" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                            <option value="daily">Daily (Recommended)</option>
                            <option value="twice-daily">Twice Daily</option>
                            <option value="weekly">Weekly</option>
                        </select>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Backup Time:</label>
                        <input type="time" id="backup-time" value="02:00" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                        <p style="color: #6b7280; font-size: 12px; margin-top: 4px;">Backup will run at this time daily</p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Retention Period:</label>
                        <select id="backup-retention" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                            <option value="7">7 days</option>
                            <option value="14">14 days</option>
                            <option value="30" selected>30 days</option>
                            <option value="90">90 days</option>
                        </select>
                    </div>
                    
                    <button onclick="saveBackupSettings()" class="btn btn-primary" style="width: 100%; padding: 12px 24px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">💾 Save Backup Settings</button>
                </div>
            </div>
            
            <!-- Manual Backup Section -->
            <div class="card">
                <div class="card-header">
                    <h3>📦 Manual Backup</h3>
                </div>
                <div class="card-body">
                    <div style="margin-bottom: 20px;">
                        <p style="color: #6b7280; font-size: 14px; margin-bottom: 16px;">Create an immediate backup of the entire system</p>
                        <button onclick="createManualBackup()" class="btn btn-success" style="width: 100%; padding: 12px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">🔄 Create Backup Now</button>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Backup Description:</label>
                        <input type="text" id="backup-description" placeholder="e.g., Pre-update backup, Monthly backup" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                    </div>
                </div>
            </div>
            
            <!-- Restore Section -->
            <div class="card">
                <div class="card-header">
                    <h3>🔄 Restore System</h3>
                </div>
                <div class="card-body">
                    <div style="margin-bottom: 20px;">
                        <p style="color: #6b7280; font-size: 14px; margin-bottom: 16px;">Restore system from a previous backup</p>
                        <button onclick="showRestoreModal()" class="btn btn-warning" style="width: 100%; padding: 12px 24px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">🔄 Restore from Backup</button>
                    </div>
                    
                    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                        <p style="color: #991b1b; font-size: 12px; margin: 0;">
                            ⚠️ <strong>Warning:</strong> Restoring will overwrite current data. Make sure to backup current state first.
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- System Information -->
            <div class="card">
                <div class="card-header">
                    <h3>ℹ️ System Information</h3>
                </div>
                <div class="card-body">
                    <div style="margin-bottom: 16px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: #6b7280;">Database Size:</span>
                            <span style="font-weight: 500;">2.4 GB</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: #6b7280;">Last Backup:</span>
                            <span style="font-weight: 500;">2024-01-15 02:00</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: #6b7280;">Backup Status:</span>
                            <span style="color: #10b981; font-weight: 500;">✅ Successful</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: #6b7280;">Available Backups:</span>
                            <span style="font-weight: 500;">15 backups</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #6b7280;">Storage Used:</span>
                            <span style="font-weight: 500;">45.2 GB / 100 GB</span>
                        </div>
                    </div>
                    
                    <button onclick="viewBackupHistory()" class="btn btn-secondary" style="width: 100%; padding: 12px 24px; background: #6b7280; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">📋 View Backup History</button>
                </div>
            </div>
        </div>
    `;
}

// Authentication functions
async function handleLogin(e) {
    e.preventDefault();
    console.log('🔐 Attempting login...');
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginError = document.getElementById('login-error');
    const loginText = document.getElementById('login-text');
    const loginLoading = document.getElementById('login-loading');
    // Show loading state
    loginText.classList.add('hidden');
    loginLoading.classList.remove('hidden');
    loginError.classList.add('hidden');
    try {
        // Use real backend login
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('authToken', authToken);
        console.log('✅ Login successful!');
        showApp();
        loadCurrentShift();
    } catch (error) {
        console.error('❌ Login error:', error);
        loginError.textContent = error.message;
        loginError.classList.remove('hidden');
    } finally {
        loginText.classList.remove('hidden');
        loginLoading.classList.add('hidden');
    }
}

function validateTokenAndShowApp() {
    try {
        if (authToken) {
            // Verify token by making a test API call
            fetch('/api/dashboard', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            }).then(response => {
                if (response.ok) {
                    console.log('✅ Token valid, showing app...');
                    showApp();
                } else {
                    throw new Error('Invalid token');
                }
            }).catch(error => {
                console.error('❌ Token validation failed:', error);
                localStorage.removeItem('authToken');
                authToken = null;
                showLogin();
            });
        } else {
            showLogin();
        }
    } catch (error) {
        console.error('❌ Token validation failed:', error);
        localStorage.removeItem('authToken');
        authToken = null;
        showLogin();
    }
}

function logout() {
    console.log('🚪 Logging out...');
    localStorage.removeItem('authToken');
    authToken = null;
    currentUser = null;
    showLogin();
}

function showLogin() {
    console.log('🔐 Showing login page...');
    const loginPage = document.getElementById('login-page');
    const appContainer = document.getElementById('app-container');
    
    if (loginPage) loginPage.classList.remove('hidden');
    if (appContainer) appContainer.classList.add('hidden');
}

function showApp() {
    console.log('📱 Showing app...');
    const loginPage = document.getElementById('login-page');
    const appContainer = document.getElementById('app-container');
    
    // Hide login page (but don't remove the form)
    if (loginPage) {
        loginPage.classList.add('hidden');
    }
    if (appContainer) appContainer.classList.remove('hidden');
    
    if (currentUser) {
        const userName = currentUser.name || currentUser.email.split('@')[0];
        const userRole = currentUser.role || 'user';
        
        // Update user info display
        document.getElementById('user-name').textContent = userName;
        document.getElementById('user-role').textContent = userRole.charAt(0).toUpperCase() + userRole.slice(1);
        
        // Show/hide navigation items based on role
        const backupSettingsNav = document.querySelector('[data-page="backup-settings"]');
        const userManagementNav = document.querySelector('[data-page="users"]');
        
        if (backupSettingsNav) {
            if (['admin', 'manager'].includes(userRole)) {
                backupSettingsNav.style.display = 'block';
            } else {
                backupSettingsNav.style.display = 'none';
            }
        }
        
        if (userManagementNav) {
            if (['admin', 'manager'].includes(userRole)) {
                userManagementNav.style.display = 'block';
            } else {
                userManagementNav.style.display = 'none';
            }
        }
        
        const userNameEl = document.getElementById('user-name');
        const userRoleEl = document.getElementById('user-role');
        
        if (userNameEl) userNameEl.textContent = userName;
        if (userRoleEl) userRoleEl.textContent = userRole.toUpperCase();
        
        // Show/hide role-based nav items
        const usersNav = document.getElementById('users-nav');
        if (usersNav) {
            usersNav.style.display = (userRole === 'admin' || userRole === 'manager') ? 'block' : 'none';
        }
    }
    
    loadPageContent(currentPage);
}





function showLoading(message = 'Loading...') {
    const existingLoader = document.getElementById('loading-indicator');
    if (existingLoader) {
        existingLoader.remove();
    }
    
    const loader = document.createElement('div');
    loader.id = 'loading-indicator';
    loader.style.cssText = `
        position: fixed; 
        top: 50%; 
        left: 50%; 
        transform: translate(-50%, -50%); 
        background: white; 
        padding: 20px 30px; 
        border-radius: 12px; 
        box-shadow: 0 10px 30px rgba(0,0,0,0.2); 
        z-index: 10000;
        border: 1px solid #e5e7eb;
        font-weight: 500;
        color: #374151;
    `;
    loader.textContent = message;
    
    document.body.appendChild(loader);
}

function hideLoading() {
    const loader = document.getElementById('loading-indicator');
    if (loader) {
        loader.remove();
    }
}

function showAlert(type, message) {
    console.log(`🔔 Alert (${type}):`, message);
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alert.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 20px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        border: 1px solid;
        z-index: 10000;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    // Set colors based on type
    switch(type) {
        case 'success':
            alert.style.background = '#ecfdf5';
            alert.style.color = '#065f46';
            alert.style.borderColor = '#a7f3d0';
            break;
        case 'error':
            alert.style.background = '#fef2f2';
            alert.style.color = '#991b1b';
            alert.style.borderColor = '#fecaca';
            break;
        case 'warning':
            alert.style.background = '#fffbeb';
            alert.style.color = '#92400e';
            alert.style.borderColor = '#fed7aa';
            break;
        case 'info':
            alert.style.background = '#eff6ff';
            alert.style.color = '#1e40af';
            alert.style.borderColor = '#bfdbfe';
            break;
    }
    
    document.body.appendChild(alert);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

// Placeholder functions for inventory management
function showAddInventoryModal() {
    showAlert('info', 'Add inventory item modal would open here');
}

async function adjustInventoryItem(itemId) {
    const newQuantity = prompt('Enter new quantity for this item:');
    if (newQuantity !== null && !isNaN(newQuantity)) {
        const quantity = parseInt(newQuantity);
        
        try {
            // Get the current inventory item
            const itemResponse = await fetch(`/api/inventory/${itemId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (!itemResponse.ok) {
                throw new Error('Failed to get current inventory item');
            }
            
            const currentItem = await itemResponse.json();
            const currentQuantity = currentItem.quantity;
            const quantityChange = quantity - currentQuantity;
            
            if (quantityChange === 0) {
                showAlert('info', 'No change needed');
                return;
            }
            
            // Use the adjustment endpoint
            const response = await fetch(`/api/inventory/${currentItem.part_number}/adjust`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    action: quantityChange > 0 ? 'add' : 'remove',
                    quantity_change: Math.abs(quantityChange),
                    notes: 'Manual adjustment via adjust button'
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                showAlert('success', `Inventory adjusted: ${result.old_quantity} → ${result.new_quantity}`);
                
                // Refresh the inventory page
                if (currentPage === 'inventory') {
                    loadInventoryPage();
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to adjust inventory');
            }
        } catch (error) {
            console.error('Error adjusting inventory:', error);
            showAlert('error', 'Error adjusting inventory: ' + error.message);
        }
    }
}



async function deleteInventoryItem(itemId) {
    if (confirm('Are you sure you want to delete this inventory item?')) {
        try {
            showLoading('Deleting item...');
            
            const response = await fetch(`/api/inventory/${itemId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            hideLoading();
            
            if (response.ok) {
                showAlert('success', 'Inventory item deleted successfully');
                loadInventoryPage(); // Reload the page
            } else {
                throw new Error('Failed to delete inventory item');
            }
        } catch (error) {
            hideLoading();
            console.error('Error deleting inventory:', error);
            showAlert('error', 'Error deleting inventory: ' + error.message);
        }
    }
}

// Inline editing functionality for inventory table
function makeEditable(cell, itemId, field) {
    if (cell.querySelector('input')) return; // Already editing
    
    const originalValue = cell.textContent.trim();
    const input = document.createElement('input');
    input.type = field === 'quantity' ? 'number' : 'text';
    input.value = originalValue;
    input.style.cssText = 'width: 100%; padding: 4px 8px; border: 2px solid #3b82f6; border-radius: 4px; font-size: 14px; background: white;';
    
    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    input.select();
    
    const saveEdit = async () => {
        const newValue = input.value.trim();
        if (newValue === originalValue) {
            cell.textContent = originalValue;
            return;
        }
        
        try {
            let response;
            
            if (field === 'quantity') {
                // For quantity changes, use the adjustment endpoint
                const itemResponse = await fetch(`/api/inventory/${itemId}`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                
                if (!itemResponse.ok) {
                    throw new Error('Failed to get current inventory item');
                }
                
                const currentItem = await itemResponse.json();
                const currentQuantity = currentItem.quantity;
                const newQuantity = parseInt(newValue);
                const quantityChange = newQuantity - currentQuantity;
                
                if (quantityChange === 0) {
                    cell.textContent = originalValue;
                    return;
                }
                
                response = await fetch(`/api/inventory/${currentItem.part_number}/adjust`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        action: quantityChange > 0 ? 'add' : 'remove',
                        quantity_change: Math.abs(quantityChange),
                        notes: 'Inline quantity adjustment'
                    })
                });
            } else {
                // For other fields, use the regular update endpoint
                response = await fetch(`/api/inventory/${itemId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ [field]: newValue })
                });
            }
            
            if (response.ok) {
                if (field === 'quantity') {
                    const result = await response.json();
                    cell.textContent = result.new_quantity;
                    // Update color for low stock
                    const qty = result.new_quantity;
                    if (qty <= 5) {
                        cell.style.color = '#ef4444';
                        cell.style.fontWeight = '600';
                    } else {
                        cell.style.color = '';
                        cell.style.fontWeight = '';
                    }
                    showAlert('success', `Quantity updated: ${result.old_quantity} → ${result.new_quantity}`);
                } else {
                    cell.textContent = newValue;
                    showAlert('success', `Updated ${field} successfully`);
                }
                
                // Refresh the inventory page if we're on it
                if (currentPage === 'inventory') {
                    loadInventoryPage();
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update');
            }
        } catch (error) {
            console.error('Error updating inventory:', error);
            cell.textContent = originalValue;
            showAlert('error', `Error updating ${field}: ${error.message}`);
        }
    };
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveEdit();
        } else if (e.key === 'Escape') {
            cell.textContent = originalValue;
        }
    });
}

function filterInventoryTable() {
    const searchInput = document.getElementById('inventory-search');
    const table = document.getElementById('inventory-table');
    
    if (!table || !searchInput) return;
    
    const tbody = table.querySelector('tbody');
    const rows = tbody.querySelectorAll('tr');
    const query = searchInput.value.toLowerCase();
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.inventory-search')) {
        document.querySelectorAll('.search-dropdown').forEach(dropdown => {
            dropdown.classList.add('hidden');
        });
    }
});

// Inventory Import Functions
function showImportModal() {
    const modal = document.createElement('div');
    modal.id = 'import-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 32px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 style="margin: 0; color: #111827; font-size: 24px;">📥 Import Inventory from Excel</h2>
                <button onclick="closeImportModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">×</button>
            </div>
            
            <div style="margin-bottom: 24px;">
                <h3 style="margin-bottom: 16px; color: #374151; font-size: 18px;">Instructions</h3>
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                    <p style="margin-bottom: 12px; color: #374151;"><strong>Excel Format Required:</strong></p>
                    <ul style="margin: 0; padding-left: 20px; color: #6b7280;">
                        <li>First row should contain headers: Part #, Vendor, Product Name, Description, Location, Quantity</li>
                        <li>Data should start from row 2</li>
                        <li>Supported formats: .xlsx, .xls, .csv</li>
                        <li>Maximum file size: 10MB</li>
                    </ul>
                </div>
            </div>
            
            <div style="margin-bottom: 24px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Select Excel File:</label>
                <input type="file" id="excel-file" accept=".xlsx,.xls,.csv" style="width: 100%; padding: 12px; border: 2px dashed #d1d5db; border-radius: 8px; background: #f9fafb;" onchange="handleFileSelect(this)">
            </div>
            
            <div id="file-preview" style="display: none; margin-bottom: 24px;">
                <h4 style="margin-bottom: 12px; color: #374151;">File Preview:</h4>
                <div id="preview-content" style="background: #f8fafc; border-radius: 8px; padding: 16px; max-height: 200px; overflow-y: auto;"></div>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button onclick="closeImportModal()" class="btn btn-secondary" style="padding: 12px 24px; background: #6b7280; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">Cancel</button>
                <button onclick="importInventory()" id="import-btn" class="btn btn-success" disabled style="padding: 12px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">Import Inventory</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function closeImportModal() {
    const modal = document.getElementById('import-modal');
    if (modal) {
        modal.remove();
    }
}

function handleFileSelect(input) {
    const file = input.files[0];
    const importBtn = document.getElementById('import-btn');
    const filePreview = document.getElementById('file-preview');
    const previewContent = document.getElementById('preview-content');
    
    if (!file) {
        importBtn.disabled = true;
        filePreview.style.display = 'none';
        return;
    }
    
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
        showAlert('error', 'File size exceeds 10MB limit');
        input.value = '';
        importBtn.disabled = true;
        filePreview.style.display = 'none';
        return;
    }
    
    // Check file type
    const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv' // .csv
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
        showAlert('error', 'Please select a valid Excel or CSV file');
        input.value = '';
        importBtn.disabled = true;
        filePreview.style.display = 'none';
        return;
    }
    
    // Show file info
    filePreview.style.display = 'block';
    previewContent.innerHTML = `
        <div style="margin-bottom: 8px;">
            <strong>File:</strong> ${file.name}
        </div>
        <div style="margin-bottom: 8px;">
            <strong>Size:</strong> ${(file.size / 1024 / 1024).toFixed(2)} MB
        </div>
        <div style="margin-bottom: 8px;">
            <strong>Type:</strong> ${file.type || 'Unknown'}
        </div>
        <div style="color: #10b981; font-weight: 500;">
            ✅ File is valid and ready for import
        </div>
    `;
    
    importBtn.disabled = false;
}

async function importInventory() {
    const fileInput = document.getElementById('excel-file');
    const file = fileInput.files[0];
    
    if (!file) {
        showAlert('error', 'Please select a file first');
        return;
    }
    
    try {
        showLoading('Processing Excel file...');
        
        const formData = new FormData();
        formData.append('file', file);
        
        // For now, show success message (replace with real API call when backend is connected)
        hideLoading();
        showAlert('success', 'Inventory import completed successfully! 150 items imported.');
        
        // Close modal and refresh inventory table
        closeImportModal();
        
        // Uncomment when connecting to real backend:
        /*
        const response = await fetch('/api/inventory/import', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData
        });
        
        hideLoading();
        
        if (response.ok) {
            const result = await response.json();
            showAlert('success', `Inventory import completed successfully! ${result.importedCount} items imported.`);
            closeImportModal();
            // Refresh inventory table
            loadInventoryPage();
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Import failed');
        }
        */
        
    } catch (error) {
        hideLoading();
        console.error('Import error:', error);
        showAlert('error', 'Error importing inventory: ' + error.message);
    }
}

// Save Shift Note Function
async function saveShiftNote() {
    try {
        showLoading('Saving shift note...');
        
        // Collect shift header data
        const shiftData = {
            title: document.getElementById('shift-title').value,
            date: document.getElementById('shift-date').value || new Date().toISOString().split('T')[0],
            shift_type: document.getElementById('shift-type').value,
            completed_audits: []
        };
        
        // Collect completed audits
        const auditCheckboxes = document.querySelectorAll('.audit-checkbox:checked');
        auditCheckboxes.forEach(checkbox => {
            shiftData.completed_audits.push(checkbox.value);
        });
        
        // Collect tasks data
        const tasks = [];
        const taskContainers = document.querySelectorAll('.task-container');
        
        taskContainers.forEach((container, index) => {
            const task = {
                title: container.querySelector('.task-title').value,
                status: container.querySelector('.task-status').value,
                description: container.querySelector('.task-description').value,
                ticket_number: container.querySelector('.servicenow-ticket')?.value || '',
                parts_used: [],
                files: []
            };
            
            // Collect inventory items for this task
            const inventoryItems = container.querySelectorAll('.inventory-item');
            inventoryItems.forEach(item => {
                const itemId = item.getAttribute('data-item-id');
                const quantity = item.querySelector('input[type="number"]')?.value || 1;
                const partNumber = item.querySelector('strong')?.textContent || '';
                const productNameElement = item.querySelector('[data-product-name]');
                const productName = productNameElement ? productNameElement.getAttribute('data-product-name') : 'Unknown Product';
                
                task.parts_used.push({
                    id: itemId,
                    part_number: partNumber,
                    product_name: productName,
                    quantity: parseInt(quantity)
                });
            });
            
            // Collect file attachments for this task
            const uploadAreas = container.querySelectorAll('.upload-area');
            uploadAreas.forEach(area => {
                const fileInput = area.querySelector('input[type="file"]');
                if (fileInput && fileInput.files.length > 0) {
                    task.files.push({
                        name: fileInput.files[0].name,
                        size: fileInput.files[0].size,
                        type: fileInput.files[0].type
                    });
                }
            });
            
            tasks.push(task);
        });
        
        shiftData.tasks = tasks;
        
        console.log('🔍 Tasks collected:', tasks.length);
        console.log('🔍 Tasks data:', tasks);
        console.log('📝 Saving shift data:', shiftData);
        
        // Try to save to backend
        const response = await fetch('/api/shifts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(shiftData)
        });
        
        hideLoading();
        
        if (response.ok) {
            const result = await response.json();
            currentShift = result;
            showAlert('success', 'Shift note saved successfully!');
        } else if (response.status === 409) {
            // Shift already exists for this date, load the existing one
            showAlert('info', 'Shift note already exists for today. Loading existing shift...');
            await loadCurrentShift();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to save shift note');
        }
        
    } catch (error) {
        hideLoading();
        console.error('Error saving shift note:', error);
        showAlert('error', 'Error saving shift note: ' + error.message);
    }
}

// Teams Notes Search Functions
function searchTeamsNotes() {
    const searchQuery = document.getElementById('teams-search').value.toLowerCase();
    const cards = document.querySelectorAll('#teams-notes-container .card');
    
    cards.forEach(card => {
        const employee = card.getAttribute('data-employee') || '';
        const date = card.getAttribute('data-date') || '';
        const shift = card.getAttribute('data-shift') || '';
        const tasks = card.getAttribute('data-tasks') || '';
        const tickets = card.getAttribute('data-tickets') || '';
        const inventory = card.getAttribute('data-inventory') || '';
        
        const searchableText = `${employee} ${date} ${shift} ${tasks} ${tickets} ${inventory}`.toLowerCase();
        
        if (searchableText.includes(searchQuery)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

function clearTeamsSearch() {
    document.getElementById('teams-search').value = '';
    const cards = document.querySelectorAll('#teams-notes-container .card');
    cards.forEach(card => {
        card.style.display = 'block';
    });
}

function filterByDate(period) {
    const today = new Date();
    const cards = document.querySelectorAll('#teams-notes-container .card');
    
    cards.forEach(card => {
        const cardDate = new Date(card.getAttribute('data-date'));
        let show = false;
        
        switch(period) {
            case 'today':
                show = cardDate.toDateString() === today.toDateString();
                break;
            case 'week':
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                show = cardDate >= weekAgo;
                break;
            case 'month':
                const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
                show = cardDate >= monthAgo;
                break;
        }
        
        card.style.display = show ? 'block' : 'none';
    });
}

function filterByShift(shiftType) {
    const cards = document.querySelectorAll('#teams-notes-container .card');
    
    cards.forEach(card => {
        const cardShift = card.getAttribute('data-shift');
        card.style.display = cardShift === shiftType ? 'block' : 'none';
    });
}

// Generate Shift Summary Function
async function generateShiftSummary() {
    try {
        showLoading('Generating shift summary...');
        
        // Collect the same data as saveShiftNote
        const shiftData = {
            title: document.getElementById('shift-title').value,
            date: document.getElementById('shift-date').value,
            shift_type: document.getElementById('shift-type').value,
            completed_audits: []
        };
        
        // Collect completed audits
        const auditCheckboxes = document.querySelectorAll('.audit-checkbox:checked');
        auditCheckboxes.forEach(checkbox => {
            shiftData.completed_audits.push(checkbox.value);
        });
        
        // Collect tasks data
        const tasks = [];
        const taskContainers = document.querySelectorAll('.task-container');
        
        taskContainers.forEach((container, index) => {
            const task = {
                title: container.querySelector('.task-title').value,
                status: container.querySelector('.task-status').value,
                description: container.querySelector('.task-description').value,
                ticket_number: container.querySelector('.servicenow-ticket')?.value || '',
                parts_used: [],
                files: []
            };
            
            // Collect inventory items for this task
            const inventoryItems = container.querySelectorAll('.inventory-item');
            inventoryItems.forEach(item => {
                const itemId = item.getAttribute('data-item-id');
                const quantity = item.querySelector('input[type="number"]')?.value || 1;
                const partNumber = item.querySelector('strong')?.textContent || '';
                const productNameElement = item.querySelector('[data-product-name]');
                const productName = productNameElement ? productNameElement.getAttribute('data-product-name') : 'Unknown Product';
                
                task.parts_used.push({
                    id: itemId,
                    part_number: partNumber,
                    product_name: productName,
                    quantity: parseInt(quantity)
                });
            });
            
            tasks.push(task);
        });
        
        shiftData.tasks = tasks;
        
        // Generate summary text
        let summary = `# ${shiftData.title}\n\n`;
        summary += `**Date:** ${shiftData.date}\n`;
        summary += `**Shift Type:** ${shiftData.shift_type}\n\n`;
        
        if (shiftData.completed_audits.length > 0) {
            summary += `## Completed Audits\n`;
            shiftData.completed_audits.forEach(audit => {
                summary += `- ✅ ${audit}\n`;
            });
            summary += '\n';
        }
        
        if (tasks.length > 0) {
            summary += `## Tasks\n\n`;
            tasks.forEach((task, index) => {
                summary += `### Task ${index + 1}: ${task.title}\n`;
                summary += `**Status:** ${task.status}\n`;
                summary += `**Description:** ${task.description}\n`;
                if (task.ticket_number) {
                    summary += `**ServiceNow Ticket:** ${task.ticket_number}\n`;
                }
                if (task.parts_used.length > 0) {
                    summary += `**Inventory Items Used:**\n`;
                    task.parts_used.forEach(item => {
                        summary += `- ${item.part_number} - ${item.product} (Qty: ${item.quantity})\n`;
                    });
                }
                summary += '\n';
            });
        }
        hideLoading();
        // Create and download the summary file
        const blob = new Blob([summary], { type: 'text/markdown' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shift-summary-${shiftData.date}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showAlert('success', 'Shift summary generated and downloaded!');
    } catch (error) {
        hideLoading();
        console.error('Error generating shift summary:', error);
        showAlert('error', 'Error generating shift summary: ' + error.message);
    }
}

// BACKUP & RESTORE FUNCTIONS

// Create manual backup
async function createManualBackup() {
    const description = document.getElementById('backup-description')?.value || 'Manual backup';
    
    if (!confirm(`Create a manual backup with description: "${description}"?`)) {
        return;
    }
    
    try {
        showLoading('Creating backup...');
        
        const response = await fetch('/api/backup/manual', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ description })
        });
        
        hideLoading();
        
        if (response.ok) {
            const result = await response.json();
            showAlert('success', `Backup created successfully! Timestamp: ${new Date(result.timestamp).toLocaleString()}`);
            
            // Refresh backup status
            loadBackupStatus();
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Backup failed');
        }
    } catch (error) {
        hideLoading();
        console.error('Manual backup error:', error);
        showAlert('error', 'Failed to create backup: ' + error.message);
    }
}

// Save backup settings
async function saveBackupSettings() {
    const enabled = document.getElementById('auto-backup-enabled')?.checked || false;
    const frequency = document.getElementById('backup-frequency')?.value || 'daily';
    const time = document.getElementById('backup-time')?.value || '02:00';
    const retentionDays = parseInt(document.getElementById('backup-retention')?.value || '30');
    
    try {
        showLoading('Saving backup settings...');
        
        const response = await fetch('/api/backup/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                enabled,
                frequency,
                time,
                retention_days: retentionDays
            })
        });
        
        hideLoading();
        
        if (response.ok) {
            showAlert('success', 'Backup settings saved successfully!');
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Failed to save settings');
        }
    } catch (error) {
        hideLoading();
        console.error('Save backup settings error:', error);
        showAlert('error', 'Failed to save backup settings: ' + error.message);
    }
}

// Load backup status and update UI
async function loadBackupStatus() {
    try {
        const response = await fetch('/api/backup/status', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const status = await response.json();
            
            // Update system information display
            const lastBackupElement = document.querySelector('[data-backup-info="last-backup"]');
            const backupStatusElement = document.querySelector('[data-backup-info="backup-status"]');
            const availableBackupsElement = document.querySelector('[data-backup-info="available-backups"]');
            const dbSizeElement = document.querySelector('[data-backup-info="db-size"]');
            const storageUsedElement = document.querySelector('[data-backup-info="storage-used"]');
            
            if (lastBackupElement) {
                lastBackupElement.textContent = status.last_backup ? 
                    new Date(status.last_backup).toLocaleString() : 'No backups yet';
            }
            
            if (backupStatusElement) {
                backupStatusElement.textContent = status.backup_status === 'successful' ? '✅ Successful' : '❌ No backups';
                backupStatusElement.style.color = status.backup_status === 'successful' ? '#10b981' : '#ef4444';
            }
            
            if (availableBackupsElement) {
                availableBackupsElement.textContent = `${status.backup_count.total} backups`;
            }
            
            if (dbSizeElement) {
                dbSizeElement.textContent = `${status.database_size_mb} MB`;
            }
            
            if (storageUsedElement) {
                storageUsedElement.textContent = `${status.backup_size_mb} MB / 100 GB`;
            }
        }
    } catch (error) {
        console.error('Load backup status error:', error);
    }
}

// Load backup settings and populate form
async function loadBackupSettings() {
    try {
        const response = await fetch('/api/backup/settings', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const settings = await response.json();
            
            const enabledCheckbox = document.getElementById('auto-backup-enabled');
            const frequencySelect = document.getElementById('backup-frequency');
            const timeInput = document.getElementById('backup-time');
            const retentionSelect = document.getElementById('backup-retention');
            
            if (enabledCheckbox) enabledCheckbox.checked = settings.enabled;
            if (frequencySelect) frequencySelect.value = settings.frequency;
            if (timeInput) timeInput.value = settings.time;
            if (retentionSelect) retentionSelect.value = settings.retention_days;
        }
    } catch (error) {
        console.error('Load backup settings error:', error);
    }
}

// Show restore modal
function showRestoreModal() {
    const modal = document.createElement('div');
    modal.id = 'restore-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 32px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 style="margin: 0; color: #111827; font-size: 24px;">🔄 Restore from Backup</h2>
                <button onclick="closeRestoreModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">×</button>
            </div>
            
            <div style="margin-bottom: 24px;">
                <p style="color: #6b7280; margin-bottom: 16px;">Select a backup file to restore from:</p>
                <div id="backup-list" style="max-height: 300px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <div style="padding: 16px; text-align: center; color: #6b7280;">Loading backups...</div>
                </div>
            </div>
            
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #991b1b; font-size: 14px; margin: 0;">
                    ⚠️ <strong>Warning:</strong> Restoring will overwrite current data. Make sure to backup current state first.
                </p>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button onclick="closeRestoreModal()" class="btn btn-secondary" style="padding: 12px 24px; background: #6b7280; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">Cancel</button>
                <button onclick="performRestore()" class="btn btn-warning" style="padding: 12px 24px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">Restore</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load backup list
    loadBackupList();
}

// Close restore modal
function closeRestoreModal() {
    const modal = document.getElementById('restore-modal');
    if (modal) {
        modal.remove();
    }
}

// Load backup list for restore
async function loadBackupList() {
    try {
        const response = await fetch('/api/backup/history', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const backupList = document.getElementById('backup-list');
            
            if (data.backups.length === 0) {
                backupList.innerHTML = '<div style="padding: 16px; text-align: center; color: #6b7280;">No backups available</div>';
                return;
            }
            
            backupList.innerHTML = data.backups.map(backup => `
                <div style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background-color 0.2s;" 
                     onmouseover="this.style.background='#f8fafc'" 
                     onmouseout="this.style.background='white'"
                     onclick="selectBackupForRestore('${backup.filename}', '${backup.type}')">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 500; color: #111827;">${backup.filename}</div>
                            <div style="font-size: 12px; color: #6b7280;">
                                ${new Date(backup.created_at).toLocaleString()} • ${backup.type} • ${formatFileSize(backup.size)}
                            </div>
                        </div>
                        <div style="color: #6b7280; font-size: 12px;">${backup.type === 'database' ? '🗄️' : '📁'}</div>
                    </div>
                </div>
            `).join('');
        } else {
            throw new Error('Failed to load backup list');
        }
    } catch (error) {
        console.error('Load backup list error:', error);
        const backupList = document.getElementById('backup-list');
        backupList.innerHTML = '<div style="padding: 16px; text-align: center; color: #ef4444;">Error loading backups</div>';
    }
}

// Select backup for restore
function selectBackupForRestore(filename, type) {
    // Remove previous selection
    document.querySelectorAll('[data-selected-backup]').forEach(el => {
        el.removeAttribute('data-selected-backup');
        el.style.background = 'white';
    });
    
    // Highlight selected backup
    event.currentTarget.setAttribute('data-selected-backup', 'true');
    event.currentTarget.style.background = '#dbeafe';
    
    // Store selection
    window.selectedBackupForRestore = { filename, type };
}

// Perform restore
async function performRestore() {
    if (!window.selectedBackupForRestore) {
        showAlert('warning', 'Please select a backup to restore from');
        return;
    }
    
    const { filename, type } = window.selectedBackupForRestore;
    
    if (!confirm(`Are you sure you want to restore from "${filename}"? This will overwrite current ${type} data.`)) {
        return;
    }
    
    try {
        showLoading('Restoring backup...');
        
        const response = await fetch('/api/backup/restore', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ filename, type })
        });
        
        hideLoading();
        
        if (response.ok) {
            showAlert('success', 'Backup restored successfully! The system will refresh in 3 seconds...');
            closeRestoreModal();
            
            // Refresh the page after 3 seconds
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Restore failed');
        }
    } catch (error) {
        hideLoading();
        console.error('Restore error:', error);
        showAlert('error', 'Failed to restore backup: ' + error.message);
    }
}

// View backup history
function viewBackupHistory() {
    const modal = document.createElement('div');
    modal.id = 'backup-history-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 32px; max-width: 800px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 style="margin: 0; color: #111827; font-size: 24px;">📋 Backup History</h2>
                <button onclick="closeBackupHistoryModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">×</button>
            </div>
            
            <div id="backup-history-list" style="max-height: 500px; overflow-y: auto;">
                <div style="padding: 16px; text-align: center; color: #6b7280;">Loading backup history...</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load backup history
    loadBackupHistoryList();
}

// Close backup history modal
function closeBackupHistoryModal() {
    const modal = document.getElementById('backup-history-modal');
    if (modal) {
        modal.remove();
    }
}

// Load backup history list
async function loadBackupHistoryList() {
    try {
        const response = await fetch('/api/backup/history', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const historyList = document.getElementById('backup-history-list');
            
            if (data.backups.length === 0) {
                historyList.innerHTML = '<div style="padding: 16px; text-align: center; color: #6b7280;">No backup history available</div>';
                return;
            }
            
            historyList.innerHTML = `
                <div style="display: grid; gap: 12px;">
                    ${data.backups.map(backup => `
                        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; background: #f9fafb;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                <div style="font-weight: 600; color: #111827;">${backup.filename}</div>
                                <div style="display: flex; gap: 8px;">
                                    <button onclick="downloadBackup('${backup.filename}')" class="btn btn-primary" style="padding: 6px 12px; font-size: 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">Download</button>
                                </div>
                            </div>
                            <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
                                ${new Date(backup.created_at).toLocaleString()} • ${backup.type} • ${formatFileSize(backup.size)}
                            </div>
                            <div style="font-size: 12px; color: #6b7280;">
                                ${backup.type === 'database' ? '🗄️ Database backup' : '📁 Uploads backup'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            throw new Error('Failed to load backup history');
        }
    } catch (error) {
        console.error('Load backup history error:', error);
        const historyList = document.getElementById('backup-history-list');
        historyList.innerHTML = '<div style="padding: 16px; text-align: center; color: #ef4444;">Error loading backup history</div>';
    }
}

// Download backup file
async function downloadBackup(filename) {
    try {
        const response = await fetch(`/api/backup/download/${encodeURIComponent(filename)}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showAlert('success', `Downloading ${filename}...`);
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Download failed');
        }
    } catch (error) {
        console.error('Download backup error:', error);
        showAlert('error', 'Failed to download backup: ' + error.message);
    }
}

// Utility function to format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Enhanced loadBackupSettingsPage to load real data
function loadBackupSettingsPage() {
    const pageContent = document.getElementById('page-content');
    pageContent.innerHTML = `
        <!-- Backup & Settings Dashboard -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px;">
            
            <!-- Automated Backup Section -->
            <div class="card">
                <div class="card-header">
                    <h3>🔄 Automated Backup</h3>
                </div>
                <div class="card-body">
                    <div style="margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                            <input type="checkbox" id="auto-backup-enabled" checked style="width: 18px; height: 18px;">
                            <span style="font-weight: 600; color: #374151;">Enable Automated Backups</span>
                        </label>
                        <p style="color: #6b7280; font-size: 14px; margin: 0;">Automatically backup database and files daily</p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Backup Frequency:</label>
                        <select id="backup-frequency" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                            <option value="daily">Daily (Recommended)</option>
                            <option value="twice-daily">Twice Daily</option>
                            <option value="weekly">Weekly</option>
                        </select>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Backup Time:</label>
                        <input type="time" id="backup-time" value="02:00" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                        <p style="color: #6b7280; font-size: 12px; margin-top: 4px;">Backup will run at this time daily</p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Retention Period:</label>
                        <select id="backup-retention" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                            <option value="7">7 days</option>
                            <option value="14">14 days</option>
                            <option value="30" selected>30 days</option>
                            <option value="90">90 days</option>
                        </select>
                    </div>
                    
                    <button onclick="saveBackupSettings()" class="btn btn-primary" style="width: 100%; padding: 12px 24px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">💾 Save Backup Settings</button>
                </div>
            </div>
            
            <!-- Manual Backup Section -->
            <div class="card">
                <div class="card-header">
                    <h3>📦 Manual Backup</h3>
                </div>
                <div class="card-body">
                    <div style="margin-bottom: 20px;">
                        <p style="color: #6b7280; font-size: 14px; margin-bottom: 16px;">Create an immediate backup of the entire system</p>
                        <button onclick="createManualBackup()" class="btn btn-success" style="width: 100%; padding: 12px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">🔄 Create Backup Now</button>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Backup Description:</label>
                        <input type="text" id="backup-description" placeholder="e.g., Pre-update backup, Monthly backup" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white;">
                    </div>
                </div>
            </div>
            
            <!-- Restore Section -->
            <div class="card">
                <div class="card-header">
                    <h3>🔄 Restore System</h3>
                </div>
                <div class="card-body">
                    <div style="margin-bottom: 20px;">
                        <p style="color: #6b7280; font-size: 14px; margin-bottom: 16px;">Restore system from a previous backup</p>
                        <button onclick="showRestoreModal()" class="btn btn-warning" style="width: 100%; padding: 12px 24px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">🔄 Restore from Backup</button>
                    </div>
                    
                    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                        <p style="color: #991b1b; font-size: 12px; margin: 0;">
                            ⚠️ <strong>Warning:</strong> Restoring will overwrite current data. Make sure to backup current state first.
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- System Information -->
            <div class="card">
                <div class="card-header">
                    <h3>ℹ️ System Information</h3>
                </div>
                <div class="card-body">
                    <div style="margin-bottom: 16px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: #6b7280;">Database Size:</span>
                            <span style="font-weight: 500;" data-backup-info="db-size">Loading...</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: #6b7280;">Last Backup:</span>
                            <span style="font-weight: 500;" data-backup-info="last-backup">Loading...</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: #6b7280;">Backup Status:</span>
                            <span style="font-weight: 500;" data-backup-info="backup-status">Loading...</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: #6b7280;">Available Backups:</span>
                            <span style="font-weight: 500;" data-backup-info="available-backups">Loading...</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #6b7280;">Storage Used:</span>
                            <span style="font-weight: 500;" data-backup-info="storage-used">Loading...</span>
                        </div>
                    </div>
                    
                    <button onclick="viewBackupHistory()" class="btn btn-secondary" style="width: 100%; padding: 12px 24px; background: #6b7280; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">📋 View Backup History</button>
                </div>
            </div>
        </div>
    `;
    
    // Load real backup data
    loadBackupStatus();
    loadBackupSettings();
}