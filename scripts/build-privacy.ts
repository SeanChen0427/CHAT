// Sean 版（Supabase）：產生 GitHub Pages 用的靜態隱私權政策頁（Meta App 需要公開網址）。
// 用法：PRIVACY_CONTACT="聯絡方式" tsx scripts/build-privacy.ts admin/dist/privacy.html
import { writeFileSync } from 'fs';
import { renderPrivacyHtml } from '../src/privacy';

const out = process.argv[2] ?? 'admin/dist/privacy.html';
writeFileSync(out, renderPrivacyHtml(process.env.PRIVACY_CONTACT));
console.log(`已產生 ${out}`);
