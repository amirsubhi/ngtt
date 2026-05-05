export class AppError extends Error {
  constructor(
    public override message: string,
    public statusCode = 500,
    public code = 'INTERNAL_ERROR',
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(m = 'Not found') { super(m, 404, 'NOT_FOUND'); }
}

export class UnauthorizedError extends AppError {
  constructor(m = 'Unauthorized') { super(m, 401, 'UNAUTHORIZED'); }
}

export class ForbiddenError extends AppError {
  constructor(m = 'Forbidden') { super(m, 403, 'FORBIDDEN'); }
}

export class ValidationError extends AppError {
  constructor(m = 'Invalid input') { super(m, 400, 'VALIDATION'); }
}
