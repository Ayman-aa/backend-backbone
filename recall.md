# Backend Backbone - Complete System Recall

## System Overview
This is a Node.js/TypeScript backend for a chat application built with Fastify, Socket.IO, Prisma (SQLite), and various plugins for authentication, file uploads, and real-time messaging.

## Tech Stack
- **Framework**: Fastify
- **Database**: SQLite with Prisma ORM
- **Real-time**: Socket.IO
- **Authentication**: JWT + Refresh Tokens (stored as HTTP cookies)
- **File Upload**: Fastify Multipart
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Zod schemas

## Project Structure
```
backend-backbone/
├── src/
│   ├── config/
│   │   └── env.ts                 # Environment variables
│   ├── modules/
│   │   ├── auth/
│   │   │   └── auth.routes.ts     # Authentication endpoints
│   │   ├── users/
│   │   │   ├── profile.routes.ts  # User profile management
│   │   │   └── users.routes.ts    # User search/discovery
│   │   ├── friends/
│   │   │   └── friends.routes.ts  # Friend system (send/accept/block)
│   │   ├── chats/
│   │   │   └── chats.routes.ts    # Messaging system
│   │   └── socket/
│   │       └── socket.ts          # WebSocket real-time events
│   ├── plugins/
│   │   ├── jwt.ts                 # JWT plugin configuration
│   │   └── oauth2.ts              # Google OAuth2 setup
│   ├── types/
│   ├── utils/
│   │   └── prisma.ts              # Database client + helper functions
│   └── index.ts                   # Main server setup
├── prisma/
│   └── schema.prisma              # Database schema
└── uploads/                       # User uploaded files (avatars)
```

## Database Schema (Prisma)

### Core Models:
1. **User**: id, email, password, username, first_name, last_name, avatar
2. **RefreshToken**: token, userId, expiresAt, userAgent, ipAddress
3. **LoginAttempt**: email, attempts, lockedUntil (for rate limiting logins)
4. **Friendship**: requester, recipient, status ("pending"/"accepted"/"declined")
5. **Message**: sender, recipient, content, createdAt, read
6. **Block**: blocker, blocked, createdAt

## Authentication System

### JWT Strategy:
- **Access Token**: Short-lived (15 minutes), contains user data
- **Refresh Token**: Long-lived (7 days), stored as HTTP-only cookie
- **Auto-refresh**: Frontend should call `/refresh` when access token expires

### Key Security Features:
- Login attempt tracking (5 attempts = 10min lockout)
- Rate limiting on auth endpoints
- Refresh token rotation (new token on each refresh)
- IP/UserAgent validation (currently disabled due to strictness)

## API Routes Documentation

### Authentication Routes (`/auth`)

#### `POST /auth/authenticate`
**Purpose**: Unified login/register endpoint
**Rate Limit**: 5 requests per 5 minutes
**Body**: `{ email, password, username? }`
**Logic**:
- If user exists: verify password and login
- If user doesn't exist: create account and auto-login
- Returns JWT token + sets refresh cookie
**Response**: `{ statusCode, message, token, user, action }`

#### `POST /auth/refresh`
**Purpose**: Get new access token using refresh cookie
**Rate Limit**: 10 requests per minute
**Logic**:
- Validates refresh token from cookie
- Deletes old refresh token
- Creates new refresh token
- Returns new access token
**Response**: `{ message, token }`

#### `POST /auth/fetch-token`
**Purpose**: Get access token without rotating refresh token
**Logic**: Similar to refresh but doesn't rotate the refresh token
**Response**: `{ token }`

#### `POST /auth/logout`
**Purpose**: Invalidate refresh token and clear cookie
**Logic**: Deletes refresh token from database and clears cookie

#### `GET /auth/validate`
**Purpose**: Validate access token and return user data
**Headers**: `Authorization: Bearer <token>`
**Response**: `{ valid: true, user: payload }`

#### `GET /auth/google/callback`
**Purpose**: Handle Google OAuth2 callback
**Logic**: Exchange code for user info, create/login user, set tokens

### Profile Routes (`/profile`)

#### `GET /profile/me`
**Auth**: Required
**Purpose**: Get current user's profile
**Response**: `{ user: { id, username, email, avatar, createdAt } }`

#### `GET /profile/:id?targetUserId=X`
**Auth**: Required
**Purpose**: Get another user's profile
**Logic**: Checks for blocks before returning profile
**Response**: `{ user: { id, username, avatar, email } }`

#### `PATCH /profile/username`
**Auth**: Required
**Body**: `{ username }`
**Purpose**: Update username
**Validation**: Zod schema validation
**Response**: `{ user: updatedUser }`

#### `PATCH /profile/avatar`
**Auth**: Required
**Rate Limit**: 3 requests per hour per user
**Purpose**: Upload/update profile picture
**File Limits**: 5MB, image types only
**Logic**:
- Validates file type/size
- Generates secure filename with crypto
- Deletes old avatar file
- Updates database
**Response**: `{ message, avatar, fullPath }`

### Users Routes (`/users`)

#### `GET /users/search?query=X`
**Auth**: Required
**Purpose**: Search users by username/email
**Logic**: Excludes blocked users and current user
**Response**: `{ users: [{ id, username, email, avatar }] }`

### Friends Routes (`/friends`)

#### `GET /friends`
**Auth**: Required
**Purpose**: Get user's friends list
**Response**: `{ friends: [user objects] }`

#### `GET /friends/requests`
**Auth**: Required
**Purpose**: Get pending friend requests (sent and received)
**Response**: `{ sent: [...], received: [...] }`

#### `POST /friends/send`
**Auth**: Required
**Body**: `{ recipientId }`
**Purpose**: Send friend request
**Logic**: Validates recipient exists, not blocked, not already friends

#### `POST /friends/respond`
**Auth**: Required
**Body**: `{ requestId, action: "accept"|"decline" }`
**Purpose**: Accept or decline friend request

#### `POST /friends/block`
**Auth**: Required
**Body**: `{ userId }`
**Purpose**: Block a user
**Logic**: Removes any existing friendship, adds block record

#### `POST /friends/unblock`
**Auth**: Required
**Body**: `{ userId }`
**Purpose**: Unblock a user

### Chat Routes (`/chats`)

#### `GET /chats`
**Auth**: Required
**Purpose**: Get user's conversations with last message
**Response**: Array of conversations with friend info and last message

#### `GET /chats/:friendId/messages`
**Auth**: Required
**Purpose**: Get message history with a specific friend
**Logic**: Validates friendship exists, marks messages as read
**Response**: `{ messages: [...] }`

#### `POST /chats/send`
**Auth**: Required
**Body**: `{ recipientId, content }`
**Purpose**: Send a private message
**Logic**:
- Validates friendship exists
- Saves message to database
- Emits real-time event via Socket.IO
**Response**: `{ message: savedMessage }`

## Socket.IO Events

### Connection Flow:
1. Client connects with JWT token in auth
2. Server validates token and joins user to personal room
3. Broadcasts online status to other users

### Events:
- **Connection**: Joins `user_${userId}` room, broadcasts online status
- **Disconnect**: Broadcasts offline status, cleans up rate limiter
- **private_message**: Deprecated (use API endpoint instead)

### Rate Limiting:
- 10 events per second per user using `limiter` package
- Automatic cleanup when users disconnect

## Server Configuration (`index.ts`)

### Plugins Registered:
1. **CORS**: Allows localhost:8080 with credentials
2. **Static Files**: Serves `/uploads` directory with CORS headers
3. **Rate Limiting**: Global 10 req/min, excludes localhost
4. **Helmet**: Security headers (causes CORP issues with images)
5. **Multipart**: File upload support
6. **Cookies**: With secret for signing
7. **JWT**: Custom plugin for token handling
8. **OAuth2**: Google authentication

### Current Issues:
- **Helmet CORP**: Blocks cross-origin image loading
- **Rate Limiting**: May be too aggressive for some endpoints
- **Security vs Usability**: Some security measures too strict

## Utility Functions (`utils/prisma.ts`)

### Database Helpers:
- `generateRandomUsername(prefix?)`: Creates random usernames
- `checkLoginAttempts(email)`: Validates if account is locked
- `recordFailedLogin(email)`: Increments failed login counter
- `clearLoginAttempts(email)`: Resets failed login counter

## Current Known Issues:

1. **Image CORS**: Helmet blocking avatar display (needs CORP configuration)
2. **Rate Limiting**: Sometimes too aggressive, blocking legitimate requests
3. **Session Persistence**: Was broken due to payload mismatch in /validate endpoint
4. **Missing Imports**: crypto import was missing in auth.routes.ts

## Security Features Implemented:
- JWT with short expiration
- Refresh token rotation
- Rate limiting (global and per-user)
- Login attempt tracking
- File upload validation
- Path traversal protection
- Password hashing (bcrypt)
- Input validation (Zod schemas)

## Development Status:
The system is functional with:
- ✅ User authentication and registration
- ✅ Friend system with blocking
- ✅ Real-time messaging
- ✅ File uploads (avatars)
- ✅ Rate limiting and security
- ⚠️ Some CORS issues with static files
- ⚠️ Rate limiting may need tuning

## Next Steps / Potential Improvements:
- Fix Helmet CORP configuration for images
- Add message pagination
- Implement message deletion/editing
- Add group chats
- Improve error handling consistency
- Add comprehensive logging
- Consider Redis for session storage in production