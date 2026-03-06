declare module 'playwright-extra-plugin-stealth' {
  function StealthPlugin(): any;
  export default StealthPlugin;
}

declare module 'playwright' {
  interface BrowserType<T extends Browser> {
    use(plugin: any): this;
  }
}
