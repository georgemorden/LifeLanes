import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/pwa",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173/LifeLanes/",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run build:pages && npm run preview -- --host 127.0.0.1 --port 4173 --base /LifeLanes/",
    url: "http://127.0.0.1:4173/LifeLanes/",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
