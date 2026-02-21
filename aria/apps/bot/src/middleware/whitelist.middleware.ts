export function whitelistMiddleware(allowedIds: number[]) {
  return async (ctx: any, next: any) => {
    const userId = ctx.from?.id;

    // Silently ignore if no user ID
    if (!userId) {
      return;
    }

    // Allow if user is in whitelist
    if (allowedIds.includes(userId)) {
      return next();
    }

    // Silently ignore unauthorized users
    return;
  };
}
