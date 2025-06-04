import { FastifyInstance } from 'fastify/types/instance'
import { z } from "zod"
import { prisma } from "../../utils/prisma"
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";



const userSchema = z.object({
  username: z.string().min(3).optional(),
})

export default async function profile(app: FastifyInstance) {
  
  /* <-- me route --> */
  app.get("/me", { preHandler: [app.authenticate] }, async (req, reply) => {
    return reply.send({
      message: "You are in",
      user: req.user
    });
    });
  /* <-- me route --> */
  
  /* <-- :id route --> */
  app.get("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const mainUser: any = req.user;
    const { targetUserId } = req.query as { targetUserId?: string };
    
    if (!targetUserId || isNaN(Number(targetUserId)))
      return reply.status(400).send({ error: "Missing or invalid targetUserId" });
    
    const userId: number = parseInt(targetUserId);
    
    const isBlocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: mainUser.id, blockedId: userId },
          { blockerId: userId, blockedId: mainUser.id },
        ]
      }
    });
    
    if (isBlocked)
      return reply.status(403).send({ error: "Blocked users cannot interact" });
    
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id:true, username:true, avatar:true, email:true },
      });
      
      if (!user)
        return reply.status(404).send({ error: "User not found" });
      
      return reply.send({ user });
    } catch (err) {
        console.error("❌ Error fetching user:", err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
  })
  /* <-- :id route --> */
  
  /* <-- update username route --> */
  app.patch("/username", {preHandler: [app.authenticate] }, async (request, reply) => {
    const user: any = request.user;
    const body = userSchema.safeParse(request.body);
    if (!body.success)
      return reply.status(400).send({ error: "invalide data" });
    
    const newUsername = body.data.username;
    
    try {
      const updateUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          username: newUsername,
        },
      });
      return reply.send({ user: updateUser });
    } catch (err: any) {
      console.log(err.meta); /* 4er bash nshuf wa7ed l9adia */
        if ( err.code === "P2002" && err.meta?.target?.includes("username"))
          return reply.status(409).send({ error: "Username already taken" })
        return reply.status(500).send({ error: "Server error, (Brother is it from here)" })
      }
  })
  /* <-- update username route --> */
  
  /* <-- update avatar route --> */
  app.patch("/avatar", { preHandler: [app.authenticate] }, async (req, reply) => {
    const user: any = req.user;
    const oldAvatar = user.avatar;
    
    const data = await req.file();
    
    if (!data || !data.mimetype.startsWith("image/"))
      return reply.status(400).send({ error: "Invalid image file" });
    
    const fileExt = path.extname(data.filename);
    const fileName = `avatar_${user.id}_${Date.now()}${fileExt}`;
    const filePath = path.join(__dirname, "../../../uploads", fileName);
    const __uploadsDir = path.join(__dirname, "../../../uploads");
    
    try {
      await pipeline(data.file, fs.createWriteStream(filePath));
      
      const updateUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          avatar: fileName,
        }
      });
      
      if (oldAvatar && oldAvatar !== 'default_avatar.png') {
        const oldAvatarPath = path.join(__uploadsDir, oldAvatar);
          fs.unlink(oldAvatarPath, (err) => {
            if (err) throw err;
            console.log(`Old avatar deleted: ${oldAvatar}`);
          });
      }
      
      return reply.send({ message: "Avatar updated", avatar: updateUser.avatar });
    } catch (err) {
        console.error("Upload error:", err);
        return reply.status(500).send({ error: "Failed to upload image." });
      }
  })
  /* <-- update avatar route --> */
}

/*
| Method | Route              | Description                           |
| ------ | ------------------ | ------------------------------------- |
| GET    | `/me`              | Get current user profile              |
| GET    | `/:id`             | Get user profile by id                |
| PATCH  | `/username`        | Update username                       |
| PATCH  | `/avatar`          | Update profile picture                |
*/