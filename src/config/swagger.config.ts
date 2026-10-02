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
    tags: [
      { name: 'Health', description: 'System health & uptime diagnostics' },
      { name: 'Auth', description: 'Authentication, session management & password security' },
      { name: 'Members', description: 'Member registration, profile management & dashboards' },
      { name: 'Membership', description: 'Membership tiers & upgrade checkout' },
      { name: 'Files', description: 'Secure file upload & binary streaming' },
      { name: 'Directory', description: 'Public consultant & trainer directory search' },
      { name: 'Core Hub Services', description: '12 canonical hub service requests' },
      {
        name: 'Diagnostic Tools Shop',
        description: 'Diagnostic assessment instruments catalog & ordering',
      },
      {
        name: 'Member Requests & Tracking',
        description: 'Member engagement request workflows and tracking',
      },
      {
        name: 'Admin Requests',
        description: 'Staff operations, review, pricing approval & fulfillment',
      },
      { name: 'Notifications', description: 'In-app notification feed & status tracking' },
      {
        name: 'Transactions & Invoices',
        description: 'Financial ledger & itemized invoices for members',
      },
      { name: 'Admin Transactions', description: 'Staff accounting and ledger lookup' },
      {
        name: 'Community',
        description: 'Member community feed, announcements, comments & reactions',
      },
      {
        name: 'Admin Community',
        description: 'Staff community post creation, pinning, moderation & archive',
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
                benefits: {
                  type: 'object',
                  properties: {
                    assessmentAccess: {
                      type: 'object',
                      properties: {
                        type: {
                          type: 'string',
                          enum: [
                            'SPECIMEN_DEMO',
                            'SINGLE_COMPLIMENTARY',
                            'UNRESTRICTED_SUITE',
                            'RESTRICTED',
                          ],
                          example: 'SINGLE_COMPLIMENTARY',
                        },
                        description: { type: 'string' },
                        discountedRetakes: { type: 'boolean', example: true },
                        benchmarkReporting: { type: 'boolean', example: false },
                      },
                    },
                    directoryVisibility: {
                      type: 'object',
                      properties: {
                        badge: {
                          type: 'string',
                          enum: ['NONE', 'VERIFIED_PROFESSIONAL', 'MASTER'],
                          example: 'VERIFIED_PROFESSIONAL',
                        },
                        featuredListing: { type: 'boolean', example: false },
                        prioritySearchWeight: { type: 'integer', example: 2 },
                        listingType: {
                          type: 'string',
                          enum: ['NONE', 'BASIC', 'PRIORITY', 'FEATURED'],
                          example: 'PRIORITY',
                        },
                      },
                    },
                    discounts: {
                      type: 'object',
                      properties: {
                        platformDiscountPercentage: { type: 'integer', example: 30 },
                        conciergeReviewAssistance: { type: 'boolean', example: false },
                        allCoreHubServicesIncluded: { type: 'boolean', example: false },
                        description: { type: 'string' },
                      },
                    },
                    accreditationsAndCertificates: {
                      type: 'object',
                      properties: {
                        programmeAccreditationsIncluded: { type: 'integer', example: 1 },
                        freeTraineeCertificates: { type: 'integer', example: 20 },
                        quarterlyFreeTools: { type: 'integer', example: 0 },
                        description: { type: 'string' },
                      },
                    },
                  },
                },
                directoryEligibility: {
                  type: 'object',
                  properties: {
                    isEligible: { type: 'boolean', example: true },
                    reasons: { type: 'array', items: { type: 'string' } },
                    criteria: {
                      type: 'object',
                      properties: {
                        directoryOptIn: { type: 'boolean', example: true },
                        profileCompletionRate: { type: 'integer', example: 85 },
                        completionThreshold: { type: 'integer', example: 80 },
                        hasMetCompletionThreshold: { type: 'boolean', example: true },
                        membershipStatus: { type: 'string', nullable: true, example: 'ACTIVE' },
                        userStatus: { type: 'string', example: 'ACTIVE' },
                        isMembershipActive: { type: 'boolean', example: true },
                        isUserActive: { type: 'boolean', example: true },
                      },
                    },
                  },
                },
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
                  text: {
                    type: 'object',
                    properties: {
                      en: { type: 'string', example: 'Profile updated' },
                      ar: { type: 'string', example: 'تم تحديث الملف الشخصي' },
                    },
                  },
                  date: { type: 'string', format: 'date-time' },
                  tone: {
                    type: 'string',
                    enum: ['positive', 'neutral', 'info'],
                    example: 'info',
                  },
                },
              },
            },
          },
        },
        MemberProfileResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email', example: 'john.doe@example.com' },
            fullNameEn: { type: 'string', example: 'John Doe' },
            fullNameAr: { type: 'string', nullable: true, example: 'جون دو' },
            phone: { type: 'string', example: '+201012345678' },
            country: { type: 'string', example: 'Egypt' },
            city: { type: 'string', nullable: true, example: 'Cairo' },
            yearsOfExperience: { type: 'string', example: '6-10' },
            areasOfExpertise: { type: 'array', items: { type: 'string' } },
            industriesServed: { type: 'array', items: { type: 'string' } },
            languages: { type: 'array', items: { type: 'string' } },
            bioEn: { type: 'string', nullable: true },
            bioAr: { type: 'string', nullable: true },
            linkedinUrl: { type: 'string', nullable: true },
            photoFileId: { type: 'string', nullable: true },
            directoryOptIn: { type: 'boolean', example: false },
            profileCompletionRate: { type: 'integer', example: 85 },
            completionPercentage: { type: 'integer', example: 85 },
            missingFields: { type: 'array', items: { type: 'string' } },
            missingItems: { type: 'array', items: { type: 'string' } },
            membership: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                tier: {
                  type: 'string',
                  enum: ['ESSENTIAL', 'PROFESSIONAL', 'MASTER'],
                  example: 'ESSENTIAL',
                },
                status: {
                  type: 'string',
                  enum: ['ACTIVE', 'EXPIRED', 'SUSPENDED'],
                  example: 'ACTIVE',
                },
                startDate: { type: 'string', format: 'date-time' },
                endDate: { type: 'string', format: 'date-time', nullable: true },
              },
            },
            files: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  category: { type: 'string', example: 'CV' },
                  originalName: { type: 'string', example: 'resume.pdf' },
                  sizeBytes: { type: 'integer', example: 1048576 },
                  mimeType: { type: 'string', example: 'application/pdf' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
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
                outstandingUpgradeAttempt: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    targetTier: { type: 'string', example: 'PROFESSIONAL' },
                    state: { type: 'string', enum: ['declined', 'pending'], example: 'declined' },
                    transactionRef: { type: 'string', example: 'txn_123456789' },
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
        DeclinedUpgradeResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: {
              type: 'string',
              example:
                'Payment transaction was declined. Your active membership remains unchanged and unaffected.',
            },
            data: {
              type: 'object',
              properties: {
                paymentStatus: {
                  type: 'string',
                  enum: ['DECLINED'],
                  example: 'DECLINED',
                },
                transactionId: {
                  type: 'string',
                  example: 'txn_9f8c12a4-5678-4abc-def0-123456789abc',
                },
                failureReason: {
                  type: 'string',
                  example:
                    'Payment transaction was declined by the issuing bank (insufficient funds or fraud check).',
                },
                membership: {
                  type: 'object',
                  description:
                    'Unchanged membership reflecting the member previous active tier (BRU-67, MEM-52)',
                  properties: {
                    id: {
                      type: 'string',
                      format: 'uuid',
                      example: 'd3b07384-d113-4678-a6ba-0d862804ec6d',
                    },
                    tier: { type: 'string', example: 'ESSENTIAL' },
                    status: { type: 'string', example: 'ACTIVE' },
                    startDate: {
                      type: 'string',
                      format: 'date-time',
                      example: '2026-01-01T00:00:00.000Z',
                    },
                    endDate: {
                      type: 'string',
                      format: 'date-time',
                      example: '2027-01-01T00:00:00.000Z',
                    },
                    price: { type: 'number', example: 0.0 },
                  },
                },
                outstandingUpgradeAttempt: {
                  type: 'object',
                  description:
                    'Audit record of the declined upgrade attempt stored separately from membership (MEM-52c)',
                  properties: {
                    targetTier: { type: 'string', example: 'PROFESSIONAL' },
                    state: { type: 'string', example: 'declined' },
                    transactionRef: {
                      type: 'string',
                      example: 'txn_9f8c12a4-5678-4abc-def0-123456789abc',
                    },
                  },
                },
                message: {
                  type: 'string',
                  example:
                    'Payment transaction was declined. Your active membership remains unchanged and unaffected.',
                },
              },
            },
          },
        },
        MembershipTierCatalogItem: {
          type: 'object',
          properties: {
            tier: {
              type: 'string',
              enum: ['ESSENTIAL', 'PROFESSIONAL', 'MASTER'],
              example: 'PROFESSIONAL',
            },
            name: { type: 'string', example: 'Professional' },
            tagline: {
              type: 'string',
              example: 'The Hub working alongside your practice, at the member rate.',
            },
            annualFee: { type: 'number', example: 180.0 },
            currency: { type: 'string', example: 'USD' },
            discountRate: { type: 'integer', example: 30 },
            coreHubServicesIncluded: { type: 'boolean', example: false },
            accreditedProgrammes: { type: 'integer', example: 1 },
            freeTraineeCertificates: { type: 'integer', example: 20 },
            freeQuarterlyTools: { type: 'integer', example: 0 },
            trainerCertificationEligible: { type: 'boolean', example: false },
            coreHubServices: {
              type: 'array',
              items: { type: 'string' },
              example: [
                'Training Needs Analysis (TNA) Assistance',
                'Program Mapping & Learning Architecture',
              ],
            },
            isCurrentPlan: { type: 'boolean', example: false },
            canUpgrade: { type: 'boolean', example: true },
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
        PublicTrainerListItem: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'd3b07384-d113-46fb-97c3-30514a6012e5' },
            slug: { type: 'string', example: 'john-doe' },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            titleEn: { type: 'string', nullable: true, example: null },
            titleAr: { type: 'string', nullable: true, example: null },
            bioEn: {
              type: 'string',
              nullable: true,
              example: 'Experienced executive corporate trainer.',
            },
            bioAr: {
              type: 'string',
              nullable: true,
              example: 'مدرب تنفيذي معتمد للمؤسسات والشركات.',
            },
            photoUrl: {
              type: 'string',
              nullable: true,
              example: '/api/v1/files/file_photo_123/download',
            },
            country: { type: 'string', example: 'Egypt' },
            city: { type: 'string', nullable: true, example: 'Cairo' },
            areasOfExpertise: {
              type: 'array',
              items: { type: 'string' },
              example: ['Leadership Development', 'Strategic Negotiation'],
            },
            industriesServed: {
              type: 'array',
              items: { type: 'string' },
              example: ['Banking', 'Telecommunications'],
            },
            languages: {
              type: 'array',
              items: { type: 'string' },
              example: ['Arabic', 'English'],
            },
            tier: {
              type: 'string',
              enum: ['ESSENTIAL', 'PROFESSIONAL', 'MASTER'],
              example: 'MASTER',
            },
            badgeType: {
              type: 'string',
              enum: ['PRIORITY', 'FEATURED', 'STANDARD'],
              example: 'PRIORITY',
            },
          },
        },
        PublicTrainerProfile: {
          type: 'object',
          allOf: [
            { $ref: '#/components/schemas/PublicTrainerListItem' },
            {
              type: 'object',
              properties: {
                yearsOfExperience: { type: 'string', nullable: true, example: '6-10' },
                linkedinUrl: {
                  type: 'string',
                  nullable: true,
                  example: 'https://linkedin.com/in/johndoe',
                },
              },
            },
          ],
        },
        DirectorySearchResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                trainers: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/PublicTrainerListItem' },
                },
                total: { type: 'integer', example: 42 },
                page: { type: 'integer', example: 1 },
                totalPages: { type: 'integer', example: 4 },
              },
            },
          },
        },
        PublicTrainerProfileResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { $ref: '#/components/schemas/PublicTrainerProfile' },
          },
        },
        SubmitUnifiedRequest: {
          type: 'object',
          required: ['itemSlug', 'acknowledgement'],
          properties: {
            itemSlug: { type: 'string', example: 'pqp-assessment' },
            brief: {
              type: 'object',
              example: { clientName: 'Acme Corp', projectScope: 'Leadership Assessment' },
            },
            acknowledgement: { type: 'boolean', example: true },
            customRequirements: {
              type: 'string',
              example: 'Need assessment delivered in French.',
            },
          },
        },
        RespondInfoMemberRequest: {
          type: 'object',
          required: ['responseNotes'],
          properties: {
            responseNotes: {
              type: 'string',
              example: 'Updated project requirements attached.',
            },
            updatedBrief: {
              type: 'object',
              example: { attendeeCount: 25 },
            },
          },
        },
        PayMemberRequest: {
          type: 'object',
          properties: {
            paymentMethodId: { type: 'string', example: 'pm_card_visa' },
            gatewayToken: { type: 'string', example: 'tok_12345' },
            paymentReference: { type: 'string', example: 'PAY-GATEWAY-7890' },
          },
        },
        AdminRequestInfoInput: {
          type: 'object',
          required: ['reviewNotes'],
          properties: {
            reviewNotes: {
              type: 'string',
              minLength: 5,
              example: 'Please provide the target delivery date and audience size.',
            },
          },
        },
        AdminRejectRequestInput: {
          type: 'object',
          required: ['rejectionReason'],
          properties: {
            rejectionReason: {
              type: 'string',
              minLength: 5,
              example: 'Service requested is outside current geographic delivery scope.',
            },
          },
        },
        AdminApproveRequestInput: {
          type: 'object',
          properties: {
            baseAmount: {
              type: 'integer',
              description: 'Base price in minor currency units (cents)',
              example: 15000,
            },
            adminNotes: {
              type: 'string',
              example: 'Approved with standard professional tier discount.',
            },
          },
        },
        AdminFulfillRequestInput: {
          type: 'object',
          properties: {
            deliveryNotes: {
              type: 'string',
              example: 'Credentials generated and sent to member.',
            },
            customAccessUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://portal.ibdl.net/assessments/test-token',
            },
          },
        },
        AdminMarkPaidInput: {
          type: 'object',
          properties: {
            paymentRef: { type: 'string', example: 'BANK-TRANSFER-9988' },
            paymentReference: { type: 'string', example: 'BANK-TRANSFER-9988' },
            paidAmount: { type: 'integer', description: 'Amount in cents', example: 8500 },
            adminNotes: { type: 'string', example: 'Verified wire receipt from National Bank.' },
          },
        },
        NotificationItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            referenceCode: { type: 'string', example: 'REQ-2026-A8K2' },
            type: { type: 'string', example: 'REQUEST_UNDER_REVIEW' },
            titleEn: { type: 'string', example: 'Request Under Review' },
            titleAr: { type: 'string', example: 'الطلب قيد المراجعة' },
            messageEn: { type: 'string', example: 'Your request is under review.' },
            messageAr: { type: 'string', example: 'طلبك قيد المراجعة حالياً.' },
            link: { type: 'string', nullable: true },
            isRead: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        TransactionItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            invoiceNumber: { type: 'string', example: 'INV-2026-00001' },
            userId: { type: 'string' },
            sourceType: {
              type: 'string',
              enum: ['REQUEST', 'SHOP_ORDER', 'SUBSCRIPTION'],
              example: 'REQUEST',
            },
            sourceId: { type: 'string', example: 'req_uuid_123' },
            amountCents: { type: 'integer', example: 8500 },
            currency: { type: 'string', example: 'USD' },
            status: {
              type: 'string',
              enum: ['PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED'],
              example: 'CONFIRMED',
            },
            paymentReference: { type: 'string', example: 'TXN-BANK-998822' },
            paidAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AddPostCommentInput: {
          type: 'object',
          required: ['content'],
          properties: {
            content: {
              type: 'string',
              minLength: 1,
              maxLength: 1000,
              example: 'This is a very insightful announcement. Thank you!',
            },
          },
        },
        TogglePostReactionInput: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['LIKE', 'CELEBRATE', 'SUPPORT', 'INSIGHTFUL'],
              default: 'LIKE',
              example: 'LIKE',
            },
          },
        },
        AdminCreatePostInput: {
          type: 'object',
          required: ['title', 'content'],
          properties: {
            title: {
              type: 'string',
              minLength: 3,
              maxLength: 200,
              example: 'Important Update: New Freelancer Benefits Released',
            },
            content: {
              type: 'string',
              minLength: 1,
              maxLength: 50000,
              example: 'We are thrilled to announce new benefits for all IBDL members...',
            },
            category: {
              type: 'string',
              enum: ['ANNOUNCEMENT', 'OPPORTUNITY', 'GENERAL', 'EVENT'],
              default: 'ANNOUNCEMENT',
              example: 'ANNOUNCEMENT',
            },
            status: {
              type: 'string',
              enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
              default: 'PUBLISHED',
              example: 'PUBLISHED',
            },
            isPinned: {
              type: 'boolean',
              default: false,
              example: true,
            },
            attachments: {
              type: 'array',
              items: {
                type: 'object',
                required: ['name', 'url'],
                properties: {
                  name: { type: 'string', example: 'benefits_guide.pdf' },
                  url: {
                    type: 'string',
                    format: 'uri',
                    example: 'https://files.ibdl.net/docs/guide.pdf',
                  },
                  size: { type: 'integer', example: 102400 },
                  type: { type: 'string', example: 'application/pdf' },
                },
              },
            },
          },
        },
        AdminUpdatePostInput: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 3, maxLength: 200 },
            content: { type: 'string', minLength: 1, maxLength: 50000 },
            category: {
              type: 'string',
              enum: ['ANNOUNCEMENT', 'OPPORTUNITY', 'GENERAL', 'EVENT'],
            },
            status: {
              type: 'string',
              enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
            },
            isPinned: { type: 'boolean' },
            attachments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  url: { type: 'string', format: 'uri' },
                  size: { type: 'integer' },
                  type: { type: 'string' },
                },
              },
            },
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
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/MemberProfileResponse' },
                    },
                  },
                },
              },
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
      '/api/v1/memberships/tiers': {
        get: {
          summary: 'List Membership Tiers Catalog',
          description:
            'Retrieves canonical tier metadata, pricing, discounts, and benefits for comparison (SCR-68) and upgrade flows (SCR-70). Returns session-aware flags (isCurrentPlan, canUpgrade) if authenticated.',
          tags: ['Membership'],
          responses: {
            '200': {
              description: 'Membership tiers catalog retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/MembershipTierCatalogItem' },
                      },
                    },
                  },
                },
              },
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
              description:
                'Payment transaction was declined by the issuer (BRU-67, MEM-52, PAY-05, MEM-14)',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DeclinedUpgradeResponse' },
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
        delete: {
          summary: 'Delete Profile Photo',
          description:
            'Permanently removes current profile photo for the authenticated member, superseding active storage records.',
          tags: ['Files'],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Profile photo removed successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Profile photo removed successfully' },
                    },
                  },
                },
              },
            },
            '401': { description: 'Unauthorized' },
            '404': { description: 'Member profile not found' },
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
        delete: {
          summary: 'Revoke All Other Sessions',
          description:
            'Terminates all active login sessions for the authenticated member except the current one.',
          tags: ['Auth'],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Other sessions revoked successfully',
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
      '/api/v1/auth/password': {
        patch: {
          summary: 'Change Password (RESTful)',
          description:
            'Updates password for authenticated member, strictly enforcing password history policy (cannot reuse current or last 3 passwords).',
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
            '400': {
              description: 'Validation failed or candidate password reuses recent passwords',
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
      '/api/v1/directory': {
        get: {
          summary: 'Search and Filter Public Trainer Directory',
          description:
            'Public endpoint returning eligible accredited trainers with tier-based placement precedence (PRO-33 to PRO-38, DIR-01 to DIR-18). Evaluates strict 100% profile completion and omits private data.',
          tags: ['Directory'],
          parameters: [
            {
              name: 'search',
              in: 'query',
              description: 'Text search matching name or biography',
              required: false,
              schema: { type: 'string' },
            },
            {
              name: 'expertise',
              in: 'query',
              description: 'Filter by area of expertise',
              required: false,
              schema: { type: 'string' },
            },
            {
              name: 'industry',
              in: 'query',
              description: 'Filter by industry served',
              required: false,
              schema: { type: 'string' },
            },
            {
              name: 'country',
              in: 'query',
              description: 'Filter by country',
              required: false,
              schema: { type: 'string' },
            },
            {
              name: 'city',
              in: 'query',
              description: 'Filter by city',
              required: false,
              schema: { type: 'string' },
            },
            {
              name: 'tier',
              in: 'query',
              description: 'Filter by membership tier',
              required: false,
              schema: {
                type: 'string',
                enum: ['ESSENTIAL', 'PROFESSIONAL', 'MASTER'],
              },
            },
            {
              name: 'page',
              in: 'query',
              description: 'Page number for pagination',
              required: false,
              schema: { type: 'integer', default: 1 },
            },
            {
              name: 'limit',
              in: 'query',
              description: 'Page size limit',
              required: false,
              schema: { type: 'integer', default: 12 },
            },
          ],
          responses: {
            '200': {
              description: 'Public trainer directory search results',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DirectorySearchResponse' },
                },
              },
            },
            '400': {
              description: 'Invalid filter query parameters',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/v1/directory/{slug}': {
        get: {
          summary: 'Get Public Trainer Profile by Slug or ID',
          description:
            'Public endpoint returning detailed public trainer profile if eligible under PRO-34. Strictly omits email, phone, and internal documents.',
          tags: ['Directory'],
          parameters: [
            {
              name: 'slug',
              in: 'path',
              description: 'Public URL-safe slug or ID of the trainer',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Public trainer profile',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/PublicTrainerProfileResponse' },
                },
              },
            },
            '404': {
              description: 'Trainer profile not found or ineligible',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/v1/services': {
        get: {
          tags: ['Core Hub Services'],
          summary: 'List 12 Canonical Core Hub Services',
          description:
            'Retrieves the 12 Core Hub Services with server-calculated tier discounts (MEM-13) and Master complimentary inclusion.',
          responses: {
            '200': {
              description: 'Catalog of 12 Core Hub Services',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            slug: { type: 'string', example: 'training-needs-analysis' },
                            nameEn: {
                              type: 'string',
                              example: 'Training Needs Analysis (TNA) Assistance',
                            },
                            basePrice: { type: 'number', example: 150.0 },
                            discountPercentage: { type: 'number', example: 15.0 },
                            finalPrice: { type: 'number', example: 127.5 },
                            isIncludedWithPlan: { type: 'boolean', example: false },
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
      },
      '/api/v1/services/{slug}/request': {
        post: {
          tags: ['Core Hub Services'],
          summary: 'Request a Core Hub Service',
          description:
            'Submits a request for a Core Hub Service. Master tier members receive 100% discount with immediate IN_REVIEW status.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'slug',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    customRequirements: { type: 'string' },
                    intakeData: { type: 'object' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Service request created successfully',
            },
            '401': {
              description: 'Authentication required',
            },
            '404': {
              description: 'Service slug not found',
            },
          },
        },
      },
      '/api/v1/shop/items': {
        get: {
          tags: ['Diagnostic Tools Shop'],
          summary: 'List Unified Shop Catalog Items',
          description:
            'Retrieves active catalog items (diagnostic assessment instruments, core hub services, simulations) with tier discounts and availability status.',
          parameters: [
            {
              name: 'kind',
              in: 'query',
              description: 'Filter by item category type',
              schema: {
                type: 'string',
                enum: ['tool', 'service'],
              },
            },
            {
              name: 'search',
              in: 'query',
              description: 'Search by item title or description in English or Arabic',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'List of shop catalog items',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            slug: { type: 'string', example: 'pqp-assessment' },
                            category: { type: 'string', example: 'DIAGNOSTIC_TOOL' },
                            nameEn: {
                              type: 'string',
                              example: 'PQP™ Professional Quality Profile',
                            },
                            nameAr: { type: 'string' },
                            descriptionEn: { type: 'string' },
                            descriptionAr: { type: 'string' },
                            pricingModel: { type: 'string', example: 'FIXED' },
                            priceMinor: { type: 'integer', example: 10000 },
                            formattedPrice: { type: 'string', example: '$100.00' },
                            tierDiscountPercentage: { type: 'integer', example: 15 },
                            isEligibleMasterQuarterly: { type: 'boolean', example: false },
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
      },
      '/api/v1/shop/tools': {
        get: {
          tags: ['Diagnostic Tools Shop'],
          summary: 'List Diagnostic Assessment Instruments',
          description:
            'Retrieves the 3 Diagnostic Assessment Instruments (PQP™, CPAT™, Management Drives®) with tier discounts and Master quarterly entitlement availability.',
          responses: {
            '200': {
              description: 'Catalog of 3 Diagnostic Tools',
            },
          },
        },
      },
      '/api/v1/shop/tools/{slug}/order': {
        post: {
          tags: ['Diagnostic Tools Shop'],
          summary: 'Order a Diagnostic Assessment Instrument',
          description:
            'Orders a diagnostic assessment instrument. Enforces 1 usage per contractual quarter for Master members (MEM-14, MEM-16, MEM-76), falling back to 40% discount.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'slug',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    customRequirements: { type: 'string' },
                    intakeData: {
                      type: 'object',
                      properties: {
                        targetOrganization: { type: 'string' },
                        participantCount: { type: 'integer' },
                        assessmentEmail: { type: 'string', format: 'email' },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Diagnostic tool order created successfully',
            },
            '401': {
              description: 'Authentication required',
            },
            '404': {
              description: 'Tool slug not found',
            },
          },
        },
      },
      '/api/v1/members/requests': {
        get: {
          tags: ['Member Requests & Tracking'],
          summary: 'List Authenticated Member Requests',
          description:
            'Returns paginated list of engagement requests for the authenticated member adhering to MEM-78f (no silent disappearance).',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: [
                  'PENDING_PAYMENT',
                  'IN_REVIEW',
                  'IN_PROGRESS',
                  'COMPLETED',
                  'CANCELLED',
                  'REJECTED',
                ],
              },
            },
            {
              name: 'category',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['CORE_SERVICE', 'DIAGNOSTIC_TOOL'],
              },
            },
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', default: 1 },
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 20 },
            },
          ],
          responses: {
            '200': {
              description: 'Paginated list of member requests',
            },
            '401': {
              description: 'Authentication required',
            },
          },
        },
      },
      '/api/v1/members/requests/{referenceCode}': {
        get: {
          tags: ['Member Requests & Tracking'],
          summary: 'Get Member Request Details',
          description:
            'Retrieves details for a specific request by referenceCode with strict tenant isolation (MEM-78).',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'referenceCode',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'REQ-2026-A8K2' },
            },
          ],
          responses: {
            '200': {
              description: 'Engagement request details',
            },
            '401': {
              description: 'Authentication required',
            },
            '404': {
              description: 'Request not found or unauthorized access',
            },
          },
        },
      },
      '/api/v1/members/requests/{referenceCode}/cancel': {
        post: {
          tags: ['Member Requests & Tracking'],
          summary: 'Cancel Member Engagement Request',
          description:
            'Cancels a PENDING_PAYMENT or IN_REVIEW engagement request with audit trail (MEM-78f).',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'referenceCode',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'REQ-2026-A8K2' },
            },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    reason: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Request cancelled successfully',
            },
            '422': {
              description: 'Cannot cancel request in terminal state',
            },
          },
        },
      },
      '/api/v1/members/requests/{referenceCode}/respond-info': {
        post: {
          tags: ['Member Requests & Tracking'],
          summary: 'Respond to Information Request (Member Subroute)',
          description:
            'Submits member response notes and optional updated brief for a request in AWAITING_RESPONSE status.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'referenceCode',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'REQ-2026-A8K2' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RespondInfoMemberRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Response submitted successfully' },
            '400': { description: 'Validation failed' },
            '401': { description: 'Authentication required' },
            '422': { description: 'Invalid state for response' },
          },
        },
      },
      '/api/v1/members/requests/{referenceCode}/pay': {
        post: {
          tags: ['Member Requests & Tracking'],
          summary: 'Pay for Member Request (Member Subroute)',
          description:
            'Initiates payment for an approved request in AWAITING_PAYMENT status and generates invoice.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'referenceCode',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'REQ-2026-A8K2' },
            },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PayMemberRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Payment recorded and confirmed' },
            '400': { description: 'Validation error' },
            '401': { description: 'Authentication required' },
            '422': { description: 'Request not in AWAITING_PAYMENT state' },
          },
        },
      },
      '/api/v1/requests': {
        post: {
          tags: ['Member Requests & Tracking'],
          summary: 'Submit Unified Engagement Request',
          description:
            'Submits a unified engagement request for a diagnostic tool or core hub service with brief data and mandatory acknowledgement (REQ-14, SEC-33).',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SubmitUnifiedRequest' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Engagement request submitted successfully',
            },
            '400': {
              description: 'Validation error or brief exceeds 50KB limit',
            },
            '401': {
              description: 'Authentication required',
            },
            '404': {
              description: 'Catalog item slug not found',
            },
            '409': {
              description: 'Active open request already exists for this item',
            },
            '429': {
              description: 'Rate limit exceeded',
            },
          },
        },
        get: {
          tags: ['Member Requests & Tracking'],
          summary: 'List Member Engagement Requests',
          description:
            'Returns paginated list of engagement requests for the authenticated member adhering to MEM-78f.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: [
                  'PENDING_PAYMENT',
                  'SUBMITTED',
                  'UNDER_REVIEW',
                  'AWAITING_RESPONSE',
                  'AWAITING_PAYMENT',
                  'PAYMENT_CONFIRMED',
                  'FULFILLED',
                  'CANCELLED',
                  'REJECTED',
                ],
              },
            },
            {
              name: 'category',
              in: 'query',
              schema: {
                type: 'string',
                enum: [
                  'CORE_SERVICE',
                  'DIAGNOSTIC_TOOL',
                  'BUSINESS_SIMULATION',
                  'PROFESSIONAL_RECOGNITION',
                ],
              },
            },
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', default: 1 },
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 20 },
            },
          ],
          responses: {
            '200': {
              description: 'Paginated list of member requests',
            },
            '401': {
              description: 'Authentication required',
            },
          },
        },
      },
      '/api/v1/requests/{id}': {
        get: {
          tags: ['Member Requests & Tracking'],
          summary: 'Get Member Request Details',
          description:
            'Retrieves details for a specific request by ID or reference code with tenant isolation (MEM-78).',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Internal request UUID or referenceCode (e.g. REQ-2026-A8K2)',
              schema: { type: 'string', example: 'REQ-2026-A8K2' },
            },
          ],
          responses: {
            '200': {
              description: 'Engagement request details',
            },
            '401': {
              description: 'Authentication required',
            },
            '404': {
              description: 'Request not found or unauthorized access',
            },
          },
        },
      },
      '/api/v1/requests/{id}/cancel': {
        post: {
          tags: ['Member Requests & Tracking'],
          summary: 'Cancel Member Engagement Request',
          description:
            'Cancels a PENDING_PAYMENT, SUBMITTED, or UNDER_REVIEW engagement request with audit trail (MEM-78f).',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'REQ-2026-A8K2' },
            },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    reason: { type: 'string', example: 'No longer needed' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Request cancelled successfully',
            },
            '401': {
              description: 'Authentication required',
            },
            '422': {
              description: 'Cannot cancel request in terminal state',
            },
          },
        },
      },
      '/api/v1/requests/{id}/respond-info': {
        post: {
          tags: ['Member Requests & Tracking'],
          summary: 'Respond to Information Request',
          description:
            'Provides additional details and optional updated brief when request is in AWAITING_RESPONSE state.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'REQ-2026-A8K2' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RespondInfoMemberRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Information submitted and request returned to review',
            },
            '400': {
              description: 'Validation failed',
            },
            '401': {
              description: 'Authentication required',
            },
            '422': {
              description: 'Request is not awaiting member response',
            },
          },
        },
      },
      '/api/v1/requests/{id}/pay': {
        post: {
          tags: ['Member Requests & Tracking'],
          summary: 'Pay for Approved Request',
          description:
            'Processes payment for a request in AWAITING_PAYMENT state and transitions to PAYMENT_CONFIRMED.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'REQ-2026-A8K2' },
            },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PayMemberRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Payment successful, invoice generated',
            },
            '400': {
              description: 'Validation error',
            },
            '401': {
              description: 'Authentication required',
            },
            '422': {
              description: 'Request is not in AWAITING_PAYMENT status',
            },
          },
        },
      },
      '/api/v1/admin/requests': {
        get: {
          tags: ['Admin Requests'],
          summary: 'List and Search All Requests (Staff)',
          description:
            'Lists and searches engagement requests across all members with filters. Restricted to OPERATIONS_OFFICER, FINANCE_OFFICER, SYSTEM_ADMINISTRATOR.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: [
                  'PENDING_PAYMENT',
                  'SUBMITTED',
                  'UNDER_REVIEW',
                  'AWAITING_RESPONSE',
                  'AWAITING_PAYMENT',
                  'PAYMENT_CONFIRMED',
                  'FULFILLED',
                  'CANCELLED',
                  'REJECTED',
                ],
              },
            },
            {
              name: 'category',
              in: 'query',
              schema: {
                type: 'string',
                enum: [
                  'CORE_SERVICE',
                  'DIAGNOSTIC_TOOL',
                  'BUSINESS_SIMULATION',
                  'PROFESSIONAL_RECOGNITION',
                ],
              },
            },
            {
              name: 'memberId',
              in: 'query',
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'search',
              in: 'query',
              schema: { type: 'string' },
            },
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', default: 1 },
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 20 },
            },
          ],
          responses: {
            '200': {
              description: 'List of engagement requests',
            },
            '401': {
              description: 'Authentication required',
            },
            '403': {
              description: 'Forbidden: staff role required',
            },
          },
        },
      },
      '/api/v1/admin/requests/{id}': {
        get: {
          tags: ['Admin Requests'],
          summary: 'Get Detailed Request Context (Staff)',
          description:
            'Retrieves full request details, member context, audit history, and credentials. Restricted to OPERATIONS_OFFICER, FINANCE_OFFICER, SYSTEM_ADMINISTRATOR.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'REQ-2026-A8K2' },
            },
          ],
          responses: {
            '200': {
              description: 'Detailed engagement request context',
            },
            '401': {
              description: 'Authentication required',
            },
            '403': {
              description: 'Forbidden: staff role required',
            },
            '404': {
              description: 'Request not found',
            },
          },
        },
      },
      '/api/v1/admin/requests/{id}/start-review': {
        post: {
          tags: ['Admin Requests'],
          summary: 'Start Review on Request (Staff)',
          description:
            'Transitions request from SUBMITTED to UNDER_REVIEW with staff audit log. Restricted to OPERATIONS_OFFICER, SYSTEM_ADMINISTRATOR.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'REQ-2026-A8K2' },
            },
          ],
          responses: {
            '200': {
              description: 'Request moved to UNDER_REVIEW',
            },
            '401': {
              description: 'Authentication required',
            },
            '403': {
              description: 'Forbidden',
            },
            '409': {
              description: 'Optimistic locking conflict (request was updated concurrently)',
            },
            '422': {
              description: 'Invalid state transition',
            },
          },
        },
      },
      '/api/v1/admin/requests/{id}/request-info': {
        post: {
          tags: ['Admin Requests'],
          summary: 'Request Info from Member (Staff)',
          description:
            'Transitions request to AWAITING_RESPONSE with mandatory review notes. Restricted to OPERATIONS_OFFICER, SYSTEM_ADMINISTRATOR.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'REQ-2026-A8K2' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminRequestInfoInput' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Request moved to AWAITING_RESPONSE',
            },
            '400': {
              description: 'Validation failed (reviewNotes min 5 characters)',
            },
            '401': {
              description: 'Authentication required',
            },
            '403': {
              description: 'Forbidden',
            },
            '422': {
              description: 'Invalid state transition',
            },
          },
        },
      },
      '/api/v1/admin/requests/{id}/reject': {
        post: {
          tags: ['Admin Requests'],
          summary: 'Reject Request (Staff)',
          description:
            'Transitions request to REJECTED with mandatory rejection reason. Restricted to OPERATIONS_OFFICER, SYSTEM_ADMINISTRATOR.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'REQ-2026-A8K2' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminRejectRequestInput' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Request rejected',
            },
            '400': {
              description: 'Validation failed (rejectionReason min 5 characters)',
            },
            '401': {
              description: 'Authentication required',
            },
            '403': {
              description: 'Forbidden',
            },
            '422': {
              description: 'Invalid state transition',
            },
          },
        },
      },
      '/api/v1/admin/requests/{id}/approve': {
        post: {
          tags: ['Admin Requests'],
          summary: 'Approve Request & Calculate Pricing (Staff)',
          description:
            'Approves request, recalculating price with tier discount. Transitions to AWAITING_PAYMENT or PAYMENT_CONFIRMED if $0. Restricted to OPERATIONS_OFFICER, SYSTEM_ADMINISTRATOR.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'REQ-2026-A8K2' },
            },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminApproveRequestInput' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Request approved',
            },
            '401': {
              description: 'Authentication required',
            },
            '403': {
              description: 'Forbidden',
            },
            '422': {
              description: 'Invalid state transition',
            },
          },
        },
      },
      '/api/v1/admin/requests/{id}/fulfill': {
        post: {
          tags: ['Admin Requests'],
          summary: 'Fulfill Request & Assign Credentials (Staff)',
          description:
            'Transitions request from PAYMENT_CONFIRMED to FULFILLED, automatically assigning credential pool items if diagnostic tool. Restricted to OPERATIONS_OFFICER, SYSTEM_ADMINISTRATOR.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'REQ-2026-A8K2' },
            },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminFulfillRequestInput' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Request fulfilled',
            },
            '401': {
              description: 'Authentication required',
            },
            '403': {
              description: 'Forbidden',
            },
            '422': {
              description: 'Request not in PAYMENT_CONFIRMED state',
            },
          },
        },
      },
      '/api/v1/admin/requests/{id}/mark-paid': {
        post: {
          tags: ['Admin Requests'],
          summary: 'Mark Request as Paid Offline (Finance Staff)',
          description:
            'Idempotent recording of offline/bank payment by FINANCE_OFFICER or SYSTEM_ADMINISTRATOR. Generates financial transaction and invoice.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'REQ-2026-A8K2' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminMarkPaidInput' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Payment marked as confirmed and invoice generated',
            },
            '400': {
              description: 'Validation failed: paymentRef is required',
            },
            '401': {
              description: 'Authentication required',
            },
            '403': {
              description: 'Forbidden: finance staff role required',
            },
            '422': {
              description: 'Invalid state for marking paid',
            },
          },
        },
      },
      '/api/v1/notifications': {
        get: {
          tags: ['Notifications'],
          summary: 'Get In-App Notifications Feed',
          description: 'Returns in-app notifications and unreadCount for the authenticated user.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Notifications list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/NotificationItem' },
                      },
                      unreadCount: { type: 'integer', example: 2 },
                    },
                  },
                },
              },
            },
            '401': {
              description: 'Authentication required',
            },
          },
        },
      },
      '/api/v1/notifications/read-all': {
        patch: {
          tags: ['Notifications'],
          summary: 'Mark All Notifications as Read',
          description: 'Marks all in-app notifications for the authenticated user as read.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          responses: {
            '200': {
              description: 'All notifications marked as read',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'All notifications marked as read.' },
                    },
                  },
                },
              },
            },
            '401': {
              description: 'Authentication required',
            },
          },
        },
      },
      '/api/v1/notifications/{id}/read': {
        patch: {
          tags: ['Notifications'],
          summary: 'Mark Single Notification as Read',
          description: 'Marks a specific notification as read by notification UUID.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '200': {
              description: 'Notification marked as read',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Notification marked as read.' },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Invalid notification UUID',
            },
            '401': {
              description: 'Authentication required',
            },
            '404': {
              description: 'Notification not found',
            },
          },
        },
      },
      '/api/v1/transactions': {
        get: {
          tags: ['Transactions & Invoices'],
          summary: 'List Member Transactions',
          description:
            'Returns cursor-paginated financial transactions, invoice numbers, and payment status for the authenticated member.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'cursor',
              in: 'query',
              schema: { type: 'string' },
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 20 },
            },
            {
              name: 'sourceType',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['REQUEST', 'SHOP_ORDER', 'SUBSCRIPTION'],
              },
            },
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED'],
              },
            },
          ],
          responses: {
            '200': {
              description: 'Transactions list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/TransactionItem' },
                      },
                      pagination: {
                        type: 'object',
                        properties: {
                          nextCursor: { type: 'string', nullable: true },
                          total: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': {
              description: 'Authentication required',
            },
            '403': {
              description: 'Only members can access member transactions',
            },
          },
        },
      },
      '/api/v1/transactions/{invoiceNumber}': {
        get: {
          tags: ['Transactions & Invoices'],
          summary: 'Get Member Invoice Details',
          description:
            'Retrieves invoice metadata, billing breakdown, and receipt details for the authenticated member.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'invoiceNumber',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'INV-2026-00001' },
            },
          ],
          responses: {
            '200': {
              description: 'Invoice details',
            },
            '400': {
              description: 'Invalid invoice number format',
            },
            '401': {
              description: 'Authentication required',
            },
            '403': {
              description: 'Forbidden',
            },
            '404': {
              description: 'Invoice not found',
            },
          },
        },
      },
      '/api/v1/admin/transactions': {
        get: {
          tags: ['Admin Transactions'],
          summary: 'List Ledger Transactions (Staff)',
          description:
            'Staff ledger query across all transactions with filtering. Restricted to FINANCE_OFFICER, SYSTEM_ADMINISTRATOR.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'cursor',
              in: 'query',
              schema: { type: 'string' },
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 20 },
            },
            {
              name: 'userId',
              in: 'query',
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'sourceType',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['REQUEST', 'SHOP_ORDER', 'SUBSCRIPTION'],
              },
            },
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED'],
              },
            },
          ],
          responses: {
            '200': {
              description: 'Ledger transactions',
            },
            '401': {
              description: 'Authentication required',
            },
            '403': {
              description: 'Forbidden: finance staff role required',
            },
          },
        },
      },
      '/api/v1/admin/transactions/{invoiceNumber}': {
        get: {
          tags: ['Admin Transactions'],
          summary: 'Get Invoice Lookup (Staff)',
          description:
            'Retrieves invoice and member financial record by invoice number. Restricted to FINANCE_OFFICER, SYSTEM_ADMINISTRATOR.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'invoiceNumber',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'INV-2026-00001' },
            },
          ],
          responses: {
            '200': {
              description: 'Invoice details',
            },
            '400': {
              description: 'Invalid invoice number format',
            },
            '401': {
              description: 'Authentication required',
            },
            '403': {
              description: 'Forbidden: finance staff role required',
            },
            '404': {
              description: 'Invoice not found',
            },
          },
        },
      },
      '/api/v1/community/posts': {
        get: {
          tags: ['Community'],
          summary: 'List Community Posts',
          description:
            'Retrieves published community announcements, opportunities, events, and general posts with pagination, search, and reaction counts.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'category',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['ANNOUNCEMENT', 'OPPORTUNITY', 'GENERAL', 'EVENT'],
              },
            },
            {
              name: 'search',
              in: 'query',
              schema: { type: 'string' },
            },
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', default: 1 },
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 10 },
            },
          ],
          responses: {
            '200': {
              description: 'List of community posts',
            },
            '401': {
              description: 'Authentication required',
            },
          },
        },
      },
      '/api/v1/community/posts/{id}': {
        get: {
          tags: ['Community'],
          summary: 'Get Community Post Details',
          description: 'Retrieves a single community post with all active comments and reactions.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '200': {
              description: 'Post details with comments',
            },
            '400': {
              description: 'Invalid post ID format',
            },
            '401': {
              description: 'Authentication required',
            },
            '404': {
              description: 'Post not found',
            },
          },
        },
      },
      '/api/v1/community/posts/{id}/comments': {
        post: {
          tags: ['Community'],
          summary: 'Add Comment to Post',
          description: 'Adds a member comment to a published community post.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AddPostCommentInput' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Comment added successfully',
            },
            '400': {
              description: 'Validation failed: comment content required',
            },
            '401': {
              description: 'Authentication required',
            },
            '404': {
              description: 'Post not found',
            },
          },
        },
      },
      '/api/v1/community/posts/{id}/react': {
        post: {
          tags: ['Community'],
          summary: 'Toggle Post Reaction',
          description:
            'Toggles a member reaction (LIKE, CELEBRATE, SUPPORT, INSIGHTFUL) on a community post.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TogglePostReactionInput' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Reaction toggled successfully',
            },
            '400': {
              description: 'Invalid reaction type',
            },
            '401': {
              description: 'Authentication required',
            },
            '404': {
              description: 'Post not found',
            },
          },
        },
      },
      '/api/v1/admin/community/posts': {
        post: {
          tags: ['Admin Community'],
          summary: 'Create Community Post (Staff)',
          description:
            'Creates a community announcement, opportunity, or event with attachments. Restricted to COMMUNITY_MODERATOR or SYSTEM_ADMINISTRATOR.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminCreatePostInput' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Post created successfully',
            },
            '400': {
              description: 'Validation failed: title and content required',
            },
            '401': {
              description: 'Authentication required',
            },
            '403': {
              description: 'Forbidden: staff role required',
            },
          },
        },
      },
      '/api/v1/admin/community/posts/{id}': {
        patch: {
          tags: ['Admin Community'],
          summary: 'Update Community Post (Staff)',
          description:
            'Updates post details, pinning status, or status. Restricted to COMMUNITY_MODERATOR or SYSTEM_ADMINISTRATOR.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminUpdatePostInput' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Post updated successfully',
            },
            '400': {
              description: 'Validation failed',
            },
            '401': {
              description: 'Authentication required',
            },
            '403': {
              description: 'Forbidden: staff role required',
            },
            '404': {
              description: 'Post not found',
            },
          },
        },
        delete: {
          tags: ['Admin Community'],
          summary: 'Delete or Archive Post (Staff)',
          description:
            'Soft-archives (default) or hard-deletes (hard=true) a post. Restricted to COMMUNITY_MODERATOR or SYSTEM_ADMINISTRATOR.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'hard',
              in: 'query',
              description: 'Set to true to hard-delete post instead of archiving',
              schema: { type: 'boolean', default: false },
            },
          ],
          responses: {
            '200': {
              description: 'Post archived or deleted successfully',
            },
            '400': {
              description: 'Invalid post ID',
            },
            '401': {
              description: 'Authentication required',
            },
            '403': {
              description: 'Forbidden: staff role required',
            },
            '404': {
              description: 'Post not found',
            },
          },
        },
      },
      '/api/v1/admin/community/comments/{commentId}': {
        delete: {
          tags: ['Admin Community'],
          summary: 'Moderate / Delete Comment (Staff)',
          description:
            'Moderates / soft-deletes an inappropriate comment. Restricted to COMMUNITY_MODERATOR or SYSTEM_ADMINISTRATOR.',
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: 'commentId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '200': {
              description: 'Comment moderated successfully',
            },
            '400': {
              description: 'Invalid comment ID',
            },
            '401': {
              description: 'Authentication required',
            },
            '403': {
              description: 'Forbidden: staff role required',
            },
            '404': {
              description: 'Comment not found',
            },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
