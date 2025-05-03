const { register, login, logout, me } = require('../../controllers/auth.controller');

module.exports = async function (fastify, opts) {
  // Register route
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          name: { type: 'string' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' },
            name: { type: 'string' }
          }
        }
      }
    }
  }, register);

  // Login route
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            user: {
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
    }
  }, login);

  // Logout route
  fastify.post('/logout', {}, logout);

  // Get current user route (protected)
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
    schema: {
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
  }, me);
};