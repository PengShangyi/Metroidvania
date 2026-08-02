import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    viewport: { width: 960, height: 540 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 960, height: 540 } },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 960, height: 540 } },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 960, height: 540 } },
    },
  ],
  webServer: {
    command: 'pnpm build:test && pnpm preview --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    // 默认只等 60 秒，而这条命令要先跑完 tsc -b 加 vite build（含 Phaser 那个 1.4MB 的
    // chunk）才开始监听端口。CI 冷缓存下超时表现为「服务器没起来」而不是「构建慢」，
    // 再叠上 retries: 2 就是三次同样费解的失败。
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
