import { FastifyInstance } from "fastify";
const bcrypt = require("bcrypt");
import { PrismaClient } from "@prisma/client";
import { prisma } from '../../utils/prisma';


export default async function local_1v1(app: FastifyInstance) {
  /* <-- Local 1vs1 route --> */
  app.post("/local", { preHandler: [app.authenticate], 
    schema: {
      body: {
        type: 'object',
        required: ['score1', 'score2', 'player2Name',],
        properties: {
          score1: { type: 'integer' },
          score2: { type: 'integer' },
          player2Name: { type: 'string' }
        },
      },
      additionalProperties: false,
    } 
   }, async (req, reply) => {
    const user: any = req.user;
    const { score1, score2, player2Name } = req.body as { score1: number, score2: number, player2Name: string };
    
    try {
      const winnerId = score1 === score2 ? null : (score1 > score2 ? user.id : null); /* Hadi 4er f local since the user is unknown "gest" */
      
      const game = await prisma.game.create({
        data: { player1Id: user.id, player2Name, score1, score2, winnerId, mode: 'LOCAL' },
      });
      
      return reply.send({ message: "Local game saved", game });
      } catch (err) {
          console.error("❌ Failed to save local game:", err);
          return reply.status(500).send({ error: "Internal Server Error" });
      }
  })
  /* <-- Local 1vs1 route --> */
  
  /* <-- Get game results route --> */
  app.get("/local", { preHandler: [app.authenticate] }, async (req, reply) => {
    const user: any = req.user;
  
    try {
      const games = await prisma.game.findMany({
        where: {
          player1Id: user.id,
          mode: 'LOCAL'
        },
        orderBy: { createdAt: "desc" }
      });
  
      return reply.send({ games });
    } catch (err) {
      console.error("❌ Failed to fetch local games:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });
  /* <-- Get game results route --> */

}