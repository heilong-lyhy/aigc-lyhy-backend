// src/modules/blog/sanitize-html.helper.ts
// 共享的 sanitize-html 配置：评论、文章等内容存储前统一清洗，保留安全标签

import sanitizeHtml from 'sanitize-html';

/** 博客内容允许的 HTML 标签白名单 */
const BLOG_ALLOWED_TAGS = [
  'b',
  'i',
  'em',
  'strong',
  'a',
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'del',
  'ins',
  'sup',
  'sub',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'hr',
  'span',
  'div',
];

/** 博客内容允许的 HTML 属性白名单 */
const BLOG_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
};

/** 博客内容 sanitize-html 统一配置 */
const BLOG_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: BLOG_ALLOWED_TAGS,
  allowedAttributes: BLOG_ALLOWED_ATTRIBUTES,
  // 关键：仅允许 http/https/mailto 协议，禁止 javascript:/data:/vbscript: 等
  allowedSchemes: ['http', 'https', 'mailto'],
  // 关键修复：将协议白名单应用到所有 URL 属性（href、src），而非仅 href
  // 修复前：allowedSchemes 默认只作用于 href，src 仍可使用 javascript:/data: 协议
  //         攻击者可注入 <img src="javascript:alert(1)">（旧 IE）或
  //         <img src="data:image/svg+xml;base64,..."> 植入 SVG XSS
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  // 关键修复：禁止 //example.com 这种协议相对 URL，防止从 https 页面跳到 http 被中间人
  allowProtocolRelative: false,
};

/**
 * 清洗 HTML 内容，移除危险脚本和属性，保留安全标签
 * 用于评论、文章等内容存储前的 XSS 防护
 */
export function sanitizeBlogContent(html: string): string {
  return sanitizeHtml(html, BLOG_SANITIZE_OPTIONS);
}
