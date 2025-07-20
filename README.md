# 🔧 IT Shift Notes & Inventory Management System

A comprehensive web-based system for managing IT shift notes, inventory tracking, and team collaboration.

## ✨ Features

### 📋 **Shift Management**
- Create and edit daily shift notes
- Track completed audits and tasks
- ServiceNow ticket integration
- Inventory usage tracking
- File attachments support
- Generate shift summaries

### 👥 **User Management**
- Role-based access control (User, Manager, Administrator)
- User creation, editing, and status management
- Search and filter users
- Password management

### 📦 **Inventory Management**
- Track inventory items with part numbers
- Real-time search functionality
- Quantity management
- Bulk import via Excel/CSV
- Usage tracking per task

### 🔍 **Team Collaboration**
- View all team member shift notes
- Advanced search and filtering
- Date and shift type filtering
- Real-time updates

### ⚙️ **Administrative Tools**
- Automated backup system
- Manual backup creation
- System restore functionality
- Backup history and management
- System configuration

## 🚀 Quick Start

### Prerequisites
- Node.js 16.0.0 or higher
- MySQL 8.0 or higher
- Modern web browser

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd shift-notes
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up database**
   ```bash
   # Create database and tables (see production-setup.md)
   ```

5. **Start the application**
   ```bash
   npm start
   ```

6. **Access the application**
   - Open browser to `http://localhost:3000`
   - Login with default admin credentials:
     - Email: `admin@company.com`
     - Password: `admin123`

## 🔐 Default Login Credentials

### Administrator
- **Email:** `admin@company.com`
- **Password:** `admin123`
- **Access:** Full system access

### Regular User
- **Email:** `user@company.com`
- **Password:** `user123`
- **Access:** Basic shift notes and inventory

## 📁 Project Structure

```
shift-notes/
├── public/
│   └── index.html          # Main application file
├── server.js               # Express server
├── package.json            # Dependencies and scripts
├── .env.example           # Environment variables template
├── production-setup.md    # Production deployment guide
└── README.md              # This file
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | Database host | `localhost` |
| `DB_USER` | Database username | `shift_user` |
| `DB_PASSWORD` | Database password | - |
| `DB_NAME` | Database name | `shift_notes_db` |
| `JWT_SECRET` | JWT signing secret | - |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |

## 🗄️ Database Schema

### Users Table
- `id` - Primary key
- `name` - User's full name
- `email` - Unique email address
- `password_hash` - Encrypted password
- `role` - User role (user/manager/admin)
- `active` - Account status
- `last_login` - Last login timestamp

### Shift Notes Table
- `id` - Primary key
- `user_id` - Foreign key to users
- `title` - Shift title
- `date` - Shift date
- `shift_type` - Day or night shift
- `completed_audits` - JSON array of audits

### Tasks Table
- `id` - Primary key
- `shift_note_id` - Foreign key to shift notes
- `title` - Task title
- `description` - Task description
- `status` - Task status
- `ticket_number` - ServiceNow ticket

### Inventory Table
- `id` - Primary key
- `part_number` - Unique part number
- `product_name` - Product name
- `description` - Product description
- `quantity` - Available quantity
- `location` - Storage location

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcrypt password encryption
- **Role-based Access** - Granular permission system
- **Input Validation** - Server-side validation
- **CORS Protection** - Cross-origin request protection
- **Helmet Security** - Security headers

## 📊 Backup & Recovery

### Automated Backups
- Daily automated backups at 2:00 AM
- 30-day retention policy
- Database and application backups
- Configurable backup paths

### Manual Backups
- On-demand backup creation
- Custom backup descriptions
- Download backup files
- System restore functionality

## 🛠️ Development

### Running in Development Mode
```bash
npm run dev
```

### File Structure
- **Frontend:** Single-page application in `public/index.html`
- **Backend:** Express.js server in `server.js`
- **Database:** MySQL with connection pooling

### Adding New Features
1. Update the frontend HTML/JavaScript
2. Add corresponding backend API endpoints
3. Update database schema if needed
4. Test thoroughly before deployment

## 🚀 Production Deployment

For production deployment instructions, see [production-setup.md](production-setup.md).

## 📞 Support

### Troubleshooting
1. Check application logs
2. Verify database connection
3. Check environment variables
4. Review browser console for errors

### Common Issues
- **Login not working:** Check JWT_SECRET in .env
- **Database errors:** Verify database credentials and connection
- **Port conflicts:** Change PORT in .env
- **CORS errors:** Update CORS_ORIGIN in .env

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Version:** 1.0.0  
**Last Updated:** January 2024  
**Maintainer:** Your Company IT Team 