// Extend Express Request to include validated data
declare global {
  namespace Express {
    interface Request {
      validatedData?: any
    }
  }
}

export {}
