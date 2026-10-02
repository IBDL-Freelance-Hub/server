import { Request, Response, NextFunction } from 'express';
import { AdminCreatePostUseCase } from '../application/admin-create-post.usecase';
import { AdminUpdatePostUseCase } from '../application/admin-update-post.usecase';
import { AdminDeletePostUseCase } from '../application/admin-delete-post.usecase';
import { AdminModerateCommentUseCase } from '../application/admin-moderate-comment.usecase';
import { AuthenticationError } from '../../../shared/errors';
import { getClientIp } from '../../../shared/utils';

export class AdminCommunityController {
  constructor(
    private readonly createPostUseCase: AdminCreatePostUseCase = new AdminCreatePostUseCase(),
    private readonly updatePostUseCase: AdminUpdatePostUseCase = new AdminUpdatePostUseCase(),
    private readonly deletePostUseCase: AdminDeletePostUseCase = new AdminDeletePostUseCase(),
    private readonly moderateCommentUseCase: AdminModerateCommentUseCase = new AdminModerateCommentUseCase(),
  ) {}

  private getActorMeta(req: Request) {
    if (!req.user) {
      throw new AuthenticationError('Authentication required.');
    }
    return {
      userId: req.user.id,
      role: req.user.staffRole || req.user.userType || 'STAFF',
      ipAddress: getClientIp(req),
      requestId: req.id,
    };
  }

  createPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = this.getActorMeta(req);
      const post = await this.createPostUseCase.execute(req.body, actor);

      res.status(201).json({
        success: true,
        data: post,
        message: 'Community post created successfully.',
      });
    } catch (error) {
      next(error);
    }
  };

  updatePost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = this.getActorMeta(req);
      const id = req.params.id as string;
      const updated = await this.updatePostUseCase.execute(id, req.body, actor);

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Community post updated successfully.',
      });
    } catch (error) {
      next(error);
    }
  };

  deletePost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = this.getActorMeta(req);
      const id = req.params.id as string;
      const hardDelete = req.query.hard === 'true';

      const result = await this.deletePostUseCase.execute(id, actor, hardDelete);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  moderateComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = this.getActorMeta(req);
      const commentId = req.params.commentId as string;
      const hardDelete = req.query.hard === 'true';

      const result = await this.moderateCommentUseCase.execute(commentId, actor, hardDelete);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
