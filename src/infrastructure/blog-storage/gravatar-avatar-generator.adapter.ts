// src/infrastructure/blog-storage/gravatar-avatar-generator.adapter.ts
// AvatarGenerator boundary contract 的默认实现：基于 Gravatar 的头像 URL 拼装

import type { AvatarGenerator } from '@src/modules/blog/contracts/avatar-generator.contract';
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class GravatarAvatarGeneratorAdapter implements AvatarGenerator {
  generateAvatar(email: string): Promise<string | null> {
    if (!email) return Promise.resolve(null);
    const hash = createHash('md5').update(email.trim().toLowerCase()).digest('hex');
    return Promise.resolve(`https://www.gravatar.com/avatar/${hash}?d=identicon`);
  }
}
