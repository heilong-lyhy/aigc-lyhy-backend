// src/infrastructure/blog-storage/cravatar-avatar-generator.adapter.ts
// AvatarGenerator boundary contract 的实现：基于 Cravatar（cravatar.cn）的头像 URL 拼装

import type { AvatarGenerator } from '@modules/blog/contracts/avatar-generator.contract';
import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

export const CRAVATAR_BASE_URL_TOKEN = Symbol('CRAVATAR_BASE_URL');

@Injectable()
export class CravatarAvatarGeneratorAdapter implements AvatarGenerator {
  constructor(
    @Inject(CRAVATAR_BASE_URL_TOKEN)
    private readonly baseUrl: string,
  ) {}

  generateAvatar(email: string): Promise<string | null> {
    if (!email) return Promise.resolve(null);
    const hash = createHash('md5').update(email.trim().toLowerCase()).digest('hex');
    return Promise.resolve(`${this.baseUrl}/${hash}?d=identicon`);
  }
}
