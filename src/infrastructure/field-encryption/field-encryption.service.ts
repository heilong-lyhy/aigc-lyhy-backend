// src/infrastructure/field-encryption/field-encryption.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { getEncryptedFields } from './field-encryption.metadata';

const getRequiredConfig = (config: ConfigService, key: string): string => {
  const value = config.get<string>(key);
  if (!value || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
};

// AES-256-GCM 参数：
// - KEY_LENGTH=32 字节（256 位），由 FIELD_ENCRYPTION_KEY 提供（utf8 解码后必须 32 字节）
// - IV_LENGTH=12 字节（96 位），NIST 推荐的 GCM nonce 长度，每次加密随机生成
// - AUTH_TAG_LENGTH=16 字节（128 位），GCM 提供的完整性认证标签
const FIELD_ENCRYPTION_META = {
  KEY_LENGTH: 32,
  IV_LENGTH: 12,
  AUTH_TAG_LENGTH: 16,
} as const;

/**
 * 密文封装格式：base64( IV[12] || authTag[16] || ciphertext )
 * - IV 不需保密，但同一密钥下绝不复用，故每次随机生成并随密文存储
 * - authTag 用于校验密文完整性，防止 padding oracle / 字节翻转攻击
 * - 解密时验证 authTag 失败会抛错，调用方应捕获并视为数据被篡改
 */
const METADATA_PREFIX_LENGTH =
  FIELD_ENCRYPTION_META.IV_LENGTH + FIELD_ENCRYPTION_META.AUTH_TAG_LENGTH;

@Injectable()
export class FieldEncryptionService {
  private readonly key: Buffer;
  private readonly logger = new Logger(FieldEncryptionService.name);

  constructor(private readonly configService: ConfigService) {
    const keyStr = getRequiredConfig(this.configService, 'FIELD_ENCRYPTION_KEY');
    const keyBuf = Buffer.from(keyStr, 'utf8');
    if (keyBuf.length !== FIELD_ENCRYPTION_META.KEY_LENGTH) {
      throw new Error(
        `FIELD_ENCRYPTION_KEY must be exactly ${FIELD_ENCRYPTION_META.KEY_LENGTH} bytes (utf8), got ${keyBuf.length}`,
      );
    }
    this.key = keyBuf;
  }

  encrypt(plain: string): string {
    // 每次加密生成随机 IV，避免 CBC 时代固定 IV 导致的"相同明文产生相同密文"频率分析风险
    const iv = randomBytes(FIELD_ENCRYPTION_META.IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // 拼接 IV + authTag + ciphertext，整体 base64 输出
    return Buffer.concat([iv, authTag, enc]).toString('base64');
  }

  decrypt(cipherBase64: string): string {
    const buf = Buffer.from(cipherBase64, 'base64');
    // 密文至少需包含 IV + authTag，否则格式非法
    if (buf.length < METADATA_PREFIX_LENGTH) {
      throw new Error('Invalid ciphertext: too short');
    }
    const iv = buf.subarray(0, FIELD_ENCRYPTION_META.IV_LENGTH);
    const authTag = buf.subarray(
      FIELD_ENCRYPTION_META.IV_LENGTH,
      FIELD_ENCRYPTION_META.IV_LENGTH + FIELD_ENCRYPTION_META.AUTH_TAG_LENGTH,
    );
    const enc = buf.subarray(METADATA_PREFIX_LENGTH);

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    // setAuthTag 后若解密过程中 tag 不匹配，final() 会抛 'Unsupported state or unable to authenticate data'
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  }

  encryptEntity(entity: unknown) {
    if (typeof entity !== 'object' || entity === null) return;
    const fields = getEncryptedFields(entity.constructor);
    for (const field of fields) {
      const val = (entity as Record<string | symbol, unknown>)[field];

      if (typeof val === 'string' && val) {
        const encrypted = this.encrypt(val);
        (entity as Record<string | symbol, unknown>)[field] = encrypted;
      } else if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
        const jsonString = JSON.stringify(val);
        const encrypted = this.encrypt(jsonString);
        (entity as Record<string | symbol, unknown>)[field] = encrypted;
      }
    }
  }

  decryptEntity(entity: unknown) {
    if (typeof entity !== 'object' || entity === null) return;
    const fields = getEncryptedFields(entity.constructor);
    for (const field of fields) {
      const val = (entity as Record<string | symbol, unknown>)[field];

      if (typeof val === 'string' && val) {
        try {
          const decrypted = this.decrypt(val);
          try {
            const parsed: unknown = JSON.parse(decrypted);

            (entity as Record<string | symbol, unknown>)[field] = parsed;
          } catch {
            (entity as Record<string | symbol, unknown>)[field] = decrypted;
          }
        } catch {
          // 解密失败：密文被篡改、密钥错误或非 GCM 格式的旧数据
          // 记录告警以便识别未加密的旧数据，但仍跳过以不阻断其他字段解密
          this.logger.warn(
            `解密字段 ${String(field)} 失败，可能为加密系统引入前的旧数据或密钥不匹配`,
          );
          continue;
        }
      }
    }
  }
}
