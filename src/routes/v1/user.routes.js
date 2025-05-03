const { getUsers, getUserById, updateUser, deleteUser } = require('../../controllers/user.controller');

module.exports = async function (fastify, opts) {
  // Get all users (protected, admin only in a real app)
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              email: { type: 'string' },
              name: { type: 'string' }
            }
          }
        }
      }
    }
  }, getUsers);

  // Get user by ID (protected)
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' },
            name: { type: 'string' }
          }
        }
      }
    }
  }, getUserById);

  // Update user (protected)
  fastify.put('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' },
            name: { type: 'string' }
          }
        }
      }
    }
  }, updateUser);

  // Delete user (protected)
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, deleteUser);
};