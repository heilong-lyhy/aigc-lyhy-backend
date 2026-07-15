// src/infrastructure/blog-storage/cravatar-avatar-generator.adapter.ts
// AvatarGenerator boundary contract 的实现：基于 Cravatar（cravatar.cn）的头像 URL 拼装
// 国内访问稳定，替代 Gravatar

import type { AvatarGenerator } from '@modules/blog/contracts/avatar-generator.contract';
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class CravatarAvatarGeneratorAdapter implements AvatarGenerator {
  private readonly baseUrl = process.env.CRAVATAR_BASE_URL ?? 'https://cravatar.cn/avatar';

  generateAvatar(email: string): Promise<string | null> {
    if (!email) return Promise.resolve(null);
    const hash = createHash('md5').update(email.trim().toLowerCase()).digest('hex');
    return Promise.resolve(`${this.baseUrl}/${hash}?d=identicon`);
  }
}
