import { Router } from 'express';
import { requireAuth, requireStaffRole, validateRequest } from '../../../shared/middleware';
import { AdminCommunityController } from './admin-community.controller';
import {
  adminCreatePostSchema,
  adminUpdatePostSchema,
  postIdParamSchema,
  commentIdParamSchema,
  deletePostQuerySchema,
} from './admin-community.schema';

const router = Router();
const controller = new AdminCommunityController();

// Global guard for all admin community routes: requireAuth + COMMUNITY_MODERATOR or SYSTEM_ADMINISTRATOR
router.use(requireAuth, requireStaffRole(['COMMUNITY_MODERATOR', 'SYSTEM_ADMINISTRATOR']));

// POST /api/v1/admin/community/posts — Create a post
router.post(
  '/posts',
  validateRequest({
    body: adminCreatePostSchema,
  }),
  controller.createPost,
);

// PATCH /api/v1/admin/community/posts/:id — Update a post
router.patch(
  '/posts/:id',
  validateRequest({
    params: postIdParamSchema,
    body: adminUpdatePostSchema,
  }),
  controller.updatePost,
);

// DELETE /api/v1/admin/community/posts/:id — Archive or hard-delete a post
router.delete(
  '/posts/:id',
  validateRequest({
    params: postIdParamSchema,
    query: deletePostQuerySchema,
  }),
  controller.deletePost,
);

// DELETE /api/v1/admin/community/comments/:commentId — Moderate / soft-delete offensive comment
router.delete(
  '/comments/:commentId',
  validateRequest({
    params: commentIdParamSchema,
  }),
  controller.moderateComment,
);

export const adminCommunityRouter = router;
