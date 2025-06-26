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
  
  // Types for the dashboard response
  interface GameStats {
    totalGames: number;
    wonGames: number;
    lostGames: number;
    winRate: number;
    totalScore: number;
    averageScore: number;
  }
  
  interface TournamentStats extends GameStats {
    totalTournaments: number;
    completedTournaments: number;
    wonTournaments: number;
    gameWinRate: number;
    tournamentWinRate: number;
  }
  
  interface OverallStats extends GameStats {
    gamesPerMode: {
      local: number;
      remote: number;
      tournament: number;
    };
  }
  
  interface RecentActivity {
    id: number;
    mode: string;
    opponent: string;
    userScore: number;
    opponentScore: number;
    result: 'win' | 'loss';
    createdAt: Date;
    tournamentId?: number | null;
  }
  
  interface DailyStats {
    [date: string]: {
      games: number;
      wins: number;
    };
  }
  
  interface Achievements {
    firstWin: boolean;
    streak: boolean;
    perfectGame: boolean;
    tournament_winner: boolean;
    centurion: boolean;
    champion: boolean;
  }
  
  interface DashboardResponse {
    user: {
      id: number;
      username: string;
      avatar: string | null;
    };
    stats: {
      overall: OverallStats;
      local: GameStats;
      remote: GameStats;
      tournament: TournamentStats;
    };
    recentActivity: RecentActivity[];
    performanceTrend: DailyStats;
    achievements: Achievements;
  }
  
  /* <-- Complete Dashboard Stats Route --> */
  app.get("/dashboard", { preHandler: [app.authenticate] }, async (req, reply) => {
    const user: any = req.user;
    const username: string = user.username;
    const userId: number = user.id;
  
    try {
      // 1. LOCAL GAMES STATS
      const localGames = await prisma.game.findMany({
        where: {
          player1Id: userId,
          mode: 'LOCAL'
        },
        orderBy: { createdAt: "desc" }
      });
  
      const localStats: GameStats = {
        totalGames: localGames.length,
        wonGames: localGames.filter((game: any) => {
          if (game.winnerId === userId) return true;
          if (!game.winnerId && game.score1 > game.score2) return true;
          return false;
        }).length,
        lostGames: localGames.filter((game: any) => {
          if (game.winnerId && game.winnerId !== userId) return true;
          if (!game.winnerId && game.score1 < game.score2) return true;
          return false;
        }).length,
        totalScore: localGames.reduce((sum: number, game: any) => sum + game.score1, 0),
        averageScore: 0,
        winRate: 0
      };
      
      localStats.averageScore = localStats.totalGames > 0 ? 
        Math.round((localStats.totalScore / localStats.totalGames) * 100) / 100 : 0;
      localStats.winRate = localStats.totalGames > 0 ? 
        Math.round((localStats.wonGames / localStats.totalGames) * 100 * 100) / 100 : 0;
  
      // 2. REMOTE GAMES STATS
      const remoteGames = await prisma.game.findMany({
        where: {
          OR: [{ player1Id: userId }, { player2Id: userId }],
          mode: 'REMOTE',
        },
        include: {
          player1: { select: { username: true, avatar: true } },
          player2: { select: { username: true, avatar: true } }
        },
        orderBy: { createdAt: "desc" }
      });
  
      const remoteStats: GameStats = {
        totalGames: remoteGames.length,
        wonGames: remoteGames.filter((game: any) => game.winnerId === userId).length,
        lostGames: remoteGames.filter((game: any) => game.winnerId !== userId && game.winnerId !== null).length,
        totalScore: remoteGames.reduce((sum: number, game: any) => {
          return sum + (game.player1Id === userId ? game.score1 : game.score2);
        }, 0),
        averageScore: 0,
        winRate: 0
      };
      
      remoteStats.averageScore = remoteStats.totalGames > 0 ? 
        Math.round((remoteStats.totalScore / remoteStats.totalGames) * 100) / 100 : 0;
      remoteStats.winRate = remoteStats.totalGames > 0 ? 
        Math.round((remoteStats.wonGames / remoteStats.totalGames) * 100 * 100) / 100 : 0;
  
      // 3. TOURNAMENT STATS
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
        include: { 
          games: {
            orderBy: { round: 'desc' }
          }
        },
        orderBy: { createdAt: "desc" },
      });
  
      const tournamentGames = await prisma.game.findMany({
        where: {
          OR: [
            { tournamentPlayer1Name: username },
            { tournamentPlayer2Name: username },
          ],
          mode: 'TOURNAMENT'
        },
        orderBy: { createdAt: "desc" }
      });
  
      const completedTournaments = tournaments.filter((t: any) => t.status === "COMPLETED");
      const wonTournaments = tournaments.filter((tournament: any) => {
        const finalMatch = tournament.games.sort((a: any, b: any) => (b.round || 0) - (a.round || 0))[0];
        if (!finalMatch) return false;
        
        const winner = finalMatch.score1 > finalMatch.score2
          ? finalMatch.tournamentPlayer1Name
          : finalMatch.tournamentPlayer2Name;
        return winner === username;
      });
  
      const tournamentStats: TournamentStats = {
        totalTournaments: tournaments.length,
        completedTournaments: completedTournaments.length,
        wonTournaments: wonTournaments.length,
        totalGames: tournamentGames.length,
        wonGames: tournamentGames.filter((game: any) => {
          const winner = game.score1 > game.score2 
            ? game.tournamentPlayer1Name 
            : game.tournamentPlayer2Name;
          return winner === username;
        }).length,
        lostGames: 0,
        totalScore: tournamentGames.reduce((sum: number, game: any) => {
          return sum + (game.tournamentPlayer1Name === username ? game.score1 : game.score2);
        }, 0),
        averageScore: 0,
        winRate: 0,
        gameWinRate: 0,
        tournamentWinRate: 0
      };
      
      tournamentStats.lostGames = tournamentStats.totalGames - tournamentStats.wonGames;
      tournamentStats.averageScore = tournamentStats.totalGames > 0 ? 
        Math.round((tournamentStats.totalScore / tournamentStats.totalGames) * 100) / 100 : 0;
      tournamentStats.gameWinRate = tournamentStats.totalGames > 0 ? 
        Math.round((tournamentStats.wonGames / tournamentStats.totalGames) * 100 * 100) / 100 : 0;
      tournamentStats.tournamentWinRate = tournamentStats.completedTournaments > 0 ? 
        Math.round((tournamentStats.wonTournaments / tournamentStats.completedTournaments) * 100 * 100) / 100 : 0;
      tournamentStats.winRate = tournamentStats.gameWinRate; // For consistency with other stats
  
      // 4. OVERALL COMBINED STATS
      const allGames: number = localGames.length + remoteGames.length + tournamentGames.length;
      const allWins: number = localStats.wonGames + remoteStats.wonGames + tournamentStats.wonGames;
      const allLosses: number = localStats.lostGames + remoteStats.lostGames + tournamentStats.lostGames;
      const allScore: number = localStats.totalScore + remoteStats.totalScore + tournamentStats.totalScore;
  
      const overallStats: OverallStats = {
        totalGames: allGames,
        wonGames: allWins,
        lostGames: allLosses,
        winRate: allGames > 0 ? Math.round((allWins / allGames) * 100 * 100) / 100 : 0,
        totalScore: allScore,
        averageScore: allGames > 0 ? Math.round((allScore / allGames) * 100) / 100 : 0,
        gamesPerMode: {
          local: localGames.length,
          remote: remoteGames.length,
          tournament: tournamentGames.length
        }
      };
  
      // 5. RECENT ACTIVITY (last 10 games across all modes)
      const recentLocalGames: RecentActivity[] = localGames.slice(0, 5).map((game: any) => ({
        id: game.id,
        mode: 'LOCAL',
        opponent: game.player2Name || 'Guest',
        userScore: game.score1,
        opponentScore: game.score2,
        result: game.score1 > game.score2 ? 'win' : 'loss',
        createdAt: game.createdAt,
        tournamentId: game.tournamentId
      }));
  
      const recentRemoteGames: RecentActivity[] = remoteGames.slice(0, 5).map((game: any) => ({
        id: game.id,
        mode: 'REMOTE',
        opponent: game.player1Id === userId ? (game.player2?.username || 'Unknown') : (game.player1?.username || 'Unknown'),
        userScore: game.player1Id === userId ? game.score1 : game.score2,
        opponentScore: game.player1Id === userId ? game.score2 : game.score1,
        result: game.winnerId === userId ? 'win' : 'loss',
        createdAt: game.createdAt,
        tournamentId: game.tournamentId
      }));
  
      const recentTournamentGames: RecentActivity[] = tournamentGames.slice(0, 5).map((game: any) => ({
        id: game.id,
        mode: 'TOURNAMENT',
        opponent: game.tournamentPlayer1Name === username ? (game.tournamentPlayer2Name || 'Unknown') : (game.tournamentPlayer1Name || 'Unknown'),
        userScore: game.tournamentPlayer1Name === username ? game.score1 : game.score2,
        opponentScore: game.tournamentPlayer1Name === username ? game.score2 : game.score1,
        result: (game.tournamentPlayer1Name === username ? game.score1 : game.score2) > 
                (game.tournamentPlayer1Name === username ? game.score2 : game.score1) ? 'win' : 'loss',
        createdAt: game.createdAt,
        tournamentId: game.tournamentId
      }));
  
      const recentActivity: RecentActivity[] = [...recentLocalGames, ...recentRemoteGames, ...recentTournamentGames]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);
  
      // 6. PERFORMANCE TRENDS (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
      const recentGamesForTrend = await prisma.game.findMany({
        where: {
          OR: [
            { player1Id: userId },
            { player2Id: userId },
            { tournamentPlayer1Name: username },
            { tournamentPlayer2Name: username }
          ],
          createdAt: {
            gte: thirtyDaysAgo
          }
        },
        orderBy: { createdAt: 'asc' }
      });
  
      // Group games by day for trend analysis
      const dailyStats: DailyStats = {};
      recentGamesForTrend.forEach((game: any) => {
        const date: string = game.createdAt.toISOString().split('T')[0];
        if (!dailyStats[date]) {
          dailyStats[date] = { games: 0, wins: 0 };
        }
        dailyStats[date].games++;
        
        // Determine if user won
        let userWon = false;
        if (game.mode === 'LOCAL' && game.player1Id === userId) {
          userWon = game.score1 > game.score2;
        } else if (game.mode === 'REMOTE') {
          userWon = game.winnerId === userId;
        } else if (game.mode === 'TOURNAMENT') {
          const userScore = game.tournamentPlayer1Name === username ? game.score1 : game.score2;
          const opponentScore = game.tournamentPlayer1Name === username ? game.score2 : game.score1;
          userWon = userScore > opponentScore;
        }
        
        if (userWon) dailyStats[date].wins++;
      });
  
      const achievements: Achievements = {
        firstWin: allWins > 0,
        streak: false, // You can implement streak logic
        perfectGame: false, // You can implement perfect game logic
        tournament_winner: tournamentStats.wonTournaments > 0,
        centurion: allGames >= 100,
        champion: allWins >= 50
      };
  
      const response: DashboardResponse = {
        user: {
          id: userId,
          username: user.username,
          avatar: user.avatar
        },
        stats: {
          overall: overallStats,
          local: localStats,
          remote: remoteStats,
          tournament: tournamentStats
        },
        recentActivity,
        performanceTrend: dailyStats,
        achievements
      };
  
      return reply.send(response);
  
    } catch (err: any) {
      console.error("❌ Failed to fetch dashboard data:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });
  /* <-- Complete Dashboard Stats Route --> */

}