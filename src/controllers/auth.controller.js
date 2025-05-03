const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

// Register a new user
exports.register = async (request, reply) => {
  try {
    const { email, password, name } = request.body;
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return reply.code(409).send({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create new user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword
      }
    });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return reply.code(201).send(userWithoutPassword);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

// Login user
exports.login = async (request, reply) => {
  try {
    const { email, password } = request.body;
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    // Create JWT token
    const token = await reply.jwtSign(
      { id: user.id },
      { expiresIn: '1d' }
    );

    // Set JWT token in cookie
    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax', // Change to 'strict' in production
      secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
      maxAge: 86400 // 1 day in seconds
    });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return reply.send({ user: userWithoutPassword });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

// Logout user
exports.logout = async (request, reply) => {
  // Clear the auth cookie
  reply.clearCookie('token', { path: '/' });
  return reply.send({ message: 'Logged out successfully' });
};

// Get current user
exports.me = async (request, reply) => {
  try {
    const userId = request.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return reply.send(userWithoutPassword);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};