/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from 'express';
import { PostCategory, PostStatus, StaffRole } from '@prisma/client';
import { AdminCommunityController } from '../../../../src/modules/community/presentation/admin-community.controller';
import { CommunityController } from '../../../../src/modules/community/presentation/community.controller';
import { AdminCreatePostUseCase } from '../../../../src/modules/community/application/admin-create-post.usecase';
import { AdminUpdatePostUseCase } from '../../../../src/modules/community/application/admin-update-post.usecase';
import { AdminDeletePostUseCase } from '../../../../src/modules/community/application/admin-delete-post.usecase';
import { AdminModerateCommentUseCase } from '../../../../src/modules/community/application/admin-moderate-comment.usecase';
import { ListCommunityPostsUseCase } from '../../../../src/modules/community/application/list-community-posts.usecase';
import { GetCommunityPostUseCase } from '../../../../src/modules/community/application/get-community-post.usecase';
import { AddPostCommentUseCase } from '../../../../src/modules/community/application/add-post-comment.usecase';
import { TogglePostReactionUseCase } from '../../../../src/modules/community/application/toggle-post-reaction.usecase';
import { requireStaffRole } from '../../../../src/shared/middleware/requireStaffRole.middleware';
import {
  AuthorizationError,
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from '../../../../src/shared/errors';
import {
  togglePostReactionSchema,
  listCommunityPostsQuerySchema,
  ALLOWED_REACTION_TYPES,
} from '../../../../src/modules/community/presentation/community.schema';
import { adminCreatePostSchema } from '../../../../src/modules/community/presentation/admin-community.schema';

describe('Community & Announcements Module Unit Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockReq = {
      headers: {},
      params: {},
      query: {},
      body: {},
      id: 'test-req-id',
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as unknown as Request['socket'],
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('1. RBAC & Staff Route Guards', () => {
    const middleware = requireStaffRole(['COMMUNITY_MODERATOR', 'SYSTEM_ADMINISTRATOR']);

    it('should reject unauthenticated request', () => {
      mockReq.user = undefined;
      expect(() => middleware(mockReq as Request, mockRes as Response, mockNext)).toThrow(
        AuthorizationError,
      );
    });

    it('should reject MEMBER trying to access admin community routes (403 Forbidden)', () => {
      mockReq.user = { id: 'u-member', userType: 'MEMBER' } as any;
      expect(() => middleware(mockReq as Request, mockRes as Response, mockNext)).toThrow(
        AuthorizationError,
      );
    });

    it('should reject staff with unallowed role (e.g. FINANCE_OFFICER)', () => {
      mockReq.user = {
        id: 'u-fin',
        userType: 'STAFF',
        staffRole: StaffRole.FINANCE_OFFICER,
      } as any;
      expect(() => middleware(mockReq as Request, mockRes as Response, mockNext)).toThrow(
        AuthorizationError,
      );
    });

    it('should allow COMMUNITY_MODERATOR', () => {
      mockReq.user = {
        id: 'u-mod',
        userType: 'STAFF',
        staffRole: StaffRole.COMMUNITY_MODERATOR,
      } as any;
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow SYSTEM_ADMINISTRATOR', () => {
      mockReq.user = {
        id: 'u-admin',
        userType: 'STAFF',
        staffRole: StaffRole.SYSTEM_ADMINISTRATOR,
      } as any;
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('2. AdminCommunityController & Use Cases', () => {
    let mockPrisma: any;
    let createPostUseCase: AdminCreatePostUseCase;
    let updatePostUseCase: AdminUpdatePostUseCase;
    let deletePostUseCase: AdminDeletePostUseCase;
    let moderateCommentUseCase: AdminModerateCommentUseCase;
    let controller: AdminCommunityController;

    beforeEach(() => {
      mockPrisma = {
        $transaction: jest.fn((cb: any) => cb(mockPrisma)),
        communityPost: {
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          findUnique: jest.fn(),
        },
        postComment: {
          findUnique: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        auditLog: {
          create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        },
      };

      createPostUseCase = new AdminCreatePostUseCase(mockPrisma);
      updatePostUseCase = new AdminUpdatePostUseCase(mockPrisma);
      deletePostUseCase = new AdminDeletePostUseCase(mockPrisma);
      moderateCommentUseCase = new AdminModerateCommentUseCase(mockPrisma);

      controller = new AdminCommunityController(
        createPostUseCase,
        updatePostUseCase,
        deletePostUseCase,
        moderateCommentUseCase,
      );
    });

    it('createPost: should create a published post with publishedAt and audit log', async () => {
      mockReq.user = {
        id: 'staff-1',
        userType: 'STAFF',
        staffRole: StaffRole.COMMUNITY_MODERATOR,
      } as any;
      mockReq.body = {
        title: 'New Annual Conference Announcement',
        content: 'Join us for the 2026 Freelancers summit!',
        category: PostCategory.EVENT,
        isPinned: true,
      };

      const mockCreated = {
        id: 'post-1',
        title: mockReq.body.title,
        content: mockReq.body.content,
        category: PostCategory.EVENT,
        status: PostStatus.PUBLISHED,
        isPinned: true,
        publishedAt: new Date(),
        author: { id: 'staff-1', email: 'mod@ibdl.com' },
      };
      mockPrisma.communityPost.create.mockResolvedValue(mockCreated);

      await controller.createPost(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockCreated,
        }),
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'COMMUNITY_POST_CREATED',
            resourceId: 'post-1',
          }),
        }),
      );
    });

    it('updatePost: should update post details and audit changes', async () => {
      mockReq.user = {
        id: 'staff-1',
        userType: 'STAFF',
        staffRole: StaffRole.SYSTEM_ADMINISTRATOR,
      } as any;
      mockReq.params = { id: 'post-1' };
      mockReq.body = {
        title: 'Updated Title',
        isPinned: false,
      };

      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: 'post-1',
        title: 'Old Title',
        status: PostStatus.PUBLISHED,
        isPinned: true,
      });

      const mockUpdated = {
        id: 'post-1',
        title: 'Updated Title',
        isPinned: false,
        status: PostStatus.PUBLISHED,
        author: { id: 'staff-1', email: 'admin@ibdl.com' },
      };
      mockPrisma.communityPost.update.mockResolvedValue(mockUpdated);

      await controller.updatePost(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'COMMUNITY_POST_UPDATED',
            resourceId: 'post-1',
          }),
        }),
      );
    });

    it('updatePost: should throw NotFoundError if post does not exist', async () => {
      mockReq.user = {
        id: 'staff-1',
        userType: 'STAFF',
        staffRole: StaffRole.COMMUNITY_MODERATOR,
      } as any;
      mockReq.params = { id: 'non-existing' };
      mockReq.body = { title: 'New' };

      mockPrisma.communityPost.findUnique.mockResolvedValue(null);

      await controller.updatePost(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('deletePost: should archive post by default', async () => {
      mockReq.user = {
        id: 'staff-1',
        userType: 'STAFF',
        staffRole: StaffRole.COMMUNITY_MODERATOR,
      } as any;
      mockReq.params = { id: 'post-1' };
      mockReq.query = { hard: 'false' };

      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: 'post-1',
        title: 'Test Post',
        status: PostStatus.PUBLISHED,
      });
      mockPrisma.communityPost.update.mockResolvedValue({
        id: 'post-1',
        status: PostStatus.ARCHIVED,
      });

      await controller.deletePost(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockPrisma.communityPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-1' },
          data: { status: PostStatus.ARCHIVED },
        }),
      );
    });

    it('deletePost: should permanently delete post when hard=true', async () => {
      mockReq.user = {
        id: 'staff-1',
        userType: 'STAFF',
        staffRole: StaffRole.SYSTEM_ADMINISTRATOR,
      } as any;
      mockReq.params = { id: 'post-1' };
      mockReq.query = { hard: 'true' };

      mockPrisma.communityPost.findUnique.mockResolvedValue({ id: 'post-1', title: 'Test Post' });
      mockPrisma.communityPost.delete.mockResolvedValue({ id: 'post-1' });

      await controller.deletePost(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.communityPost.delete).toHaveBeenCalledWith({ where: { id: 'post-1' } });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'COMMUNITY_POST_HARD_DELETED',
          }),
        }),
      );
    });

    it('moderateComment: should soft-delete offensive comment', async () => {
      mockReq.user = {
        id: 'staff-1',
        userType: 'STAFF',
        staffRole: StaffRole.COMMUNITY_MODERATOR,
      } as any;
      mockReq.params = { commentId: 'comment-1' };
      mockReq.query = {};

      mockPrisma.postComment.findUnique.mockResolvedValue({
        id: 'comment-1',
        postId: 'post-1',
        userId: 'spammer-1',
        isDeleted: false,
      });
      mockPrisma.postComment.update.mockResolvedValue({
        id: 'comment-1',
        isDeleted: true,
      });

      await controller.moderateComment(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockPrisma.postComment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comment-1' },
          data: { isDeleted: true },
        }),
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'COMMUNITY_COMMENT_MODERATED',
            resourceId: 'comment-1',
          }),
        }),
      );
    });

    it('moderateComment: should return idempotent success if comment is already soft-deleted', async () => {
      mockReq.user = {
        id: 'staff-1',
        userType: 'STAFF',
        staffRole: StaffRole.COMMUNITY_MODERATOR,
      } as any;
      mockReq.params = { commentId: 'comment-1' };
      mockReq.query = {};

      mockPrisma.postComment.findUnique.mockResolvedValue({
        id: 'comment-1',
        postId: 'post-1',
        userId: 'spammer-1',
        isDeleted: true,
      });

      await controller.moderateComment(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ message: 'Comment is already moderated.' }),
        }),
      );
      expect(mockPrisma.postComment.update).not.toHaveBeenCalled();
    });

    it('deletePost: should return idempotent success if post is already archived', async () => {
      mockReq.user = {
        id: 'staff-1',
        userType: 'STAFF',
        staffRole: StaffRole.COMMUNITY_MODERATOR,
      } as any;
      mockReq.params = { id: 'post-1' };
      mockReq.query = { hard: 'false' };

      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: 'post-1',
        title: 'Already Archived Post',
        status: PostStatus.ARCHIVED,
      });

      await controller.deletePost(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ message: 'Post is already archived.' }),
        }),
      );
      expect(mockPrisma.communityPost.update).not.toHaveBeenCalled();
    });
  });

  describe('3. CommunityController & Member Interactions', () => {
    let mockPrisma: any;
    let listPostsUseCase: ListCommunityPostsUseCase;
    let getPostUseCase: GetCommunityPostUseCase;
    let addCommentUseCase: AddPostCommentUseCase;
    let toggleReactionUseCase: TogglePostReactionUseCase;
    let controller: CommunityController;

    beforeEach(() => {
      mockPrisma = {
        $transaction: jest.fn((cb: any) => cb(mockPrisma)),
        communityPost: {
          count: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
        },
        postComment: {
          create: jest.fn(),
        },
        postReaction: {
          findUnique: jest.fn(),
          create: jest.fn(),
          delete: jest.fn(),
          count: jest.fn(),
        },
      };

      listPostsUseCase = new ListCommunityPostsUseCase(mockPrisma);
      getPostUseCase = new GetCommunityPostUseCase(mockPrisma);
      addCommentUseCase = new AddPostCommentUseCase(mockPrisma);
      toggleReactionUseCase = new TogglePostReactionUseCase(mockPrisma);

      controller = new CommunityController(
        listPostsUseCase,
        getPostUseCase,
        addCommentUseCase,
        toggleReactionUseCase,
      );
    });

    it('listPosts: should return published posts with pin priority and author details', async () => {
      mockReq.user = { id: 'member-1' } as any;
      mockReq.query = { page: '1', limit: '10' };

      mockPrisma.communityPost.count.mockResolvedValue(2);
      mockPrisma.communityPost.findMany.mockResolvedValue([
        {
          id: 'post-pinned',
          title: 'Pinned Post',
          content: 'Important',
          category: PostCategory.ANNOUNCEMENT,
          status: PostStatus.PUBLISHED,
          isPinned: true,
          createdAt: new Date('2026-10-01'),
          updatedAt: new Date('2026-10-01'),
          publishedAt: new Date('2026-10-01'),
          author: {
            id: 'staff-1',
            email: 'admin@ibdl.com',
            staff: { role: StaffRole.SYSTEM_ADMINISTRATOR },
            member: null,
          },
          _count: { comments: 5, reactions: 12 },
          reactions: [{ id: 'react-1', type: 'LIKE' }],
        },
        {
          id: 'post-regular',
          title: 'Regular Post',
          content: 'Daily news',
          category: PostCategory.UPDATE,
          status: PostStatus.PUBLISHED,
          isPinned: false,
          createdAt: new Date('2026-10-02'),
          updatedAt: new Date('2026-10-02'),
          publishedAt: new Date('2026-10-02'),
          author: {
            id: 'staff-2',
            email: 'mod@ibdl.com',
            staff: { role: StaffRole.COMMUNITY_MODERATOR },
            member: null,
          },
          _count: { comments: 0, reactions: 2 },
          reactions: [],
        },
      ]);

      await controller.listPosts(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              id: 'post-pinned',
              isPinned: true,
              hasLiked: true,
              commentCount: 5,
            }),
            expect.objectContaining({
              id: 'post-regular',
              isPinned: false,
              hasLiked: false,
              commentCount: 0,
            }),
          ]),
          pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
        }),
      );
      // Verify sorting parameter includes isPinned desc first
      expect(mockPrisma.communityPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        }),
      );
    });

    it('getPost: should return single post with active comments and omit deleted comments', async () => {
      mockReq.user = { id: 'member-1' } as any;
      mockReq.params = { id: 'post-1' };

      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: 'post-1',
        title: 'Community Guidelines',
        content: 'Be respectful',
        category: PostCategory.ANNOUNCEMENT,
        status: PostStatus.PUBLISHED,
        isPinned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
        author: {
          id: 'staff-1',
          email: 'admin@ibdl.com',
          staff: { role: StaffRole.SYSTEM_ADMINISTRATOR },
          member: null,
        },
        _count: { comments: 1, reactions: 4 },
        reactions: [],
        comments: [
          {
            id: 'c-1',
            postId: 'post-1',
            content: 'Great guidelines!',
            createdAt: new Date(),
            updatedAt: new Date(),
            user: {
              id: 'm-1',
              email: 'm1@example.com',
              member: { fullNameEn: 'Sarah Member' },
              staff: null,
            },
          },
        ],
      });

      await controller.getPost(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'post-1',
            comments: expect.arrayContaining([
              expect.objectContaining({
                id: 'c-1',
                content: 'Great guidelines!',
                author: expect.objectContaining({ fullName: 'Sarah Member' }),
              }),
            ]),
          }),
        }),
      );
      // Verify query specifically filters comments where isDeleted: false
      expect(mockPrisma.communityPost.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            comments: expect.objectContaining({
              where: { isDeleted: false },
            }),
          }),
        }),
      );
    });

    it('getPost: should throw NotFoundError for non-existing or archived post', async () => {
      mockReq.params = { id: 'archived-post' };
      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: 'archived-post',
        status: PostStatus.ARCHIVED,
      });

      await controller.getPost(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('addComment: should add comment to published post', async () => {
      mockReq.user = { id: 'member-1' } as any;
      mockReq.params = { id: 'post-1' };
      mockReq.body = { content: 'Very insightful announcement!' };

      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      });

      mockPrisma.postComment.create.mockResolvedValue({
        id: 'comment-new',
        postId: 'post-1',
        content: 'Very insightful announcement!',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: 'member-1',
          email: 'user@example.com',
          member: { fullNameEn: 'John Member' },
          staff: null,
        },
      });

      await controller.addComment(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'comment-new',
            content: 'Very insightful announcement!',
            author: expect.objectContaining({ fullName: 'John Member' }),
          }),
        }),
      );
    });

    it('addComment: should throw BusinessRuleError when attempting to comment on a DRAFT post', async () => {
      mockReq.user = { id: 'member-1' } as any;
      mockReq.params = { id: 'draft-post' };
      mockReq.body = { content: 'Trying to comment on draft' };

      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: 'draft-post',
        status: PostStatus.DRAFT,
      });

      await controller.addComment(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(BusinessRuleError));
    });

    it('addComment: should throw ValidationError on empty comment content', async () => {
      mockReq.user = { id: 'member-1' } as any;
      mockReq.params = { id: 'post-1' };
      mockReq.body = { content: '   ' };

      await controller.addComment(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('toggleReaction: should create reaction when not previously reacted (like)', async () => {
      mockReq.user = { id: 'member-1' } as any;
      mockReq.params = { id: 'post-1' };
      mockReq.body = { type: 'LIKE' };

      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      });
      mockPrisma.postReaction.findUnique.mockResolvedValue(null);
      mockPrisma.postReaction.create.mockResolvedValue({ id: 'react-1' });
      mockPrisma.postReaction.count.mockResolvedValue(1);

      await controller.toggleReaction(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { reacted: true, type: 'LIKE', reactionCount: 1 },
      });
      expect(mockPrisma.postReaction.create).toHaveBeenCalled();
    });

    it('toggleReaction: should delete reaction when already present (unlike)', async () => {
      mockReq.user = { id: 'member-1' } as any;
      mockReq.params = { id: 'post-1' };
      mockReq.body = { type: 'LIKE' };

      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      });
      mockPrisma.postReaction.findUnique.mockResolvedValue({ id: 'react-existing' });
      mockPrisma.postReaction.delete.mockResolvedValue({ id: 'react-existing' });
      mockPrisma.postReaction.count.mockResolvedValue(0);

      await controller.toggleReaction(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { reacted: false, type: 'LIKE', reactionCount: 0 },
      });
      expect(mockPrisma.postReaction.delete).toHaveBeenCalledWith({
        where: { id: 'react-existing' },
      });
    });

    it('getPost: should throw NotFoundError when a non-staff MEMBER requests a DRAFT post (SEC-COMM-001)', async () => {
      mockReq.user = { id: 'member-1', userType: 'MEMBER' } as any;
      mockReq.params = { id: 'draft-post' };
      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: 'draft-post',
        status: PostStatus.DRAFT,
      });

      await controller.getPost(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('getPost: should allow STAFF to preview a DRAFT post', async () => {
      mockReq.user = {
        id: 'staff-1',
        userType: 'STAFF',
        staffRole: StaffRole.COMMUNITY_MODERATOR,
      } as any;
      mockReq.params = { id: 'draft-post' };
      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: 'draft-post',
        title: 'Draft Announcement',
        content: 'Internal draft',
        category: PostCategory.ANNOUNCEMENT,
        status: PostStatus.DRAFT,
        isPinned: false,
        attachments: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        author: {
          id: 'staff-1',
          email: 'mod@ibdl.net',
          staff: { role: StaffRole.COMMUNITY_MODERATOR },
          member: null,
        },
        _count: { comments: 0, reactions: 0 },
        reactions: [],
        comments: [],
      });

      await controller.getPost(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ id: 'draft-post', status: PostStatus.DRAFT }),
        }),
      );
    });

    it('getPost: should cap comments at 100 in database query (SEC-COMM-002)', async () => {
      mockReq.params = { id: 'post-1' };
      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: 'post-1',
        title: 'Popular Post',
        content: 'Lots of discussion',
        category: PostCategory.ANNOUNCEMENT,
        status: PostStatus.PUBLISHED,
        isPinned: false,
        attachments: null,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        author: { id: 'a1', email: 'a@ibdl.net', staff: null, member: null },
        _count: { comments: 500, reactions: 10 },
        reactions: [],
        comments: [],
      });

      await controller.getPost(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.communityPost.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            comments: expect.objectContaining({
              take: 100,
            }),
          }),
        }),
      );
    });

    it('toggleReaction: should handle concurrent create race (P2002) without failing (SEC-COMM-004)', async () => {
      mockReq.user = { id: 'member-1' } as any;
      mockReq.params = { id: 'post-1' };
      mockReq.body = { type: 'LIKE' };

      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      });
      mockPrisma.postReaction.findUnique.mockResolvedValue(null);
      const p2002Error = new Error('Unique constraint failed');
      (p2002Error as any).code = 'P2002';
      Object.setPrototypeOf(
        p2002Error,
        (mockPrisma.PrismaClientKnownRequestError || Error).prototype,
      );
      mockPrisma.postReaction.create.mockRejectedValue(p2002Error);
      mockPrisma.postReaction.count.mockResolvedValue(1);

      await controller.toggleReaction(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ reacted: true }),
        }),
      );
    });

    it('toggleReaction: should handle concurrent delete race (P2025) without failing (SEC-COMM-004)', async () => {
      mockReq.user = { id: 'member-1' } as any;
      mockReq.params = { id: 'post-1' };
      mockReq.body = { type: 'LIKE' };

      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      });
      mockPrisma.postReaction.findUnique.mockResolvedValue({ id: 'react-1' });
      const p2025Error = new Error('Record to delete does not exist');
      (p2025Error as any).code = 'P2025';
      Object.setPrototypeOf(
        p2025Error,
        (mockPrisma.PrismaClientKnownRequestError || Error).prototype,
      );
      mockPrisma.postReaction.delete.mockRejectedValue(p2025Error);
      mockPrisma.postReaction.count.mockResolvedValue(0);

      await controller.toggleReaction(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ reacted: false }),
        }),
      );
    });
  });

  describe('4. Input Boundaries & Security Schemas (SEC-COMM-003, SEC-COMM-005)', () => {
    it('togglePostReactionSchema: should accept whitelisted reaction types', () => {
      for (const type of ALLOWED_REACTION_TYPES) {
        const result = togglePostReactionSchema.safeParse({ type });
        expect(result.success).toBe(true);
      }
    });

    it('togglePostReactionSchema: should default to LIKE when type omitted', () => {
      const result = togglePostReactionSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('LIKE');
      }
    });

    it('togglePostReactionSchema: should reject arbitrary or invalid reaction types (SEC-COMM-003)', () => {
      const invalidTypes = ['DISLIKE', 'ANGRY', 'SPAM', 'HATE', ''];
      for (const type of invalidTypes) {
        const result = togglePostReactionSchema.safeParse({ type });
        expect(result.success).toBe(false);
      }
    });

    it('listCommunityPostsQuerySchema: should reject search queries longer than 100 characters (SEC-COMM-005)', () => {
      const longSearch = 'a'.repeat(101);
      const result = listCommunityPostsQuerySchema.safeParse({ search: longSearch });
      expect(result.success).toBe(false);
    });

    it('adminCreatePostSchema: should reject post content exceeding 50,000 characters', () => {
      const hugeContent = 'a'.repeat(50001);
      const result = adminCreatePostSchema.safeParse({
        title: 'Valid Title',
        content: hugeContent,
      });
      expect(result.success).toBe(false);
    });

    it('adminCreatePostSchema: should reject post with more than 10 attachments', () => {
      const attachments = Array.from({ length: 11 }, (_, i) => ({
        name: `doc-${i}.pdf`,
        url: `https://storage.ibdl.net/doc-${i}.pdf`,
      }));
      const result = adminCreatePostSchema.safeParse({
        title: 'Valid Title',
        content: 'Valid content',
        attachments,
      });
      expect(result.success).toBe(false);
    });
  });
});
