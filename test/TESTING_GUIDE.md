# 🎮 Remote Pong Testing Guide

## Overview
This guide will help you test the remote multiplayer pong functionality step by step. You now have all the backend infrastructure ready!

## What You Have Built ✅

### Backend Components:
- ✅ **Database Schema**: Game, RemoteMatchRequest, User models
- ✅ **API Routes**: Match requests, game management, score submission
- ✅ **Socket.IO Events**: Real-time gameplay communication
- ✅ **Authentication**: JWT + refresh tokens
- ✅ **Rate Limiting**: Per-user limits for security

### File Structure:
```
backend-backbone/
├── src/modules/game/game.remote-1v1.routes.ts  # API endpoints
├── src/modules/socket/remote.ts                # Socket.IO events
├── test/api-test.html                          # API testing interface
├── test/pong-local.html                        # Your original Pong game
└── test/TESTING_GUIDE.md                       # This guide
```

## Step-by-Step Testing Process

### 1. 🚀 Start Your Backend Server
```bash
cd backend-backbone
npm run dev  # or your start command
```

Verify server is running at `http://localhost:3000`

### 2. 🔐 Test Authentication
Open `test/api-test.html` in your browser:
1. **Create User 1**: Use email `player1@test.com`, password `password123`
2. **Create User 2**: Use email `player2@test.com`, password `password123`
3. Save the JWT tokens and user IDs for later

### 3. 🎯 Test Match Request Flow

#### Send Match Request (Player 1):
1. Login as Player 1
2. In "Match Requests" section, enter Player 2's user ID
3. Click "Send Match Request"
4. Should return: `{ message: "Match request sent", matchRequest: {...} }`

#### Accept Match Request (Player 2):
1. Login as Player 2 (new browser tab/window)
2. Click "Get My Match Requests"
3. Find the pending request, note its `id`
4. Enter the request ID, select "Accept"
5. Click "Respond to Request"
6. Should return: `{ message: "Match request accepted", game: {...} }`

**Important**: Save the `game.id` from the response!

### 4. 🔌 Test Socket.IO Connection

#### Player 1:
1. In API test page, click "Connect to Socket.IO"
2. Enter the game ID and user ID in Socket section
3. Click "Join Game Room"
4. Should see: `{ event: "game_joined", data: {...} }`

#### Player 2:
1. In second browser tab, connect to Socket.IO
2. Join the same game room
3. Both players should see `player_joined` events

### 5. 🏓 Test Game Score Submission
After "playing" the game:
1. Enter the game ID in "Game Management"
2. Set scores (e.g., Player 1: 5, Player 2: 3)
3. Click "Submit Game Score"
4. Should return: `{ message: "Game score submitted successfully", game: {...} }`

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/authenticate` | POST | Login/Register users |
| `/users/search` | GET | Find other users |
| `/game/remote/request` | POST | Send match request |
| `/game/remote/respond` | POST | Accept/decline request |
| `/game/remote` | GET | List match requests |
| `/game/remote/:id/submit` | POST | Submit final scores |

## Socket.IO Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `join_game` | Client → Server | Join game room |
| `game_joined` | Server → Client | Confirm room joined |
| `player_joined` | Server → Client | Another player joined |
| `paddle_move` | Client ↔ Server | Real-time paddle updates |
| `ball_update` | Client ↔ Server | Real-time ball position |
| `score_update` | Client ↔ Server | Score changes |
| `game_over` | Client → Server | Game finished |

## Expected Database State After Testing

### RemoteMatchRequest Table:
```
| id | requesterId | recipientId | status   |
|----|-------------|-------------|----------|
| 1  | 1           | 2           | accepted |
```

### Game Table:
```
| id | player1Id | player2Id | score1 | score2 | winnerId | mode   |
|----|-----------|-----------|--------|--------|----------|--------|
| 1  | 1         | 2         | 5      | 3      | 1        | REMOTE |
```

## Next Steps: Building the Frontend

To create a full remote Pong game, you'll need to:

### 1. **Modify Your Pong Game** (`pong-local.html`):
- Add Socket.IO connection
- Send/receive paddle positions
- Synchronize ball movement
- Handle network player controls

### 2. **Key Frontend Changes Needed**:
```javascript
// Add Socket.IO connection
const socket = io('http://localhost:3000', {
    auth: { token: jwtToken }
});

// Send paddle movements
socket.emit('paddle_move', {
    gameId: currentGameId,
    playerId: currentUserId,
    paddleY: this.player1.y
});

// Receive opponent paddle movements
socket.on('opponent_paddle_move', (data) => {
    this.player2.y = data.paddleY;
});
```

### 3. **Game Synchronization Strategy**:
- **Player 1** (host): Controls ball physics, sends updates
- **Player 2** (client): Receives ball position, sends paddle only
- Both players send paddle positions to each other

## Troubleshooting

### Common Issues:

1. **"Authentication error"**: Check JWT token is set correctly
2. **"Rate limit exceeded"**: Wait a minute or restart server
3. **"Game not found"**: Ensure game was created when accepting match request
4. **Socket connection fails**: Verify server is running and token is valid

### Debug Commands:
```bash
# Check server logs
tail -f logs/server.log

# Check database
npx prisma studio

# Test API directly
curl -X POST http://localhost:3000/auth/authenticate \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}'
```

## Success Criteria ✅

You'll know everything is working when:
- ✅ Two users can authenticate
- ✅ Match requests can be sent and accepted
- ✅ Games are created automatically
- ✅ Socket.IO connections work
- ✅ Players can join game rooms
- ✅ Game scores can be submitted

**You now have a complete backend for remote multiplayer Pong!** 🎉

The final step is adapting your beautiful Pong game to use these APIs and Socket.IO events for real multiplayer gameplay.