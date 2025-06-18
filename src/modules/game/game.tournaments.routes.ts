import { FastifyInstance } from "fastify";
const bcrypt = require("bcrypt");
import { PrismaClient } from "@prisma/client";
import { prisma } from '../../utils/prisma';

/* 
  Tournament
  ├── Basic Info (name, max players, status)
  ├── Participants (who joined)
  ├── Brackets (the matchups)
  └── Games (actual matches played)
  
  Tournament
  ├── Basic Info (name, max players, status)
  ├── Participants (who joined)
  ├── Brackets (the matchups)
  └── Games (actual matches played)

*/


}