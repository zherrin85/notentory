# Notentory - Enhanced Shift Notes & Inventory Management

A comprehensive web application for managing shift notes, inventory, and team collaboration in industrial environments.

## 🚀 Features

- **📝 Daily Shift Notes**: Create and manage detailed shift documentation
- **👥 Team Collaboration**: View and manage team shift notes
- **📦 Inventory Management**: Track parts, quantities, and usage
- **📊 Reporting**: Generate comprehensive reports and summaries
- **🔒 User Management**: Role-based access control (Admin, Manager, Technician)
- **📁 File Attachments**: Upload and manage documents and images
- **🔄 Backup System**: Automated backup and restore functionality
- **📱 Mobile Responsive**: Works seamlessly on desktop and mobile devices

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL 8.0+
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Security**: bcrypt for password hashing

## 📋 Prerequisites

- Node.js 16.0.0 or higher
- MySQL 8.0 or higher
- npm or yarn package manager

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd shift-notes
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

```bash
# Create database and user
mysql -u root -p
```

In MySQL console:
```sql
CREATE DATABASE shift_notes_db;
CREATE USER 'your_database_user'@'localhost' IDENTIFIED BY 'your_database_password';
GRANT ALL PRIVILEGES ON shift_notes_db.* TO 'your_database_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4. Environment Configuration

```bash
# Create environment file
echo "DB_HOST=localhost" > .env
echo "DB_USER=your_database_user" >> .env
echo "DB_PASSWORD=your_database_password" >> .env
echo "DB_NAME=shift_notes_db" >> .env
echo "JWT_SECRET=your_jwt_secret_here" >> .env
echo "PORT=3000" >> .env
```

### 5. Initialize Database

```bash
node database-init.js
```

### 6. Start the Application

```bash
node server.js
```

### 7. Access the Application

- Open browser to `http://localhost:3000`
- Login with default credentials:
  - **Email:** `admin@shiftnotes.com`
  - **Password:** `admin123`

## 👥 Default Users

The system comes with pre-configured users for testing:

### Administrator
- **Email:** `admin@shiftnotes.com`
- **Password:** `admin123`
- **Role:** Full system access

### Regular User
- **Email:** `user@shiftnotes.com`
- **Password:** `user123`
- **Role:** Basic access

## 📁 Project Structure

```
shift-notes/
├── public/                 # Frontend files
│   ├── index.html         # Main application page
│   └── main.js            # Frontend JavaScript
├── server.js              # Main server file
├── database-init.js       # Database initialization
├── package.json           # Dependencies
├── .env                   # Environment variables
├── uploads/               # File uploads directory
├── backups/               # Backup files
└── README.md              # This file
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | Database host | `localhost` |
| `DB_USER` | Database username | - |
| `DB_PASSWORD` | Database password | - |
| `DB_NAME` | Database name | `shift_notes_db` |
| `DB_PORT` | Database port | `3306` |
| `JWT_SECRET` | JWT signing secret | - |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |

### Database Schema

The application uses the following main tables:

- **users**: User accounts and authentication
- **shift_notes**: Daily shift documentation
- **tasks**: Individual tasks within shifts
- **inventory**: Parts and materials tracking
- **inventory_transactions**: Inventory usage history
- **activity_log**: System activity tracking
- **file_attachments**: Uploaded files
- **settings**: Application settings

## 🔒 Security Features

- **Password Hashing**: All passwords are hashed using bcrypt
- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access**: Different permission levels for users
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Protection**: Parameterized queries
- **File Upload Security**: Restricted file types and sizes

## 📱 Mobile Support

The application is fully responsive and includes:

- **Mobile Navigation**: Hamburger menu for mobile devices
- **Touch-Friendly Interface**: Optimized for touch interactions
- **Responsive Design**: Adapts to different screen sizes
- **Offline Capabilities**: Basic offline functionality

## 🔄 Backup & Restore

### Automatic Backups

The system includes automated backup functionality:

- **Database Backups**: Daily MySQL dumps
- **File Backups**: Uploaded files backup
- **Retention Policy**: Configurable backup retention
- **Restore Capability**: Easy restore from backups

### Manual Backup

```bash
# Create manual backup
curl -X POST http://localhost:3000/api/backup/manual \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Manual backup"}'
```

## 📊 API Endpoints

### Authentication
- `POST /api/login` - User login
- `GET /api/users` - Get users (authenticated)

### Shift Notes
- `GET /api/shifts/current` - Get current shift
- `POST /api/shifts` - Create new shift
- `PUT /api/shifts/:id` - Update shift
- `GET /api/shifts` - Get all shifts

### Inventory
- `GET /api/inventory` - Get inventory items
- `POST /api/inventory` - Add inventory item
- `PUT /api/inventory/:id` - Update inventory
- `POST /api/inventory/import` - Bulk import

### Tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task

### Reports
- `GET /api/dashboard` - Dashboard data
- `GET /api/reports/inventory` - Inventory reports

## 🚀 Deployment

For production deployment, see [production-setup.md](production-setup.md) for detailed instructions.

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Verify MySQL is running
   - Check database credentials in `.env`
   - Ensure database exists

2. **Port Already in Use**
   - Change PORT in `.env`
   - Kill existing process: `lsof -ti:3000 | xargs kill`

3. **Permission Denied**
   - Check file permissions for uploads directory
   - Ensure proper ownership of application files

### Logs

- **Application Logs**: Check console output
- **Database Logs**: MySQL error log
- **System Logs**: System journal

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

1. Check the troubleshooting section
2. Review the API documentation
3. Check application logs
4. Contact system administrator

## 🔄 Updates

To update the application:

1. Backup current installation
2. Pull latest changes
3. Update dependencies: `npm install`
4. Run database migrations if needed
5. Restart the application

---

**Notentory** - Streamlining shift documentation and inventory management for modern industrial operations. 