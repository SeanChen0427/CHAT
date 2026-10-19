import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

// Sean 版（Supabase）：API 不再提供後台頁面，根路徑導向 GitHub Pages 上的後台。
describe('GET /', () => {
  it('redirects to the admin site on GitHub Pages', async () => {
    const res = await createApp().fetch(new Request('https://api.example.com/'), {
      ADMIN_ORIGINS: 'https://seanchen0427.github.io',
    } as never);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://seanchen0427.github.io/CHAT/');
  });

  it('answers with a short text when no admin origin is configured', async () => {
    const res = await createApp().fetch(new Request('https://api.example.com/'), {} as never);
    expect(res.status).toBe(200);
  });
});
