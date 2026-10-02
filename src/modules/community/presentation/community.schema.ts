import { z } from 'zod';
import { PostCategory } from '@prisma/client';

export const listCommunityPostsQuerySchema = z.object({
  category: z.nativeEnum(PostCategory).optional(),
  search: z.string().trim().optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .pipe(z.number().int().positive().max(50)),
});

export const addPostCommentSchema = z.object({
  content: z
    .string({ required_error: 'Comment content is required' })
    .trim()
    .min(1, 'Comment content cannot be empty')
    .max(1000, 'Comment cannot exceed 1000 characters'),
});

export const togglePostReactionSchema = z.object({
  type: z.string().trim().toUpperCase().optional().default('LIKE'),
});

export const communityPostIdParamSchema = z.object({
  id: z.string().uuid('Invalid post ID format'),
});

export type ListCommunityPostsQueryInput = z.infer<typeof listCommunityPostsQuerySchema>;
export type AddPostCommentInput = z.infer<typeof addPostCommentSchema>;
export type TogglePostReactionInput = z.infer<typeof togglePostReactionSchema>;
