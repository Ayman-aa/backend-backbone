const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');

module.exports = async function (fastify, opts) {
  // Register all route groups
  fastify.register(authRoutes, { prefix: '/auth' });
  fastify.register(userRoutes, { prefix: '/users' });
};