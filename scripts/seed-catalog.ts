import { PrismaClient, CatalogItemCategory, PricingModel } from '@prisma/client';

const prisma = new PrismaClient();

export const INITIAL_CATALOG_ITEMS = [
  // ==========================================
  // SECTION 1: 12 CORE HUB SERVICES (BRU-93, MKT-114)
  // ==========================================
  // 3 IN_HUB ('Go to it', non-requestable)
  {
    slug: 'professional-profile-visibility',
    category: CatalogItemCategory.CORE_SERVICE,
    pricingModel: PricingModel.IN_HUB,
    nameEn: 'Professional Profile, Visibility & Opportunity Showcase',
    nameAr: 'الملف المهني وإبراز الخبرات والفرص',
    descriptionEn: 'Make trainer expertise easier for the market to discover.',
    descriptionAr: 'تسهيل اكتشاف وصول الخبرات التدريبية لسوق العمل والشركات.',
    basePrice: 0,
    currency: 'USD',
    percentageRate: null,
    metadata: { deliveryModel: 'IN_HUB', requestable: false, unit: 'in-hub access' },
  },
  {
    slug: 'accreditation-professional-recognition-pathway',
    category: CatalogItemCategory.CORE_SERVICE,
    pricingModel: PricingModel.IN_HUB,
    nameEn: 'Accreditation & Professional Recognition Pathway',
    nameAr: 'مسار الاعتماد والاعتراف المهني',
    descriptionEn: 'Strengthen market credibility through recognized standards.',
    descriptionAr: 'تعزيز المصداقية في السوق عبر معايير اعتماد معترف بها.',
    basePrice: 0,
    currency: 'USD',
    percentageRate: null,
    metadata: { deliveryModel: 'IN_HUB', requestable: false, unit: 'in-hub access' },
  },
  {
    slug: 'continuous-professional-development',
    category: CatalogItemCategory.CORE_SERVICE,
    pricingModel: PricingModel.IN_HUB,
    nameEn: 'Continuous Professional Development & Market Insights',
    nameAr: 'التطوير المهني المستمر ورؤى السوق',
    descriptionEn: 'Keep trainer capability relevant to a changing GCC learning market.',
    descriptionAr: 'مواكبة متغيرات واحتياجات سوق التدريب في الخليج باستمرار.',
    basePrice: 0,
    currency: 'USD',
    percentageRate: null,
    metadata: { deliveryModel: 'IN_HUB', requestable: false, unit: 'in-hub access' },
  },

  // 6 Project-Based (PERCENTAGE 5% of client project value)
  {
    slug: 'tna-assistance',
    category: CatalogItemCategory.CORE_SERVICE,
    pricingModel: PricingModel.PERCENTAGE,
    nameEn: 'Training Needs Analysis (TNA) Assistance',
    nameAr: 'تحليل الاحتياجات التدريبية (TNA)',
    descriptionEn: 'Turn a client request into a defensible learning need.',
    descriptionAr: 'تحويل طلب العميل الأولي إلى احتياج تدريبي دقيق ومثبت.',
    basePrice: 0,
    currency: 'USD',
    percentageRate: 5.0,
    metadata: {
      deliveryModel: 'PERCENTAGE',
      percentageRate: 5.0,
      durationDays: 7,
      unit: '5% of client project value',
    },
  },
  {
    slug: 'program-mapping',
    category: CatalogItemCategory.CORE_SERVICE,
    pricingModel: PricingModel.PERCENTAGE,
    nameEn: 'Program Mapping & Learning Architecture',
    nameAr: 'هيكلة البرامج والمسارات التدريبية',
    descriptionEn: 'Convert identified needs into a coherent learning journey.',
    descriptionAr: 'تحويل الاحتياجات المحددة إلى مسار تعليمي متكامل ومترابط.',
    basePrice: 0,
    currency: 'USD',
    percentageRate: 5.0,
    metadata: {
      deliveryModel: 'PERCENTAGE',
      percentageRate: 5.0,
      durationDays: 5,
      unit: '5% of client project value',
    },
  },
  {
    slug: 'proposal-building',
    category: CatalogItemCategory.CORE_SERVICE,
    pricingModel: PricingModel.PERCENTAGE,
    nameEn: 'Proposal Building & Commercial Solution Support',
    nameAr: 'إعداد المقترحات والعروض الفنية والمالية',
    descriptionEn: 'Transform expertise into a client-ready proposal.',
    descriptionAr: 'تحويل خبرتك إلى عرض فني وتجاري جاهز للتقديم للعملاء.',
    basePrice: 0,
    currency: 'USD',
    percentageRate: 5.0,
    metadata: {
      deliveryModel: 'PERCENTAGE',
      percentageRate: 5.0,
      durationDays: 3,
      unit: '5% of client project value',
    },
  },
  {
    slug: 'content-design',
    category: CatalogItemCategory.CORE_SERVICE,
    pricingModel: PricingModel.PERCENTAGE,
    nameEn: 'Content Design & Development',
    nameAr: 'تصميم وتطوير المحتوى التدريبي',
    descriptionEn:
      'Build learning content that is instructionally sound and professionally structured.',
    descriptionAr: 'بناء محتوى تدريبي متين تعليمياً ومصمم باحترافية عالية.',
    basePrice: 0,
    currency: 'USD',
    percentageRate: 5.0,
    metadata: {
      deliveryModel: 'PERCENTAGE',
      percentageRate: 5.0,
      durationDays: 10,
      unit: '5% of client project value',
    },
  },
  {
    slug: 'training-mode-strategy-selection',
    category: CatalogItemCategory.CORE_SERVICE,
    pricingModel: PricingModel.PERCENTAGE,
    nameEn: 'Training Mode & Strategy Selection',
    nameAr: 'اختيار نمط واستراتيجية التدريب',
    descriptionEn:
      'Choose the right blend of delivery modes to maximize learning and commercial impact.',
    descriptionAr: 'اختيار المزيج الأمثل من أنماط التدريب لتحقيق أعلى أثر تدريبي وتجاري.',
    basePrice: 0,
    currency: 'USD',
    percentageRate: 5.0,
    metadata: {
      deliveryModel: 'PERCENTAGE',
      percentageRate: 5.0,
      durationDays: 3,
      unit: '5% of client project value',
    },
  },
  {
    slug: 'training-roi-toolkit',
    category: CatalogItemCategory.CORE_SERVICE,
    pricingModel: PricingModel.PERCENTAGE,
    nameEn: 'Training ROI & Impact Measurement Toolkit',
    nameAr: 'قياس الأثر وعائد الاستثمار التدريبي',
    descriptionEn: 'Show clients what changed because of the training.',
    descriptionAr: 'إثبات التغيير والقيمة المضافة التي أحدثها التدريب للعميل.',
    basePrice: 0,
    currency: 'USD',
    percentageRate: 5.0,
    metadata: {
      deliveryModel: 'PERCENTAGE',
      percentageRate: 5.0,
      durationDays: 5,
      unit: '5% of client project value',
    },
  },

  // 1 Included or Quoted
  {
    slug: 'trainer-help-desk-expert-support',
    category: CatalogItemCategory.CORE_SERVICE,
    pricingModel: PricingModel.INCLUDED_OR_QUOTED,
    nameEn: 'Trainer Help Desk & Expert Support',
    nameAr: 'مكتب مساندة المدرب والدعم الاستشاري',
    descriptionEn: 'Get practical support when an opportunity or delivery challenge arises.',
    descriptionAr: 'مساندة عملية فورية عند ظهور تحديات تدريبية أو فرص جديدة.',
    basePrice: 0,
    currency: 'USD',
    percentageRate: null,
    metadata: {
      deliveryModel: 'INCLUDED_OR_QUOTED',
      durationDays: 1,
      unit: 'included with plan or custom quote',
    },
  },

  // 2 Quoted (Services 09 & 11 from catalogData.ts / servicesData.ts)
  {
    slug: 'business-networking-collaboration',
    category: CatalogItemCategory.CORE_SERVICE,
    pricingModel: PricingModel.QUOTED,
    nameEn: 'Business Networking & Collaboration',
    nameAr: 'التواصل والتعاون المهني بين المدربين',
    descriptionEn:
      'Connect with peers, build delivery partnerships, and pursue larger opportunities together.',
    descriptionAr: 'بناء الشراكات والتواصل مع الزملاء للمنافسة على الفرص التدريبية الكبرى معاً.',
    basePrice: 0,
    currency: 'USD',
    percentageRate: null,
    metadata: { deliveryModel: 'QUOTED', unit: 'custom quote' },
  },
  {
    slug: 'templates-tools-resource-library',
    category: CatalogItemCategory.CORE_SERVICE,
    pricingModel: PricingModel.QUOTED,
    nameEn: 'Templates, Tools & Resource Library',
    nameAr: 'مكتبة النماذج والأدوات والمصادر',
    descriptionEn: 'Stop rebuilding essential documents from scratch.',
    descriptionAr: 'توفير وقتك ونماذج العمل الجاهزة دون الحاجة للبدء من الصفر.',
    basePrice: 0,
    currency: 'USD',
    percentageRate: null,
    metadata: { deliveryModel: 'QUOTED', unit: 'custom quote' },
  },

  // ==========================================
  // SECTION 2: PROFESSIONAL RECOGNITION SERVICES
  // ==========================================
  {
    slug: 'trainer-accreditation',
    category: CatalogItemCategory.PROFESSIONAL_RECOGNITION,
    pricingModel: PricingModel.FIXED,
    nameEn: 'Trainer Accreditation',
    nameAr: 'اعتماد المدرب المهني',
    descriptionEn:
      'Comprehensive assessment and professional credentialing as an IBDL Certified Trainer.',
    descriptionAr: 'تقييم شامل واعتماد مهني دولي كمدرب معتمد من IBDL.',
    basePrice: 25000, // $250.00 stored in integer minor units (cents)
    currency: 'USD',
    percentageRate: null,
    metadata: { unit: 'one-time credential' },
  },
  {
    slug: 'content-accreditation',
    category: CatalogItemCategory.PROFESSIONAL_RECOGNITION,
    pricingModel: PricingModel.FIXED,
    nameEn: 'Content Accreditation',
    nameAr: 'اعتماد المحتوى والحقائب التدريبية',
    descriptionEn:
      'Peer review and formal accreditation of training packages, courseware, and curricular materials.',
    descriptionAr: 'مراجعة نظراء واعتماد رسمي للحقائب التدريبية والمناهج التعليمية.',
    basePrice: 35000, // $350.00 stored in integer minor units (cents)
    currency: 'USD',
    percentageRate: null,
    metadata: {
      unit: 'per training package',
      requiresTrainerAccreditation: true,
      prerequisiteSlug: 'trainer-accreditation',
    },
  },
  {
    slug: 'learner-certificate',
    category: CatalogItemCategory.PROFESSIONAL_RECOGNITION,
    pricingModel: PricingModel.FIXED,
    nameEn: 'Learner Certificate',
    nameAr: 'شهادة إتمام معتمدة للمتدرب',
    descriptionEn: 'Verifiable digital certification issued for successful course completion.',
    descriptionAr: 'إصدار شهادات إتمام رقمية معتمدة وقابلة للتحقق للمتدربين.',
    basePrice: 3000, // $30.00 stored in integer minor units (cents)
    currency: 'USD',
    percentageRate: null,
    metadata: { unit: 'per certificate issued' },
  },

  // ==========================================
  // SECTION 3: 5 BUSINESS SIMULATION GAMES (category: BUSINESS_SIMULATION)
  // Approved Pricing: 15 USD per trainee per event (1500 cents)
  // ==========================================
  {
    slug: 'win-vs-war',
    category: CatalogItemCategory.BUSINESS_SIMULATION,
    pricingModel: PricingModel.FIXED,
    nameEn: 'Win vs. War',
    nameAr: 'Win vs. War',
    descriptionEn:
      'Full-day business leadership and strategy war-game simulation for up to 60 participants, including trainers, simulation, report, evaluation, and certificates.',
    descriptionAr:
      'لعبة محاكاة الأعمال لمدة يوم لعدد يصل الى 60 شخص يتضمن المدربين واللعبة والتقرير والتقييم والشهادات',
    basePrice: 1500, // $15.00 stored in integer cents
    currency: 'USD',
    percentageRate: null,
    metadata: {
      unit: '15 USD per trainee per event',
      focusAr: 'لعبة محاكاة للقيادة والإستراتيجية',
      capacity: 60,
    },
  },
  {
    slug: 'master-board-game',
    category: CatalogItemCategory.BUSINESS_SIMULATION,
    pricingModel: PricingModel.FIXED,
    nameEn: 'Master Board Game',
    nameAr: 'Master Board Game',
    descriptionEn:
      'Full-day strategic planning and decision-making business simulation for up to 60 participants, including trainers, simulation, report, evaluation, and certificates.',
    descriptionAr:
      'لعبة محاكاة الأعمال لمدة يوم لعدد يصل الى 60 شخص يتضمن المدربين واللعبة والتقرير والتقييم والشهادات',
    basePrice: 1500, // $15.00 stored in integer cents
    currency: 'USD',
    percentageRate: null,
    metadata: {
      unit: '15 USD per trainee per event',
      focusAr: 'لعبة محاكاة للتخطيط الاستراتيجي واتخاذ القرارت',
      capacity: 60,
    },
  },
  {
    slug: 'sparta',
    category: CatalogItemCategory.BUSINESS_SIMULATION,
    pricingModel: PricingModel.FIXED,
    nameEn: 'Sparta',
    nameAr: 'Sparta',
    descriptionEn:
      'Full-day coaching and leadership simulation for up to 60 participants, including trainers, simulation, report, evaluation, and certificates.',
    descriptionAr:
      'لعبة محاكاة الأعمال لمدة يوم لعدد يصل الى 60 شخص يتضمن المدربين واللعبة والتقرير والتقييم والشهادات',
    basePrice: 1500, // $15.00 stored in integer cents
    currency: 'USD',
    percentageRate: null,
    metadata: {
      unit: '15 USD per trainee per event',
      focusAr: 'لعبة محاكاة للكوتشنج والقيادة',
      capacity: 60,
    },
  },
  {
    slug: 'target-hunter',
    category: CatalogItemCategory.BUSINESS_SIMULATION,
    pricingModel: PricingModel.FIXED,
    nameEn: 'Target Hunter',
    nameAr: 'Target Hunter',
    descriptionEn:
      'Full-day sales planning business simulation for up to 60 participants, including trainers, simulation, report, evaluation, and certificates.',
    descriptionAr:
      'لعبة محاكاة الأعمال لمدة يوم لعدد يصل الى 60 شخص يتضمن المدربين واللعبة والتقرير والتقييم والشهادات',
    basePrice: 1500, // $15.00 stored in integer cents
    currency: 'USD',
    percentageRate: null,
    metadata: {
      unit: '15 USD per trainee per event',
      focusAr: 'لعبة محاكاة لتخطيط المبيعات',
      capacity: 60,
    },
  },
  {
    slug: 'synergystack',
    category: CatalogItemCategory.BUSINESS_SIMULATION,
    pricingModel: PricingModel.FIXED,
    nameEn: 'Synergy Stack',
    nameAr: 'Synergy Stack',
    descriptionEn:
      'Online business simulation for up to 20 participants, optimizing teamwork, accelerating performance, and reducing stress, with dashboard tracking.',
    descriptionAr:
      'لعبة محاكاة الأعمال online لعدد يصل الى 20 شخص يتضمن المدربين واللعبة والتقرير والتقييم والشهادات ومتابعة على لوحة التحكم',
    basePrice: 1500, // $15.00 stored in integer cents
    currency: 'USD',
    percentageRate: null,
    metadata: {
      unit: '15 USD per trainee per event',
      focusAr: 'لعبة تطوير الفريق الأمثل وتسريع أداء الفريق، وتقليل التوتر، والعمل معًا أفضل',
      capacity: 20,
    },
  },
  {
    slug: 'micromatic',
    category: CatalogItemCategory.BUSINESS_SIMULATION,
    pricingModel: PricingModel.FIXED,
    nameEn: 'Micromatic',
    nameAr: 'Micromatic',
    descriptionEn:
      'Business simulation game for up to 60 participants, including trainers, simulation, report, evaluation, and certificates.',
    descriptionAr:
      'لعبة محاكاة الأعمال لعدد يصل الى 60 شخص يتضمن المدربين واللعبة والتقرير والتقييم والشهادات',
    basePrice: 1500, // $15.00 stored in integer cents
    currency: 'USD',
    percentageRate: null,
    metadata: {
      unit: '15 USD per trainee per event',
      focusAr: 'لعبة محاكاة للأعمال',
      capacity: 60,
    },
  },
  {
    slug: 'mogul-ceo',
    category: CatalogItemCategory.BUSINESS_SIMULATION,
    pricingModel: PricingModel.FIXED,
    nameEn: 'Mogul CEO',
    nameAr: 'Mogul CEO',
    descriptionEn:
      'Business simulation game for up to 60 participants, including trainers, simulation, report, evaluation, and certificates.',
    descriptionAr:
      'لعبة محاكاة الأعمال لعدد يصل الى 60 شخص يتضمن المدربين واللعبة والتقرير والتقييم والشهادات',
    basePrice: 1500, // $15.00 stored in integer cents
    currency: 'USD',
    percentageRate: null,
    metadata: {
      unit: '15 USD per trainee per event',
      focusAr: 'لعبة محاكاة لإدارة الشركات',
      capacity: 60,
    },
  },
  {
    slug: 'maven',
    category: CatalogItemCategory.BUSINESS_SIMULATION,
    pricingModel: PricingModel.FIXED,
    nameEn: 'Maven',
    nameAr: 'Maven',
    descriptionEn:
      'Business simulation game for up to 60 participants, including trainers, simulation, report, evaluation, and certificates.',
    descriptionAr:
      'لعبة محاكاة الأعمال لعدد يصل الى 60 شخص يتضمن المدربين واللعبة والتقرير والتقييم والشهادات',
    basePrice: 1500, // $15.00 stored in integer cents
    currency: 'USD',
    percentageRate: null,
    metadata: {
      unit: '15 USD per trainee per event',
      focusAr: 'لعبة محاكاة استراتيجية',
      capacity: 60,
    },
  },

  // ==========================================
  // SECTION 4: 3 DIAGNOSTIC TOOLS (9 PACKAGES, category: DIAGNOSTIC_TOOL, pricingModel: FREE_THEN_PAID)
  // ==========================================
  // PQP™ - Personality & Qualities Portfolio (Level 1: 4000, Level 2: 7000, Level 3: 16000 cents)
  {
    slug: 'pqp',
    category: CatalogItemCategory.DIAGNOSTIC_TOOL,
    pricingModel: PricingModel.FREE_THEN_PAID,
    packageLevel: 'LEVEL_1',
    nameEn: 'PQP™ - Personality & Qualities Portfolio - Level 1',
    nameAr: 'PQP™ - محفظة الشخصية والصفات القيادية - المستوى الأول',
    descriptionEn: 'L1 assessment process and individual report, for 20-100 candidates.',
    descriptionAr: 'عملية تقييم وتقرير فردي من المستوى الأول، لـ 20-100 مرشح.',
    basePrice: 4000, // $40.00 in cents
    currency: 'USD',
    percentageRate: null,
    metadata: {
      instrument: 'PQP',
      level: 'LEVEL_1',
      credits: 1,
      unit: 'per candidate report / package level',
    },
  },
  {
    slug: 'pqp-level-2',
    category: CatalogItemCategory.DIAGNOSTIC_TOOL,
    pricingModel: PricingModel.FREE_THEN_PAID,
    packageLevel: 'LEVEL_2',
    nameEn: 'PQP™ - Personality & Qualities Portfolio - Level 2',
    nameAr: 'PQP™ - محفظة الشخصية والصفات القيادية - المستوى الثاني',
    descriptionEn: 'L2 adds a 45-minute online report-interpretation session with an IBDL expert.',
    descriptionAr:
      'يضيف المستوى الثاني جلسة عبر الإنترنت مدتها 45 دقيقة لتفسير التقرير مع خبير IBDL.',
    basePrice: 7000, // $70.00 in cents
    currency: 'USD',
    percentageRate: null,
    metadata: {
      instrument: 'PQP',
      level: 'LEVEL_2',
      credits: 2,
      unit: 'per candidate report / package level',
    },
  },
  {
    slug: 'pqp-level-3',
    category: CatalogItemCategory.DIAGNOSTIC_TOOL,
    pricingModel: PricingModel.FREE_THEN_PAID,
    packageLevel: 'LEVEL_3',
    nameEn: 'PQP™ - Personality & Qualities Portfolio - Level 3',
    nameAr: 'PQP™ - محفظة الشخصية والصفات القيادية - المستوى الثالث',
    descriptionEn:
      'L3 adds report interpretation and four 60-minute online one-to-one coaching sessions to build an individual development plan.',
    descriptionAr:
      'يضيف المستوى الثالث تفسير التقرير وأربع جلسات توجيه فردية عبر الإنترنت مدة كل منها 60 دقيقة لبناء خطة تطوير فردية.',
    basePrice: 16000, // $160.00 in cents
    currency: 'USD',
    percentageRate: null,
    metadata: {
      instrument: 'PQP',
      level: 'LEVEL_3',
      credits: 5,
      unit: 'per candidate report / package level',
    },
  },

  // CPAT™ - Change Profile & Adaptability Tool (Level 1: 4000, Level 2: 7000, Level 3: 16000 cents)
  {
    slug: 'cpat',
    category: CatalogItemCategory.DIAGNOSTIC_TOOL,
    pricingModel: PricingModel.FREE_THEN_PAID,
    packageLevel: 'LEVEL_1',
    nameEn: 'CPAT™ - Change Profile & Adaptability Tool - Level 1',
    nameAr: 'CPAT™ - أداة تشخيص التكيّف والتغيير - المستوى الأول',
    descriptionEn: 'L1 assessment process and individual report, for 20-100 candidates.',
    descriptionAr: 'عملية تقييم وتقرير فردي من المستوى الأول، لـ 20-100 مرشح.',
    basePrice: 4000, // $40.00 in cents
    currency: 'USD',
    percentageRate: null,
    metadata: {
      instrument: 'CPAT',
      level: 'LEVEL_1',
      credits: 1,
      unit: 'per candidate report / package level',
    },
  },
  {
    slug: 'cpat-level-2',
    category: CatalogItemCategory.DIAGNOSTIC_TOOL,
    pricingModel: PricingModel.FREE_THEN_PAID,
    packageLevel: 'LEVEL_2',
    nameEn: 'CPAT™ - Change Profile & Adaptability Tool - Level 2',
    nameAr: 'CPAT™ - أداة تشخيص التكيّف والتغيير - المستوى الثاني',
    descriptionEn: 'L2 adds a 45-minute online report-interpretation session with an IBDL expert.',
    descriptionAr:
      'يضيف المستوى الثاني جلسة عبر الإنترنت مدتها 45 دقيقة لتفسير التقرير مع خبير IBDL.',
    basePrice: 7000, // $70.00 in cents
    currency: 'USD',
    percentageRate: null,
    metadata: {
      instrument: 'CPAT',
      level: 'LEVEL_2',
      credits: 2,
      unit: 'per candidate report / package level',
    },
  },
  {
    slug: 'cpat-level-3',
    category: CatalogItemCategory.DIAGNOSTIC_TOOL,
    pricingModel: PricingModel.FREE_THEN_PAID,
    packageLevel: 'LEVEL_3',
    nameEn: 'CPAT™ - Change Profile & Adaptability Tool - Level 3',
    nameAr: 'CPAT™ - أداة تشخيص التكيّف والتغيير - المستوى الثالث',
    descriptionEn:
      'L3 adds report interpretation and four 60-minute online one-to-one coaching sessions to build an individual development plan.',
    descriptionAr:
      'يضيف المستوى الثالث تفسير التقرير وأربع جلسات توجيه فردية عبر الإنترنت مدة كل منها 60 دقيقة لبناء خطة تطوير فردية.',
    basePrice: 16000, // $160.00 in cents
    currency: 'USD',
    percentageRate: null,
    metadata: {
      instrument: 'CPAT',
      level: 'LEVEL_3',
      credits: 5,
      unit: 'per candidate report / package level',
    },
  },

  // Management Drives® (Level 1: 15000, Level 2: 20000, Level 3: 40000 cents)
  {
    slug: 'management-drives',
    category: CatalogItemCategory.DIAGNOSTIC_TOOL,
    pricingModel: PricingModel.FREE_THEN_PAID,
    packageLevel: 'LEVEL_1',
    nameEn: 'Management Drives® - Level 1',
    nameAr: 'Management Drives® - المستوى الأول',
    descriptionEn: 'L1 assessment process and individual report, for 20-100 candidates.',
    descriptionAr: 'عملية تقييم وتقرير فردي من المستوى الأول، لـ 20-100 مرشح.',
    basePrice: 15000, // $150.00 in cents
    currency: 'USD',
    percentageRate: null,
    metadata: {
      instrument: 'MANAGEMENT_DRIVES',
      level: 'LEVEL_1',
      credits: 1,
      unit: 'per candidate profile / package level',
    },
  },
  {
    slug: 'management-drives-level-2',
    category: CatalogItemCategory.DIAGNOSTIC_TOOL,
    pricingModel: PricingModel.FREE_THEN_PAID,
    packageLevel: 'LEVEL_2',
    nameEn: 'Management Drives® - Level 2',
    nameAr: 'Management Drives® - المستوى الثاني',
    descriptionEn: 'L2 adds a 45-minute online report-interpretation session with an IBDL expert.',
    descriptionAr:
      'يضيف المستوى الثاني جلسة عبر الإنترنت مدتها 45 دقيقة لتفسير التقرير مع خبير IBDL.',
    basePrice: 20000, // $200.00 in cents
    currency: 'USD',
    percentageRate: null,
    metadata: {
      instrument: 'MANAGEMENT_DRIVES',
      level: 'LEVEL_2',
      credits: 2,
      unit: 'per candidate profile / package level',
    },
  },
  {
    slug: 'management-drives-level-3',
    category: CatalogItemCategory.DIAGNOSTIC_TOOL,
    pricingModel: PricingModel.FREE_THEN_PAID,
    packageLevel: 'LEVEL_3',
    nameEn: 'Management Drives® - Level 3',
    nameAr: 'Management Drives® - المستوى الثالث',
    descriptionEn:
      'L3 adds report interpretation and four 60-minute online one-to-one coaching sessions to build an individual development plan.',
    descriptionAr:
      'يضيف المستوى الثالث تفسير التقرير وأربع جلسات توجيه فردية عبر الإنترنت مدة كل منها 60 دقيقة لبناء خطة تطوير فردية.',
    basePrice: 40000, // $400.00 in cents
    currency: 'USD',
    percentageRate: null,
    metadata: {
      instrument: 'MANAGEMENT_DRIVES',
      level: 'LEVEL_3',
      credits: 5,
      unit: 'per candidate profile / package level',
    },
  },
];

export async function seedCatalog() {
  console.log('Seeding unified catalog items...');

  const activeSlugs = new Set(INITIAL_CATALOG_ITEMS.map((item) => item.slug));

  // Deactivate or remove items that are no longer part of the approved catalog
  const existingItems = await prisma.catalogItem.findMany({ select: { id: true, slug: true } });
  for (const existing of existingItems) {
    if (!activeSlugs.has(existing.slug)) {
      const requestCount = await prisma.engagementRequest.count({
        where: { catalogItemId: existing.id },
      });
      if (requestCount === 0) {
        await prisma.catalogItem.delete({ where: { id: existing.id } });
        console.log(`Deleted obsolete item with no requests: ${existing.slug}`);
      } else {
        await prisma.catalogItem.update({
          where: { id: existing.id },
          data: { isActive: false },
        });
        console.log(`Deactivated obsolete item with existing requests: ${existing.slug}`);
      }
    }
  }

  // Upsert all approved catalog items
  for (const item of INITIAL_CATALOG_ITEMS) {
    await prisma.catalogItem.upsert({
      where: { slug: item.slug },
      update: {
        category: item.category,
        pricingModel: item.pricingModel,
        packageLevel: (item as { packageLevel?: string }).packageLevel || null,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        descriptionEn: item.descriptionEn,
        descriptionAr: item.descriptionAr,
        basePrice: item.basePrice,
        currency: item.currency,
        percentageRate: item.percentageRate,
        isActive: true,
        metadata: item.metadata,
      },
      create: {
        slug: item.slug,
        category: item.category,
        pricingModel: item.pricingModel,
        packageLevel: (item as { packageLevel?: string }).packageLevel || null,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        descriptionEn: item.descriptionEn,
        descriptionAr: item.descriptionAr,
        basePrice: item.basePrice,
        currency: item.currency,
        percentageRate: item.percentageRate,
        isActive: true,
        metadata: item.metadata,
      },
    });
  }

  console.log(`Successfully seeded ${INITIAL_CATALOG_ITEMS.length} catalog items!`);

  // Query and display Trainer Accreditation row to prove exact DB storage
  const trainerAccreditationRow = await prisma.catalogItem.findUnique({
    where: { slug: 'trainer-accreditation' },
  });
  console.log('\n=== DB ROW: Trainer Accreditation ===');
  console.log(JSON.stringify(trainerAccreditationRow, null, 2));

  // Catalog breakdown summary
  const allItems = await prisma.catalogItem.findMany({ where: { isActive: true } });
  console.log(`\nActive Catalog Total: ${allItems.length}`);
  const byCategory = allItems.reduce(
    (acc, it) => {
      acc[it.category] = (acc[it.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  console.log('Breakdown by category:', byCategory);
}

if (require.main === module) {
  seedCatalog()
    .catch((err) => {
      console.error('Failed to seed catalog:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
