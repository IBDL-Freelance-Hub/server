import { AppError } from './appError';

export class InvalidActivationTokenError extends AppError {
  constructor(
    message = 'This activation link is no longer valid.',
    details: unknown = {
      messageAr: 'لم يعد رابط التفعيل هذا صالحاً.',
      action: 'REQUEST_NEW_LINK',
    },
  ) {
    super(message, 400, 'ACTIVATION_LINK_INVALID', details);
  }
}

export class InvalidTokenError extends AppError {
  constructor(
    message = 'This reset link is no longer valid. Request a new one.',
    details: unknown = {
      messageAr: 'لم يعد رابط تعيين كلمة السر هذا صالحاً. يرجى طلب رابط جديد.',
      action: 'REQUEST_NEW_LINK',
    },
  ) {
    super(message, 400, 'RESET_TOKEN_INVALID', details);
  }
}
