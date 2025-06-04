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

/*
| Export                          | Description                                      |
|---------------------------------|--------------------------------------------------|
| prisma                          | Initialized Prisma client instance               |
| generateRandomUsername(p?)      | Generates a random username with optional prefix |
*/ 
