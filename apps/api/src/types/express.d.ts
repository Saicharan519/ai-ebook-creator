declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth for authenticated requests. */
      auth?: { userId: string };
    }
  }
}

export {};
