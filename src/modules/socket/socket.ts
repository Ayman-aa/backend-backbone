import { Server as HttpServer } from 'http';
import { Socket, Server as SocketIOServer } from 'socket.io';

export let io: SocketIOServer;

export function setupSocketIO(server: HttpServer) {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      credentials: true,
    },
  });
  
  io.on("connection", (socket) => {
    console.log("🟢 A user connected:", socket.id);
    
    socket.on("private_message", ({ to, message }) => {
      socket.to(to).emit("private_message", {
        from: socket.id,
        message,
      });
    });
    
    socket.on("disconnect", () => {
          console.log("🔴 A user disconnected:", socket.id);
    });
  })
}