```ts
🚀 API ROUTES OVERVIEW
═════════════════════════════════════════════════════════

📁 🎮 GAMING

POST /game/local              [A] - Local Game Record
GET  /game/local              [A] - Local Stats
POST /game/remote/request     [A] - Challenge Enemy
POST /game/remote/respond     [A] - Accept/Decline
GET  /game/remote             [A] - Match History
POST /game/remote/:id/submit  [A] - Submit Score
POST /game/tournaments/create [A] - Create Tournament
POST /game/tournaments/submit-score [A] - Tournament Score
GET  /game/tournaments/history [A] - Tournament Stats


📁 👤 PROFILE

GET   /profile/me             [A] - Self Inspection
GET   /profile/:id            [A] - Stalk Others
PATCH /profile/username       [A] - Identity Change
PATCH /profile/avatar         [A] - Face Lift (Rate Limited)


📁 👥 USERS

GET /users/                   [A] - Browse Humans
GET /users/search             [A] - Hunt Specific Targets


📁 💬 MESSAGING

POST /chats/send              [A] - Send Message
POST /chats/thread            [A] - Get Conversation
GET  /chats/conversations     [A] - Chat List
POST /chats/mark-read         [A] - Mark as Read


📁 📁 STATIC FILES

  GET  /uploads/*         [P]


📁 🔐 AUTHENTICATION

POST /auth/authenticate        [P] - Login/Register (The Gateway)
POST /auth/refresh             [P] - Token Renewal (Stay Alive)
POST /auth/fetch-token         [P] - Token Retrieval
POST /auth/logout              [P] - Clean Exit
GET  /auth/google/callback     [P] - OAuth Magic
GET  /auth/validate            [P] - Token Verification
POST /auth/verify-login-2fa    [P] - 2FA Login Gate
POST /auth/generate-2fa        [A] - Code Generation
POST /auth/verify-2fa          [A] - Code Verification  
POST /auth/resend-2fa          [A] - Code Resend
POST /auth/enable-2fa          [A] - Enable 2FA
POST /auth/disable-2fa         [A] - Disable 2FA


📁 🤝 FRIENDS

POST /friends/request         [A] - Send Friend Request
POST /friends/accept          [A] - Accept Request
POST /friends/decline         [A] - Reject Request
GET  /friends/list            [A] - View Squad
GET  /friends/pending         [A] - Incoming Requests
GET  /friends/sent            [A] - Outgoing Requests
POST /friends/block           [A] - Ban Hammer
POST /friends/unblock         [A] - Forgiveness
GET  /friends/blocked         [A] - Hall of Shame

═════════════════════════════════════════════════════════
📊 SUMMARY: 42 routes total
   [A]uth: 33 | [P]ublic: 9 | 1 cols
═════════════════════════════════════════════════════════


           _ _        _        _
      ___ | | | _   _| | _ __ (_) ___
     / _ \| | || | | | || '__|| |/ __|
    |  __/| | || |_| | || |   | |\__ \
     \___||_|_| \__,_|_||_|   |_||___/


✅ ONLINE 🌐
Server is up and listening on: http://localhost:3000

---------------------------------------------------------

```