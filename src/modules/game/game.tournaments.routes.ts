import { FastifyInstance } from "fastify";
const bcrypt = require("bcrypt");
import { PrismaClient } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import { boolean } from "zod";

/*
  4-Player Tournament Bracket & Route Flow

   [Alice] ──────┐
                 │
                 │   Match 1 (Round 1)
   [Bob]   ──────┘   ────────────────┐
                                     │
                                     │
                                     │
   [Carol] ─────┐                    │
                │                    │
                │   Match 2 (Round 1)│
   [Dave]  ─────┘   ────────────────┘
                                     │
                                     │
                        Final Match (Round 2)
                        ──────────────────────
                        │                   │
                        │                   │
                     Champion           (Winner of Final)

-----------------------------------------------------------
ROUTE FLOW:

1. POST /tournaments/create
   - Creates tournament and both round 1 matches.
   - Returns: tournament info + round 1 matches.

2. POST /tournaments/submit-score
   - Called after each match is played.
   - When both round 1 matches are finished,
     backend creates the final match.

3. POST /tournaments/submit-score (for final)
   - Called after final match is played.
   - Backend declares champion and marks tournament as completed.

4. GET /tournaments/:id/bracket (optional)
   - Returns all matches and their status for bracket display.
-----------------------------------------------------------
*/

export default async function tournament(app: FastifyInstance) {
  /* <-- CREATE TOURNAMENT --> */
  app.post(
    "/create",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["name", "players"],
          properties: {
            players: {
              type: "array",
              items: { type: "string" },
              minItems: 4,
              maxItems: 8,
            },
            name: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { name, players } = req.body as { name: string; players: string[] };
      const user: any = req.user;

      try {
        const tournament = await prisma.tournament.create({
          data: {
            name,
            maxPlayers: players.length,
            ownerId: user.id,
            status: "IN_PROGRESS",
          },
        });

        const currentMatches = [];
        for (let i = 0; i < players.length; i += 2) {
          const match = await prisma.game.create({
            data: {
              tournamentPlayer1Name: players[i],
              tournamentPlayer2Name: players[i + 1],
              score1: 0,
              score2: 0,
              mode: "TOURNAMENT",
              tournamentId: tournament.id,
              round: 1,
            },
          });

          currentMatches.push({
            id: match.id,
            player1: players[i],
            player2: players[i + 1],
            round: 1,
          });
        }

        return reply.send({
          message: "Tournament created successfully!",
          tournament,
          currentMatches,
        });
      } catch (err: any) {
        console.error("❌ Failed to create tournament:", err.message);
        return reply.status(500).send({ error: "Failed to create tournament" });
      }
    },
  );
  /* <-- CREATE TOURNAMENT --> */

  /* <-- SUBMIT TOURNAMENT SCORE --> */
  app.post(
    "/submit-score",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["matchId", "score1", "score2"],
          properties: {
            matchId: { type: "integer" },
            score1: { type: "integer" },
            score2: { type: "integer" },
          },
        },
      },
    },
    async (req, reply) => {
      const { matchId, score1, score2 } = req.body as {
        matchId: number;
        score1: number;
        score2: number;
      };
      const user: any = req.user;

      try {
        const match = await prisma.game.update({
          where: { id: matchId },
          data: { score1, score2 },
        });

        const tournamentId = match.tournamentId;
        const round = match.round;

        const roundMatches: any[] = await prisma.game.findMany({
          where: { tournamentId, round },
        });

        const allFinished = roundMatches.every(
          (m) => m.score1 !== 0 || m.score2 !== 0,
        );
        if (!allFinished)
          return reply.send({
            messge: "Score submitted! Waiting for other matches.",
          });

        const winners = roundMatches
          .map((m) => {
            if (m.score1 > m.score2) return m.tournamentPlayer1Name;
            if (m.score2 > m.score1) return m.tournamentPlayer2Name;
            return null; // handle ties if needed
          })
          .filter(boolean);

        if (winners.length === 1) {
          await prisma.tournament.update({
            where: { id: tournamentId },
            data: { status: "COMPLETED" },
          });
          return reply.send({
            message: "Tournament complete!",
            champion: winners[0],
          });
        }

        const nextRound = round + 1;
        const nextMatches = [];
        for (let i = 0; i < winners.length; i += 2) {
          const newMatch = await prisma.game.create({
            data: {
              tournamentPlayer1Name: winners[i],
              tournamentPlayer2Name: winners[i + 1],
              score1: 0,
              score2: 0,
              mode: "TOURNAMENT",
              tournamentId,
              round: nextRound,
            },
          });
          nextMatches.push({
            id: newMatch.id,
            player1: winners[i],
            player2: winners[i + 1],
            round: nextRound,
          });
        }

        return reply.send({ message: "Next round created!", nextMatches });
      } catch (err: any) {
        console.error("❌ Failed to submit score:", err.message);
        return reply.status(500).send({ error: "Failed to submit score" });
      }
    },
  );
  /* <-- SUBMIT TOURNAMENT SCORE --> */

  /* <--  HISTORY STATS --> */
  app.get(
    "/history",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const user: any = req.user;
      const username = user.username;

      try {
        // Get all tournaments where user played
        const tournaments = await prisma.tournament.findMany({
          where: {
            games: {
              some: {
                OR: [
                  { tournamentPlayer1Name: username },
                  { tournamentPlayer2Name: username },
                ],
              },
            },
          },
          include: { games: true },
          orderBy: { createdAt: "desc" },
        });

        // Calculate stats
        const totalTournaments = tournaments.length;
        const completedTournaments = tournaments.filter(
          (t: any) => t.status === "COMPLETED",
        ).length;
        const wonTournaments = tournaments.filter((t: any) => {
          // Find final match (highest round) and check if user won
          const finalMatch = t.games.sort(
            (a: any, b: any) => b.round! - a.round!,
          )[0];
          if (!finalMatch) return false;

          const winner =
            finalMatch.score1 > finalMatch.score2
              ? finalMatch.tournamentPlayer1Name
              : finalMatch.tournamentPlayer2Name;
          return winner === username;
        }).length;

        return reply.send({
          username,
          stats: {
            totalTournaments,
            completedTournaments,
            wonTournaments,
            winRate:
              totalTournaments > 0
                ? ((wonTournaments / completedTournaments) * 100).toFixed(1)
                : 0,
          },
          tournaments, // Full tournament data for detailed view
        });
      } catch (err: any) {
        console.error("❌ Failed to get user tournaments:", err.message);
        return reply.status(500).send({ error: "Failed to fetch user data" });
      }
    },
  );
  /* <-- HISTORY STATS --> */
}
