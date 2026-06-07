// src/modules/blog/sanitize-html.helper.spec.ts

import { sanitizeBlogContent } from './sanitize-html.helper';

describe('sanitizeBlogContent', () => {
  it('应保留安全的 HTML 标签', () => {
    const html = '<p>Hello <strong>world</strong></p><ul><li>item</li></ul>';
    expect(sanitizeBlogContent(html)).toBe(html);
  });

  it('应保留标题标签', () => {
    const html = '<h1>Title</h1><h2>Sub</h2><h3>Section</h3>';
    expect(sanitizeBlogContent(html)).toBe(html);
  });

  it('应保留代码块标签', () => {
    const html = '<pre><code>const x = 1;</code></pre>';
    expect(sanitizeBlogContent(html)).toBe(html);
  });

  it('应保留表格标签', () => {
    const html =
      '<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>D</td></tr></tbody></table>';
    expect(sanitizeBlogContent(html)).toBe(html);
  });

  it('应保留 img 标签及安全属性', () => {
    const html = '<img src="https://example.com/img.png" alt="test" width="100" height="50">';
    // sanitize-html 会将自闭合标签标准化为 XHTML 风格
    expect(sanitizeBlogContent(html)).toBe(
      '<img src="https://example.com/img.png" alt="test" width="100" height="50" />',
    );
  });

  it('应保留 a 标签及安全属性', () => {
    const html =
      '<a href="https://example.com" title="link" target="_blank" rel="noopener">link</a>';
    expect(sanitizeBlogContent(html)).toBe(html);
  });

  it('应移除 script 标签', () => {
    const html = '<p>Hello</p><script>alert("xss")</script>';
    expect(sanitizeBlogContent(html)).toBe('<p>Hello</p>');
  });

  it('应移除 onclick 等事件属性', () => {
    const html = '<div onclick="alert(1)">click</div>';
    expect(sanitizeBlogContent(html)).toBe('<div>click</div>');
  });

  it('应移除 javascript: scheme', () => {
    const html = '<a href="javascript:alert(1)">evil</a>';
    expect(sanitizeBlogContent(html)).toBe('<a>evil</a>');
  });

  it('应移除 iframe 标签', () => {
    const html = '<p>text</p><iframe src="https://evil.com"></iframe>';
    expect(sanitizeBlogContent(html)).toBe('<p>text</p>');
  });

  it('应保留纯文本', () => {
    const text = 'Hello world, no HTML here!';
    expect(sanitizeBlogContent(text)).toBe(text);
  });

  it('应保留安全的 mailto scheme', () => {
    const html = '<a href="mailto:test@example.com">email</a>';
    expect(sanitizeBlogContent(html)).toBe(html);
  });

  it('应移除不安全的 data scheme（非 img src）', () => {
    const html = '<a href="data:text/html,<script>alert(1)</script>">evil</a>';
    expect(sanitizeBlogContent(html)).toBe('<a>evil</a>');
  });

  it('应移除 span/div 的 class 属性', () => {
    const html = '<span class="highlight">text</span><div class="container">block</div>';
    expect(sanitizeBlogContent(html)).toBe('<span>text</span><div>block</div>');
  });

  it('应保留 hr 标签', () => {
    const html = '<p>above</p><hr><p>below</p>';
    // sanitize-html 会将自闭合标签标准化为 XHTML 风格
    expect(sanitizeBlogContent(html)).toBe('<p>above</p><hr /><p>below</p>');
  });
});
