import { FastifyInstance } from "fastify";
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
  
  /* <-- Get local game results + stats route --> */
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
  
      // Calculate local game stats
      const totalGames = games.length;
      const wonGames = games.filter((game: any) => {
        if (game.winnerId === user.id) return true;
        // For local games, if no winnerId but score1 > score2, user wins
        if (!game.winnerId && game.score1 > game.score2) return true;
        return false;
      }).length;
      const lostGames = games.filter((game: any) => {
        // Lost if winnerId is not user.id or score1 < score2
        if (game.winnerId && game.winnerId !== user.id) return true;
        if (!game.winnerId && game.score1 < game.score2) return true;
        return false;
      }).length;
  
      return reply.send({ 
        games,
        stats: {
          totalGames,
          wonGames,
          lostGames,
          winRate: totalGames > 0 ? ((wonGames / totalGames) * 100).toFixed(1) : 0
        }
      });
    } catch (err) {
      console.error("❌ Failed to fetch local games:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });
  /* <-- Get local game results + stats route --> */

}