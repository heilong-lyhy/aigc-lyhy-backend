// src/usecases/blog/create-blog-comment.usecase.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogCommentStatus } from '@app-types/models/blog.types';
import { BlogCommentService } from '@modules/blog/blog-comment.service';
import { BlogPostService } from '@modules/blog/blog-post.service';
import { BlogPostQueryService } from '@modules/blog/queries/blog-post.query.service';
import { CreateBlogCommentUsecase } from './create-blog-comment.usecase';

describe('CreateBlogCommentUsecase', () => {
  let usecase: CreateBlogCommentUsecase;
  let commentService: { createComment: jest.Mock };
  let postService: { incrementCommentCount: jest.Mock };
  let postQueryService: { postExists: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  const mockCommentView = {
    id: 1,
    postId: 1,
    parentId: null,
    replyToId: null,
    authorName: '访客',
    authorAvatar: 'https://avatar.example.com/test.png',
    content: '评论内容',
    status: BlogCommentStatus.PENDING,
    nestingLevel: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    commentService = {
      createComment: jest.fn(),
    };
    postService = {
      incrementCommentCount: jest.fn(),
    };
    postQueryService = {
      postExists: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new CreateBlogCommentUsecase(
      commentService as unknown as BlogCommentService,
      postService as unknown as BlogPostService,
      postQueryService as unknown as BlogPostQueryService,
      transactionRunner,
    );
  });

  it('应在事务内创建评论并更新计数', async () => {
    postQueryService.postExists.mockResolvedValue(true);
    commentService.createComment.mockResolvedValue(mockCommentView);

    const result = await usecase.execute({
      postId: 1,
      authorName: '访客',
      authorEmail: 'test@example.com',
      content: '评论内容',
    });

    expect(result.comment).toBe(mockCommentView);
    expect(postQueryService.postExists).toHaveBeenCalledWith(1, expect.anything());
    expect(commentService.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ postId: 1, content: '评论内容' }),
      expect.anything(),
    );
    expect(postService.incrementCommentCount).toHaveBeenCalledWith(1, expect.anything());
  });

  it('文章不存在时应抛出 DomainError', async () => {
    postQueryService.postExists.mockResolvedValue(false);

    await expect(
      usecase.execute({
        postId: 999,
        authorName: '访客',
        authorEmail: 'test@example.com',
        content: '评论内容',
      }),
    ).rejects.toThrow(DomainError);

    expect(commentService.createComment).not.toHaveBeenCalled();
    expect(postService.incrementCommentCount).not.toHaveBeenCalled();
  });

  it('嵌套层级超过上限时应抛出 DomainError', async () => {
    postQueryService.postExists.mockResolvedValue(true);
    commentService.createComment.mockRejectedValue(
      new DomainError(BLOG_ERROR.COMMENT_NESTING_EXCEEDED, '评论嵌套层级超过上限'),
    );

    await expect(
      usecase.execute({
        postId: 1,
        parentId: 10,
        authorName: '访客',
        authorEmail: 'test@example.com',
        content: '深层回复',
      }),
    ).rejects.toThrow(DomainError);
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    postQueryService.postExists.mockResolvedValue(true);
    commentService.createComment.mockResolvedValue(mockCommentView);

    await usecase.execute({
      postId: 1,
      authorName: '访客',
      authorEmail: 'test@example.com',
      content: '评论内容',
    });

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
