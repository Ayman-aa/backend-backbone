✅ Implemented API Routes
```
| Method | Route              | Description                                      |
| ------ | ------------------ | ------------------------------------------------ |
| POST   | `/authenticate`    | Unified login/register endpoint                  |
| POST   | `/refresh`         | Refresh authentication token                     |
| POST   | `/fetch-token`     | Get a new token using refresh token              |
| POST   | `/logout`          | Log out (invalidate refresh token)               |
| GET    | `/google/callback` | Handle Google OAuth response                     |
| GET    | `/validate`        | Validate authentication token                    |

| Method | Route              | Description                                      |
| ------ | ------------------ | ------------------------------------------------ |
| POST   | `/send`            | Send a private message to a user                 |
| POST   | `/thread`          | Get all messages between current user and a user |
| GET    | `/conversations`   | Get list of users I've chatted with              |
| POST   | `/mark-read`       | Mark messages from a user as read                |

| Method | Route              | Description                                      |
| ------ | ------------------ | ------------------------------------------------ |
| POST   | `/friends/request` | Send friend request                              |
| POST   | `/friends/accept`  | Accept request (needs `friendshipId`)            |
| POST   | `/friends/decline` | Decline request                                  |
| GET    | `/friends/list`    | Get accepted friends                             |
| GET    | `/friends/pending` | Get requests I received                          |
| GET    | `/friends/sent`    | Get requests I sent                              |
| POST   | `/friends/block`   | Block a user                                     |
| POST   | `/friends/unblock` | Unblock a user                                   |
| POST   | `/friends/blocked` | Get list of users I blocked                      |

| Method | Route              | Description                                      |
| ------ | ------------------ | ------------------------------------------------ |
| GET    | `/me`              | Get current user profile                         |
| GET    | `/:id`             | Get user profile by id                           |
| PATCH  | `/username`        | Update username                                  |
| PATCH  | `/avatar`          | Update profile picture                           |

| Method | Route              | Description                                      |
| ------ | ------------------ | ------------------------------------------------ |
| GET    | `/users`           | Get all users (excluding current)                |
| GET    | `/users/search`    | Search users by username or email                |
```
