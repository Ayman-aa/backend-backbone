const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all users
exports.getUsers = async (request, reply) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    return reply.send(users);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

// Get user by ID
exports.getUserById = async (request, reply) => {
  try {
    const { id } = request.params;
    const userId = parseInt(id);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return reply.send(user);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

// Update user
exports.updateUser = async (request, reply) => {
  try {
    const { id } = request.params;
    const userId = parseInt(id);
    const { email, name } = request.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return reply.code(404).send({ error: 'User not found' });
    }

    // Ensure the user can only update their own profile
    // or implement admin check here
    if (request.user.id !== userId) {
      return reply.code(403).send({ error: 'Not authorized to update this user' });
    }

    // If email is being updated, check if new email is already in use
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email }
      });

      if (emailExists) {
        return reply.code(409).send({ error: 'Email already in use' });
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(email ? { email } : {}),
        ...(name ? { name } : {})
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return reply.send(updatedUser);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

// Delete user
exports.deleteUser = async (request, reply) => {
  try {
    const { id } = request.params;
    const userId = parseInt(id);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return reply.code(404).send({ error: 'User not found' });
    }

    // Ensure the user can only delete their own profile
    // or implement admin check here
    if (request.user.id !== userId) {
      return reply.code(403).send({ error: 'Not authorized to delete this user' });
    }

    // Delete user
    await prisma.user.delete({
      where: { id: userId }
    });

    return reply.send({ message: 'User deleted successfully' });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};