import { Request, Response, NextFunction } from 'express';
import { ListCommunityPostsUseCase } from '../application/list-community-posts.usecase';
import { GetCommunityPostUseCase } from '../application/get-community-post.usecase';
import { AddPostCommentUseCase } from '../application/add-post-comment.usecase';
import { TogglePostReactionUseCase } from '../application/toggle-post-reaction.usecase';
import { AuthenticationError } from '../../../shared/errors';
import { PostCategory } from '@prisma/client';

export class CommunityController {
  constructor(
    private readonly listPostsUseCase: ListCommunityPostsUseCase = new ListCommunityPostsUseCase(),
    private readonly getPostUseCase: GetCommunityPostUseCase = new GetCommunityPostUseCase(),
    private readonly addCommentUseCase: AddPostCommentUseCase = new AddPostCommentUseCase(),
    private readonly toggleReactionUseCase: TogglePostReactionUseCase = new TogglePostReactionUseCase(),
  ) {}

  listPosts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUserId = req.user?.id;
      const category = req.query.category as PostCategory | undefined;
      const search = req.query.search as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const result = await this.listPostsUseCase.execute({
        currentUserId,
        category,
        search,
        page,
        limit,
      });

      res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  getPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUserId = req.user?.id;
      const id = req.params.id as string;

      const post = await this.getPostUseCase.execute(id, currentUserId);

      res.status(200).json({
        success: true,
        data: post,
      });
    } catch (error) {
      next(error);
    }
  };

  addComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required to comment.');
      }

      const id = req.params.id as string;
      const { content } = req.body;

      const comment = await this.addCommentUseCase.execute({
        postId: id,
        userId: req.user.id,
        content,
      });

      res.status(201).json({
        success: true,
        data: comment,
        message: 'Comment added successfully.',
      });
    } catch (error) {
      next(error);
    }
  };

  toggleReaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required to react.');
      }

      const id = req.params.id as string;
      const { type } = req.body;

      const result = await this.toggleReactionUseCase.execute({
        postId: id,
        userId: req.user.id,
        type,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
