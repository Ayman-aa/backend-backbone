import { FastifyInstance } from "fastify";
const bcrypt = require("bcrypt");
import { generateRandomUsername, prisma } from '../utils/prisma';

export default async function authRoutes(app: FastifyInstance) {
  
  /* <-- / route --> */
  app.get("/", async (request, reply) => {
    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>NeogEO2077</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: #121212;
              color: #e0e0e0;
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              text-align: center;
            }
      
            h1 {
              font-size: 3.5rem;
              color: #00E676;
              margin-bottom: 40px;
              font-weight: 700;
            }
      
            a {
              text-decoration: none;
              font-size: 1.2rem;
              color: #121212;
              background-color: #00E676;
              padding: 14px 30px;
              border-radius: 50px;
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
              font-weight: 500;
              letter-spacing: 0.5px;
              transition: all 0.2s ease-in-out;
            }
      
            a:hover {
              background-color: #03DAC6;
              transform: translateY(-4px);
              box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
            }
      
            a:active {
              background-color: #00C853;
              transform: translateY(2px);
              box-shadow: none;
            }
          </style>
        </head>
        <body>
          <h1>NeoGeo2077n  ...    .</h1>
          <a href="/auth/google">Login with Google</a>
        </body>
      </html>
    `);
  });
  /* <-- / route --> *
  
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
    
  /* <-- Google Callback route --> */
  app.get("/google/callback", async (request, reply) => {
    const token = await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
    
    const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${token.token.access_token}`
      }
    }).then(res => res.json());
    
    /* Daba ra hna wa9ila fin 4adi darou l2ala3ib dial checks, including each of login and signup */
    const user = await prisma.user.findUnique({ where: { email: userInfo.email } });
    if (!user) {
      const user = await prisma.user.create({
        data: {
          email: userInfo.email,
          password: '',
          username: generateRandomUsername(userInfo.given_name)
        }
      });
    }
    
    const jwtToken = app.jwt.sign({ id: user.id, email: user.email }, { expiresIn: '15m' });
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
      token: jwtToken,
      user: { id: user.id, email: user.email, username: user.username }
      });
  })
  /* <-- Google Callback route --> */
  
  app.get("/user", async (request, reply) => {
    const token = request.cookies['refreshToken'];
    if (!token)
      return reply.status(401).send({ error: "Token is required" });
    
    const response = await fetch('http://localhost:3000/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    console.log(data);
  });
}
