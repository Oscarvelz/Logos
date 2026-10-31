import { chromium } from '/workspace/work/browser-test/node_modules/playwright-core/index.mjs';
export const BASE = 'http://127.0.0.1:4173/Logos/';
export async function launch(extra = []) {
  return chromium.launch({
    executablePath: '/workspace/work/browser-test/browsers/chromium_headless_shell-1155/chrome-linux/headless_shell',
    // Raw proxy flag (not Playwright's proxy option) so loopback stays direct.
    args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:8899', '--autoplay-policy=no-user-gesture-required', ...extra],
  });
}
export const PHONE = { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36' };
export const TABLET = { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: true, deviceScaleFactor: 1 };
