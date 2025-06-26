import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { gameService } from "../../services/GameService";

interface CreateGameRequest {
  Body: {
    maxScore?: number;
    paddleSpeed?: number;
    ballSpeed?: number;
  };
}

interface JoinGameRequest {
  Params: {
    gameId: string;
  };
}

interface GameStatsRequest {
  Querystring: {
    limit?: string;
  };
}

export default async function remoteRoutes(app: FastifyInstance) {
  /* <-- Create new remote game --> */
  app.post<CreateGameRequest>(
    "/create",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          properties: {
            maxScore: { type: "integer", minimum: 1, maximum: 21 },
            paddleSpeed: { type: "integer", minimum: 1, maximum: 20 },
            ballSpeed: { type: "integer", minimum: 1, maximum: 15 },
          },
          additionalProperties: true,
        },
      },
    },
    async (request: FastifyRequest<CreateGameRequest>, reply: FastifyReply) => {
      const user: any = request.user;
      const gameConfig = request.body;

      try {
        // Check if player is already in a game
        const existingGame = gameService.isPlayerInGame(user.id);
        if (existingGame) {
          return reply.status(400).send({
            error: "Already in a game",
            gameId: existingGame,
          });
        }

        const gameId = await gameService.createGame(user.id, gameConfig);

        return reply.send({
          message: "Remote game created successfully",
          gameId,
          config: gameConfig,
        });
      } catch (error) {
        console.error("❌ Failed to create remote game:", error);
        return reply.status(500).send({
          error: "Failed to create game",
          details: (error as Error).message,
        });
      }
    },
  );

  /* <-- Join existing remote game --> */
  app.post<JoinGameRequest>(
    "/join/:gameId",
    {
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest<JoinGameRequest>, reply: FastifyReply) => {
      const user: any = request.user;
      const { gameId } = request.params;

      try {
        // Check if player is already in a game
        const existingGame = gameService.isPlayerInGame(user.id);
        if (existingGame) {
          return reply.status(400).send({
            error: "Already in a game",
            gameId: existingGame,
          });
        }

        const success = await gameService.joinGame(gameId, user.id);
        if (!success) {
          return reply.status(400).send({ error: "Failed to join game" });
        }

        const gameState = gameService.getGameState(gameId);

        return reply.send({
          message: "Successfully joined game",
          gameId,
          gameState,
        });
      } catch (error) {
        console.error("❌ Failed to join remote game:", error);
        return reply.status(500).send({
          error: "Failed to join game",
          details: (error as Error).message,
        });
      }
    },
  );

  /* <-- Get game state --> */
  app.get<JoinGameRequest>(
    "/state/:gameId",
    {
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest<JoinGameRequest>, reply: FastifyReply) => {
      const { gameId } = request.params;

      try {
        const gameState = gameService.getGameState(gameId);
        if (!gameState) {
          return reply.status(404).send({ error: "Game not found" });
        }

        return reply.send({ gameState });
      } catch (error) {
        console.error("❌ Failed to get game state:", error);
        return reply.status(500).send({ error: "Failed to get game state" });
      }
    },
  );

  /* <-- Get active games --> */
  app.get(
    "/active",
    {
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const activeGames = gameService.getActiveGames();

        // Filter to show only joinable games (waiting for players)
        const joinableGames = activeGames
          .filter((game) => game.status === "waiting" && !game.player2)
          .map((game) => ({
            id: game.id,
            status: game.status,
            player1: {
              id: game.player1.id,
              username: game.player1.username,
            },
            config: game.config,
          }));

        return reply.send({
          games: joinableGames,
          count: joinableGames.length,
        });
      } catch (error) {
        console.error("❌ Failed to get active games:", error);
        return reply.status(500).send({ error: "Failed to get active games" });
      }
    },
  );

  /* <-- Get player's current game --> */
  app.get(
    "/current",
    {
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user: any = request.user;

      try {
        const gameId = gameService.isPlayerInGame(user.id);
        if (!gameId) {
          return reply.send({ gameId: null, gameState: null });
        }

        const gameState = gameService.getGameState(gameId);
        return reply.send({ gameId, gameState });
      } catch (error) {
        console.error("❌ Failed to get current game:", error);
        return reply.status(500).send({ error: "Failed to get current game" });
      }
    },
  );

  /* <-- Get player stats --> */
  app.get(
    "/stats",
    {
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user: any = request.user;

      try {
        const stats = await gameService.getPlayerStats(user.id);
        return reply.send({ stats });
      } catch (error) {
        console.error("❌ Failed to get player stats:", error);
        return reply.status(500).send({ error: "Failed to get player stats" });
      }
    },
  );

  /* <-- Get game history --> */
  app.get<GameStatsRequest>(
    "/history",
    {
      preHandler: [app.authenticate],
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "string", pattern: "^[0-9]+$" },
          },
          additionalProperties: false,
        },
      },
    },
    async (request: FastifyRequest<GameStatsRequest>, reply: FastifyReply) => {
      const user: any = request.user;
      const limit = request.query.limit ? parseInt(request.query.limit) : 10;

      try {
        const history = await gameService.getGameHistory(user.id, limit);
        return reply.send({
          history,
          count: history.length,
        });
      } catch (error) {
        console.error("❌ Failed to get game history:", error);
        return reply.status(500).send({ error: "Failed to get game history" });
      }
    },
  );

  /* <-- Leave current game --> */
  app.post(
    "/leave",
    {
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user: any = request.user;

      try {
        const gameId = gameService.isPlayerInGame(user.id);
        if (!gameId) {
          return reply.status(400).send({ error: "Not in any game" });
        }

        await gameService.forceEndGame(
          gameId,
          `Player ${user.username} left the game`,
        );

        return reply.send({
          message: "Successfully left the game",
          gameId,
        });
      } catch (error) {
        console.error("❌ Failed to leave game:", error);
        return reply.status(500).send({ error: "Failed to leave game" });
      }
    },
  );
  
  
}
