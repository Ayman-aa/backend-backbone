import { io } from "../modules/socket/socket";

/**
 * 🚨 Send alert to frontend (shows as toast/popup)
 */
export async function sendAlert(userId: number, message: string, type: "success" | "error" | "info" | "warning" = "info") {
  try {
    io.to(`user_${userId}`).emit("alert", {
      message,
      type,
      timestamp: Date.now()
    });

    console.log(`🚨 Alert sent to User ${userId}: ${message}`);
  } catch (error) {
    console.error("❌ Failed to send alert:", error);
  }
}
