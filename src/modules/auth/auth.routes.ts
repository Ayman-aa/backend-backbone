import { FastifyInstance } from "fastify";
const bcrypt = require("bcrypt");
import { generateRandomUsername, checkLoginAttempts, recordFailedLogin, clearLoginAttempts, prisma } from '../../utils/prisma';
import { PrismaClient } from "@prisma/client";

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
     preHandler: [app.rateLimit({ max: 5, timeWindow: '5 minute' })],
     schema: {
       body: {
         type: 'object',
         required: ['email', 'password'],
         properties: {
           email: { type: 'string', format: 'email', maxLength: 254, pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' },
           password: { type: 'string', minLength: 8, maxLength: 128 },
           username: { type: 'string', minLength: 3, maxLength: 30, pattern: '^[a-zA-Z0-9_-]+$' },
         },
         additionalProperties: false,
       }
     }
    }, async (request, reply) => {
     const { password, username } = request.body as { email: string, password: string, username?: string };
     const email = (request.body as any).email.toLowerCase();
     let logged: boolean;
     let user: any;
     
     try {
       const loginAttempts: any = await checkLoginAttempts(email);
       if (loginAttempts.isLocked) 
         return reply.status(429).send({ statusCode: 429,error: "Account temporarily locked due to too many failed attempts"});
       
       const existingUser = await prisma.user.findUnique({ where: { email } });
       
       if (existingUser) {
         const match = await bcrypt.compare(password, existingUser.password);
         if (!match) {
           await recordFailedLogin(email);
           return reply.status(401).send({ statusCode: 401, error: "Invalid credentials" });
         }
         logged = true;
         user = existingUser;
       } 
       else {
         const newUsername = username || generateRandomUsername(email.split('@')[0]);
         
         const existingUsername = await prisma.user.findUnique({ where: { username: newUsername } });
         if (existingUsername)
           return reply.status(400).send({ statusCode: 400, error: "Username taken. Choose another." });
         
         const hashedPassword = await bcrypt.hash(password, 10);
         const newUser = await prisma.user.create({
           data: { email, password: hashedPassword, username: newUsername },
         });
         logged = false;
         user = newUser;
       }
       await clearLoginAttempts(email);
       
       const token = app.jwt.sign({ id: user.id, email: user.email, username: user.username, avatar: user.avatar }, 
       { expiresIn: '15m' });
       
       const refreshToken = crypto.randomUUID();
       const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
       await prisma.refreshToken.create({
         data: {
           token: refreshToken,
           userId: user.id,
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
         statusCode: logged ? 200 : 201,
         message: logged ? "Login successful" : "Account created successfully",
         token,
         user: { id: user.id, email: user.email, username: user.username },
         action: logged ? "login" : "register"
       });
       
     } catch (err: any) {
       app.log.error('Authentication error:', { email, error: err.message });
       return reply.status(500).send({ statusCode: 500, error: "Authentication service unavailable" });
     }
   })
  /* <-- Unified Authentication route --> */
  
  /* <-- Refresh route --> */
  app.post("/refresh", {
    preHandler: [app.rateLimit({ max: 10, timeWindow: '1 minute' })],
   }, async (request, reply) => {
    const token = request.cookies.refreshToken;
    const userAgent = request.headers['user-agent'];
    const ipAddress = request.ip;
  
    try {
      if (!token) return reply.status(401).send({ error: "No refresh token found" });
  
      const result = await prisma.$transaction(async (tx: PrismaClient) => {
        const storedToken = await tx.refreshToken.findUnique({ 
          where: { token },
          include: { user: true }
        });
  
        if (!storedToken || storedToken.expiresAt < new Date()) {
          if (storedToken) await tx.refreshToken.delete({ where: { token } });  
          throw new Error('Invalid or expired refresh token');
        }
  
        // if (storedToken.userAgent !== userAgent || storedToken.ipAddress !== ipAddress) {
        //   await tx.refreshToken.deleteMany({ where: { userId: storedToken.userId } });
        //   throw new Error('Security violation detected');
        // }
  
        await tx.refreshToken.delete({ where: { token } });
        
        const newRefreshToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        
        await tx.refreshToken.create({
          data: {
            token: newRefreshToken,
            userId: storedToken.userId,
            expiresAt,
            userAgent,
            ipAddress,
          }
        });
  
        return { user: storedToken.user, newRefreshToken };
      });
  
      const newAccessToken = app.jwt.sign({
        id: result.user.id,
        email: result.user.email,
        username: result.user.username,
        avatar: result.user.avatar
      }, { expiresIn: '15m' });
  
      reply.setCookie("refreshToken", result.newRefreshToken, {
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "lax",
        maxAge: 7 * 24 * 3600
      });
  
      return reply.send({ message: "Token refreshed", token: newAccessToken });
    } catch (err: any) {
      app.log.error("Refresh token error:", { error: err.message, userAgent, ipAddress });
      return reply.status(401).send({ error: "Invalid refresh token" });
    }
  });
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
        
      const payload = app.jwt.verify(token)  as { id: string, username: string };
      return reply.send({ valid: true, id: payload.id, username: payload.username });
      
    } catch (err: any) {
        console.warn('Token validation failed:' + err.message);
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
