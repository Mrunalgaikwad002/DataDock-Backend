# DataDock Backend API

A robust Node.js backend API for the DataDock file management system, built with Express.js and Supabase for scalable file storage and user management.


## 📋 Table of Contents

- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [API Endpoints](#-api-endpoints)
- [Installation](#-installation)
- [Environment Setup](#-environment-setup)
- [Database Schema](#-database-schema)
- [Deployment](#-deployment)
- [API Documentation](#-api-documentation)

## ✨ Features

### 🔐 Authentication & Authorization
- JWT-based user authentication
- User registration and login
- Password hashing and security
- Token-based session management

### 📁 File Management
- File upload with progress tracking
- Bulk file operations
- File metadata management
- Secure file storage with Supabase
- File preview and download URLs

### 📂 Folder Operations
- Hierarchical folder structure
- Folder creation and management
- Local folder import functionality
- Breadcrumb navigation
- Folder sharing and permissions

### 🔍 Search & Discovery
- Global search across files and folders
- Advanced filtering options
- Search suggestions
- Recent items tracking
- Starred items management

### 👥 Sharing & Collaboration
- User-to-user sharing
- Public link generation
- Permission management (read/write)
- Shared items tracking
- Link expiration and access limits

### 📊 Storage Management
- Storage usage tracking
- File type statistics
- Storage quota management
- Trash management with recovery

## 🛠️ Technology Stack

- **Runtime**: Node.js (ES6+ modules)
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **File Storage**: Supabase Storage
- **Authentication**: JWT tokens
- **File Upload**: Multer middleware
- **CORS**: Cross-origin resource sharing
- **Environment**: dotenv for configuration

## 📡 API Endpoints

### Authentication Routes (`/auth`)
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/signup` - User signup (alias)
- `GET /auth/me` - Get current user profile

### File Routes (`/files`)
- `GET /files` - Get files with filtering
- `POST /files/upload` - Upload single file
- `POST /files/bulk-upload` - Upload multiple files
- `GET /files/:id/download` - Get download URL
- `GET /files/:id/view` - Get preview URL
- `PUT /files/:id/star` - Star/unstar file
- `DELETE /files/:id` - Move file to trash
- `POST /files/:id/restore` - Restore from trash
- `DELETE /files/:id/permanent` - Permanent delete
- `GET /files/trash` - Get trashed files

### Folder Routes (`/folders`)
- `GET /folders` - Get folders with filtering
- `POST /folders` - Create new folder
- `POST /folders/import` - Import local folder structure
- `GET /folders/:id/breadcrumbs` - Get folder breadcrumbs
- `PUT /folders/:id/star` - Star/unstar folder
- `PUT /folders/:id/rename` - Rename folder
- `PUT /folders/:id/move` - Move folder
- `DELETE /folders/:id` - Delete folder
- `GET /folders/starred` - Get starred folders

### Search Routes (`/search`)
- `GET /search` - Global search
- `GET /search/starred` - Get starred items
- `GET /search/shared` - Get shared items
- `GET /search/recent` - Get recent items
- `GET /search/suggestions` - Get search suggestions
- `GET /search/advanced` - Advanced search

### Sharing Routes (`/share`)
- `POST /share/user` - Share with user
- `DELETE /share/user/:id` - Remove user permission
- `GET /share/user/:id` - Get resource users
- `POST /share/link` - Create public link
- `DELETE /share/link/:id` - Delete public link
- `GET /share/links` - Get public links
- `GET /share/link/:token` - Access public link

### Storage Routes (`/storage`)
- `GET /storage/usage` - Get storage statistics
- `GET /storage/quota` - Get storage quota

### Database Routes (`/db`)
- `GET /db/health` - Database health check
- `POST /db/migrate` - Run database migrations

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Supabase account and project
- PostgreSQL database (via Supabase)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/Mrunalgaikwad002/DataDock.git
   cd DataDock/Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the Backend directory:
   ```env
   # Server Configuration
   PORT= your port number
   NODE_ENV= your credentials

   # Supabase Configuration
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_KEY=your_supabase_service_key
   SUPABASE_BUCKET= supabase_bucket_name

   # JWT Configuration
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRES_IN= your expiry time

   # CORS Configuration
   CORS_ORIGIN= your cors origin
   ```

4. **Database Setup**
   - Create a Supabase project
   - Run the SQL scripts in `db/schema.sql`
   - Run migrations in `db/migration.sql`

5. **Start the server**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## 🔧 Environment Setup

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `your port number` |
| `NODE_ENV` | Environment | `development` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_KEY` | Supabase service key | `use service key` |
| `SUPABASE_BUCKET` | Storage bucket name | `supabase bucket name` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key` |
| `JWT_EXPIRES_IN` | Token expiration | `your expiry time` |
| `CORS_ORIGIN` | Allowed origins | `your port number` |

### Supabase Setup

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and anon key

2. **Database Schema**
   ```sql
   -- Run the schema.sql file in your Supabase SQL editor
   -- This creates the necessary tables and relationships
   ```

3. **Storage Bucket**
   - Create a storage bucket named `your storage name`
   - Set appropriate permissions
   - Configure CORS if needed

## 🗄️ Database Schema

### Core Tables

#### `users`
- `id` (UUID, Primary Key)
- `email` (VARCHAR, Unique)
- `username` (VARCHAR)
- `password_hash` (VARCHAR)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

#### `folders`
- `id` (UUID, Primary Key)
- `name` (VARCHAR)
- `parent_id` (UUID, Foreign Key)
- `user_id` (UUID, Foreign Key)
- `is_starred` (BOOLEAN)
- `is_deleted` (BOOLEAN)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

#### `files`
- `id` (UUID, Primary Key)
- `name` (VARCHAR)
- `size` (BIGINT)
- `mime_type` (VARCHAR)
- `folder_id` (UUID, Foreign Key)
- `user_id` (UUID, Foreign Key)
- `storage_path` (VARCHAR)
- `download_url` (TEXT)
- `path` (VARCHAR)
- `is_starred` (BOOLEAN)
- `is_deleted` (BOOLEAN)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

#### `permissions`
- `id` (UUID, Primary Key)
- `resource_id` (UUID)
- `resource_type` (VARCHAR)
- `user_id` (UUID, Foreign Key)
- `permission_type` (VARCHAR)
- `created_at` (TIMESTAMP)

#### `public_links`
- `id` (UUID, Primary Key)
- `resource_id` (UUID)
- `resource_type` (VARCHAR)
- `token` (VARCHAR, Unique)
- `expires_at` (TIMESTAMP)
- `max_accesses` (INTEGER)
- `access_count` (INTEGER)
- `created_at` (TIMESTAMP)

## 🚀 Deployment

### Render Deployment

1. **Connect to Render**
   - Connect your GitHub repository
   - Select the Backend directory

2. **Environment Variables**
   Set the following in Render dashboard:
   ```
   PORT=10000
   NODE_ENV=production
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   SUPABASE_BUCKET=files
   JWT_SECRET=your_jwt_secret
   JWT_EXPIRES_IN= your expiry time
   CORS_ORIGIN=https://your-frontend-domain.com
   ```

3. **Build Command**
   ```bash
   npm install
   ```

4. **Start Command**
   ```bash
   npm start
   ```

### Heroku Deployment

1. **Create Heroku App**
   ```bash
   heroku create your-app-name
   ```

2. **Set Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set SUPABASE_URL=your_supabase_url
   heroku config:set SUPABASE_KEY=your_supabase_key
   # ... set all other variables
   ```

3. **Deploy**
   ```bash
   git push heroku main
   ```

### Railway Deployment

1. **Connect Repository**
   - Connect your GitHub repository
   - Select the Backend directory

2. **Environment Variables**
   - Add all required environment variables
   - Set `PORT` to `$PORT` (Railway sets this automatically)

3. **Deploy**
   - Railway will automatically deploy on push

## 📚 API Documentation

### Authentication

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "password123"
}
```

#### Login User
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### File Operations

#### Upload File
```http
POST /files/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <file>
folderId: <optional_folder_id>
```

#### Get Files
```http
GET /files?folderId=123&search=document&sortBy=name&sortOrder=asc
Authorization: Bearer <token>
```

### Folder Operations

#### Create Folder
```http
POST /folders
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Folder",
  "parentId": "optional_parent_id"
}
```

#### Import Local Folder
```http
POST /folders/import
Authorization: Bearer <token>
Content-Type: multipart/form-data

name: "Folder Name"
parentId: "optional_parent_id"
structure: "JSON_structure"
importMode: "files"
files: <file1>
files: <file2>
fileInfo: "JSON_file_info"
```

### Search

#### Global Search
```http
GET /search?query=document&type=all&sortBy=name
Authorization: Bearer <token>
```

#### Get Starred Items
```http
GET /search/starred?type=all&sortBy=name
Authorization: Bearer <token>
```

### Sharing

#### Share with User
```http
POST /share/user
Authorization: Bearer <token>
Content-Type: application/json

{
  "resourceId": "file_or_folder_id",
  "resourceType": "file|folder",
  "userEmail": "user@example.com",
  "permissionType": "read|write"
}
```

#### Create Public Link
```http
POST /share/link
Authorization: Bearer <token>
Content-Type: application/json

{
  "resourceId": "file_or_folder_id",
  "resourceType": "file|folder",
  "expiresAt": "2024-12-31T23:59:59Z",
  "maxAccesses": 100
}
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt password encryption
- **CORS Protection**: Configurable cross-origin policies
- **Input Validation**: Request data validation
- **Rate Limiting**: API rate limiting (configurable)
- **File Type Validation**: Secure file upload restrictions
- **Permission Checks**: Resource access control

## 📊 Performance

- **Database Indexing**: Optimized queries with proper indexes
- **File Streaming**: Efficient file upload/download
- **Caching**: Response caching for frequently accessed data
- **Connection Pooling**: Database connection optimization
- **Compression**: Response compression for large payloads

## 🧪 Testing

### Run Tests
```bash
# Install test dependencies
npm install --save-dev jest supertest

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

### API Testing
Use tools like Postman or curl to test endpoints:

```bash
# Health check
curl https://datadock-backend.onrender.com/db/health

# Test authentication
curl -X POST https://datadock-backend.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

## 📞 Support

For issues and questions:
1. Check the [Issues](https://github.com/Mrunalgaikwad002/DataDock/issues) page
2. Create a new issue with detailed information
3. Contact the maintainer

## 👨‍💻 Author

**Mrunal Gaikwad**
- GitHub: [@Mrunalgaikwad002](https://github.com/Mrunalgaikwad002)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**DataDock Backend API** - Powering modern file management 🚀
