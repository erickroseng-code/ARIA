export function whitelistMiddleware(allowedIds: number[]) {
  return async (ctx: any, next: any) => {
    const userId = ctx.from?.id;

    // Silently ignore if no user ID
    if (!userId) {
      return;
    }

    // Allow all if whitelist contains 0 (wildcard)
    if (allowedIds.includes(0)) {
      console.log(`[WHITELIST] User ${userId} allowed (wildcard mode)`);
      return next();
    }

    // Allow if user is in whitelist
    if (allowedIds.includes(userId)) {
      console.log(`[WHITELIST] User ${userId} allowed (in whitelist)`);
      return next();
    }

    // Log unauthorized users to find their ID
    console.log(`[WHITELIST] User ${userId} blocked (not in whitelist: ${allowedIds.join(',')})`);
    return;
  };
}
