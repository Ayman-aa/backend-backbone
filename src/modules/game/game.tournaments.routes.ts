import { FastifyInstance } from "fastify";
const bcrypt = require("bcrypt");
import { PrismaClient } from "@prisma/client";
import { prisma } from '../../utils/prisma';

/* 
  Tournament
  ├── Basic Info (name, max players, status)
  ├── Participants (who joined)
  ├── Brackets (the matchups)
  └── Games (actual matches played)
  
  Tournament
  ├── Basic Info (name, max players, status)
  ├── Participants (who joined)
  ├── Brackets (the matchups)
  └── Games (actual matches played)

*/

export default async function tournament(app: FastifyInstance) {
    
    /* <-- CREATE TOURNAMENT --> */
    app.post("/create", {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: 'object', required: ['name', 'players'], 
          properties: { 
            players: { "type": "array", "enum": [4, 8] },
            name: { "type": "string" },
            },
          },
        },
      }, async (req, reply) => {
      const { name, players } = req.body as { name: string, players: string[] };
      const user: any = req.user;
      
      try {
        const tournament = await prisma.tournament.create({
          data: { name, maxPlayers: players.length, ownerId: user.id, status: "IN_PROGRESS" },
        });
        
        const currentMatches = [];
        for (let i = 0; i < players.length; i+=2) {
          const match = await prisma.game.create({
            data: {
              tournamentPlayer1Name: players[i],
              tournamentPlayer2Name: players[i + 1],
              score1: 0,
              score2: 0,
              mode: 'TOURNAMENT',
              tournamentId: tournament.id,
            },
          });
          
          currentMatches.push({
            id: match.id,
            player1: players[i],
            player2: players[i + 1],
            round: 1
          });
        }
        
        return reply.send({ message: "Tournament created successfully!", tournament, currentMatches });
      } catch (err: any) {
          console.error("❌ Failed to create tournament:", err.message);
          return reply.status(500).send({ error: "Failed to create tournament" });
        }
      })
    /* <-- CREATE TOURNAMENT --> */
    
    /* <-- JOIN TOURNAMENT --> */
    // app.post("/join", {
    //   preHandler: [app.authenticate], 
    //   schema: {
    //     body: {
    //       type: 'object',
    //       required: [tou]
    //     }
    //   }
    // })
    /* <-- JOIN TOURNAMENT --> */
}