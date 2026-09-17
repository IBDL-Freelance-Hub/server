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
        MemberDashboardResponse: {
          type: 'object',
          properties: {
            member: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                fullNameEn: { type: 'string', example: 'John Doe' },
                fullNameAr: { type: 'string', nullable: true, example: 'جون دو' },
                email: { type: 'string', format: 'email', example: 'john.doe@example.com' },
                city: { type: 'string', nullable: true, example: 'Cairo' },
                country: { type: 'string', example: 'Egypt' },
                profileCompletionRate: { type: 'integer', example: 82 },
                photoUrl: {
                  type: 'string',
                  nullable: true,
                  example: '/api/v1/files/uuid-123/download',
                },
              },
            },
            membership: {
              type: 'object',
              properties: {
                tier: {
                  type: 'string',
                  enum: ['ESSENTIAL', 'PROFESSIONAL', 'MASTER'],
                  example: 'PROFESSIONAL',
                },
                status: {
                  type: 'string',
                  enum: ['ACTIVE', 'EXPIRED', 'SUSPENDED'],
                  example: 'ACTIVE',
                },
                startDate: { type: 'string', format: 'date-time' },
                renewsOn: { type: 'string', format: 'date-time', nullable: true },
                daysUntilRenewal: { type: 'integer', example: 180 },
              },
            },
            entitlements: {
              type: 'object',
              properties: {
                tier: { type: 'string', example: 'PROFESSIONAL' },
                tierName: { type: 'string', example: 'Professional' },
                status: { type: 'string', example: 'ACTIVE' },
                isActive: { type: 'boolean', example: true },
                benefits: { type: 'object' },
                directoryEligibility: { type: 'object' },
              },
            },
            profileProgress: {
              type: 'object',
              properties: {
                completionPercentage: { type: 'integer', example: 82 },
                missingFields: { type: 'array', items: { type: 'string' } },
              },
            },
            recentActivity: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  action: { type: 'string', example: 'MEMBER_REGISTERED' },
                  resource: { type: 'string', example: 'Member' },
                  resourceId: { type: 'string', nullable: true },
                  reason: { type: 'string', nullable: true },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        UpgradeMembershipRequest: {
          type: 'object',
          required: ['targetTier'],
          properties: {
            targetTier: {
              type: 'string',
              enum: ['PROFESSIONAL', 'MASTER'],
              example: 'PROFESSIONAL',
            },
            paymentMethodToken: {
              type: 'string',
              example: 'mock-token-success',
            },
            simulationOutcome: {
              type: 'string',
              enum: ['SUCCESS', 'FAIL', 'PENDING'],
              example: 'SUCCESS',
            },
          },
        },
        UpgradeMembershipResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                paymentStatus: {
                  type: 'string',
                  enum: ['SUCCESSFUL', 'PENDING', 'DECLINED'],
                  example: 'SUCCESSFUL',
                },
                transactionId: { type: 'string', example: 'txn_123456789' },
                failureReason: { type: 'string', nullable: true },
                membership: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    tier: { type: 'string', example: 'PROFESSIONAL' },
                    status: { type: 'string', example: 'ACTIVE' },
                    startDate: { type: 'string', format: 'date-time' },
                    endDate: { type: 'string', format: 'date-time' },
                    price: { type: 'number', example: 180.0 },
                  },
                },
                message: {
                  type: 'string',
                  example: 'Successfully upgraded to PROFESSIONAL membership.',
                },
              },
            },
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
      '/api/v1/members/dashboard': {
        get: {
          summary: 'Get Member Dashboard',
          description:
            'Aggregates member profile data, membership tier, server-side entitlements, live profile progress, and recent audit activity feed (SEC-33, MEM-01 to MEM-12, PRO-13, PRO-14).',
          tags: ['Members'],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Member dashboard aggregated data retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/MemberDashboardResponse' },
                    },
                  },
                },
              },
            },
            '401': {
              description: 'Unauthorized / invalid session',
            },
            '404': {
              description: 'Member record not found',
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
      '/api/v1/memberships/upgrade': {
        post: {
          summary: 'Upgrade Membership Tier via Sandbox Payment Simulator',
          description:
            'Upgrades an active member to a higher tier with simulated payment processing (MEM-07 to MEM-18, PAY-01 to PAY-12, SEC-33). Pricing is strictly computed server-side.',
          tags: ['Membership'],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpgradeMembershipRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Membership upgraded or payment pending',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/UpgradeMembershipResponse' },
                },
              },
            },
            '400': {
              description: 'Validation failed or invalid upgrade hierarchy (downgrade / same tier)',
            },
            '401': {
              description: 'Unauthorized / invalid session',
            },
            '402': {
              description: 'Payment transaction was declined by the issuer (PAY-05, MEM-14)',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/UpgradeMembershipResponse' },
                },
              },
            },
            '404': {
              description: 'Member profile not found',
            },
          },
        },
      },
      '/api/v1/files/cv': {
        post: {
          summary: 'Upload Curriculum Vitae (CV)',
          description:
            'Uploads a member CV document (PDF, DOC, DOCX up to 25MB) with magic byte verification.',
          tags: ['Files'],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: { type: 'string', format: 'binary' },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'CV uploaded successfully' },
            '400': { description: 'Invalid file format or size exceeded' },
            '401': { description: 'Unauthorized' },
          },
        },
      },
      '/api/v1/files/photo': {
        post: {
          summary: 'Upload Profile Photo',
          description:
            'Uploads a member profile photo (JPEG, PNG, WebP up to 5MB) with magic byte verification.',
          tags: ['Files'],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: { type: 'string', format: 'binary' },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Profile photo uploaded successfully' },
            '400': { description: 'Invalid image format or size exceeded' },
            '401': { description: 'Unauthorized' },
          },
        },
      },
      '/api/v1/files/{fileId}/download': {
        get: {
          summary: 'Download Stored File',
          description:
            'Securely downloads or streams a file. Zero-trust check returns 404 if not owned by member.',
          tags: ['Files'],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'fileId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': { description: 'File binary stream' },
            '401': { description: 'Unauthorized' },
            '404': { description: 'File not found' },
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
