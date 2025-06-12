const { PrismaClient } = require('@prisma/client');

export const prisma = new PrismaClient();

export function generateRandomUsername(p?: string): string {
  const prefixes = ['user', 'guest', 'member', 'account'];
  let prefix = '';
  if (p) prefix = p;
  else prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  
  const randomString = Math.random().toString(36).substring(2, 8);
  
  return `${prefix}_${randomString}`
}

export async function checkLoginAttempts(email: string) {
  const attempt = await prisma.loginAttempt.findUnique({ where: { email } });
  
  const now = new Date();
  
  if (!attempt)
    return { isLocked: false };
  
  if (attempt.lockedUntil && attempt.lockedUntil > now)
    return { isLocked: true, until: attempt.lockedUntil };
  
  return { isLocked: false };
}

export async function recordFailedLogin(email: string) {
  const MAX_ATTEMPTS = 5;
  const LOCK_TIME = 10 * 60 * 1000;
  
  const existing = await prisma.loginAttempt.findUnique({ where: { email } });
  
  if (!existing) {
    return await prisma.loginAttempt.create({
      data: { email, attempts: 1 },
    });
  }
  
  const attempts = existing.attempts + 1;
  
  const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_TIME) : null;
  
  return await prisma.loginAttempt.update({
    where: { email },
    data: { attempts, lockedUntil },
  });
}

export async function resetLoginAttempts(email: string) {
  try {
    await prisma.loginAttempt.delete({ where: { email } });
  } catch (err) {
    // user never had a failed login, ignore
  }
}

/*
| Export                          | Description                                      |
|---------------------------------|--------------------------------------------------|
| prisma                          | Initialized Prisma client instance               |
| generateRandomUsername(p?)      | Generates a random username with optional prefix |
*/ 
