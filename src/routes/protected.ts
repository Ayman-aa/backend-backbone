import { FastifyInstance } from 'fastify/types/instance'

export default async function protectedRoutes(app: FastifyInstance) {
  
  /* <-- me route --> */
  app.get("/me", { preHandler: [app.authenticate] }, async (req, reply) => {
    return reply.send({
      message: "You are in",
      user: req.user
    });
    });
  /* <-- Google Callback route --> */
  
  /* <-- Dashboard route --> */
  app.get("/dashboard", { preHandler: [app.authenticate] }, async (req, reply) => {
    let user = req.user as any; /* From JWT hadi */ 

    console.log(req.user);
    return reply.type('text/html').send(`
      <html>
        <body>
        <h1>Welcome ${user.email}</h1>
        <p>ID: ${user.id}</p>
        <p>Email: ${user.email}</
        </body>
      </html>
      `)
   })
  /* <-- Dashboard route --> */
}
