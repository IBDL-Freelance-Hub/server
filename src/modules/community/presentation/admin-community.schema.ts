import { z } from 'zod';
import { PostCategory, PostStatus } from '@prisma/client';

export const postAttachmentSchema = z.object({
  name: z.string().trim().min(1),
  url: z.string().url(),
  size: z.number().int().nonnegative().optional(),
  type: z.string().trim().optional(),
});

export const adminCreatePostSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title cannot exceed 200 characters'),
  content: z
    .string({ required_error: 'Content is required' })
    .trim()
    .min(1, 'Content cannot be empty'),
  category: z.nativeEnum(PostCategory).optional().default(PostCategory.ANNOUNCEMENT),
  status: z.nativeEnum(PostStatus).optional().default(PostStatus.PUBLISHED),
  isPinned: z.boolean().optional().default(false),
  attachments: z.array(postAttachmentSchema).optional(),
});

export const adminUpdatePostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title cannot exceed 200 characters')
    .optional(),
  content: z.string().trim().min(1, 'Content cannot be empty').optional(),
  category: z.nativeEnum(PostCategory).optional(),
  status: z.nativeEnum(PostStatus).optional(),
  isPinned: z.boolean().optional(),
  attachments: z.array(postAttachmentSchema).optional(),
});

export const postIdParamSchema = z.object({
  id: z.string().uuid('Invalid post ID format'),
});

export const commentIdParamSchema = z.object({
  commentId: z.string().uuid('Invalid comment ID format'),
});

export const deletePostQuerySchema = z.object({
  hard: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export type AdminCreatePostInputSchema = z.infer<typeof adminCreatePostSchema>;
export type AdminUpdatePostInputSchema = z.infer<typeof adminUpdatePostSchema>;
