require('dotenv').config();
const fastify = require('fastify')({
  logger: process.env.NODE_ENV === 'development'
});

// Register plugins
const registerPlugins = async () => {
  await fastify.register(require('@fastify/cors'), {
    origin: true,
    credentials: true
  });
  
  await fastify.register(require('@fastify/cookie'), {
    secret: process.env.COOKIE_SECRET || 'my-secret',
    hook: 'onRequest',
  });

  await fastify.register(require('@fastify/jwt'), {
    secret: process.env.JWT_SECRET || 'supersecret',
    cookie: {
      cookieName: 'token',
      signed: false
    }
  });

  // Swagger documentation
  await fastify.register(require('@fastify/swagger'), {
    routePrefix: '/documentation',
    swagger: {
      info: {
        title: 'Backend Backbone API',
        description: 'API documentation',
        version: '0.1.0'
      },
      externalDocs: {
        url: 'https://swagger.io',
        description: 'Find more info here'
      },
      host: `localhost:${process.env.PORT || 3000}`,
      schemes: ['http'],
      consumes: ['application/json'],
      produces: ['application/json']
    },
    exposeRoute: true
  });
};

// Register routes
const registerRoutes = async () => {
  fastify.register(require('./routes/v1'), { prefix: '/api/v1' });
};

const start = async () => {
  try {
    // Register all plugins
    await registerPlugins();
    
    // Register all routes
    await registerRoutes();

    // Auth decorator
    fastify.decorate('authenticate', async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    });

    // Default route
    fastify.get('/', async (request, reply) => {
      return { message: 'Backend Backbone API' };
    });

    // Start the server
    await fastify.listen({ 
      port: process.env.PORT || 3000,
      host: '0.0.0.0'
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();