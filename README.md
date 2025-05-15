

# Node.js Rest API

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](http://prettier.io) [![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/) [![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)

This is a sample Node.js application comprehensive API including features such as user authentication, token refresh, user logout, password reset, and user management (creation, update, deletion).

Additionally, it supports authentication through various platforms including **Google**, ~~Facebook~~, and ~~Github~~.

The project also includes a Swagger documentation.

### ✅ Authentication

- [x] Local register & login with JWT
- [x] Google OAuth login/signup
- [x] JWT access token (short-lived) & refresh token (7d, cookie)
- [x] Refresh endpoint (`/auth/refresh`)
- [x] Logout (`/auth/logout`)
- [x] User info (`/profile/me`)
- [x] Upload avatar image via multipart/form-data
- [x] Update username (`/profile/username`)

### 👥 Friend System

- [x] Send request (`POST /friends/request`)
- [x] Accept request (`POST /friends/accept`)
- [x] Decline request (`POST /friends/decline`)
- [x] List all accepted friends (`GET /friends/list`)
- [x] View pending received requests (`GET /friends/pending`)
- [x] View sent requests (`GET /friends/sent`)

> Friendships use a single `Friendship` table with `requesterId`, `recipientId`, and `status`.




<div align="center">
  <a href="#"><img src="https://img.shields.io/badge/Fastify-black?style=for-the-badge&logo=fastify&logoColor=white" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" /></a>
  <a href="#"><img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=JSON%20web%20tokens&logoColor=pink" /></a>
  <a href="#"><img src="https://img.shields.io/badge/OAuth-EB5424?style=for-the-badge&logo=auth0&logoColor=white" /></a>
</div>

---

