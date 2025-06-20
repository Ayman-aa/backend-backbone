import { FastifyInstance } from "fastify";
import {  prisma } from '../../utils/prisma';
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { generate2FACode, send2FACode } from '../../utils/2fa'

export default async function auth2faRoutes(app: FastifyInstance) {
  
  /* <-- Generate 2FA Code --> */
  app.post('/generate-2fa', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user: any = req.user;
  
    const code = generate2FACode(); // 6-digit
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
  
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFACode: code,
          twoFACodeExpiresAt: expiresAt,
        }
      });
  
      await send2FACode(user.email, code);
  
      return reply.send({ message: '2FA code sent to your email' });
    } catch (err) {
      console.error('❌ Failed to generate 2FA code:', err);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
  /* <-- Generate 2FA Code --> */

  /* <-- Verify 2FA Code --> */
  app.post('/verify-2fa', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user: any = req.user;
    const { code } = req.body as { code: string };
  
    if (!code) return reply.status(400).send({ error: 'Code is required' });
  
    try {
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  
      const isValid = dbUser?.twoFACode === code &&
                      dbUser.twoFACodeExpiresAt &&
                      new Date() < dbUser.twoFACodeExpiresAt;
  
      if (!isValid)
        return reply.status(401).send({ error: 'Invalid or expired 2FA code' });
  
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFACode: null, twoFACodeExpiresAt: null }
      });
  
      return reply.send({ message: '2FA verified successfully' });
    } catch (err) {
      console.error('❌ 2FA verification failed:', err);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
  /* <-- Verify 2FA Code --> */
  
  /* <-- Resend 2FA Code --> */
  app.post('/resend-2fa', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user: any = req.user;
  
    const code = generate2FACode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFACode: code,
          twoFACodeExpiresAt: expiresAt,
        }
      });
  
      await send2FACode(user.email, code);
  
      return reply.send({ message: '2FA code re-sent to your email' });
    } catch (err) {
      console.error('❌ Failed to resend 2FA code:', err);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
  /* <-- Resend 2FA Code --> */

  /* <-- Enable 2FA --> */
  app.post('/enable-2fa', { preHandler: [app.authenticate] }, async (req, reply) => {
      const user: any = req.user;
  
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { isTwoFAEnabled: true }
        });
        return reply.send({ message: '2FA enabled successfully' });
      } catch (err) {
        console.error('❌ Failed to enable 2FA:', err);
        return reply.status(500).send({ error: 'Internal Server Error: Failed to enable 2FA' });
      }
  });
  /* <-- Enable 2FA --> */
  
  /* <-- Disable 2FA --> */
  app.post('/disable-2fa', { preHandler: [app.authenticate] }, async (req, reply) => {
      const user: any = req.user;
  
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            isTwoFAEnabled: false,
            twoFACode: null,
            twoFACodeExpiresAt: null
          }
        });
        return reply.send({ message: '2FA disabled successfully' });
      } catch (err) {
        console.error('❌ Failed to disable 2FA:', err);
        return reply.status(500).send({ error: 'Internal Server Error: Failed to disable 2FA' });
      }
  });
  /* <-- Disable 2FA --> */

}