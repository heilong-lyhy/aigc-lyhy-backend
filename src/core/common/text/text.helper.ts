// src/core/common/text/text.helper.ts

/** Protocol-compatible trim that preserves empty/null/undefined distinctions. */
export function trimTextPure(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.trim();
  }
  return value;
}

/**
 * 邮箱脱敏，避免日志泄露。
 * local part ≤2 字符时保留首字符 + `***`，否则保留前 2 字符 + `***`，域名原样保留。
 */
export function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const [localPart, domainPart] = parts;
  if (localPart.length <= 2) {
    return `${localPart.charAt(0) || '*'}***@${domainPart}`;
  }
  return `${localPart.slice(0, 2)}***@${domainPart}`;
}

// [KEPT:业务保留] trimText: trim 后空字符串转为 undefined
export function trimText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  return value as string | undefined;
}

/**
 * 文本转小写处理
 * @param value 待处理的值
 * @returns 如果是字符串则返回小写后的结果，否则返回原值
 */
export function toLowerCase(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.toLowerCase();
  }
  return value as string | undefined;
}

/**
 * 文本规范化处理
 * @param value 待处理的值
 * @returns 如果是字符串则返回规范化后的结果，否则返回原值
 */
export function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return value as string | undefined;
  }

  return value
    .trim() // 去除首尾空格
    .replace(/[\uFF01-\uFF5E]/g, (char) => {
      // 全角转半角
      return String.fromCharCode(char.charCodeAt(0) - 0xfee0);
    })
    .replace(/[\u3000]/g, ' ') // 全角空格转半角空格
    .replace(/\s+/g, ' ') // 多个空格归一
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      '',
    ); // 过滤 Emoji
}
