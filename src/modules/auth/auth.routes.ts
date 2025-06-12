import { FastifyInstance } from "fastify";
const bcrypt = require("bcrypt");
import { generateRandomUsername, prisma } from '../../utils/prisma';

/* 
  Q: When JWT expires, what happens?
  ✅ Frontend uses refresh token (from cookie) to get new JWT.
  
  Q: Is it automatic?
  🚫 No — you must write frontend code to detect 401 and call /refresh.
  
  Q: If refresh token expires or is deleted?
  ✅ User is fully logged out. You return 401, and frontend clears everything.
*/
export default async function authRoutes(app: FastifyInstance) {
  /* <-- Unified Authentication route --> */
  app.post("/authenticate", { 
    preHandler: [app.rateLimit({ max: 5, timeWindow: '1 minute' })],
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 254, pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' },
          password: { type: 'string', minLength: 8, maxLength: 128, pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]' },
          username: { type: 'string', minLength: 3, maxLength: 30, pattern: '^[a-zA-Z0-9_-]+$' },
        },
        additionalProperties: false,
      }
    }
   }, async (request, reply) => {
    const { email, password, username } = request.body as { email: string, password: string, username?: string };
    
    try {
      // Check if user exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      
      if (existingUser) {
        // User exists - verify password (LOGIN)
        const match = await bcrypt.compare(password, existingUser.password);
        if (!match) {
          return reply.status(401).send({ 
            statusCode: 401, 
            error: "Incorrect password" 
          });
        }
        
        // Password correct - login
        const token = app.jwt.sign({ 
          id: existingUser.id, 
          email: existingUser.email, 
          username: existingUser.username, 
          avatar: existingUser.avatar 
        }, { expiresIn: '15m' });
        
        const refreshToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await prisma.refreshToken.create({
          data: {
            token: refreshToken,
            userId: existingUser.id,
            expiresAt,
            userAgent: request.headers['user-agent'],
            ipAddress: request.ip,
          }
        });
        
        reply.setCookie("refreshToken", refreshToken, {
          path: "/",
          httpOnly: false,
          secure: false,
          sameSite: "lax",
          maxAge: 7 * 24 * 3600
        });
        
        return reply.status(200).send({
          statusCode: 200,
          message: "Login successful",
          token,
          user: { id: existingUser.id, email: existingUser.email, username: existingUser.username },
          action: "login"
        });
        
      } else {
        // User doesn't exist - register new user (REGISTRATION)
        
        // Generate username if not provided
        const newUsername = username || generateRandomUsername(email.split('@')[0]);
        
        // Check if username is taken
        const existingUsername = await prisma.user.findUnique({ where: { username: newUsername } });
        if (existingUsername) {
          return reply.status(400).send({ 
            statusCode: 400, 
            error: "Username already taken. Please provide a different username." 
          });
        }
        
        // Create new user
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            username: newUsername,
          },
        });
        
        // Auto-login after registration
        const token = app.jwt.sign({ 
          id: newUser.id, 
          email: newUser.email, 
          username: newUser.username, 
          avatar: newUser.avatar 
        }, { expiresIn: '15m' });
        
        const refreshToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await prisma.refreshToken.create({
          data: {
            token: refreshToken,
            userId: newUser.id,
            expiresAt,
            userAgent: request.headers['user-agent'],
            ipAddress: request.ip,
          }
        });
        
        reply.setCookie("refreshToken", refreshToken, {
          path: "/",
          httpOnly: false,
          secure: false,
          sameSite: "lax",
          maxAge: 7 * 24 * 3600
        });
        
        return reply.status(201).send({
          statusCode: 201,
          message: "Account created and login successful",
          token,
          user: { id: newUser.id, email: newUser.email, username: newUser.username },
          action: "register"
        });
      }
      
    } catch (err) {
      console.error("Authentication error:", err);
      return reply.status(500).send({ 
        statusCode: 500, 
        error: "Internal Server Error",
        message: "An error occurred during authentication"
      });
    }
  })
  /* <-- Unified Authentication route --> */
  
  /* <-- Refresh route --> */
  app.post("/refresh", async (request, reply) => {
    const token = request.cookies.refreshToken; /* Hada li kain fl cookie li siftna */

    try {
      if (!token)
        return reply.status(401).send({ error: "No refresh token found" });
  
      const storedToken = await prisma.refreshToken.findUnique({ where: { token } });
      if (!storedToken || storedToken.expiresAt < new Date())
        return reply.status(401).send({ error: "Invalid or expired refresh token" });
  
      const user = await prisma.user.findUnique({ where: { id: storedToken.userId } });
      if (!user)
        return reply.status(401).send({ error: "User not found" });
        
      const newAccessToken = app.jwt.sign({ id: user.id, email: user.email, username: user.username, avatar: user.avatar }, { expiresIn: '15m' });
      /* todo: 4adir rotate refresh token hna blati 4er nchecki wa7ed l3aiba */
      await prisma.refreshToken.delete({ where: { token } });
      const newRefreshToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      await prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: user.id,
          expiresAt,
          userAgent: request.headers['user-agent'],
          ipAddress: request.ip,
        }
      });
          
      reply.setCookie("refreshToken", newRefreshToken, {
        path: "/",
        httpOnly: false,
        secure: false,        // Must be true for cross-origin
        sameSite: "lax",    // Required for cross-origin
        maxAge: 7 * 24 * 3600
      });

      return reply.send({ message: "Token refreshed", token: newAccessToken });
    } catch (err) {
      console.error("❌ Refresh token error:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  })
  /* <-- Refresh route --> */
  
  /* <-- Fetch-token route --> */
  app.post("/fetch-token", async (request, reply) => {
    const token = request.cookies.refreshToken; /* Hada li kain fl cookie li siftna */
    if (!token)
      return reply.status(401).send({ error: "No refresh token found" });
    
    const storedToken = await prisma.refreshToken.findUnique({ where: { token } });
    if (!storedToken || storedToken.expiresAt < new Date())
      return reply.status(401).send({ error: "Invalid or expired refresh token" });
        
    const user = await prisma.user.findUnique({ where: { id: storedToken.userId } });
    if (!user)
      return reply.status(401).send({ error: "User not found" });
      
    const newAccessToken = app.jwt.sign({ id: user.id, email: user.email, username: user.username, avatar: user.avatar }, { expiresIn: '15m' });

    return reply.send({ token: newAccessToken });
  })
  /* <-- Fetch-token route --> */
  
  /* <-- Logout route --> */
  app.post("/logout", async (request, reply) => {
    const token = request.cookies.refreshToken;
    if (token)
      await prisma.refreshToken.deleteMany({ where: { token } });
    
    reply.clearCookie("refreshToken", {
      path: "/",
      httpOnly: false,
      secure: false,        // Must be true for cross-origin
      sameSite: "lax",    // Required for cross-origin
      maxAge: 7 * 24 * 3600
    });
    return reply.send({ message: "Logout successful" });
  })
  /* <-- Logout route --> */
    
  /* <-- Google Callback route --> */
  app.get("/google/callback", async (request, reply) => {
    try {
      const token = await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
      
      const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${token.token.access_token}`
        }
      }).then(res => res.json());
      
      /* Daba ra hna wa9ila fin 4adi darou l2ala3ib dial checks, including each of login and signup */
      let user = await prisma.user.findUnique({ where: { email: userInfo.email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: userInfo.email,
            password: '',
            username: generateRandomUsername(userInfo.given_name)
          }
        });
      }
      
      const jwtToken = app.jwt.sign({ id: user.id, email: user.email, username: user.username, avatar: user.avatar }, { expiresIn: '15m' });
  
      const refreshToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      console.log("🔑 Created refresh token:", refreshToken);
      console.log("⏰ Token expires at:", expiresAt);
      console.log("👤 For user ID:", user.id);
      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt,
          userAgent: request.headers['user-agent'],
          ipAddress: request.ip,
        }
      });
      console.log("✅ Refresh token saved to database");
      reply.setCookie("refreshToken", refreshToken, {
        path: "/",
        httpOnly: false,
        secure: false,        // Must be true for cross-origin
        sameSite: "lax",    // Required for cross-origin
        maxAge: 7 * 24 * 3600
      })
      
      return reply.redirect('http://localhost:8080');
    } catch (err) {
      console.error("❌ Google auth error:", err);
      // Redirect to frontend with error parameter
      return reply.redirect('http://localhost:8080?google_error=true');
    }
  })
  /* <-- Google Callback route --> */
  
  /* <-- Validate route --> */
  app.get("/validate", async (request, reply) => {
    try {
      const authHeader = request.headers['authorization'];
      if (!authHeader)
        return reply.status(401).send({ valid: false, message: 'No token provided' });
      
      const token = authHeader.split(' ')[1];
      if (!token)
        return reply.status(401).send({ valid: false, message: 'Malformed token' });
        
      const payload = app.jwt.verify(token);
      return reply.send({ valid: true, user: payload });
      
    } catch (err) {
        return reply.status(401).send({ valid: false, message: 'Invalid or expired token' });
      }
  })
  /* <-- Validate route --> */
  
  /* <-- Sessions route !But not now --> */
    /* /sessions route that lists them [ip, userAgent]
    Show to the user:
        "You're logged in from Chrome on MacBook in Morocco"
    Allow "log out from all devices except this one" */
  /* <-- Sessions route !But not now --> */

}

/*
| Method | Route              | Description                           |
| ------ | ------------------ | ------------------------------------- |
| POST   | `/authenticate`    | Unified login/register endpoint       |
| POST   | `/refresh`         | Refresh authentication token          |
| POST   | `/fetch-token`     | Get a new token using refresh token   |
| POST   | `/logout`          | Log out (invalidate refresh token)    |
| GET    | `/google/callback` | Handle Google OAuth response          |
| GET    | `/validate`        | Validate authentication token         |
*/
