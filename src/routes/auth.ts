import { FastifyInstance } from "fastify";
const bcrypt = require("bcrypt");
import { prisma } from '../utils/prisma';


export default async function authRoutes(app: FastifyInstance) {
  /* <-- Register route --> */
  app.post("/register", {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'username'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 }, 
          username: { type: 'string', minLength: 3 },
        }
      }
    }
    }, async (request, reply) => {
        const { email, password, username } = request.body as { email: string, password: string, username: string};
        
          try {
            const [existingMail, existingUser] = await Promise.all([
              prisma.user.findUnique({ where: { email } }),
              prisma.user.findUnique({ where: { username } }),
            ]);
            if (existingMail) return reply.status(400).send({ statusCode: 400, error: "Email already registered" });
            if (existingUser)return reply.status(400).send({ statusCode: 400, error: "Username already registered" });
      
            const hashedPassword = await bcrypt.hash(password, 10);
          
            const user = await prisma.user.create({
              data: {
                email,
                password: hashedPassword,
                username,
              },
            });
            
            const token = app.jwt.sign({ id: user.id, email: user.email });
            reply.status(201).send({
              statusCode: 201, 
              message: "User registred successefully",
              token,
              user: { id: user.id, email: user.email, username: user.username } 
            });
          } 
          catch (err) {
            return reply.status(500).send({ statusCode: 500, error: "Registration failed" });
          }
    })
  /* <-- Register route --> */
  
  /* <-- Login route --> */
  app.post("/login", {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: {type: 'string', minLength: 6 },
        }
      }
    }
   }, async (request, reply) => {
    const { email, password } = request.body as {email: string, password: string};
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return reply.status(400).send({ statusCode: 400, error: "Email or password is incorrect" });
    
    const match = await bcrypt.compare(password, user.password);
    if (!match) return reply.status(401).send({ statusCode: 401, error: "Email or password is incorrect" });
    
    const token = app.jwt.sign({ id: user.id, email: user.email }, { expiresIn: '15s' });
    
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    const refreshToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      }
    });
    
    reply.setCookie("refreshToken", refreshToken, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 3600,
    })
    
    return reply.status(202).send({ 
      statusCode: 202,
      message: "Login successful",
      token,
      user: { id: user.id, email: user.email, username: user.username }
      });
    })
  /* <-- Login route --> */
  
  /* <-- Refresh route --> */
  app.post("/refresh", async (request, reply) => {
    const token = request.cookies.refreshToken; /* Hada li kain fl cookie li siftna */
    if (!token)
      return reply.status(401).send({ error: "No refresh token found" });
    
    const storedToken = await prisma.refreshToken.findUnique({ where: { token } });
    if (!storedToken || storedToken.expiresAt < new Date())
      return reply.status(401).send({ error: "Invalid or expired refresh token" });
        
    const user = await prisma.user.findUnique({ where: { id: storedToken.userId } });
    const newAccessToken = app.jwt.sign({ id: user.id, email: user.email, username: user.username }, { expiresIn: '15s' });
    
    /* todo: 4adir rotate refresh token hna blati 4er nchecki wa7ed l3aiba */
    await prisma.refreshToken.delete({ where: { token } });
    const newRefreshToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt,
      }
    });
    reply.setCookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 3600,
    });
  
    return reply.send({ message: "Token refreshed", token: newAccessToken });
    })
  /* <-- Refresh route --> */
  
  /* <-- Logout route --> */
  app.post("/logout", async (request, reply) => {
    const token = request.cookies.refreshToken;
    if (token)
      await prisma.refreshToken.deleteMany({ where: { token } });
    
    reply.clearCookie("refreshToken", {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    return reply.send({ message: "Logout successful" });
   })
  /* <-- Logout route --> */
}
