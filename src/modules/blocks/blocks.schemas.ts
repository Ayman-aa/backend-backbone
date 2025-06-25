import { z } from "zod";

// Base schemas for reusable validation
export const UserIdSchema = z.number().int().positive().min(1, "User ID must be a positive integer");

export const BlockIdSchema = z.number().int().positive().min(1, "Block ID must be a positive integer");

// Block user endpoint schema
export const BlockUserSchema = z.object({
  userId: UserIdSchema,
}).strict();

// Unblock user endpoint schema
export const UnblockUserSchema = z.object({
  userId: UserIdSchema,
}).strict();

// Check block status endpoint schema (for params)
export const CheckBlockStatusParamsSchema = z.object({
  userId: z.string().transform((val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) {
      throw new z.ZodError([{
        code: z.ZodIssueCode.custom,
        message: "User ID must be a valid positive integer",
        path: ["userId"]
      }]);
    }
    return num;
  }),
});

// Optional: Pagination schema for blocked users list
export const PaginationSchema = z.object({
  page: z.number().int().positive().min(1).default(1),
  limit: z.number().int().positive().min(1).max(100).default(50),
}).partial();

// Get blocked users with pagination schema
export const GetBlockedUsersSchema = PaginationSchema;

// Bulk block/unblock schema (for future enhancement)
export const BulkBlockSchema = z.object({
  userIds: z.array(UserIdSchema).min(1, "At least one user ID is required").max(50, "Too many user IDs"),
}).strict();

export const BulkUnblockSchema = z.object({
  userIds: z.array(UserIdSchema).min(1, "At least one user ID is required").max(50, "Too many user IDs"),
}).strict();

// Type exports for TypeScript
export type BlockUserInput = z.infer<typeof BlockUserSchema>;
export type UnblockUserInput = z.infer<typeof UnblockUserSchema>;
export type CheckBlockStatusParamsInput = z.infer<typeof CheckBlockStatusParamsSchema>;
export type GetBlockedUsersInput = z.infer<typeof GetBlockedUsersSchema>;
export type BulkBlockInput = z.infer<typeof BulkBlockSchema>;
export type BulkUnblockInput = z.infer<typeof BulkUnblockSchema>;

// Validation helper functions
export const validateBlockUser = (data: unknown): BlockUserInput => {
  return BlockUserSchema.parse(data);
};

export const validateUnblockUser = (data: unknown): UnblockUserInput => {
  return UnblockUserSchema.parse(data);
};

export const validateCheckBlockStatusParams = (data: unknown): CheckBlockStatusParamsInput => {
  return CheckBlockStatusParamsSchema.parse(data);
};

export const validateGetBlockedUsers = (data: unknown): GetBlockedUsersInput => {
  return GetBlockedUsersSchema.parse(data);
};

// Error message formatter for consistent API responses
export const formatZodError = (error: z.ZodError): string => {
  const firstError = error.errors[0];
  if (firstError) {
    return firstError.message;
  }
  return "Invalid input data";
};

// Custom validation helpers
export const validateUserIdParam = (userId: string): number => {
  const result = CheckBlockStatusParamsSchema.safeParse({ userId });
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }
  return result.data.userId;
};