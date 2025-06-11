# API Routes Documentation

This document lists all the API routes available in this FastifyJS application with their file locations and descriptions.

## Base URL
`http://localhost:3000`

---

## Authentication Routes
**Location:** `src/modules/auth/auth.routes.ts`  
**Prefix:** `/auth`

| Method | Route                     | Description                                    | Auth Required |
|--------|---------------------------|------------------------------------------------|---------------|
| POST   | `/auth/authenticate`      | Unified login/register endpoint                | No            |
| POST   | `/auth/refresh`           | Refresh authentication token using cookie     | No            |
| POST   | `/auth/fetch-token`       | Get new token using refresh token             | No            |
| POST   | `/auth/logout`            | Log out (invalidate refresh token)            | No            |
| GET    | `/auth/google/callback`   | Handle Google OAuth response                   | No            |
| GET    | `/auth/validate`          | Validate authentication token                  | No            |

---

## User Profile Routes  
**Location:** `src/modules/users/profile.routes.ts`  
**Prefix:** `/profile`

| Method | Route                     | Description                                    | Auth Required |
|--------|---------------------------|------------------------------------------------|---------------|
| GET    | `/profile/me`             | Get current user profile                       | Yes           |
| GET    | `/profile/:id`            | Get user profile by id (uses query param)     | Yes           |
| PATCH  | `/profile/username`       | Update username                                | Yes           |
| PATCH  | `/profile/avatar`         | Update profile picture (multipart upload)     | Yes           |

---

## Users Management Routes
**Location:** `src/modules/users/users.routes.ts`  
**Prefix:** `/users`

| Method | Route                     | Description                                    | Auth Required |
|--------|---------------------------|------------------------------------------------|---------------|
| GET    | `/users`                  | Get all users (excluding current & blocked)   | Yes           |
| GET    | `/users/search`           | Search users by username or email             | Yes           |

---

## Friends & Social Routes
**Location:** `src/modules/friends/friends.routes.ts`  
**Prefix:** `/friends`

| Method | Route                     | Description                                    | Auth Required |
|--------|---------------------------|------------------------------------------------|---------------|
| POST   | `/friends/request`        | Send friend request                            | Yes           |
| POST   | `/friends/accept`         | Accept friend request (requires friendshipId) | Yes           |
| POST   | `/friends/decline`        | Decline friend request                         | Yes           |
| GET    | `/friends/list`           | Get accepted friends                           | Yes           |
| GET    | `/friends/pending`        | Get friend requests I received                 | Yes           |
| GET    | `/friends/sent`           | Get friend requests I sent                     | Yes           |
| POST   | `/friends/block`          | Block a user                                   | Yes           |
| POST   | `/friends/unblock`        | Unblock a user                                 | Yes           |
| GET    | `/friends/blocked`        | Get list of users I blocked                    | Yes           |

---

## Chat/Messaging Routes
**Location:** `src/modules/chats/chats.routes.ts`  
**Prefix:** `/chats`

| Method | Route                     | Description                                    | Auth Required |
|--------|---------------------------|------------------------------------------------|---------------|
| POST   | `/chats/send`             | Send a private message to a user               | Yes           |
| POST   | `/chats/thread`           | Get all messages between current user and another | Yes        |
| GET    | `/chats/conversations`    | Get list of users I've chatted with + last message | Yes      |
| POST   | `/chats/mark-read`        | Mark messages from a user as read             | Yes           |

---

## Static File Routes
**Location:** `src/index.ts` (fastifyStatic plugin)  
**Prefix:** `/uploads`

| Method | Route                     | Description                                    | Auth Required |
|--------|---------------------------|------------------------------------------------|---------------|
| GET    | `/uploads/*`              | Serve uploaded files (avatars, images, etc.)  | No            |

---

## WebSocket/Socket.IO Routes
**Location:** `src/modules/socket/socket.ts`  
**Connection:** `ws://localhost:3000`

| Event Type | Event Name                | Description                                    | Auth Required |
|------------|---------------------------|------------------------------------------------|---------------|
| Connect    | `connection`              | User connects and joins private room           | Yes (JWT)     |
| Receive    | `private_message`         | Receive real-time private messages             | Yes           |
| Receive    | `user_status`             | Receive online/offline status updates         | Yes           |
| Send       | `disconnect`              | User disconnects and notifies others          | Yes           |

**Note:** Direct message sending via Socket.IO is disabled. Use the `/chats/send` API endpoint instead.

---

## Route Registration
**Location:** `src/index.ts`

All routes are registered in the main application file with their respective prefixes:

```typescript
app.register(userRoutes, { prefix: '/profile' });
app.register(usersRoutes, { prefix: '/users' });
app.register(authRoutes, { prefix: '/auth' });
app.register(friendsRoutes, { prefix: '/friends' });
app.register(chatRoutes, { prefix: '/chats' });
```

---

## Authentication Notes

- Routes marked with "Auth Required: Yes" need a valid JWT token in the `Authorization: Bearer <token>` header
- Refresh tokens are stored in HTTP-only cookies
- Google OAuth is available through the `/auth/google/callback` endpoint
- Socket.IO connections require JWT token in the auth handshake

---

## Error Handling

All routes follow consistent error response patterns:
- `200/201`: Success
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (blocked users, permission denied)
- `404`: Not Found
- `409`: Conflict (duplicate data)
- `429`: Too Many Requests (rate limiting)
- `500`: Internal Server Error