import { Router } from 'express';
import { requireAuth, validateRequest } from '../../../shared/middleware';
import { CommunityController } from './community.controller';
import {
  listCommunityPostsQuerySchema,
  communityPostIdParamSchema,
  addPostCommentSchema,
  togglePostReactionSchema,
} from './community.schema';

const router = Router();
const controller = new CommunityController();

// Global guard for community routes: requireAuth
router.use(requireAuth);

// GET /api/v1/community/posts — List published posts
router.get(
  '/posts',
  validateRequest({
    query: listCommunityPostsQuerySchema,
  }),
  controller.listPosts,
);

// GET /api/v1/community/posts/:id — Get single post with active comments
router.get(
  '/posts/:id',
  validateRequest({
    params: communityPostIdParamSchema,
  }),
  controller.getPost,
);

// POST /api/v1/community/posts/:id/comments — Add a comment
router.post(
  '/posts/:id/comments',
  validateRequest({
    params: communityPostIdParamSchema,
    body: addPostCommentSchema,
  }),
  controller.addComment,
);

// POST /api/v1/community/posts/:id/react — Toggle reaction
router.post(
  '/posts/:id/react',
  validateRequest({
    params: communityPostIdParamSchema,
    body: togglePostReactionSchema,
  }),
  controller.toggleReaction,
);

export const communityRouter = router;
