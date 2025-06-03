import { z } from "zod";

// Base schemas for reusable validation
export const UserIdSchema = z.number().int().positive().min(1, "User ID must be a positive integer");

export const MessageContentSchema = z.string()
  .min(1, "Message content is required")
  .max(1000, "Message too long (max 1000 characters)")
  .trim()
  .refine(
    (content) => content.length > 0,
    { message: "Message cannot be empty after trimming whitespace" }
  );

export const MessageIdSchema = z.number().int().positive().min(1, "Message ID must be a positive integer");

// Send message endpoint schema
export const SendMessageSchema = z.object({
  toUserId: UserIdSchema,
  content: MessageContentSchema,
}).strict();

// Get message thread endpoint schema
export const GetMessageThreadSchema = z.object({
  toUserId: UserIdSchema,
}).strict();

// Mark messages as read endpoint schema
export const MarkMessagesReadSchema = z.object({
  fromUserId: UserIdSchema,
}).strict();

// Optional: Pagination schema for future use
export const PaginationSchema = z.object({
  page: z.number().int().positive().min(1).default(1),
  limit: z.number().int().positive().min(1).max(100).default(50),
}).partial();

// Message thread with pagination schema
export const GetMessageThreadWithPaginationSchema = z.object({
  toUserId: UserIdSchema,
}).merge(PaginationSchema);

// Bulk mark as read schema (for future enhancement)
export const BulkMarkReadSchema = z.object({
  messageIds: z.array(MessageIdSchema).min(1, "At least one message ID is required").max(100, "Too many message IDs"),
}).strict();

// Search messages schema (for future enhancement)
export const SearchMessagesSchema = z.object({
  query: z.string().min(1, "Search query is required").max(100, "Search query too long"),
  userId: UserIdSchema.optional(),
}).merge(PaginationSchema);

// Delete message schema (for future enhancement)
export const DeleteMessageSchema = z.object({
  messageId: MessageIdSchema,
}).strict();

// Edit message schema (for future enhancement)
export const EditMessageSchema = z.object({
  messageId: MessageIdSchema,
  content: MessageContentSchema,
}).strict();

// Type exports for TypeScript
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type GetMessageThreadInput = z.infer<typeof GetMessageThreadSchema>;
export type MarkMessagesReadInput = z.infer<typeof MarkMessagesReadSchema>;
export type GetMessageThreadWithPaginationInput = z.infer<typeof GetMessageThreadWithPaginationSchema>;
export type BulkMarkReadInput = z.infer<typeof BulkMarkReadSchema>;
export type SearchMessagesInput = z.infer<typeof SearchMessagesSchema>;
export type DeleteMessageInput = z.infer<typeof DeleteMessageSchema>;
export type EditMessageInput = z.infer<typeof EditMessageSchema>;

// Validation helper functions
export const validateSendMessage = (data: unknown): SendMessageInput => {
  return SendMessageSchema.parse(data);
};

export const validateGetMessageThread = (data: unknown): GetMessageThreadInput => {
  return GetMessageThreadSchema.parse(data);
};

export const validateMarkMessagesRead = (data: unknown): MarkMessagesReadInput => {
  return MarkMessagesReadSchema.parse(data);
};

// Error message formatter for consistent API responses
export const formatZodError = (error: z.ZodError): string => {
  const firstError = error.errors[0];
  if (firstError) {
    return firstError.message;
  }
  return "Invalid input data";
};