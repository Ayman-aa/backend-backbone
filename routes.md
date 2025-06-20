# 🚀 Complete API Routes Documentation

## Base URL
```
Production: https://backend-backbone-production.up.railway.app
Local: http://localhost:3000
```

## Authentication
Most routes require JWT authentication via `Authorization: Bearer <token>` header.
- `[A]` = Authentication Required
- `[P]` = Public Route

---

## 🔐 Authentication Routes (`/auth`)

### POST `/auth/authenticate` [P]
**Unified login/register endpoint**
- **Body**: `{ email: string, password: string, username?: string }`
- **Rate Limit**: 5 requests per 5 minutes
- **Success Response (201)**:
  ```json
  {
    "statusCode": 201,
    "message": "Login successful" | "Account created successfully",
    "token": "jwt_token_here",
    "user": { "id": number, "email": string, "username": string },
    "action": "login" | "register"
  }
  ```
- **2FA Required (200)**:
  ```json
  {
    "message": "2FA verification required",
    "tempToken": "temp_jwt_token"
  }
  ```
- **Error Responses**:
  - `400`: Invalid data, username taken
  - `401`: Invalid credentials
  - `429`: Account temporarily locked (too many failed attempts)
  - `500`: Authentication service unavailable

### POST `/auth/refresh` [P]
**Refresh authentication token using refresh token cookie**
- **Rate Limit**: 10 requests per minute
- **Cookie Required**: `refreshToken`
- **Success Response (200)**:
  ```json
  {
    "message": "Token refreshed",
    "token": "new_jwt_token"
  }
  ```
- **Error Responses**:
  - `401`: No refresh token found, invalid or expired refresh token

### POST `/auth/fetch-token` [P]
**Get new token using existing refresh token**
- **Cookie Required**: `refreshToken`
- **Success Response (200)**:
  ```json
  {
    "token": "new_jwt_token"
  }
  ```
- **Error Responses**:
  - `401`: No refresh token found, invalid refresh token, user not found

### POST `/auth/logout` [P]
**Logout and invalidate refresh token**
- **Cookie**: `refreshToken` (optional)
- **Success Response (200)**:
  ```json
  {
    "message": "Logout successful"
  }
  ```

### GET `/auth/google/callback` [P]
**Handle Google OAuth response**
- **Redirects**: `http://localhost:8080` on success, `http://localhost:8080?google_error=true` on error
- **Sets Cookie**: `refreshToken` (7 days)

### GET `/auth/validate` [P]
**Validate JWT token**
- **Headers**: `Authorization: Bearer <token>`
- **Success Response (200)**:
  ```json
  {
    "valid": true,
    "user": { "id": string, "username": string }
  }
  ```
- **Error Responses**:
  - `401`: No token provided, malformed token, invalid or expired token

### POST `/auth/verify-login-2fa` [P]
**Verify 2FA code during login**
- **Headers**: `Authorization: Bearer <temp_token>`
- **Body**: `{ code: string }`
- **Success Response (200)**:
  ```json
  {
    "message": "2FA verification successful",
    "token": "full_jwt_token",
    "user": { "id": number, "email": string, "username": string, "isTwoFAEnabled": boolean }
  }
  ```
- **Error Responses**:
  - `400`: Code is required
  - `401`: No token provided, invalid token scope, invalid or expired 2FA code

---

## 🔐 2FA Routes (`/auth`)

### POST `/auth/generate-2fa` [A]
**Generate 2FA code and send via email**
- **Success Response (200)**:
  ```json
  {
    "message": "2FA code sent to your email"
  }
  ```
- **Error Responses**:
  - `500`: Internal Server Error

### POST `/auth/verify-2fa` [A]
**Verify 2FA code**
- **Body**: `{ code: string }`
- **Success Response (200)**:
  ```json
  {
    "message": "2FA verified successfully"
  }
  ```
- **Error Responses**:
  - `400`: Code is required
  - `401`: Invalid or expired 2FA code
  - `500`: Internal Server Error

### POST `/auth/resend-2fa` [A]
**Resend 2FA code**
- **Success Response (200)**:
  ```json
  {
    "message": "2FA code resent successfully"
  }
  ```
- **Error Responses**:
  - `500`: Internal Server Error

### POST `/auth/enable-2fa` [A]
**Enable 2FA for user account**
- **Body**: `{ code: string }`
- **Success Response (200)**:
  ```json
  {
    "message": "2FA enabled successfully"
  }
  ```
- **Error Responses**:
  - `400`: Code is required
  - `401`: Invalid or expired 2FA code
  - `500`: Internal Server Error

### POST `/auth/disable-2fa` [A]
**Disable 2FA for user account**
- **Success Response (200)**:
  ```json
  {
    "message": "2FA disabled successfully"
  }
  ```
- **Error Responses**:
  - `500`: Internal Server Error

---

## 👤 Profile Routes (`/profile`)

### GET `/profile/me` [A]
**Get current user profile**
- **Success Response (200)**:
  ```json
  {
    "user": {
      "id": number,
      "username": string,
      "email": string,
      "avatar": string | null,
      "createdAt": string
    }
  }
  ```
- **Error Responses**:
  - `404`: User not found
  - `500`: Unable to fetch profile

### GET `/profile/:id` [A]
**Get user profile by ID**
- **Query**: `targetUserId: string` (required)
- **Success Response (200)**:
  ```json
  {
    "user": {
      "id": number,
      "username": string,
      "avatar": string | null,
      "email": string
    }
  }
  ```
- **Error Responses**:
  - `400`: Missing or invalid targetUserId
  - `404`: User not found (or blocked)
  - `500`: Internal Server Error

### PATCH `/profile/username` [A]
**Update username**
- **Body**: `{ username: string }` (min 3 chars)
- **Success Response (200)**:
  ```json
  {
    "user": {
      "id": number,
      "username": string,
      "email": string,
      "avatar": string | null
    }
  }
  ```
- **Error Responses**:
  - `400`: Invalid data
  - `409`: Username already taken
  - `500`: Server error

### PATCH `/profile/avatar` [A]
**Update profile picture**
- **Rate Limit**: 3 requests per hour
- **Content-Type**: `multipart/form-data`
- **File Limits**: Max 5MB, PNG/JPG/JPEG only
- **Success Response (200)**:
  ```json
  {
    "message": "Avatar updated successfully",
    "user": {
      "id": number,
      "username": string,
      "email": string,
      "avatar": string
    }
  }
  ```
- **Error Responses**:
  - `400`: Invalid file type, file too large
  - `500`: Upload failed

---

## 👥 Users Routes (`/users`)

### GET `/users/` [A]
**Get all users (excluding current and blocked)**
- **Rate Limit**: 20 requests per minute
- **Success Response (200)**:
  ```json
  {
    "users": [
      {
        "id": number,
        "username": string,
        "email": string,
        "avatar": string | null,
        "friendshipStatus": "accepted" | "pending_sent" | "pending_received" | null,
        "friendshipId": number | null
      }
    ]
  }
  ```
- **Error Responses**:
  - `500`: Internal Server Error

### GET `/users/search` [A]
**Search users by username or email**
- **Query**: `query: string` (min 2 chars, required)
- **Success Response (200)**:
  ```json
  {
    "users": [
      {
        "id": number,
        "username": string,
        "email": string,
        "avatar": string | null,
        "friendshipStatus": "accepted" | "pending_sent" | "pending_received" | null,
        "friendshipId": number | null
      }
    ]
  }
  ```
- **Error Responses**:
  - `400`: Search query must be at least 2 characters
  - `500`: Internal Server Error

---

## 👫 Friends Routes (`/friends`)

### POST `/friends/request` [A]
**Send friend request**
- **Body**: `{ toUserId: number }`
- **Success Response (200)**:
  ```json
  {
    "message": "Friend request sent",
    "friendship": {
      "id": number,
      "requesterId": number,
      "recipientId": number,
      "status": "pending"
    }
  }
  ```
- **Error Responses**:
  - `400`: Cannot send request to yourself, invalid toUserId
  - `403`: Blocked users cannot interact
  - `409`: Friend request already exists
  - `500`: Internal Server Error

### POST `/friends/accept` [A]
**Accept friend request**
- **Body**: `{ friendshipId: number }`
- **Success Response (200)**:
  ```json
  {
    "message": "Friend request accepted",
    "friendship": {
      "id": number,
      "requesterId": number,
      "recipientId": number,
      "status": "accepted"
    }
  }
  ```
- **Error Responses**:
  - `400`: Request already handled
  - `403`: You're not allowed to accept this request
  - `404`: Friend request not found
  - `500`: Internal Server Error

### POST `/friends/decline` [A]
**Decline friend request**
- **Body**: `{ friendshipId: number }`
- **Success Response (200)**:
  ```json
  {
    "message": "Friend request declined",
    "friendship": {
      "id": number,
      "requesterId": number,
      "recipientId": number,
      "status": "declined"
    }
  }
  ```
- **Error Responses**:
  - `400`: Request already handled
  - `403`: You're not allowed to accept this request
  - `404`: Friend request not found
  - `500`: Internal Server Error

### GET `/friends/list` [A]
**Get accepted friends**
- **Success Response (200)**:
  ```json
  {
    "friends": [
      {
        "id": number,
        "avatar": string | null,
        "username": string,
        "email": string
      }
    ]
  }
  ```
- **Error Responses**:
  - `500`: Internal Server Error

### GET `/friends/pending` [A]
**Get friend requests I received**
- **Success Response (200)**:
  ```json
  {
    "friends": [
      {
        "id": number,
        "avatar": string | null,
        "username": string,
        "email": string
      }
    ],
    "friendships": [
      {
        "id": number,
        "requesterId": number,
        "recipientId": number,
        "status": "pending",
        "requester": {
          "id": number,
          "avatar": string | null,
          "username": string,
          "email": string
        }
      }
    ]
  }
  ```
- **Error Responses**:
  - `500`: Internal Server Error

### GET `/friends/sent` [A]
**Get friend requests I sent**
- **Success Response (200)**:
  ```json
  {
    "friends": [
      {
        "id": number,
        "avatar": string | null,
        "username": string,
        "email": string
      }
    ]
  }
  ```
- **Error Responses**:
  - `500`: Internal Server Error

### POST `/friends/block` [A]
**Block a user**
- **Body**: `{ blockedUserId: number }`
- **Success Response (200)**:
  ```json
  {
    "message": "User blocked",
    "block": {
      "id": number,
      "blockerId": number,
      "blockedId": number
    }
  }
  ```
- **Error Responses**:
  - `400`: Cannot block yourself
  - `409`: User is already blocked
  - `500`: Internal Server Error

### POST `/friends/unblock` [A]
**Unblock a user**
- **Body**: `{ blockedUserId: number }`
- **Success Response (200)**:
  ```json
  {
    "message": "User unblocked"
  }
  ```
- **Error Responses**:
  - `400`: You can't unblock yourself
  - `404`: Block not found
  - `500`: Internal Server Error

### GET `/friends/blocked` [A]
**Get list of blocked users**
- **Success Response (200)**:
  ```json
  {
    "blocked": [
      {
        "id": number,
        "username": string,
        "avatar": string | null,
        "email": string
      }
    ]
  }
  ```
- **Error Responses**:
  - `500`: Internal Server Error

---

## 💬 Chat Routes (`/chats`)

### POST `/chats/send` [A]
**Send a private message**
- **Body**: `{ toUserId: number, content: string }`
- **Success Response (200)**:
  ```json
  {
    "message": {
      "id": number,
      "senderId": number,
      "recipientId": number,
      "content": string,
      "read": boolean,
      "createdAt": string
    }
  }
  ```
- **Error Responses**:
  - `400`: Message cannot be empty
  - `403`: Blocked users cannot interact
  - `500`: Internal Server Error

### POST `/chats/thread` [A]
**Get all messages between current user and another user**
- **Body**: `{ toUserId: number }`
- **Success Response (200)**:
  ```json
  {
    "messages": [
      {
        "id": number,
        "senderId": number,
        "recipientId": number,
        "content": string,
        "read": boolean,
        "createdAt": string,
        "sender": {
          "id": number,
          "username": string,
          "avatar": string | null
        },
        "recipient": {
          "id": number,
          "username": string,
          "avatar": string | null
        }
      }
    ]
  }
  ```
- **Error Responses**:
  - `500`: Internal Server Error

### GET `/chats/conversations` [A]
**Get list of users I've chatted with and last message**
- **Success Response (200)**:
  ```json
  {
    "conversations": [
      {
        "user": {
          "id": number,
          "username": string,
          "avatar": string | null
        },
        "lastMessage": {
          "id": number,
          "content": string,
          "createdAt": string,
          "read": boolean,
          "senderId": number
        },
        "unreadCount": number
      }
    ]
  }
  ```
- **Error Responses**:
  - `500`: Internal Server Error

### POST `/chats/mark-read` [A]
**Mark messages from a user as read**
- **Body**: `{ fromUserId: number }`
- **Success Response (200)**:
  ```json
  {
    "success": true
  }
  ```
- **Error Responses**:
  - `500`: Internal Server Error

---

## 🎮 Game Routes

### Local Game Routes (`/game`)

#### POST `/game/local` [A]
**Save local 1v1 game result**
- **Body**: `{ score1: number, score2: number, player2Name: string }`
- **Success Response (200)**:
  ```json
  {
    "message": "Local game saved",
    "game": {
      "id": number,
      "player1Id": number,
      "player2Name": string,
      "score1": number,
      "score2": number,
      "winnerId": number | null,
      "mode": "LOCAL",
      "createdAt": string
    }
  }
  ```
- **Error Responses**:
  - `500`: Internal Server Error

#### GET `/game/local` [A]
**Get local game results and statistics**
- **Success Response (200)**:
  ```json
  {
    "games": [
      {
        "id": number,
        "player1Id": number,
        "player2Name": string,
        "score1": number,
        "score2": number,
        "winnerId": number | null,
        "mode": "LOCAL",
        "createdAt": string
      }
    ],
    "stats": {
      "totalGames": number,
      "wonGames": number,
      "lostGames": number,
      "winRate": string
    }
  }
  ```
- **Error Responses**:
  - `500`: Internal Server Error

### Remote Game Routes (`/game/remote`)

#### POST `/game/remote/request` [A]
**Send remote match request**
- **Body**: `{ opponentId: number }`
- **Success Response (200)**:
  ```json
  {
    "message": "Match request sent",
    "matchRequest": {
      "id": number,
      "requesterId": number,
      "recipientId": number,
      "status": "pending",
      "createdAt": string
    }
  }
  ```
- **Error Responses**:
  - `400`: Invalid opponent Id, Match request already sent
  - `404`: opponentId not found
  - `500`: Internal Server Error

#### POST `/game/remote/respond` [A]
**Accept or decline a match request**
- **Body**: `{ requestId: number, action: "accept" | "decline" }`
- **Success Response (200)**:
  ```json
  {
    "message": "Match request accepted",
    "matchRequest": {
      "id": number,
      "requesterId": number,
      "recipientId": number,
      "status": "accepted"
    },
    "game": {
      "id": number,
      "player1Id": number,
      "player2Id": number,
      "score1": 0,
      "score2": 0,
      "mode": "REMOTE",
      "player1": {
        "id": number,
        "username": string,
        "avatar": string | null
      },
      "player2": {
        "id": number,
        "username": string,
        "avatar": string | null
      }
    }
  }
  ```
- **Error Responses**:
  - `400`: Missing requestId or action, Request already responded to
  - `403`: Match request not found, You can only respond to requests sent to you
  - `500`: Internal Server Error

#### GET `/game/remote` [A]
**List all remote match requests**
- **Query**: `status?: "pending" | "accepted" | "declined"`, `limit?: number`, `offset?: number`
- **Success Response (200)**:
  ```json
  {
    "matchRequests": [
      {
        "id": number,
        "requesterId": number,
        "recipientId": number,
        "status": string,
        "createdAt": string,
        "requester": {
          "id": number,
          "username": string,
          "avatar": string | null
        },
        "recipient": {
          "id": number,
          "username": string,
          "avatar": string | null
        }
      }
    ],
    "pagination": {
      "total": number,
      "limit": number,
      "offset": number,
      "hasMore": boolean
    }
  }
  ```
- **Error Responses**:
  - `500`: Internal Server Error

#### POST `/game/remote/:id/submit` [A]
**Submit final game scores**
- **Params**: `id: string` (game ID)
- **Body**: `{ score1: number, score2: number }`
- **Success Response (200)**:
  ```json
  {
    "message": "Game score submitted successfully",
    "game": {
      "id": number,
      "player1Id": number,
      "player2Id": number,
      "score1": number,
      "score2": number,
      "winnerId": number | null,
      "mode": "REMOTE",
      "player1": {
        "id": number,
        "username": string,
        "avatar": string | null
      },
      "player2": {
        "id": number,
        "username": string,
        "avatar": string | null
      },
      "winner": {
        "id": number,
        "username": string,
        "avatar": string | null
      } | null
    }
  }
  ```
- **Error Responses**:
  - `400`: Invalid game ID, Game scores already submitted
  - `403`: You are not a participant in this game
  - `404`: Game not found
  - `500`: Internal Server Error

### Tournament Routes (`/game/tournaments`)

#### POST `/game/tournaments/create` [A]
**Create tournament (4 or 8 players)**
- **Body**: `{ name: string, players: string[] }` (4-8 players)
- **Success Response (200)**:
  ```json
  {
    "message": "Tournament created successfully!",
    "tournament": {
      "id": number,
      "name": string,
      "maxPlayers": number,
      "ownerId": number,
      "status": "IN_PROGRESS",
      "createdAt": string
    },
    "currentMatches": [
      {
        "id": number,
        "player1": string,
        "player2": string,
        "round": 1
      }
    ]
  }
  ```
- **Error Responses**:
  - `400`: Invalid number of players (must be 4 or 8)
  - `500`: Failed to create tournament

#### POST `/game/tournaments/submit-score` [A]
**Submit tournament match score**
- **Body**: `{ matchId: number, score1: number, score2: number }`
- **Success Response (200)**:
  ```json
  {
    "message": "Score submitted! Waiting for other matches." | "Next round created!" | "Tournament complete!",
    "nextMatches": [
      {
        "id": number,
        "player1": string,
        "player2": string,
        "round": number
      }
    ],
    "champion": string
  }
  ```
- **Error Responses**:
  - `400`: Invalid match data
  - `500`: Failed to submit score

#### GET `/game/tournaments/history` [A]
**Get user tournament history and statistics**
- **Success Response (200)**:
  ```json
  {
    "username": string,
    "stats": {
      "totalTournaments": number,
      "completedTournaments": number,
      "wonTournaments": number,
      "winRate": string
    },
    "tournaments": [
      {
        "id": number,
        "name": string,
        "maxPlayers": number,
        "status": string,
        "createdAt": string,
        "games": [
          {
            "id": number,
            "tournamentPlayer1Name": string,
            "tournamentPlayer2Name": string,
            "score1": number,
            "score2": number,
            "round": number
          }
        ]
      }
    ]
  }
  ```
- **Error Responses**:
  - `500`: Failed to fetch user data

---

## 🔌 Socket.IO Events

### Client to Server Events

#### `join_game`
**Join a game room**
- **Data**: `{ gameId: number, userId: number }`
- **Response**: `game_joined` or `game_error`

#### `paddle_move`
**Send paddle position update**
- **Data**: `{ gameId: number, playerId: number, paddleY: number }`
- **Broadcast**: `opponent_paddle_move` to other players

#### `ball_update`
**Send ball position update (host only)**
- **Data**: `{ gameId: number, ballX: number, ballY: number, ballVelX: number, ballVelY: number }`
- **Broadcast**: `ball_position` to other players

#### `score_update`
**Send score update**
- **Data**: `{ gameId: number, score1: number, score2: number }`
- **Broadcast**: `score_changed` to all players

#### `game_over`
**Send game completion**
- **Data**: `{ gameId: number, winnerId: number, score1: number, score2: number }`
- **Broadcast**: `game_finished` to all players

#### `start_game`
**Force start game**
- **Data**: `{ gameId: number }`
- **Broadcast**: `game_start` to other players

### Server to Client Events

#### `match_request_accepted`
**Match request was accepted**
- **Data**: `{ gameId: number, opponentName: string, message: string }`

#### `game_joined`
**Successfully joined game room**
- **Data**: `{ gameId: number, game: object }`

#### `player_joined`
**Another player joined the game**
- **Data**: `{ playerId: number, playerName: string }`

#### `game_start`
**Game is starting**
- **Data**: `{}`

#### `opponent_paddle_move`
**Opponent moved their paddle**
- **Data**: `{ playerId: number, paddleY: number }`

#### `ball_position`
**Ball position update from host**
- **Data**: `{ ballX: number, ballY: number, ballVelX: number, ballVelY: number }`

#### `score_changed`
**Score was updated**
- **Data**: `{ score1: number, score2: number }`

#### `game_finished`
**Game has ended**
- **Data**: `{ winnerId: number, score1: number, score2: number }`

#### `game_error`
**Game-related error occurred**
- **Data**: `{ message: string }`

---

## 📁 File Upload

### Avatar Upload (`/profile/avatar`)
- **Supported formats**: PNG, JPG, JPEG
- **Max file size**: 5MB
- **Rate limit**: 3 uploads per hour
- **Storage**: `/uploads/avatar_{userId}_{timestamp}_{hash}.{ext}`

---

## ⚡ Rate Limiting

- **Global**: 200 requests per minute
- **Authentication**: 5 requests per 5 minutes
- **Token refresh**: 10 requests per minute
- **User search**: 20 requests per minute
- **Avatar upload**: 3 requests per hour

---

## 🍪 Cookies

### `refreshToken`
- **Purpose**: Long-term authentication
- **Duration**: 7 days
- **HttpOnly**: false (for cross-origin)
- **Secure**: true (HTTPS only)
- **SameSite**: none (cross-origin support)

---

## 🔒 Security Features

- **JWT Tokens**: 15-minute expiration
- **Refresh Tokens**: 7-day expiration with rotation
- **Rate Limiting**: Per-endpoint and global limits
- **Input Validation**: JSON schema validation
- **CORS**: Configured for cross-origin requests
- **Helmet**: Security headers
- **2FA**: Email-based two-factor authentication
- **Blocking System**: Users can block each other
- **Login Attempts**: Account locking after failed attempts

---

## 🎯 Multiplayer Game Flow

### 1. Authentication
```
POST /auth/authenticate -> JWT token
```

### 2. Find Opponent
```
GET /users/search?query=username -> Find users
```

### 3. Send Match Request
```
POST /game/remote/request -> Send request
```

### 4. Accept Request
```
POST /game/remote/respond -> Creates game + Socket notification
```

### 5. Join Game Room
```
Socket: join_game -> Join real-time room
```

### 6. Real-time Gameplay
```
Socket: paddle_move, ball_update, score_update
```

### 7. Submit Final Score
```
POST /game/remote/{gameId}/submit -> Save final result
```

---

## 🏆 Tournament Flow

### 1. Create Tournament
```
POST /game/tournaments/create -> Creates tournament + Round 1 matches
```

### 2. Play Matches
```
POST /game/tournaments/submit-score -> Submit each match result
```

### 3. Automatic Progression
- Backend automatically creates next round when current round completes
- Declares champion when final match is completed

### 4. View History
```
GET /game/tournaments/history -> User tournament stats
```

---

## 📊 Statistics & Analytics

### Local Games
- Total games played
- Win/loss record
- Win rate percentage

### Remote Games
- Match request history
- Game results with opponents
- Multiplayer statistics

### Tournaments
- Tournament participation
- Tournament wins
- Win rate in tournaments
- Detailed tournament history

---

## 🚨 Error Handling

All endpoints follow consistent error response format:
```json
{
  "statusCode": number,
  "error": "Error description"
}
```

### Common HTTP Status Codes
- **200**: Success
- **201**: Created
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (authentication required)
- **403**: Forbidden (permission denied)
- **404**: Not Found
- **409**: Conflict (duplicate data)
- **429**: Too Many Requests (rate limited)
- **500**: Internal Server Error

---

## 🔧 Development Notes

### Database Models
- **User**: Authentication and profile data
- **Friendship**: Friend request system
- **Block**: User blocking system
- **Message**: Private messaging
- **Game**: All game types (local, remote, tournament)
- **RemoteMatchRequest**: Remote game requests
- **Tournament**: Tournament metadata
- **RefreshToken**: Secure token management
- **LoginAttempt**: Failed login tracking

### WebSocket Authentication
Socket.IO connections require JWT token in auth object:
```javascript
const socket = io('wss://your-domain.com', {
  auth: { token: 'your-jwt-token' }
});
```

### CORS Configuration
Backend accepts requests from all origins with credentials support for cross-origin authentication.

---

This documentation covers every route, parameter, response, and feature of the backend API. Use this as a complete reference for building frontend applications or integrating with the game backend.
