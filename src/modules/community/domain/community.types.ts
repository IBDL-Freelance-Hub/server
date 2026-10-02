import { PostCategory, PostStatus } from '@prisma/client';

export interface PostAttachment {
  name: string;
  url: string;
  size?: number;
  type?: string;
}

export interface PostAuthorSummary {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  role?: string;
}

export interface PostCommentDTO {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: PostAuthorSummary;
}

export interface CommunityPostSummaryDTO {
  id: string;
  title: string;
  content: string;
  category: PostCategory;
  status: PostStatus;
  isPinned: boolean;
  attachments?: PostAttachment[];
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  author: PostAuthorSummary;
  commentCount: number;
  reactionCount: number;
  hasLiked: boolean;
}

export interface CommunityPostDetailDTO extends CommunityPostSummaryDTO {
  comments: PostCommentDTO[];
}

export interface ToggleReactionResult {
  reacted: boolean;
  type: string;
  reactionCount: number;
}
