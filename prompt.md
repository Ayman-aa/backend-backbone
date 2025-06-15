# Comprehensive Social Chat App - Vercel v0 Prompt

Create a modern, fully-featured social chat application . This app should connect to an existing backend API and provide a complete user experience for authentication, social features, and real-time messaging.

## Backend Integration

**API Base URL:** `https://backend-backbone-production.up.railway.app`

**CRITICAL CORS SETUP:**
- Configure Next.js to handle CORS properly for cross-origin requests
- Set up proper headers for authentication tokens
- Handle cookies for refresh tokens with `credentials: 'include'`
- Must run on port 8080 (`npm run dev -- -p 8080`)

## Complete API Reference

### Authentication Routes (`/auth`)
| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/auth/authenticate` | Login/Register | `{email: string, password: string, username?: string}` | `{token: string, user: object, action: "login"\|"register"}` |
| POST | `/auth/refresh` | Refresh token using cookie | None | `{token: string}` |
| POST | `/auth/fetch-token` | Get token from refresh cookie | None | `{token: string}` |
| POST | `/auth/logout` | Logout user | None | `{message: string}` |
| GET | `/auth/google/callback` | Google OAuth callback | None | Redirects to app |
| GET | `/auth/validate` | Validate current token | None | `{valid: boolean, user?: object}` |

### User Profile Routes (`/profile`)
| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/profile/me` | Get current user profile | None | `{user: {id, username, email, avatar, createdAt}}` |
| GET | `/profile/:id?targetUserId=123` | Get user by ID | Query param | `{user: {id, username, email, avatar}}` |
| PATCH | `/profile/username` | Update username | `{username: string}` | `{user: object}` |
| PATCH | `/profile/avatar` | Update avatar (multipart) | FormData with file | `{avatar: string, fullPath: string}` |

### Users Management (`/users`)
| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/users` | Get all users with friendship status | `{users: Array<{id, username, email, avatar, friendshipStatus, friendshipId}>}` |
| GET | `/users/search?query=term` | Search users | `{users: Array<user>}` |

### Friends & Social (`/friends`)
| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/friends/request` | Send friend request | `{toUserId: number}` | `{friendship: object}` |
| POST | `/friends/accept` | Accept friend request | `{friendshipId: number}` | `{friendship: object}` |
| POST | `/friends/decline` | Decline friend request | `{friendshipId: number}` | `{friendship: object}` |
| GET | `/friends/list` | Get accepted friends | None | `{friends: Array<user>}` |
| GET | `/friends/pending` | Get received requests | None | `{friends: Array<user>, friendships: Array<object>}` |
| GET | `/friends/sent` | Get sent requests | None | `{friends: Array<user>}` |
| POST | `/friends/block` | Block user | `{blockedUserId: number}` | `{block: object}` |
| POST | `/friends/unblock` | Unblock user | `{blockedUserId: number}` | `{message: string}` |
| GET | `/friends/blocked` | Get blocked users | None | `{blocked: Array<user>}` |

### Chat/Messaging (`/chats`)
| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/chats/send` | Send message | `{toUserId: number, content: string}` | `{message: object}` |
| POST | `/chats/thread` | Get conversation thread | `{toUserId: number}` | `{messages: Array<message>}` |
| GET | `/chats/conversations` | Get all conversations | None | `{conversations: Array<{user, lastMessage, unreadCount}>}` |
| POST | `/chats/mark-read` | Mark messages as read | `{fromUserId: number}` | `{success: boolean}` |

### Static Files
| Endpoint | Description |
|----------|-------------|
| `GET /uploads/*` | Serve uploaded avatars and files |

## Data Models

```typescript
interface User {
  id: number;
  email: string;
  username: string;
  avatar?: string;
  createdAt: Date;
}

interface Message {
  id: number;
  senderId: number;
  recipientId: number;
  content: string;
  createdAt: Date;
  read: boolean;
  sender: User;
  recipient: User;
}

interface Friendship {
  id: number;
  requesterId: number;
  recipientId: number;
  status: "pending" | "accepted" | "declined";
  createdAt: Date;
}

interface Conversation {
  user: User;
  lastMessage: Message;
  unreadCount: number;
}
```

## Required Features & Pages

### 1. Authentication System
- **Landing Page**: Welcome screen with login/register forms
- **Login Form**: Email/password with validation
- **Register Form**: Email/password/username with validation
- **Google OAuth**: "Sign in with Google" button
- **Auto-refresh**: Automatic token refresh using cookies
- **Protected Routes**: Redirect to login if not authenticated

### 2. Main Dashboard Layout
- **Sidebar Navigation**: 
  - Dashboard/Home
  - Friends
  - Messages/Chats
  - Discover Users
  - Profile Settings
- **Header**: User avatar, notifications, logout
- **Responsive**: Mobile-friendly hamburger menu

### 3. User Discovery & Management
- **All Users Page**: Grid/list of all users with friend request buttons
- **Search Users**: Real-time search by username/email
- **User Profile Modal**: View user details, send friend request
- **Friend Status Indicators**: 
  - "Add Friend" button
  - "Request Sent" (disabled)
  - "Accept/Decline" buttons
  - "Friends" indicator

### 4. Friends Management
- **Friends List**: All accepted friends with chat buttons
- **Pending Requests**: Incoming friend requests to accept/decline
- **Sent Requests**: Outgoing pending requests
- **Blocked Users**: List with unblock options
- **Friend Actions**: Block/unblock functionality

### 5. Real-time Chat System
- **Conversations List**: All chat threads with unread counts
- **Chat Interface**: Real-time messaging with friend
- **Message Status**: Read/unread indicators
- **Chat Features**:
  - Send text messages
  - Auto-scroll to latest
  - Mark messages as read
  - Typing indicators (if possible)
  - Message timestamps

### 6. Profile Management
- **Profile Settings**: Edit username, upload avatar
- **Avatar Upload**: Drag & drop or click to upload
- **Profile Preview**: Current user info display
- **Account Actions**: Change password, delete account options

## Technical Requirements

### Next.js Configuration
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization' },
        ],
      },
    ];
  },
  images: {
    domains: ['backend-backbone-production.up.railway.app'],
  },
};

module.exports = nextConfig;
```

### Authentication Context
- Create React Context for user state
- Handle token storage in localStorage
- Automatic token refresh on app load
- Handle 401 responses globally

### API Client Setup
```typescript
const API_BASE = 'https://backend-backbone-production.up.railway.app';

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // Important for cookies
});

// Add auth header interceptor
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Try to refresh token
      // If refresh fails, redirect to login
    }
    return Promise.reject(error);
  }
);
```

## UI/UX Design Requirements

### macOS-Style Design
- **Clean, minimal aesthetic** with rounded corners
- **Glass morphism effects** for cards and modals
- **Smooth animations** and transitions
- **System-style icons** (Lucide React recommended)
- **Blur effects** for backgrounds
- **Subtle shadows** and depth

### Color Scheme
- **Primary**: Blue accent (#007AFF)
- **Background**: Light gray (#F5F5F7) / Dark gray (#1C1C1E)
- **Cards**: White/Dark with transparency
- **Text**: Dark gray (#1D1D1F) / Light gray (#F2F2F7)
- **Success**: Green (#34C759)
- **Error**: Red (#FF3B30)

### Components to Include
- **Toast Notifications**: Success/error messages
- **Loading States**: Skeletons for all data fetching
- **Empty States**: Illustrations for no data
- **Confirmation Modals**: For destructive actions
- **Search Components**: Real-time search with debouncing
- **Avatar Components**: With fallback initials
- **Message Bubbles**: Different styles for sent/received
- **Friend Request Cards**: With action buttons

## Real-time Features (Socket.IO)
- Connect to WebSocket at `wss://backend-backbone-production.up.railway.app`
- Handle `private_message` events for real-time chat
- Update conversation list when new messages arrive
- Show online/offline status if available

## Error Handling
- Display user-friendly error messages
- Handle network failures gracefully
- Show loading states during API calls
- Validate forms before submission
- Handle file upload errors

## Performance Optimizations
- Use React.memo for list components
- Implement virtual scrolling for large lists
- Debounce search inputs
- Optimize image loading with Next.js Image
- Cache user data appropriately

## Responsive Design
- Mobile-first approach
- Tablet and desktop optimizations
- Touch-friendly interface elements
- Adaptive navigation patterns

## Security Considerations
- Validate all user inputs
- Sanitize displayed content
- Handle authentication securely
- Protect against XSS attacks
- Secure file uploads

## Development Setup
```json
{
  "scripts": {
    "dev": "next dev -p 8080",
    "build": "next build",
    "start": "next start -p 8080"
  }
}
```

Create a production-ready, fully-functional social chat application that users can immediately use to connect, chat, and manage friendships. The app should feel native, responsive, and delightful to use with smooth animations and intuitive interactions.

**Important**: Exclude any remote gameplay features - focus only on the social/chat functionality described above.