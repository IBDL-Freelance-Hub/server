import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'IBDL Freelancers Hub API',
      version: '1.0.0',
      description:
        'RESTful API documentation for IBDL Freelancers Hub — Express & TypeScript Modular Monolith.',
      contact: {
        name: 'IBDL Engineering Team',
      },
    },
    servers: [
      {
        url: '/',
        description: 'Current Environment Server',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'session',
          description: 'Session cookie authentication',
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Bearer token authentication',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'error' },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            message: { type: 'string', example: 'Invalid request data' },
            requestId: { type: 'string', example: 'req_123456789' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Invalid email address' },
                },
              },
            },
          },
        },
        RegisterMemberRequest: {
          type: 'object',
          required: [
            'fullName',
            'email',
            'mobile',
            'country',
            'yearsOfExperience',
            'termsAccepted',
          ],
          properties: {
            fullName: { type: 'string', example: 'John Doe', minLength: 2 },
            email: { type: 'string', format: 'email', example: 'john.doe@example.com' },
            mobile: { type: 'string', example: '+201012345678' },
            country: { type: 'string', example: 'Egypt' },
            linkedinUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://linkedin.in/in/johndoe',
            },
            yearsOfExperience: {
              type: 'string',
              enum: ['<2', '2-5', '6-10', '11-15', '>15'],
              example: '2-5',
            },
            areasOfExpertise: {
              type: 'array',
              items: { type: 'string' },
              example: ['Backend', 'Node.js'],
            },
            industriesServed: {
              type: 'array',
              items: { type: 'string' },
              example: ['FinTech', 'E-commerce'],
            },
            bio: { type: 'string', example: 'Experienced backend software developer.' },
            message: { type: 'string', example: 'Looking forward to joining the hub.' },
            cvFileId: { type: 'string', example: 'file_ckz12345' },
            directoryOptIn: { type: 'boolean', default: false },
            termsAccepted: { type: 'boolean', example: true },
          },
        },
        CheckDuplicateRequest: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email', example: 'john.doe@example.com' },
            mobile: { type: 'string', example: '+201012345678' },
            country: { type: 'string', example: 'Egypt' },
          },
        },
        UpdateMemberProfileRequest: {
          type: 'object',
          properties: {
            fullNameEn: { type: 'string', example: 'John Doe' },
            fullNameAr: { type: 'string', example: 'جون دو' },
            phone: { type: 'string', example: '+201012345678' },
            country: { type: 'string', example: 'Egypt' },
            city: { type: 'string', example: 'Cairo' },
            yearsOfExperience: {
              type: 'string',
              enum: ['<2', '2-5', '6-10', '11-15', '>15'],
              example: '6-10',
            },
            areasOfExpertise: {
              type: 'array',
              items: { type: 'string' },
              example: ['Backend', 'Node.js'],
            },
            industriesServed: {
              type: 'array',
              items: { type: 'string' },
              example: ['FinTech', 'E-commerce'],
            },
            languages: {
              type: 'array',
              items: { type: 'string' },
              example: ['Arabic', 'English'],
            },
            bioEn: { type: 'string', example: 'Experienced senior engineer.' },
            bioAr: { type: 'string', example: 'مهندس برمجيات ذو خبرة.' },
            linkedinUrl: { type: 'string', example: 'https://linkedin.com/in/johndoe' },
            directoryOptIn: { type: 'boolean', default: false },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'john.doe@example.com' },
            password: { type: 'string', format: 'password', example: 'Secret123!' },
          },
        },
        ActivateAccountRequest: {
          type: 'object',
          required: ['token', 'password', 'confirmPassword'],
          properties: {
            token: { type: 'string', example: 'act_token_123456' },
            password: { type: 'string', format: 'password', example: 'Secret123!' },
            confirmPassword: { type: 'string', format: 'password', example: 'Secret123!' },
          },
        },
        ResendActivationRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email', example: 'john.doe@example.com' },
          },
        },
        ForgotPasswordRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email', example: 'john.doe@example.com' },
          },
        },
        ResetPasswordRequest: {
          type: 'object',
          required: ['token', 'newPassword', 'confirmPassword'],
          properties: {
            token: { type: 'string', example: 'reset_token_123456' },
            newPassword: { type: 'string', format: 'password', example: 'NewSecret123!' },
            confirmPassword: { type: 'string', format: 'password', example: 'NewSecret123!' },
          },
        },
        ChangePasswordRequest: {
          type: 'object',
          required: ['currentPassword', 'newPassword', 'confirmPassword'],
          properties: {
            currentPassword: { type: 'string', format: 'password', example: 'Secret123!' },
            newPassword: { type: 'string', format: 'password', example: 'NewSecret123!' },
            confirmPassword: { type: 'string', format: 'password', example: 'NewSecret123!' },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          summary: 'Health Check',
          description: 'Returns status and uptime of the API server.',
          tags: ['Health'],
          responses: {
            '200': {
              description: 'Server is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      timestamp: { type: 'string', format: 'date-time' },
                      uptime: { type: 'number', example: 123.45 },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/members/register': {
        post: {
          summary: 'Register New Member',
          description: 'Submits a registration application for joining the hub.',
          tags: ['Members'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RegisterMemberRequest' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Registration successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'success' },
                      message: {
                        type: 'string',
                        example: 'Registration application submitted successfully.',
                      },
                      data: {
                        type: 'object',
                        properties: {
                          memberId: { type: 'string', example: 'mem_12345' },
                          status: { type: 'string', example: 'PENDING' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Validation Error or duplicate entity',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/v1/members/check-duplicate': {
        post: {
          summary: 'Check Duplicate Contact Info',
          description: 'Pre-checks whether email or mobile number is already registered.',
          tags: ['Members'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CheckDuplicateRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Duplicate status checked',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'success' },
                      data: {
                        type: 'object',
                        properties: {
                          emailExists: { type: 'boolean', example: false },
                          mobileExists: { type: 'boolean', example: false },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/members/profile': {
        get: {
          summary: 'Get Current Member Profile',
          description:
            'Retrieves profile details and profile completion calculation for the authenticated member.',
          tags: ['Members'],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Profile retrieved successfully',
            },
            '401': {
              description: 'Unauthorized / invalid session',
            },
            '404': {
              description: 'Member profile not found',
            },
          },
        },
        patch: {
          summary: 'Update Current Member Profile',
          description:
            'Updates member profile details, recalculates completion score, and logs profile audit trail.',
          tags: ['Members'],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateMemberProfileRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Profile updated successfully',
            },
            '400': {
              description: 'Validation failed or read-only email attempted',
            },
            '401': {
              description: 'Unauthorized / invalid session',
            },
            '409': {
              description: 'Mobile number clash with another member',
            },
          },
        },
      },
      '/api/v1/auth/login': {
        post: {
          summary: 'Member Login',
          description: 'Authenticates member credentials and establishes a session.',
          tags: ['Auth'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Login successful',
            },
            '401': {
              description: 'Invalid credentials or account locked/inactive',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/v1/auth/me': {
        get: {
          summary: 'Get Current Profile',
          description: 'Retrieves profile information for the authenticated member.',
          tags: ['Auth'],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Current member profile',
            },
            '401': {
              description: 'Unauthorized access',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/v1/auth/sessions': {
        get: {
          summary: 'List Active Sessions',
          description: 'Lists active login sessions for the authenticated member.',
          tags: ['Auth'],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Active sessions retrieved',
            },
            '401': {
              description: 'Unauthorized',
            },
          },
        },
      },
      '/api/v1/auth/sessions/{sessionId}': {
        delete: {
          summary: 'Revoke Active Session',
          description: 'Terminates a specific login session by ID.',
          tags: ['Auth'],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'sessionId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'ID of the session to revoke',
            },
          ],
          responses: {
            '200': {
              description: 'Session revoked successfully',
            },
            '401': {
              description: 'Unauthorized',
            },
          },
        },
      },
      '/api/v1/auth/activate': {
        post: {
          summary: 'Activate Account',
          description: 'Activates member account and sets initial password.',
          tags: ['Auth'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ActivateAccountRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Account activated successfully',
            },
            '400': {
              description: 'Invalid token or weak password',
            },
          },
        },
      },
      '/api/v1/auth/resend-activation': {
        post: {
          summary: 'Resend Activation Email',
          description: 'Requests a new activation link if account is pending activation.',
          tags: ['Auth'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ResendActivationRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Activation email sent if account exists',
            },
          },
        },
      },
      '/api/v1/auth/forgot-password': {
        post: {
          summary: 'Forgot Password Request',
          description: 'Sends a password reset link to member email if registered.',
          tags: ['Auth'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ForgotPasswordRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Password reset link sent',
            },
          },
        },
      },
      '/api/v1/auth/reset-password': {
        post: {
          summary: 'Reset Password',
          description: 'Resets account password using a reset token.',
          tags: ['Auth'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ResetPasswordRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Password reset successfully',
            },
            '400': {
              description: 'Invalid or expired token',
            },
          },
        },
      },
      '/api/v1/auth/change-password': {
        post: {
          summary: 'Change Password',
          description: 'Changes password for authenticated member.',
          tags: ['Auth'],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChangePasswordRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Password updated successfully',
            },
            '401': {
              description: 'Unauthorized or incorrect current password',
            },
          },
        },
      },
      '/api/v1/auth/logout': {
        post: {
          summary: 'Logout Member',
          description: 'Clears active session cookies and revokes session.',
          tags: ['Auth'],
          responses: {
            '200': {
              description: 'Logged out successfully',
            },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
