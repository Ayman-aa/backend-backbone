import { FastifyInstance } from "fastify";
import { prisma } from "../../utils/prisma";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { generate2FACode, send2FACode } from "../../utils/2fa";

export default async function auth2faRoutes(app: FastifyInstance) {
  // 2FA Rate Limit Configurations
  const rateLimits = {
    generate2FA: {
      max: 3, // Only 3 generations per window
      timeWindow: "5 minutes", // 5-minute window
      keyGenerator: (req: any) => `2fa-gen:${req.user.id}`, // Per user, not IP
      errorResponseBuilder: () => ({
        error: "Too many 2FA generation requests",
        message: "Please wait 5 minutes before requesting another code",
        statusCode: 429,
      }),
    },

    verify2FA: {
      max: 5, // 5 attempts per window
      timeWindow: "15 minutes", // Longer window for failed attempts
      keyGenerator: (req: any) => `2fa-verify:${req.user.id}`,
      errorResponseBuilder: () => ({
        error: "Too many verification attempts",
        message: "Please wait 15 minutes before trying again",
        statusCode: 429,
      }),
    },

    resend2FA: {
      max: 2, // Very restrictive - only 2 resends
      timeWindow: "2 minutes",
      keyGenerator: (req: any) => `2fa-resend:${req.user.id}`,
      errorResponseBuilder: () => ({
        error: "Too many resend requests",
        message: "Please wait 2 minutes before requesting another code",
        statusCode: 429,
      }),
    },

    enable2FA: {
      max: 5, // Moderate limit for enable/disable
      timeWindow: "1 hour", // Hourly limit
      keyGenerator: (req: any) => `2fa-enable:${req.user.id}`,
      errorResponseBuilder: () => ({
        error: "Too many 2FA toggle attempts",
        message: "Please wait 1 hour before trying again",
        statusCode: 429,
      }),
    },

    disable2FA: {
      max: 3, // More restrictive for disable (security)
      timeWindow: "1 hour", // Hourly limit
      keyGenerator: (req: any) => `2fa-disable:${req.user.id}`,
      errorResponseBuilder: () => ({
        error: "Too many 2FA disable attempts",
        message: "Please wait 1 hour before trying again",
        statusCode: 429,
      }),
    },
  };

  /* <-- Generate 2FA Code --> */
  app.post(
    "/generate-2fa",
    {
      preHandler: [app.rateLimit(rateLimits.generate2FA)],
    },
    async (request, reply) => {
      try {
        const authHeader = request.headers["authorization"];
        if (!authHeader)
          return reply.status(401).send({ error: "No token provided" });

        const token = authHeader.split(" ")[1];
        if (!token) return reply.status(401).send({ error: "Malformed token" });

        // Verify the token (could be temp token or regular token)
        const payload = app.jwt.verify(token) as {
          id: number;
          scope?: string;
        };

        // Check if it's a temp token with 2fa_verify scope
        if (payload.scope && payload.scope !== "2fa_verify") {
          return reply.status(401).send({ error: "Invalid token scope" });
        }

        const code = generate2FACode(); // 6-digit
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

        await prisma.user.update({
          where: { id: payload.id },
          data: {
            twoFACode: code,
            twoFACodeExpiresAt: expiresAt,
          },
        });

        const userRecord = await prisma.user.findUnique({
          where: { id: payload.id },
        });

        if (!userRecord) {
          return reply.status(404).send({ error: "User not found" });
        }

        await send2FACode(userRecord.email, code);

        return reply.send({ message: "2FA code sent to your email" });
      } catch (err) {
        console.error("❌ Failed to generate 2FA code:", err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    },
  );

  /* <-- Verify 2FA Code --> */
  app.post(
    "/verify-2fa",
    {
      preHandler: [app.rateLimit(rateLimits.verify2FA)],
    },
    async (request, reply) => {
      try {
        const authHeader = request.headers["authorization"];
        if (!authHeader)
          return reply.status(401).send({ error: "No token provided" });

        const token = authHeader.split(" ")[1];
        if (!token) return reply.status(401).send({ error: "Malformed token" });

        // Verify the token (could be temp token or regular token)
        const payload = app.jwt.verify(token) as {
          id: number;
          scope?: string;
        };

        // Check if it's a temp token with 2fa_verify scope
        if (payload.scope && payload.scope !== "2fa_verify") {
          return reply.status(401).send({ error: "Invalid token scope" });
        }

        const { code } = request.body as { code: string };

        if (!code) return reply.status(400).send({ error: "Code is required" });

        const dbUser = await prisma.user.findUnique({
          where: { id: payload.id },
        });

        if (!dbUser) {
          return reply.status(404).send({ error: "User not found" });
        }

        const isValid =
          dbUser.twoFACode === code &&
          dbUser.twoFACodeExpiresAt &&
          new Date() < dbUser.twoFACodeExpiresAt;

        if (!isValid)
          return reply
            .status(401)
            .send({ error: "Invalid or expired 2FA code" });

        await prisma.user.update({
          where: { id: payload.id },
          data: { twoFACode: null, twoFACodeExpiresAt: null },
        });

        return reply.send({ message: "2FA verified successfully" });
      } catch (err) {
        console.error("❌ 2FA verification failed:", err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    },
  );

  /* <-- Resend 2FA Code --> */
  app.post(
    "/resend-2fa",
    {
      preHandler: [app.rateLimit(rateLimits.resend2FA)],
    },
    async (request, reply) => {
      try {
        const authHeader = request.headers["authorization"];
        if (!authHeader)
          return reply.status(401).send({ error: "No token provided" });

        const token = authHeader.split(" ")[1];
        if (!token) return reply.status(401).send({ error: "Malformed token" });

        // Verify the token (could be temp token or regular token)
        const payload = app.jwt.verify(token) as {
          id: number;
          scope?: string;
        };

        // Check if it's a temp token with 2fa_verify scope
        if (payload.scope && payload.scope !== "2fa_verify") {
          return reply.status(401).send({ error: "Invalid token scope" });
        }

        const code = generate2FACode();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await prisma.user.update({
          where: { id: payload.id },
          data: {
            twoFACode: code,
            twoFACodeExpiresAt: expiresAt,
          },
        });

        const userRecord = await prisma.user.findUnique({
          where: { id: payload.id },
        });

        if (!userRecord) {
          return reply.status(404).send({ error: "User not found" });
        }

        await send2FACode(userRecord.email, code);

        return reply.send({ message: "2FA code re-sent to your email" });
      } catch (err) {
        console.error("❌ Failed to resend 2FA code:", err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    },
  );

  /* <-- Enable 2FA --> */
  app.post(
    "/enable-2fa",
    {
      preHandler: [app.rateLimit(rateLimits.enable2FA)],
    },
    async (request, reply) => {
      try {
        const authHeader = request.headers["authorization"];
        if (!authHeader)
          return reply.status(401).send({ error: "No token provided" });

        const token = authHeader.split(" ")[1];
        if (!token) return reply.status(401).send({ error: "Malformed token" });

        // Verify the token (could be temp token or regular token)
        const payload = app.jwt.verify(token) as {
          id: number;
          scope?: string;
        };

        // Check if it's a temp token with 2fa_verify scope
        if (payload.scope && payload.scope !== "2fa_verify") {
          return reply.status(401).send({ error: "Invalid token scope" });
        }

        await prisma.user.update({
          where: { id: payload.id },
          data: { isTwoFAEnabled: true },
        });
        return reply.send({ message: "2FA enabled successfully" });
      } catch (err) {
        console.error("❌ Failed to enable 2FA:", err);
        return reply
          .status(500)
          .send({ error: "Internal Server Error: Failed to enable 2FA" });
      }
    },
  );

  /* <-- Disable 2FA --> */
  app.post(
    "/disable-2fa",
    {
      preHandler: [app.rateLimit(rateLimits.disable2FA)],
    },
    async (request, reply) => {
      try {
        const authHeader = request.headers["authorization"];
        if (!authHeader)
          return reply.status(401).send({ error: "No token provided" });

        const token = authHeader.split(" ")[1];
        if (!token) return reply.status(401).send({ error: "Malformed token" });

        // Verify the token (could be temp token or regular token)
        const payload = app.jwt.verify(token) as {
          id: number;
          scope?: string;
        };

        // Check if it's a temp token with 2fa_verify scope
        if (payload.scope && payload.scope !== "2fa_verify") {
          return reply.status(401).send({ error: "Invalid token scope" });
        }

        await prisma.user.update({
          where: { id: payload.id },
          data: {
            isTwoFAEnabled: false,
            twoFACode: null,
            twoFACodeExpiresAt: null,
          },
        });
        return reply.send({ message: "2FA disabled successfully" });
      } catch (err) {
        console.error("❌ Failed to disable 2FA:", err);
        return reply
          .status(500)
          .send({ error: "Internal Server Error: Failed to disable 2FA" });
      }
    },
  );
}
