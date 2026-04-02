# Authentication & User Profile System Documentation

## Overview

This document describes the authentication module and user profile system for the IASI-Quest Navigator platform. The system includes:

- **Backend API**: RESTful API with JWT authentication built with Flask
- **Frontend Authentication**: React context-based auth with protected routes
- **User Profiles**: Student profiles with project management
- **Database**: PostgreSQL with schema for users, profiles, and projects

## Backend Architecture

### Database Schema

#### Users Table

```sql
- id (PRIMARY KEY)
- username (UNIQUE)
- email (UNIQUE)
- password_hash
- created_at
```

#### Student Profiles Table

```sql
- id (PRIMARY KEY)
- user_id (FOREIGN KEY → users.id)
- full_name
- academic_year
- faculty
- specialization
- bio
- profile_picture_url
- updated_at
```

#### Projects Table

```sql
- id (PRIMARY KEY)
- student_id (FOREIGN KEY → student_profiles.id)
- title
- description
- status (In Progress, Completed, On Hold)
- progress_percentage (0-100)
- category
- created_at
- updated_at
```

### Backend Files

#### `db.py`

Database connection and initialization module. Handles:

- PostgreSQL connection pooling
- Table creation (init_db method)
- Cursor management with context managers

#### `auth.py`

Core authentication and user management logic:

**AuthManager Class Methods:**

- `hash_password(password)` - PBKDF2 password hashing
- `verify_password(password, hash)` - Password verification
- `generate_token(user_id, username)` - JWT token generation
- `verify_token(token)` - JWT token validation
- `register_user(username, email, password, full_name)` - User registration
- `login_user(username, password)` - User authentication
- `get_user_profile(user_id)` - Fetch user profile with projects
- `update_user_profile(user_id, **kwargs)` - Update profile fields
- `add_project(user_id, title, description, category)` - Create new project
- `update_project(project_id, **kwargs)` - Update project details

#### `api_server.py`

Flask REST API with endpoints:

**Authentication Endpoints:**

- `POST /auth/register` - Register new user
- `POST /auth/login` - Authenticate user
- `GET /auth/verify` - Verify token (requires auth)

**Profile Endpoints:**

- `GET /profile` - Get user profile (requires auth)
- `PUT /profile` - Update user profile (requires auth)

**Project Endpoints:**

- `POST /projects` - Create new project (requires auth)
- `PUT /projects/<id>` - Update project (requires auth)

**Health Check:**

- `GET /health` - API health status

## Frontend Architecture

### Authentication Flow

1. **Registration**
   - User fills registration form
   - Frontend validates input
   - Sends POST request to `/auth/register`
   - On success, redirects to login

2. **Login**
   - User enters credentials
   - Frontend validates input
   - Sends POST request to `/auth/login`
   - Backend returns JWT token
   - Token stored in localStorage
   - User redirected to dashboard

3. **Protected Routes**
   - `ProtectedRoute` component wraps protected pages
   - Checks if user is authenticated
   - If not authenticated, redirects to login
   - If authenticated, renders page

### Frontend Files

#### `context/AuthContext.jsx`

React Context for global auth state management:

**Exports `useAuth()` hook with:**

- `user` - Current user object
- `token` - JWT token
- `loading` - Loading state
- `error` - Error messages
- `isAuthenticated` - Boolean auth status
- `register(username, email, password, fullName)` - Register user
- `login(username, password)` - Login user
- `logout()` - Logout user
- `getProfile()` - Fetch user profile
- `updateProfile(data)` - Update profile
- `addProject(title, description, category)` - Create project
- `updateProject(projectId, data)` - Update project

#### `pages/Login.jsx`

Login page component with:

- Username/password inputs
- Error handling
- Loading state
- Link to register page

#### `pages/Register.jsx`

Registration page component with:

- Full name, username, email, password inputs
- Password confirmation
- Input validation
- Error handling
- Link to login page

#### `pages/UserProfile.jsx`

Profile page component with:

- Profile display/edit mode
- Student information (faculty, year, specialization)
- Bio section
- Projects management
- Add new projects
- View project status and progress

#### `pages/ChatApp.jsx`

Main chat application page with:

- Quest map display
- Chat interface
- User navigation (Profile, Logout)
- Protected by `ProtectedRoute`

#### `components/ProtectedRoute.jsx`

Route protection component:

- Checks authentication status
- Loading state display
- Redirects to login if not authenticated

## Setup Instructions

### Backend Setup

1. **Install Dependencies**

   ```bash
   cd bot/actions
   pip install -r requirements.txt
   ```

2. **Environment Configuration**

   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Database Initialization**
   - Database tables are auto-created on first API start
   - Or manually call `db.init_db()` in Python shell

4. **Run API Server (Local Development)**

   ```bash
   python api_server.py
   ```

   - API runs on `http://localhost:5056`

5. **Run with Docker**
   ```bash
   docker-compose up api_server
   ```

### Frontend Setup

1. **Install Dependencies**

   ```bash
   cd frontend
   npm install
   ```

2. **Environment Configuration**

   ```bash
   cp .env.example .env.local
   # Default: VITE_API_URL=http://localhost:5056
   ```

3. **Run Development Server**

   ```bash
   npm run dev
   ```

   - Frontend runs on `http://localhost:5173`

4. **Build for Production**
   ```bash
   npm run build
   ```

## API Request Examples

### Register User

```bash
curl -X POST http://localhost:5056/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "securepass123",
    "full_name": "John Doe"
  }'
```

### Login User

```bash
curl -X POST http://localhost:5056/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "securepass123"
  }'
```

### Get User Profile

```bash
curl -X GET http://localhost:5056/profile \
  -H "Authorization: Bearer <token>"
```

### Update Profile

```bash
curl -X PUT http://localhost:5056/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "John Doe",
    "academic_year": 2,
    "faculty": "Faculty of Informatics",
    "specialization": "AI & Machine Learning",
    "bio": "Passionate about AI and machine learning"
  }'
```

### Create Project

```bash
curl -X POST http://localhost:5056/projects \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Quest Navigation AI",
    "description": "Building an AI-powered quest navigator",
    "category": "Artificial Intelligence"
  }'
```

### Update Project

```bash
curl -X PUT http://localhost:5056/projects/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "In Progress",
    "progress_percentage": 45,
    "description": "Updated project description"
  }'
```

## Security Considerations

1. **Password Security**
   - Passwords hashed with PBKDF2 (100,000 iterations)
   - Never stored in plain text

2. **JWT Tokens**
   - 24-hour expiration by default
   - Change `SECRET_KEY` in production
   - Transmitted via Authorization header

3. **CORS**
   - Frontend CORS enabled (configure in production)
   - Only allow trusted domains

4. **Database**
   - Use environment variables for credentials
   - Don't commit `.env` files
   - Use strong passwords

5. **HTTPS**
   - Always use HTTPS in production
   - Configure secure cookies
   - Set secure headers

## Student Profile Fields

The system tracks the following student information:

- **Username** - Unique identifier
- **Email** - Contact information
- **Full Name** - Student name
- **Academic Year** - Year of study (1, 2, 3, etc.)
- **Faculty** - Faculty name
- **Specialization** - Area of study
- **Bio** - Personal bio/description
- **Profile Picture URL** - Avatar URL
- **Projects** - List of student projects with:
  - Title
  - Description
  - Status (In Progress, Completed, On Hold)
  - Progress percentage
  - Category
  - Created date

## Troubleshooting

### API Connection Issues

- Ensure backend is running on correct port
- Check `VITE_API_URL` in frontend .env
- Verify CORS settings

### Authentication Failures

- Check password hashing
- Verify JWT secret key matches
- Check token expiration

### Database Issues

- Verify PostgreSQL is running
- Check database credentials in .env
- Ensure tables exist or auto-create

### Frontend Issues

- Clear browser localStorage: `localStorage.clear()`
- Check browser console for errors
- Verify React Router setup

## Future Enhancements

- Email verification
- Password reset functionality
- OAuth integration (Google, GitHub)
- Two-factor authentication
- Project collaboration features
- Grade/feedback system
- Analytics dashboard
- Profile picture upload
