import { FastifyInstance } from "fastify";
const bcrypt = require("bcrypt");
import { PrismaClient } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import crypto from "crypto";
import { io } from "../socket/socket";

export default async function remote(app: FastifyInstance) {
  /* <-- Send Remote Match Request --> */
  app.post(
    "/request",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["opponentId"],
          properties: {
            opponentId: { type: "number" },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const user: any = req.user;
      const { opponentId } = req.body as { opponentId: number };

      if (!opponentId || opponentId === user.id)
        return reply.status(400).send({ error: "Invalid opponent Id" });

      try {
        const opponent = await prisma.user.findUnique({
          where: { id: opponentId },
        });
        if (!opponent)
          return reply.status(404).send({ error: "opponentId not found" });

        const existing = await prisma.remoteMatchRequest.findFirst({
          where: {
            requesterId: user.id,
            recipientId: opponentId,
            status: "pending",
          },
        });

        if (existing)
          return reply
            .status(400)
            .send({ error: "Match request already sent" });

        const matchRequest = await prisma.remoteMatchRequest.create({
          data: {
            requesterId: user.id,
            recipientId: opponentId,
            status: "pending",
          },
        });

        return reply.send({ message: "Match request sent", matchRequest });
      } catch (err: any) {
        console.error("❌ Failed to send remote match request:", err.message);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    },
  );
  /* <-- Send Remote Match Request --> */

  /* <-- Accept or Decline Remote Match --> */
  app.post(
    "/respond",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["requestId", "action"],
          properties: {
            requestId: { type: "number" },
            action: { type: "string", enum: ["accept", "decline"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const user: any = req.user;
      const { requestId, action } = req.body as {
        requestId: number;
        action: "accept" | "decline";
      };

      if (!requestId || !action)
        return reply.status(400).send({ error: "Missing requestId or action" });

      try {
        const matchRequest = await prisma.remoteMatchRequest.findUnique({
          where: { id: requestId },
          include: { requester: true, recipient: true },
        });

        if (!matchRequest)
          return reply.status(403).send({ error: "Match request not found" });

        if (matchRequest.recipientId !== user.id)
          return reply
            .status(403)
            .send({ error: "You can only respond to requests sent to you" });

        if (matchRequest.status !== "pending")
          return reply
            .status(400)
            .send({ error: "Request already responded to" });

        const updated = await prisma.remoteMatchRequest.update({
          where: { id: requestId },
          data: { status: action === "accept" ? "accepted" : "declined" },
        });

        // If accepted, create a new game
        let game = null;
        if (action === "accept") {
          game = await prisma.game.create({
            data: {
              player1Id: matchRequest.requesterId,
              player2Id: matchRequest.recipientId,
              score1: 0,
              score2: 0,
              mode: "REMOTE",
            },
            include: { player1: true, player2: true },
          });

          // Notify both players via socket that the match was accepted
          if (io) {
            // Get socket connections for both players
            const sockets = await io.fetchSockets();
            
            // Find and notify the original requester (player1)
            const requesterSocket = sockets.find(s => (s as any).userId === matchRequest.requesterId);
            if (requesterSocket) {
              requesterSocket.emit('match_request_accepted', {
                gameId: game.id,
                opponentName: game.player2.username,
                message: 'Your match request was accepted!'
              });
            }

            // Find and notify the accepter (player2) - they already know but we send confirmation
            const accepterSocket = sockets.find(s => (s as any).userId === matchRequest.recipientId);
            if (accepterSocket) {
              accepterSocket.emit('match_request_accepted', {
                gameId: game.id,
                opponentName: game.player1.username,
                message: 'Match request accepted! Game created.'
              });
            }

            console.log(`🎮 Match accepted: Game ${game.id} created between ${game.player1.username} and ${game.player2.username}`);
          }
        }

        return reply.send({
          message: `Match request ${action}ed`,
          matchRequest: updated,
          game: game,
        });
      } catch (err) {
        console.error("❌ Failed to respond to match request:", err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    },
  );
  /* <-- Accept or Decline Remote Match --> */

  /* <-- Submit Game Score --> */
  app.post(
    "/:id/submit",
    {
      preHandler: [app.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", pattern: "^[0-9]+$" }, // Ensures numeric string
          },
        },
        body: {
          type: "object",
          required: ["score1", "score2"],
          properties: {
            score1: { type: "number", minimum: 0 },
            score2: { type: "number", minimum: 0 },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const user: any = req.user;
      const { id } = req.params as { id: string };
      const gameId = parseInt(id);
      const { score1, score2 } = req.body as { score1: number; score2: number };

      if (isNaN(gameId))
        return reply.status(400).send({ error: "Invalid game ID" });

      try {
        const game = await prisma.game.findUnique({
          where: { id: gameId },
          include: { player1: true, player2: true },
        });

        if (!game) return reply.status(404).send({ error: "Game not found" });

        // Check if user is a participant in this game
        if (game.player1Id !== user.id && game.player2Id !== user.id)
          return reply
            .status(403)
            .send({ error: "You are not a participant in this game" });

        // Check if game is already completed (has scores)
        if (game.score1 !== 0 || game.score2 !== 0)
          return reply
            .status(400)
            .send({ error: "Game scores already submitted" });

        // Determine winner
        let winnerId: number | null = null;
        if (score1 > score2) winnerId = game.player1Id;
        else if (score2 > score1) winnerId = game.player2Id;
        // If scores are equal, winnerId remains null (tie)

        const updatedGame = await prisma.game.update({
          where: { id: gameId },
          data: { score1, score2, winnerId },
          include: { player1: true, player2: true, winner: true },
        });

        return reply.send({
          message: "Game score submitted successfully",
          game: updatedGame,
        });
      } catch (err) {
        console.error("❌ Failed to submit game score:", err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    },
  );
  /* <-- Submit Game Score --> */

  /* <-- List of all remote matches the user has played. --> */
  app.get(
    "/",
    {
      preHandler: [app.authenticate],
      schema: {
        querystring: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["pending", "accepted", "declined"],
            },
            limit: { type: "number", minimum: 1, maximum: 100, default: 20 },
            offset: { type: "number", minimum: 0, default: 0 },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const user: any = req.user;
      const {
        status,
        limit = 20,
        offset = 0,
      } = req.query as {
        status?: string;
        limit?: number;
        offset?: number;
      };

      try {
        const whereCondition: any = {
          OR: [{ requesterId: user.id }, { recipientId: user.id }],
        };

        if (status) whereCondition.status = status;

        const [matchRequests, total] = await prisma.$transaction([
          prisma.remoteMatchRequest.findMany({
            where: whereCondition,
            include: {
              requester: { select: { id: true, username: true, avatar: true } },
              recipient: { select: { id: true, username: true, avatar: true } },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: offset,
          }),
          prisma.remoteMatchRequest.count({
            where: whereCondition,
          }),
        ]);

        return reply.send({
          matchRequests,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        });
      } catch (err) {
        console.error("❌ Failed to fetch remote match requests:", err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    },
  );
  /* <-- List of all remote matches the user has played. --> */
}

/*
| Method | Route                    | Description                                        |
|--------|--------------------------|----------------------------------------------------|
| POST   | /remote/request          | Send remote match request to another user          |
| POST   | /remote/respond          | Accept or decline a match request                  |
| POST   | /remote/:id/submit       | Submit score result for a remote game              |
| GET    | /remote                  | List all remote match requests (sent/received)     |
*/
