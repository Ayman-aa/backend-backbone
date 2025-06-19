```js
🚀 API ROUTES OVERVIEW
════════════════════════════════════════════════════════════

📁 🎮 GAMING

  POST /game/local        [A]  GET  /game/local        [A]  GET  /game/remote/      [A]
  POST /game/remote/:i... [A]  POST /game/remote/re... [A]  POST /game/remote/re... [A]


📁 👤 PROFILE

  GET  /profile/:id       [A]  PATCH /profile/avatar    [A]  GET  /profile/me        [A]
  PATCH /profile/username  [A]


📁 👥 USERS

  GET  /users/            [A]  GET  /users/search      [A]


📁 💬 MESSAGING

  GET  /chats/conversa... [A]  POST /chats/mark-read   [A]  POST /chats/send        [A]
  POST /chats/thread      [A]


📁 📁 STATIC FILES

  GET  /uploads/*         [P]


📁 🔐 AUTHENTICATION

  POST /auth/authenticate [P]  POST /auth/fetch-token  [P]  GET  /auth/google       [P]
  GET  /auth/google/ca... [P]  POST /auth/logout       [P]  POST /auth/refresh      [P]
  GET  /auth/validate     [P]


📁 🤝 FRIENDS

  POST /friends/accept    [A]  POST /friends/block     [A]  GET  /friends/blocked   [A]
  POST /friends/decline   [A]  GET  /friends/list      [A]  GET  /friends/pending   [A]
  POST /friends/request   [A]  GET  /friends/sent      [A]  POST /friends/unblock   [A]

════════════════════════════════════════════════════════════
📊 SUMMARY: 33 routes total
   [A]uth: 25 | [P]ublic: 8 | 3 cols
════════════════════════════════════════════════════════════


           _ _        _        _
      ___ | | | _   _| | _ __ (_) ___
     / _ \| | || | | | || '__|| |/ __|
    |  __/| | || |_| | || |   | |\__ \
     \___||_|_| \__,_|_||_|   |_||___/


✅ ONLINE 🌐
Server is up and listening on: http://localhost:3000
```