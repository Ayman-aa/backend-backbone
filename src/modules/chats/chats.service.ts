import { prisma } from "../../utils/prisma";

export class ChatService {
  
  /**
   * Check if two users are friends (accepted friendship)
   * @param userId1 - First user ID
   * @param userId2 - Second user ID
   * @returns Promise<boolean> - true if users are friends
   */
  static async checkFriendship(userId1: number, userId2: number): Promise<boolean> {
    try {
      const friendship = await prisma.friendship.findFirst({
        where: {
          status: "accepted",
          OR: [
            { requesterId: userId1, recipientId: userId2 },
            { requesterId: userId2, recipientId: userId1 },
          ],
        },
      });
      
      return !!friendship;
    } catch (error) {
      console.error("Error checking friendship:", error);
      return false;
    }
  }

  /**
   * Check if a user has blocked another user
   * @param blockerId - ID of the user who might have blocked
   * @param blockedId - ID of the user who might be blocked
   * @returns Promise<boolean> - true if user is blocked
   */
  static async checkUserBlocked(blockerId: number, blockedId: number): Promise<boolean> {
    try {
      const block = await prisma.userBlock.findFirst({
        where: {
          blockerId,
          blockedId,
        },
      });
      
      return !!block;
    } catch (error) {
      console.error("Error checking block status:", error);
      return false;
    }
  }

  /**
   * Check if either user has blocked the other (bidirectional check)
   * @param userId1 - First user ID
   * @param userId2 - Second user ID
   * @returns Promise<boolean> - true if either user blocked the other
   */
  static async checkMutualBlocking(userId1: number, userId2: number): Promise<boolean> {
    try {
      const hasBlocked = await this.checkUserBlocked(userId1, userId2);
      const isBlockedBy = await this.checkUserBlocked(userId2, userId1);
      
      return hasBlocked || isBlockedBy;
    } catch (error) {
      console.error("Error checking mutual blocking:", error);
      return false;
    }
  }

  /**
   * Validate if a user can send a message to another user
   * @param senderId - ID of the message sender
   * @param recipientId - ID of the message recipient
   * @returns Promise<{ canSend: boolean, reason?: string }> - validation result
   */
  static async validateMessageSending(senderId: number, recipientId: number): Promise<{ canSend: boolean, reason?: string }> {
    try {
      // Check if trying to message themselves
      if (senderId === recipientId) {
        return { canSend: false, reason: "Cannot send message to yourself" };
      }

      // Check if recipient exists
      const recipient = await prisma.user.findUnique({
        where: { id: recipientId },
        select: { id: true }
      });

      if (!recipient) {
        return { canSend: false, reason: "Recipient user not found" };
      }

      // Check if either user has blocked the other
      const isBlocked = await this.checkMutualBlocking(senderId, recipientId);
      if (isBlocked) {
        return { canSend: false, reason: "Cannot send message - user is blocked" };
      }

      // Check if users are friends
      const areFriends = await this.checkFriendship(senderId, recipientId);
      if (!areFriends) {
        return { canSend: false, reason: "Can only send messages to friends" };
      }

      return { canSend: true };
    } catch (error) {
      console.error("Error validating message sending:", error);
      return { canSend: false, reason: "Internal server error during validation" };
    }
  }

  /**
   * Sanitize message content for security
   * @param content - Raw message content
   * @returns string - Sanitized content
   */
  static sanitizeMessageContent(content: string): string {
    if (!content || typeof content !== 'string') {
      return '';
    }

    // Basic HTML escaping to prevent XSS
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .trim();
  }

  /**
   * Validate message content
   * @param content - Message content to validate
   * @returns { isValid: boolean, reason?: string } - validation result
   */
  static validateMessageContent(content: string): { isValid: boolean, reason?: string } {
    if (!content || typeof content !== 'string') {
      return { isValid: false, reason: "Message content is required" };
    }

    const trimmedContent = content.trim();
    
    if (trimmedContent.length === 0) {
      return { isValid: false, reason: "Message cannot be empty" };
    }

    if (trimmedContent.length > 1000) {
      return { isValid: false, reason: "Message too long (max 1000 characters)" };
    }

    if (trimmedContent.length < 1) {
      return { isValid: false, reason: "Message too short (min 1 character)" };
    }

    return { isValid: true };
  }
}