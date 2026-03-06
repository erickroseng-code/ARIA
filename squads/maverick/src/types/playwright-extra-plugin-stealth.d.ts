declare module 'puppeteer-extra-plugin-stealth' {
  function StealthPlugin(): any;
  export default StealthPlugin;
}

declare module 'playwright-extra' {
  import { BrowserType, Browser, LaunchOptions, BrowserContext, BrowserContextOptions } from 'playwright';
  interface PlaywrightExtraBrowserType extends BrowserType {
    use(plugin: any): this;
    launchPersistentContext(userDataDir: string, options?: BrowserContextOptions & LaunchOptions): Promise<BrowserContext>;
    close(): Promise<void>;
  }
  export const chromium: PlaywrightExtraBrowserType;
  export const firefox: PlaywrightExtraBrowserType;
  export const webkit: PlaywrightExtraBrowserType;
}
