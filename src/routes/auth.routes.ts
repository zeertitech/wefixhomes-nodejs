import { FastifyInstance } from 'fastify';
import { authController } from '../controllers/auth.controller';
import { accountController } from '../controllers/account.controller';
import { authenticate } from '../middlewares/authenticate';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Staff/Admin registration',
      body: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
        },
      },
    },
    handler: authController.register.bind(authController),
  });

  app.post('/signup', {
    schema: {
      tags: ['Auth'],
      summary: 'Create a customer account and email a verification code',
    },
    handler: authController.signup.bind(authController),
  });

  app.post('/verify-phone', {
    schema: {
      tags: ['Auth'],
      summary: 'Verify the signup SMS OTP for a mobile number',
    },
    handler: authController.verifyPhone.bind(authController),
  });

  app.post('/verify-email', {
    schema: {
      tags: ['Auth'],
      summary: 'Verify the email OTP and start a session',
    },
    handler: authController.verifyEmail.bind(authController),
  });

  app.post('/forgot-password', {
    schema: {
      tags: ['Auth'],
      summary: 'Email a password reset code to the account',
    },
    handler: authController.forgotPassword.bind(authController),
  });

  app.post('/forgot-password/verify', {
    schema: {
      tags: ['Auth'],
      summary: 'Verify a password reset code',
    },
    handler: authController.verifyForgotPassword.bind(authController),
  });

  app.post('/reset-password', {
    schema: {
      tags: ['Auth'],
      summary: 'Set a new password after the reset code is verified',
    },
    handler: authController.resetPassword.bind(authController),
  });

  app.post('/login/otp', {
    schema: {
      tags: ['Auth'],
      summary: 'Text a login code to a registered mobile number',
    },
    handler: authController.requestLoginOtp.bind(authController),
  });

  app.post('/login/otp/verify', {
    schema: {
      tags: ['Auth'],
      summary: 'Verify the SMS login code and start a session',
    },
    handler: authController.verifyLoginOtp.bind(authController),
  });

  app.post('/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Admin login',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
        },
      },
    },
    handler: authController.login.bind(authController),
  });

  app.post('/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Refresh access token (via cookie or request body)',
      body: {
        type: 'object',
        properties: { refreshToken: { type: 'string' } },
      },
    },
    handler: authController.refresh.bind(authController),
  });

  app.post('/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'Logout current session',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate],
    handler: authController.logout.bind(authController),
  });

  app.get('/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'Logout current session',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate],
    handler: authController.logout.bind(authController),
  });

  app.post('/logout-all', {
    schema: {
      tags: ['Auth'],
      summary: 'Logout all sessions',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate],
    handler: authController.logoutAll.bind(authController),
  });

  app.get('/me', {
    schema: {
      tags: ['Auth'],
      summary: 'Get current user info',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate],
    handler: authController.me.bind(authController),
  });

  app.get('/me/profile', {
    schema: { tags: ['Account'], summary: 'Get my profile', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: authController.profile.bind(authController),
  });

  app.patch('/me/profile', {
    schema: { tags: ['Account'], summary: 'Update my name', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: authController.updateName.bind(authController),
  });

  app.post('/me/profile/picture', {
    schema: { tags: ['Account'], summary: 'Upload my profile picture', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: authController.uploadProfileImage.bind(authController),
  });

  app.post('/me/phone/otp', {
    schema: { tags: ['Account'], summary: 'Text a code to confirm a new phone number', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: authController.startPhoneChange.bind(authController),
  });

  app.post('/me/phone', {
    schema: { tags: ['Account'], summary: 'Confirm the new phone number', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: authController.confirmPhoneChange.bind(authController),
  });

  app.post('/me/password/otp', {
    schema: { tags: ['Account'], summary: 'Email a password-change code', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: authController.sendPasswordCode.bind(authController),
  });

  app.post('/me/password', {
    schema: { tags: ['Account'], summary: 'Change password with email code', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: authController.changePassword.bind(authController),
  });

  app.post('/me/email/otp', {
    schema: { tags: ['Account'], summary: 'Email a code to the current address', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: authController.startEmailChange.bind(authController),
  });

  app.post('/me/email/confirm-current', {
    schema: { tags: ['Account'], summary: 'Confirm current email and code the new address', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: authController.confirmCurrentEmail.bind(authController),
  });

  app.post('/me/email/confirm-new', {
    schema: { tags: ['Account'], summary: 'Confirm the new email', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: authController.confirmNewEmail.bind(authController),
  });

  // Self-service account. Identity comes from the session, never from the URL.
  // Password login and a future OAuth callback both land on these same cookies.
  app.get('/me/orders', {
    schema: { tags: ['Account'], summary: 'List my orders', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: accountController.orders.bind(accountController),
  });

  app.get('/me/addresses', {
    schema: { tags: ['Account'], summary: 'List my addresses', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: accountController.addresses.bind(accountController),
  });

  app.post('/me/addresses', {
    schema: { tags: ['Account'], summary: 'Add an address', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: accountController.addAddress.bind(accountController),
  });

  app.patch<{ Params: { addressId: string } }>('/me/addresses/:addressId', {
    schema: { tags: ['Account'], summary: 'Update my address', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: accountController.updateAddress.bind(accountController),
  });

  app.delete<{ Params: { addressId: string } }>('/me/addresses/:addressId', {
    schema: { tags: ['Account'], summary: 'Delete my address', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: accountController.deleteAddress.bind(accountController),
  });
}
