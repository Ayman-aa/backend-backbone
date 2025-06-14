import { FastifyInstance } from 'fastify/types/instance'
import { z } from "zod"
import { prisma } from "../../utils/prisma"
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import crypto from 'crypto';

const userSchema = z.object({
  username: z.string().min(3).optional(),
})

export default async function profile(app: FastifyInstance) {
  
  /* <-- me route --> */
  app.get("/me", { preHandler: [app.authenticate] }, async (req, reply) => {
    const user: any = req.user;
    
    try {
      const currentUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, username: true, email: true, avatar: true, createdAt: true },
      });
      
      if (!currentUser) return reply.status(404).send({ statusCode: 404, error: "User not found" });
      
      return reply.send({ user: currentUser });
    } catch (err: any) {
      console.error("Profile fetch error: " + user.id + ', ' + err.message || null);
      return reply.status(500).send({ statusCode: 500, error: "Unable to fetch profile" });
    }
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
      return reply.status(404).send({ error: "User not found" });
    
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
  app.patch("/avatar", {  preHandler: [
    app.authenticate,
    app.rateLimit({ max: 3, timeWindow: '1 hour', keyGenerator: (req: any) => req.user.id })
    ] 
    }, async (req, reply) => {
    const user: any = req.user;
    const oldAvatar = user.avatar;
    
    try {
      const data = await req.file({
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB limit
          files: 1
        }
      });
    
      if (!data) return reply.status(400).send({ error: "Invalid image file" });
      
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      
      if (!allowedMimeTypes.includes(data.mimetype))
        return reply.status(400).send({ error: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed." });
      
      const fileExt = path.extname(data.filename).toLowerCase();
      if (!allowedExtensions.includes(fileExt)) return reply.status(400).send({ error: "Invalid file extension" });
      
      const fileName = `avatar_${user.id}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${fileExt}`;
      const filePath = path.join(__dirname, "../../../uploads", fileName);
      const __uploadsDir = path.join(__dirname, "../../../uploads");
      console.log("📂 File will be saved as:", fileName);
      console.log("📂 Full file path:", filePath);
      console.log("📂 Uploads directory:", __uploadsDir);
      if (!filePath.startsWith(__uploadsDir)) return reply.status(400).send({ error: "Invalid file path" });
      
      if (!fs.existsSync(__uploadsDir)) fs.mkdirSync(__uploadsDir, { recursive: true });
    
  
      await pipeline(data.file, fs.createWriteStream(filePath));
      
      const updateUser = await prisma.user.update({
        where: { id: user.id },
        data:  { avatar: fileName },
      });
      
      if (oldAvatar && oldAvatar !== 'default_avatar.png') {
        const oldAvatarPath = path.join(__uploadsDir, oldAvatar);
        if (fs.existsSync(oldAvatarPath)) {
          fs.unlink(oldAvatarPath, (err) => {
            if (err) throw err;
            console.log(`Old avatar deleted: ${oldAvatar}`);
          });
        }
        else console.warn(`Old avatar does not exist, skipping deletion: ${oldAvatarPath}`);
      }
      return reply.send({ message: "Avatar updated", avatar: updateUser.avatar, fullPath: `/uploads/${fileName}` });
    } catch (err: any) {
        console.error("Upload error:", err.message);
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