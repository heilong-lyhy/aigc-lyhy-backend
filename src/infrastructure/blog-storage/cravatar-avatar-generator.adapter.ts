// src/infrastructure/blog-storage/cravatar-avatar-generator.adapter.ts
// AvatarGenerator boundary contract 的实现：基于 Cravatar（cravatar.cn）的头像 URL 拼装
// 国内访问稳定，替代 Gravatar

import type { AvatarGenerator } from '@src/modules/blog/contracts/avatar-generator.contract';
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class CravatarAvatarGeneratorAdapter implements AvatarGenerator {
  generateAvatar(email: string): Promise<string | null> {
    if (!email) return Promise.resolve(null);
    const hash = createHash('md5').update(email.trim().toLowerCase()).digest('hex');
    return Promise.resolve(`https://cravatar.cn/avatar/${hash}?d=identicon`);
  }
}
