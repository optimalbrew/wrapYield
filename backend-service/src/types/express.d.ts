// Extend Express Request to include validated data
declare global {
  namespace Express {
    interface Request {
      validatedData?: any
    }
  }
}

// Re-export Express types to avoid conflicts
export * from 'express'
