import { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from "fastify"; // <-- For type safety
import routesPlugin from '@fastify/routes'; // <-- ADDED: Import @fastify/routes plugin

import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import fastifyMultipart from "@fastify/multipart";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { env } from "./config/env";
import fs from "fs";

import chalk from 'chalk';
import Table from 'cli-table3'; // Import the Table constructor

import jwtPlugin from "./plugins/jwt";
import oauth2Plugin from "./plugins/oauth2";

import userRoutes from "./modules/users/profile.routes";
import usersRoutes from "./modules/users/users.routes";
import authRoutes from "./modules/auth/auth.routes";
import auth2faRoutes from "./modules/auth/auth.2fa.routes";
import friendsRoutes from "./modules/friends/friends.routes";
import chatRoutes from "./modules/chats/chats.routes";
import local_1v1 from "./modules/game/game.local-1v1.routes";
import remote from "./modules/game/game.remote-1v1.routes";
import tournamentRoutes from "./modules/game/game.tournaments.routes"

import { fastifyStatic } from "@fastify/static";
import path from "path";

import { Server } from "http";
import { setupSocketIO } from "./modules/socket/socket";

const app = Fastify();

app.register(routesPlugin);

app.register(require("@fastify/cors"), {
  origin: true,  // Allows all origins
  credentials: true,
  methods: ["GET", "POST", "PATCH", "OPTIONS", "PUT", "DELETE"],
});


app.register(fastifyStatic, {
  root: path.join(__dirname, "../uploads"),
  prefix: "/uploads",
  setHeaders: (res) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
  },
});

app.register(rateLimit, {
  max: 200,
  timeWindow: "1 minute",
  addHeaders: {
    "x-ratelimit-limit": true,
    "x-ratelimit-remaining": true,
    "x-ratelimit-reset": true,
  },
  allowList: ["127.0.0.1", "localhost"],
});

app.register(helmet);

app.register(fastifyMultipart);
app.register(cookie, { secret: env.COOKIE_SECRET });
app.register(jwtPlugin);
app.register(oauth2Plugin);

// Register routes
app.register(userRoutes, { prefix: "/profile" });
app.register(usersRoutes, { prefix: "/users" });
app.register(authRoutes,  { prefix: "/auth" });
app.register(auth2faRoutes,  { prefix: "/auth" });
app.register(friendsRoutes, { prefix: "/friends" });
app.register(chatRoutes, { prefix: "/chats" });
app.register(local_1v1, { prefix: "/game" });
app.register(remote, { prefix: "/game/remote" });
app.register(tournamentRoutes, { prefix: "/game/tournaments" });


const start = async () => {
  try {
    await app.ready();

    const httpsServer: Server = app.server;
    setupSocketIO(httpsServer);
  
    printRoutesTable(app);
    
    await app.listen({
      port: 3000,
      host: "0.0.0.0", // Bih kaywliw les connexions de l'extérieur possible.
    });
    
    const url = "http://localhost:3000";
    const status = chalk.green.bold("✅ ONLINE");
    const message = `Server is up and listening on: ${chalk.cyan.underline(url)}`;
    
    console.log(chalk.yellow(`
           _ _        _        _
      ___ | | | _   _| | _ __ (_) ___
     / _ \\| | || | | | || '__|| |/ __|
    |  __/| | || |_| | || |   | |\\__ \\
     \\___||_|_| \\__,_|_||_|   |_||___/
    
    `)); // A simple ASCII art server/network icon
    console.log(chalk.bold(`${status} ${chalk.bgBlack.whiteBright('🌐')}`));
    console.log(chalk.white(message));
    console.log(chalk.gray(`\n${'-'.repeat(message.length + 10)}\n`));
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();



// --- Enhanced Route Display Interfaces ---
interface RouteDisplayData {
  method: string;
  path: string;
  auth: boolean;
  category: string;
}

interface RouteFromRoutesPlugin {
  url: string;
  method: string | string[];
  preHandler?: preHandlerHookHandler | preHandlerHookHandler[];
}

// --- Enhanced Responsive Route Table Function ---
async function printRoutesTable(fastifyApp: FastifyInstance) {
  const routes: RouteDisplayData[] = [];
  const seenRoutes = new Set<string>();

  // Extract and categorize routes
  for (const [_, routeData] of fastifyApp.routes.entries()) {
    const routeArray = Array.isArray(routeData) ? routeData : [routeData];
    
    routeArray.forEach((route: RouteFromRoutesPlugin) => {
      const methods = Array.isArray(route.method) ? route.method : [route.method];
      
      // Debug and better authentication detection
      let isAuthenticated = false;
      if (route.preHandler) {
        if (Array.isArray(route.preHandler)) {
          isAuthenticated = route.preHandler.some((handler: any) => {
            // More comprehensive authentication detection
            if (!handler) return false;
            
            // Check function name
            if (handler.name === 'authenticate') return true;
            
            // Check if it's from app.authenticate
            if (handler.toString) {
              const handlerStr = handler.toString();
              return handlerStr.includes('authenticate') || 
                     handlerStr.includes('jwt') ||
                     handlerStr.includes('token');
            }
            
            return false;
          });
        } else {
          const handler = route.preHandler as any;
          if (handler) {
            if (handler.name === 'authenticate') isAuthenticated = true;
            else if (handler.toString) {
              const handlerStr = handler.toString();
              isAuthenticated = handlerStr.includes('authenticate') || 
                              handlerStr.includes('jwt') ||
                              handlerStr.includes('token');
            }
          }
        }
      }

      methods.forEach(method => {
        const methodUpper = method.toUpperCase();
        
        // Skip HEAD methods and OPTIONS *
        if (methodUpper === 'HEAD' || (methodUpper === 'OPTIONS' && route.url === '*')) return;
        
        const routeKey = `${methodUpper}:${route.url}`;
        if (seenRoutes.has(routeKey)) return;
        seenRoutes.add(routeKey);
        
        routes.push({
          method: methodUpper,
          path: route.url,
          auth: isAuthenticated,
          category: getCategoryFromPath(route.url)
        });
      });
    });
  }

  // Group routes by category
  const groupedRoutes = routes.reduce((acc, route) => {
    if (!acc[route.category]) acc[route.category] = [];
    acc[route.category].push(route);
    return acc;
  }, {} as Record<string, RouteDisplayData[]>);

  // Calculate proper responsive columns
  const terminalWidth = process.stdout.columns || 120;
  const itemWidth = 32; // Fixed width per item
  const minSpacing = 2; // Minimum spacing between items
  const maxColumns = Math.floor((terminalWidth - 6) / (itemWidth + minSpacing));
  const columnsPerRow = Math.min(Math.max(1, maxColumns), 3); // Max 3 columns for readability

  // Display header
  console.log(chalk.bold.cyan('\n🚀 API ROUTES OVERVIEW'));
  console.log(chalk.gray('═'.repeat(60)));

  // Display each category
  Object.entries(groupedRoutes)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([category, categoryRoutes]) => {
      if (categoryRoutes.length === 0) return;
      
      console.log(chalk.bold.yellow(`\n📁 ${category.toUpperCase()}`));
      console.log('');
      
      const sortedRoutes = categoryRoutes.sort((a, b) => a.path.localeCompare(b.path));
      
      // Display routes in proper grid
      for (let i = 0; i < sortedRoutes.length; i += columnsPerRow) {
        const routesInRow = sortedRoutes.slice(i, i + columnsPerRow);
        
        // Format each route in the row
        const formattedRoutes = routesInRow.map(route => {
          const methodColor = getMethodColor(route.method);
          const authStatus = route.auth ? chalk.green('[A]') : chalk.gray('[P]');
          const method = methodColor(route.method.padEnd(4));
          
          // Truncate path properly
          let displayPath = route.path;
          if (displayPath.length > 18) {
            displayPath = displayPath.substring(0, 15) + '...';
          }
          
          return `${method} ${chalk.white(displayPath.padEnd(18))} ${authStatus}`;
        });
        
        // Join with proper spacing
        console.log('  ' + formattedRoutes.join('  '));
      }
      
      console.log(''); // Space after each category
    });

  // Display summary
  const totalRoutes = routes.length;
  const authRoutes = routes.filter(r => r.auth).length;
  const publicRoutes = totalRoutes - authRoutes;
  
  console.log(chalk.gray('═'.repeat(60)));
  console.log(chalk.bold.white(`📊 SUMMARY: ${totalRoutes} routes total`));
  console.log(`   ${chalk.green('[A]uth:')} ${authRoutes} | ${chalk.gray('[P]ublic:')} ${publicRoutes} | ${chalk.cyan(`${columnsPerRow} cols`)}`);
  console.log(chalk.gray('═'.repeat(60)) + '\n');
}

// --- Helper Functions ---
function getCategoryFromPath(path: string): string {
  if (path.startsWith('/auth')) return '🔐 Authentication';
  if (path.startsWith('/profile')) return '👤 Profile';
  if (path.startsWith('/users')) return '👥 Users';
  if (path.startsWith('/friends')) return '🤝 Friends';
  if (path.startsWith('/chats')) return '💬 Messaging';
  if (path.startsWith('/game')) return '🎮 Gaming';
  if (path.startsWith('/uploads')) return '📁 Static Files';
  return '📋 General';
}

function getMethodColor(method: string): (text: string) => string {
  switch (method) {
    case 'GET': return chalk.bold.green;
    case 'POST': return chalk.bold.blue;
    case 'PATCH': return chalk.bold.yellow;
    case 'PUT': return chalk.bold.magenta;
    case 'DELETE': return chalk.bold.red;
    default: return chalk.bold.gray;
  }
}


/*
| Section                     | Description                                                  |
|----------------------------|--------------------------------------------------------------|
| Imports                    | Loads plugins, route modules, env, static path, socket setup |
| Fastify instance           | Creates main Fastify app                                     |
| Middleware registration    | Sets up CORS, static files, multipart, cookies, JWT, OAuth2  |
| Route registration         | Mounts all feature modules with prefixes                     |
| start()                    | Prepares server, sets up Socket.IO, starts listening         |
*/
