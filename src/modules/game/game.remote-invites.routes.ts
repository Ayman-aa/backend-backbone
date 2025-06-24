import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../utils/prisma";
import { gameService } from "../../services/GameService";
import { io } from "../socket/socket";

interface SendInviteRequest {
  Body: {
    recipientId: number;
  };
}

interface RespondInviteRequest {
  Params: {
    inviteId: string;
  };
  Body: {
    action: 'accept' | 'decline';
  };
}

interface GetInvitesRequest {
  Querystring: {
    type?: 'sent' | 'received';
  };
}

interface CancelInviteRequest {
  Params: {
    inviteId: string;
  };
}

export default async function remoteInviteRoutes(app: FastifyInstance) {
  /* <-- Send game invitation --> */
  app.post<SendInviteRequest>(
    "/invite",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          properties: {
            recipientId: { type: "integer", minimum: 1 },
          },
          required: ["recipientId"],
          additionalProperties: false,
        },
      },
    },
    async (request: FastifyRequest<SendInviteRequest>, reply: FastifyReply) => {
      const user: any = request.user;
      const { recipientId } = request.body;

      try {
        // Check if user is trying to invite themselves
        if (user.id === recipientId) {
          return reply.status(400).send({
            error: "Cannot invite yourself to a game",
          });
        }

        // Check if recipient exists
        const recipient = await prisma.user.findUnique({
          where: { id: recipientId },
          select: { id: true, username: true },
        });

        if (!recipient) {
          return reply.status(404).send({
            error: "Recipient not found",
          });
        }

        // Check if there's already a pending invitation between these users
        const existingInvite = await prisma.remoteMatchRequest.findFirst({
          where: {
            OR: [
              {
                requesterId: user.id,
                recipientId: recipientId,
                status: "pending",
              },
              {
                requesterId: recipientId,
                recipientId: user.id,
                status: "pending",
              },
            ],
          },
        });

        if (existingInvite) {
          return reply.status(409).send({
            error: "There is already a pending invitation between you and this user",
          });
        }

        // Check if either user is already in a game
        const requesterInGame = gameService.isPlayerInGame(user.id);
        const recipientInGame = gameService.isPlayerInGame(recipientId);

        if (requesterInGame) {
          return reply.status(400).send({
            error: "You are already in a game",
          });
        }

        if (recipientInGame) {
          return reply.status(400).send({
            error: "The recipient is already in a game",
          });
        }

        // Create the invitation
        const invitation = await prisma.remoteMatchRequest.create({
          data: {
            requesterId: user.id,
            recipientId: recipientId,
            status: "pending",
          },
          include: {
            requester: {
              select: { id: true, username: true, avatar: true },
            },
            recipient: {
              select: { id: true, username: true, avatar: true },
            },
          },
        });

        // Send real-time notification to recipient
        if (io) {
          io.to(`user_${recipientId}`).emit("game:invite_received", {
            inviteId: invitation.id,
            from: {
              id: user.id,
              username: user.username,
            },
            message: `${user.username} invited you to play Pong!`,
          });
        }

        return reply.send({
          message: "Game invitation sent successfully",
          invitation: {
            id: invitation.id,
            recipient: invitation.recipient,
            status: invitation.status,
            createdAt: invitation.createdAt,
          },
        });
      } catch (error) {
        console.error("❌ Failed to send game invitation:", error);
        return reply.status(500).send({
          error: "Failed to send game invitation",
          details: (error as Error).message,
        });
      }
    },
  );

  /* <-- Respond to game invitation --> */
  app.post<RespondInviteRequest>(
    "/invite/:inviteId/respond",
    {
      preHandler: [app.authenticate],
      schema: {
        params: {
          type: "object",
          properties: {
            inviteId: { type: "string", pattern: "^[0-9]+$" },
          },
          required: ["inviteId"],
        },
        body: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["accept", "decline"] },
          },
          required: ["action"],
          additionalProperties: false,
        },
      },
    },
    async (request: FastifyRequest<RespondInviteRequest>, reply: FastifyReply) => {
      const user: any = request.user;
      const { inviteId } = request.params;
      const { action } = request.body;

      try {
        // Find the invitation
        const invitation = await prisma.remoteMatchRequest.findUnique({
          where: { id: parseInt(inviteId) },
          include: {
            requester: {
              select: { id: true, username: true, avatar: true },
            },
            recipient: {
              select: { id: true, username: true, avatar: true },
            },
          },
        });

        if (!invitation) {
          return reply.status(404).send({
            error: "Invitation not found",
          });
        }

        // Check if user is the recipient
        if (invitation.recipientId !== user.id) {
          return reply.status(403).send({
            error: "You are not authorized to respond to this invitation",
          });
        }

        // Check if invitation is still pending
        if (invitation.status !== "pending") {
          return reply.status(400).send({
            error: `Invitation has already been ${invitation.status}`,
          });
        }

        if (action === "decline") {
          // Update invitation status
          await prisma.remoteMatchRequest.update({
            where: { id: parseInt(inviteId) },
            data: { status: "declined" },
          });

          // Notify requester
          if (io) {
            io.to(`user_${invitation.requesterId}`).emit("game:invite_declined", {
              inviteId: invitation.id,
              by: {
                id: user.id,
                username: user.username,
              },
              message: `${user.username} declined your game invitation`,
            });
          }

          return reply.send({
            message: "Game invitation declined",
            status: "declined",
          });
        }

        // Handle acceptance
        if (action === "accept") {
          // Check if either user is now in a game (double-check)
          const requesterInGame = gameService.isPlayerInGame(invitation.requesterId);
          const recipientInGame = gameService.isPlayerInGame(user.id);

          if (requesterInGame) {
            // Update invitation status to expired
            await prisma.remoteMatchRequest.update({
              where: { id: parseInt(inviteId) },
              data: { status: "expired" },
            });

            return reply.status(400).send({
              error: "The requester is already in a game. Invitation expired.",
            });
          }

          if (recipientInGame) {
            return reply.status(400).send({
              error: "You are already in a game",
            });
          }

          // Create a new game
          const gameId = await gameService.createGame(invitation.requesterId);
          
          // Join the recipient to the game
          await gameService.joinGame(gameId, user.id);

          // Update invitation status
          await prisma.remoteMatchRequest.update({
            where: { id: parseInt(inviteId) },
            data: { 
              status: "accepted",
              gameId: gameId,
            },
          });

          // Get the game state
          const gameState = gameService.getGameState(gameId);

          // Notify both players
          if (io) {
            // Notify requester
            io.to(`user_${invitation.requesterId}`).emit("game:invite_accepted", {
              inviteId: invitation.id,
              gameId: gameId,
              by: {
                id: user.id,
                username: user.username,
              },
              message: `${user.username} accepted your game invitation!`,
              gameState,
            });

            // Notify recipient (current user)
            io.to(`user_${user.id}`).emit("game:invite_accepted", {
              inviteId: invitation.id,
              gameId: gameId,
              by: {
                id: invitation.requesterId,
                username: invitation.requester.username,
              },
              message: `Game created! You're now playing against ${invitation.requester.username}`,
              gameState,
            });
          }

          return reply.send({
            message: "Game invitation accepted",
            status: "accepted",
            gameId: gameId,
            gameState,
            opponent: invitation.requester,
          });
        }
      } catch (error) {
        console.error("❌ Failed to respond to game invitation:", error);
        return reply.status(500).send({
          error: "Failed to respond to game invitation",
          details: (error as Error).message,
        });
      }
    },
  );

  /* <-- Get game invitations --> */
  app.get<GetInvitesRequest>(
    "/invites",
    {
      preHandler: [app.authenticate],
      schema: {
        querystring: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["sent", "received"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request: FastifyRequest<GetInvitesRequest>, reply: FastifyReply) => {
      const user: any = request.user;
      const { type } = request.query;

      try {
        let whereClause: any = {};

        if (type === "sent") {
          whereClause.requesterId = user.id;
        } else if (type === "received") {
          whereClause.recipientId = user.id;
        } else {
          // Get both sent and received
          whereClause = {
            OR: [
              { requesterId: user.id },
              { recipientId: user.id },
            ],
          };
        }

        const invitations = await prisma.remoteMatchRequest.findMany({
          where: whereClause,
          include: {
            requester: {
              select: { id: true, username: true, avatar: true },
            },
            recipient: {
              select: { id: true, username: true, avatar: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 50, // Limit to recent 50 invitations
        });

        return reply.send({
          invitations: invitations.map((invite: any) => ({
            id: invite.id,
            requester: invite.requester,
            recipient: invite.recipient,
            status: invite.status,
            gameId: invite.gameId,
            createdAt: invite.createdAt,
            type: invite.requesterId === user.id ? "sent" : "received",
          })),
          count: invitations.length,
        });
      } catch (error) {
        console.error("❌ Failed to get game invitations:", error);
        return reply.status(500).send({
          error: "Failed to get game invitations",
          details: (error as Error).message,
        });
      }
    },
  );

  /* <-- Cancel game invitation --> */
  app.delete<CancelInviteRequest>(
    "/invite/:inviteId",
    {
      preHandler: [app.authenticate],
      schema: {
        params: {
          type: "object",
          properties: {
            inviteId: { type: "string", pattern: "^[0-9]+$" },
          },
          required: ["inviteId"],
        },
      },
    },
    async (request: FastifyRequest<CancelInviteRequest>, reply: FastifyReply) => {
      const user: any = request.user;
      const { inviteId } = request.params;

      try {
        // Find the invitation
        const invitation = await prisma.remoteMatchRequest.findUnique({
          where: { id: parseInt(inviteId) },
          include: {
            recipient: {
              select: { id: true, username: true },
            },
          },
        });

        if (!invitation) {
          return reply.status(404).send({
            error: "Invitation not found",
          });
        }

        // Check if user is the requester
        if (invitation.requesterId !== user.id) {
          return reply.status(403).send({
            error: "You can only cancel invitations you sent",
          });
        }

        // Check if invitation is still pending
        if (invitation.status !== "pending") {
          return reply.status(400).send({
            error: `Cannot cancel invitation that has been ${invitation.status}`,
          });
        }

        // Update invitation status
        await prisma.remoteMatchRequest.update({
          where: { id: parseInt(inviteId) },
          data: { status: "cancelled" },
        });

        // Notify recipient
        if (io) {
          io.to(`user_${invitation.recipientId}`).emit("game:invite_cancelled", {
            inviteId: invitation.id,
            by: {
              id: user.id,
              username: user.username,
            },
            message: `${user.username} cancelled their game invitation`,
          });
        }

        return reply.send({
          message: "Game invitation cancelled",
          status: "cancelled",
        });
      } catch (error) {
        console.error("❌ Failed to cancel game invitation:", error);
        return reply.status(500).send({
          error: "Failed to cancel game invitation",
          details: (error as Error).message,
        });
      }
    },
  );
}