import * as fs from 'fs';
import * as path from 'path';

interface N { id: string; metadata: { label: string; layer: string; domain: string; type: string; metrics: { sloc: number; complexity: number } } }
interface E { id: string; from: string; to: string; type: string }

function save(name: string, nodes: N[], edges: E[]) {
  const dir = path.join(process.cwd(), 'fixtures');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, `mock-${name}.json`), JSON.stringify({ nodes, edges, version: 'mock-real-1.0' }, null, 2));
  console.log(`Generated mock-${name}.json (${nodes.length} nodes, ${edges.length} edges)`);
}

function n(id: string, label: string, layer: string, domain: string, type: string, sloc: number, complexity: number): N {
  return { id, metadata: { label, layer, domain, type, metrics: { sloc, complexity } } };
}
function e(from: string, to: string, type = 'import'): E {
  return { id: `${from}->${to}`, from, to, type };
}

// ========== 1. NEXT.JS E-COMMERCE ==========
function nextjsEcommerce() {
  const nodes: N[] = [
    // Pages
    n('app/page.tsx', 'Home Page', 'UI', 'pages', 'page', 120, 8),
    n('app/products/page.tsx', 'Product List', 'UI', 'pages', 'page', 180, 12),
    n('app/products/[id]/page.tsx', 'Product Detail', 'UI', 'pages', 'page', 250, 18),
    n('app/cart/page.tsx', 'Cart Page', 'UI', 'pages', 'page', 200, 15),
    n('app/checkout/page.tsx', 'Checkout Page', 'UI', 'pages', 'page', 350, 25),
    n('app/auth/login/page.tsx', 'Login Page', 'UI', 'pages', 'page', 150, 10),
    n('app/auth/register/page.tsx', 'Register Page', 'UI', 'pages', 'page', 180, 12),
    n('app/admin/dashboard/page.tsx', 'Admin Dashboard', 'UI', 'pages', 'page', 400, 30),
    n('app/admin/products/page.tsx', 'Admin Products', 'UI', 'pages', 'page', 300, 22),
    n('app/admin/orders/page.tsx', 'Admin Orders', 'UI', 'pages', 'page', 280, 20),
    // Components
    n('components/ProductCard.tsx', 'ProductCard', 'UI', 'components', 'component', 90, 5),
    n('components/CartItem.tsx', 'CartItem', 'UI', 'components', 'component', 70, 4),
    n('components/Navbar.tsx', 'Navbar', 'UI', 'components', 'component', 120, 8),
    n('components/Footer.tsx', 'Footer', 'UI', 'components', 'component', 60, 2),
    n('components/SearchBar.tsx', 'SearchBar', 'UI', 'components', 'component', 110, 7),
    n('components/PaymentForm.tsx', 'PaymentForm', 'UI', 'components', 'component', 200, 15),
    n('components/OrderSummary.tsx', 'OrderSummary', 'UI', 'components', 'component', 150, 10),
    n('components/AdminSidebar.tsx', 'AdminSidebar', 'UI', 'components', 'component', 80, 4),
    // API Routes
    n('app/api/products/route.ts', 'Products API', 'Service', 'api', 'api', 180, 12),
    n('app/api/cart/route.ts', 'Cart API', 'Service', 'api', 'api', 150, 10),
    n('app/api/orders/route.ts', 'Orders API', 'Service', 'api', 'api', 250, 20),
    n('app/api/auth/route.ts', 'Auth API', 'Service', 'api', 'api', 200, 15),
    n('app/api/payments/route.ts', 'Payments API', 'Service', 'api', 'api', 300, 25),
    n('app/api/admin/stats/route.ts', 'Admin Stats API', 'Service', 'api', 'api', 180, 14),
    // Services
    n('lib/services/ProductService.ts', 'ProductService', 'Core', 'services', 'service', 300, 22),
    n('lib/services/CartService.ts', 'CartService', 'Core', 'services', 'service', 200, 15),
    n('lib/services/OrderService.ts', 'OrderService', 'Core', 'services', 'service', 400, 30),
    n('lib/services/AuthService.ts', 'AuthService', 'Core', 'services', 'service', 250, 18),
    n('lib/services/PaymentService.ts', 'PaymentService', 'Core', 'services', 'service', 350, 28),
    n('lib/services/EmailService.ts', 'EmailService', 'Core', 'services', 'service', 150, 8),
    // Data / Prisma
    n('lib/prisma/client.ts', 'PrismaClient', 'Core', 'data', 'module', 40, 2),
    n('lib/prisma/schema.prisma', 'Schema', 'Core', 'data', 'module', 200, 1),
    n('lib/repositories/ProductRepo.ts', 'ProductRepo', 'Core', 'data', 'module', 180, 12),
    n('lib/repositories/OrderRepo.ts', 'OrderRepo', 'Core', 'data', 'module', 220, 15),
    n('lib/repositories/UserRepo.ts', 'UserRepo', 'Core', 'data', 'module', 160, 10),
    // Utils
    n('lib/utils/auth.ts', 'Auth Utils', 'Utils', 'utils', 'module', 100, 6),
    n('lib/utils/validation.ts', 'Validation', 'Utils', 'utils', 'module', 80, 5),
    n('lib/utils/formatters.ts', 'Formatters', 'Utils', 'utils', 'module', 60, 3),
    // Hooks
    n('hooks/useCart.ts', 'useCart', 'UI', 'hooks', 'module', 90, 6),
    n('hooks/useAuth.ts', 'useAuth', 'UI', 'hooks', 'module', 70, 4),
    n('hooks/useProducts.ts', 'useProducts', 'UI', 'hooks', 'module', 80, 5),
    // External
    n('stripe', 'Stripe', 'External', 'shared', 'external', 0, 0),
    n('next-auth', 'NextAuth', 'External', 'shared', 'external', 0, 0),
    n('@prisma/client', 'Prisma', 'External', 'shared', 'external', 0, 0),
    n('resend', 'Resend', 'External', 'shared', 'external', 0, 0),
    n('zod', 'Zod', 'External', 'shared', 'external', 0, 0),
  ];

  const edges: E[] = [
    // Pages -> Components
    e('app/products/page.tsx', 'components/ProductCard.tsx'),
    e('app/products/page.tsx', 'components/SearchBar.tsx'),
    e('app/products/[id]/page.tsx', 'components/ProductCard.tsx'),
    e('app/cart/page.tsx', 'components/CartItem.tsx'),
    e('app/cart/page.tsx', 'components/OrderSummary.tsx'),
    e('app/checkout/page.tsx', 'components/PaymentForm.tsx'),
    e('app/checkout/page.tsx', 'components/OrderSummary.tsx'),
    e('app/admin/dashboard/page.tsx', 'components/AdminSidebar.tsx'),
    e('app/admin/products/page.tsx', 'components/AdminSidebar.tsx'),
    e('app/admin/orders/page.tsx', 'components/AdminSidebar.tsx'),
    // Pages -> Hooks
    e('app/products/page.tsx', 'hooks/useProducts.ts'),
    e('app/cart/page.tsx', 'hooks/useCart.ts'),
    e('app/auth/login/page.tsx', 'hooks/useAuth.ts'),
    e('app/page.tsx', 'components/Navbar.tsx'),
    e('app/page.tsx', 'components/Footer.tsx'),
    // API -> Services
    e('app/api/products/route.ts', 'lib/services/ProductService.ts'),
    e('app/api/cart/route.ts', 'lib/services/CartService.ts'),
    e('app/api/orders/route.ts', 'lib/services/OrderService.ts'),
    e('app/api/auth/route.ts', 'lib/services/AuthService.ts'),
    e('app/api/payments/route.ts', 'lib/services/PaymentService.ts'),
    e('app/api/admin/stats/route.ts', 'lib/services/OrderService.ts'),
    // Services -> Repos
    e('lib/services/ProductService.ts', 'lib/repositories/ProductRepo.ts'),
    e('lib/services/OrderService.ts', 'lib/repositories/OrderRepo.ts'),
    e('lib/services/AuthService.ts', 'lib/repositories/UserRepo.ts'),
    e('lib/services/CartService.ts', 'lib/repositories/ProductRepo.ts'),
    e('lib/services/PaymentService.ts', 'lib/repositories/OrderRepo.ts'),
    e('lib/services/OrderService.ts', 'lib/services/EmailService.ts'),
    e('lib/services/OrderService.ts', 'lib/services/PaymentService.ts'),
    // Repos -> Prisma
    e('lib/repositories/ProductRepo.ts', 'lib/prisma/client.ts'),
    e('lib/repositories/OrderRepo.ts', 'lib/prisma/client.ts'),
    e('lib/repositories/UserRepo.ts', 'lib/prisma/client.ts'),
    e('lib/prisma/client.ts', '@prisma/client'),
    // External
    e('lib/services/PaymentService.ts', 'stripe'),
    e('lib/services/AuthService.ts', 'next-auth'),
    e('lib/services/EmailService.ts', 'resend'),
    e('lib/utils/validation.ts', 'zod'),
    e('app/api/auth/route.ts', 'lib/utils/auth.ts'),
    e('app/api/products/route.ts', 'lib/utils/validation.ts'),
  ];

  save('nextjs-ecommerce', nodes, edges);
}

// ========== 2. LARAVEL SAAS ==========
function laravelSaas() {
  const nodes: N[] = [
    // Controllers
    n('app/Http/Controllers/AuthController.php', 'AuthController', 'Service', 'controllers', 'api', 200, 15),
    n('app/Http/Controllers/TenantController.php', 'TenantController', 'Service', 'controllers', 'api', 180, 12),
    n('app/Http/Controllers/SubscriptionController.php', 'SubscriptionController', 'Service', 'controllers', 'api', 250, 20),
    n('app/Http/Controllers/InvoiceController.php', 'InvoiceController', 'Service', 'controllers', 'api', 200, 15),
    n('app/Http/Controllers/UserController.php', 'UserController', 'Service', 'controllers', 'api', 150, 10),
    n('app/Http/Controllers/DashboardController.php', 'DashboardController', 'Service', 'controllers', 'api', 180, 12),
    n('app/Http/Controllers/WebhookController.php', 'WebhookController', 'Service', 'controllers', 'api', 300, 25),
    n('app/Http/Controllers/ReportController.php', 'ReportController', 'Service', 'controllers', 'api', 220, 18),
    n('app/Http/Controllers/SettingsController.php', 'SettingsController', 'Service', 'controllers', 'api', 160, 10),
    // Models
    n('app/Models/User.php', 'User', 'Core', 'models', 'module', 150, 8),
    n('app/Models/Tenant.php', 'Tenant', 'Core', 'models', 'module', 120, 6),
    n('app/Models/Subscription.php', 'Subscription', 'Core', 'models', 'module', 180, 12),
    n('app/Models/Invoice.php', 'Invoice', 'Core', 'models', 'module', 100, 5),
    n('app/Models/Plan.php', 'Plan', 'Core', 'models', 'module', 80, 4),
    n('app/Models/Feature.php', 'Feature', 'Core', 'models', 'module', 60, 3),
    n('app/Models/AuditLog.php', 'AuditLog', 'Core', 'models', 'module', 70, 4),
    // Services
    n('app/Services/BillingService.php', 'BillingService', 'Core', 'services', 'service', 400, 35),
    n('app/Services/TenantService.php', 'TenantService', 'Core', 'services', 'service', 300, 22),
    n('app/Services/SubscriptionService.php', 'SubscriptionService', 'Core', 'services', 'service', 350, 28),
    n('app/Services/NotificationService.php', 'NotificationService', 'Core', 'services', 'service', 200, 12),
    n('app/Services/ReportService.php', 'ReportService', 'Core', 'services', 'service', 250, 18),
    n('app/Services/AuditService.php', 'AuditService', 'Core', 'services', 'service', 150, 8),
    // Jobs
    n('app/Jobs/ProcessInvoice.php', 'ProcessInvoice', 'Core', 'jobs', 'service', 120, 8),
    n('app/Jobs/SendWelcomeEmail.php', 'SendWelcomeEmail', 'Core', 'jobs', 'service', 80, 4),
    n('app/Jobs/SyncSubscription.php', 'SyncSubscription', 'Core', 'jobs', 'service', 150, 10),
    n('app/Jobs/GenerateReport.php', 'GenerateReport', 'Core', 'jobs', 'service', 200, 15),
    // Events
    n('app/Events/TenantCreated.php', 'TenantCreated', 'Core', 'events', 'module', 30, 1),
    n('app/Events/SubscriptionChanged.php', 'SubscriptionChanged', 'Core', 'events', 'module', 30, 1),
    n('app/Events/InvoicePaid.php', 'InvoicePaid', 'Core', 'events', 'module', 30, 1),
    // Listeners
    n('app/Listeners/CreateTenantResources.php', 'CreateTenantResources', 'Core', 'events', 'module', 100, 8),
    n('app/Listeners/NotifySubscriptionChange.php', 'NotifySubscriptionChange', 'Core', 'events', 'module', 80, 5),
    // Middleware
    n('app/Http/Middleware/TenantMiddleware.php', 'TenantMiddleware', 'Service', 'middleware', 'module', 60, 4),
    n('app/Http/Middleware/SubscriptionGuard.php', 'SubscriptionGuard', 'Service', 'middleware', 'module', 80, 6),
    // Views (Blade)
    n('resources/views/dashboard.blade.php', 'Dashboard View', 'UI', 'views', 'page', 200, 5),
    n('resources/views/billing.blade.php', 'Billing View', 'UI', 'views', 'page', 180, 4),
    n('resources/views/settings.blade.php', 'Settings View', 'UI', 'views', 'page', 150, 3),
    // Config / External
    n('config/billing.php', 'Billing Config', 'Utils', 'config', 'module', 40, 1),
    n('config/tenancy.php', 'Tenancy Config', 'Utils', 'config', 'module', 30, 1),
    n('laravel/cashier', 'Cashier (Stripe)', 'External', 'shared', 'external', 0, 0),
    n('laravel/sanctum', 'Sanctum', 'External', 'shared', 'external', 0, 0),
    n('spatie/laravel-permission', 'Spatie Permissions', 'External', 'shared', 'external', 0, 0),
    n('redis', 'Redis', 'External', 'shared', 'external', 0, 0),
  ];

  const edges: E[] = [
    // Controllers -> Services
    e('app/Http/Controllers/AuthController.php', 'app/Models/User.php'),
    e('app/Http/Controllers/TenantController.php', 'app/Services/TenantService.php'),
    e('app/Http/Controllers/SubscriptionController.php', 'app/Services/SubscriptionService.php'),
    e('app/Http/Controllers/InvoiceController.php', 'app/Services/BillingService.php'),
    e('app/Http/Controllers/DashboardController.php', 'app/Services/ReportService.php'),
    e('app/Http/Controllers/WebhookController.php', 'app/Services/BillingService.php'),
    e('app/Http/Controllers/WebhookController.php', 'app/Services/SubscriptionService.php'),
    e('app/Http/Controllers/ReportController.php', 'app/Services/ReportService.php'),
    e('app/Http/Controllers/SettingsController.php', 'app/Services/TenantService.php'),
    e('app/Http/Controllers/UserController.php', 'app/Models/User.php'),
    // Services -> Models
    e('app/Services/BillingService.php', 'app/Models/Invoice.php'),
    e('app/Services/BillingService.php', 'app/Models/Subscription.php'),
    e('app/Services/TenantService.php', 'app/Models/Tenant.php'),
    e('app/Services/SubscriptionService.php', 'app/Models/Subscription.php'),
    e('app/Services/SubscriptionService.php', 'app/Models/Plan.php'),
    e('app/Services/ReportService.php', 'app/Models/Invoice.php'),
    e('app/Services/AuditService.php', 'app/Models/AuditLog.php'),
    // Services -> External
    e('app/Services/BillingService.php', 'laravel/cashier'),
    e('app/Services/NotificationService.php', 'redis'),
    e('app/Http/Controllers/AuthController.php', 'laravel/sanctum'),
    e('app/Http/Middleware/TenantMiddleware.php', 'spatie/laravel-permission'),
    // Jobs -> Services
    e('app/Jobs/ProcessInvoice.php', 'app/Services/BillingService.php'),
    e('app/Jobs/SendWelcomeEmail.php', 'app/Services/NotificationService.php'),
    e('app/Jobs/SyncSubscription.php', 'app/Services/SubscriptionService.php'),
    e('app/Jobs/GenerateReport.php', 'app/Services/ReportService.php'),
    // Events -> Listeners
    e('app/Events/TenantCreated.php', 'app/Listeners/CreateTenantResources.php'),
    e('app/Events/SubscriptionChanged.php', 'app/Listeners/NotifySubscriptionChange.php'),
    e('app/Listeners/CreateTenantResources.php', 'app/Services/TenantService.php'),
    e('app/Listeners/NotifySubscriptionChange.php', 'app/Services/NotificationService.php'),
    // Services dispatch events
    e('app/Services/TenantService.php', 'app/Events/TenantCreated.php'),
    e('app/Services/SubscriptionService.php', 'app/Events/SubscriptionChanged.php'),
    e('app/Services/BillingService.php', 'app/Events/InvoicePaid.php'),
    // Middleware
    e('app/Http/Controllers/TenantController.php', 'app/Http/Middleware/TenantMiddleware.php'),
    e('app/Http/Controllers/SubscriptionController.php', 'app/Http/Middleware/SubscriptionGuard.php'),
    // Config
    e('app/Services/BillingService.php', 'config/billing.php'),
    e('app/Services/TenantService.php', 'config/tenancy.php'),
  ];

  save('laravel-saas', nodes, edges);
}

// ========== 3. DJANGO REST API ==========
function djangoRestApi() {
  const nodes: N[] = [
    // Views (API)
    n('api/views/auth_views.py', 'AuthViews', 'Service', 'views', 'api', 200, 15),
    n('api/views/project_views.py', 'ProjectViews', 'Service', 'views', 'api', 250, 18),
    n('api/views/task_views.py', 'TaskViews', 'Service', 'views', 'api', 300, 22),
    n('api/views/comment_views.py', 'CommentViews', 'Service', 'views', 'api', 150, 10),
    n('api/views/webhook_views.py', 'WebhookViews', 'Service', 'views', 'api', 180, 12),
    // Serializers
    n('api/serializers/user_serializer.py', 'UserSerializer', 'Service', 'serializers', 'module', 80, 5),
    n('api/serializers/project_serializer.py', 'ProjectSerializer', 'Service', 'serializers', 'module', 120, 8),
    n('api/serializers/task_serializer.py', 'TaskSerializer', 'Service', 'serializers', 'module', 150, 10),
    // Models
    n('core/models/user.py', 'UserModel', 'Core', 'models', 'module', 100, 6),
    n('core/models/project.py', 'ProjectModel', 'Core', 'models', 'module', 150, 10),
    n('core/models/task.py', 'TaskModel', 'Core', 'models', 'module', 200, 14),
    n('core/models/comment.py', 'CommentModel', 'Core', 'models', 'module', 80, 4),
    n('core/models/attachment.py', 'AttachmentModel', 'Core', 'models', 'module', 60, 3),
    // Services
    n('core/services/project_service.py', 'ProjectService', 'Core', 'services', 'service', 300, 25),
    n('core/services/task_service.py', 'TaskService', 'Core', 'services', 'service', 350, 28),
    n('core/services/notification_service.py', 'NotificationService', 'Core', 'services', 'service', 200, 12),
    n('core/services/file_service.py', 'FileService', 'Core', 'services', 'service', 150, 8),
    // Tasks (Celery)
    n('workers/tasks/send_email.py', 'SendEmailTask', 'Core', 'workers', 'service', 80, 4),
    n('workers/tasks/process_webhook.py', 'ProcessWebhook', 'Core', 'workers', 'service', 120, 8),
    n('workers/tasks/generate_export.py', 'GenerateExport', 'Core', 'workers', 'service', 150, 10),
    // Permissions
    n('api/permissions/project_perms.py', 'ProjectPermissions', 'Service', 'permissions', 'module', 60, 5),
    n('api/permissions/task_perms.py', 'TaskPermissions', 'Service', 'permissions', 'module', 50, 4),
    // Utils
    n('core/utils/validators.py', 'Validators', 'Utils', 'utils', 'module', 100, 8),
    n('core/utils/pagination.py', 'Pagination', 'Utils', 'utils', 'module', 60, 3),
    n('core/utils/cache.py', 'CacheUtils', 'Utils', 'utils', 'module', 80, 5),
    // Config
    n('config/settings.py', 'Settings', 'Utils', 'config', 'module', 200, 5),
    n('config/urls.py', 'URLs', 'Utils', 'config', 'module', 40, 1),
    // External
    n('celery', 'Celery', 'External', 'shared', 'external', 0, 0),
    n('django-rest-framework', 'DRF', 'External', 'shared', 'external', 0, 0),
    n('boto3', 'AWS S3', 'External', 'shared', 'external', 0, 0),
    n('redis-py', 'Redis', 'External', 'shared', 'external', 0, 0),
  ];

  const edges: E[] = [
    // Views -> Serializers
    e('api/views/auth_views.py', 'api/serializers/user_serializer.py'),
    e('api/views/project_views.py', 'api/serializers/project_serializer.py'),
    e('api/views/task_views.py', 'api/serializers/task_serializer.py'),
    // Views -> Services
    e('api/views/project_views.py', 'core/services/project_service.py'),
    e('api/views/task_views.py', 'core/services/task_service.py'),
    e('api/views/comment_views.py', 'core/models/comment.py'),
    e('api/views/webhook_views.py', 'workers/tasks/process_webhook.py'),
    // Views -> Permissions
    e('api/views/project_views.py', 'api/permissions/project_perms.py'),
    e('api/views/task_views.py', 'api/permissions/task_perms.py'),
    // Serializers -> Models
    e('api/serializers/user_serializer.py', 'core/models/user.py'),
    e('api/serializers/project_serializer.py', 'core/models/project.py'),
    e('api/serializers/task_serializer.py', 'core/models/task.py'),
    // Services -> Models
    e('core/services/project_service.py', 'core/models/project.py'),
    e('core/services/project_service.py', 'core/models/user.py'),
    e('core/services/task_service.py', 'core/models/task.py'),
    e('core/services/task_service.py', 'core/models/attachment.py'),
    e('core/services/notification_service.py', 'workers/tasks/send_email.py'),
    e('core/services/file_service.py', 'core/models/attachment.py'),
    // Services -> External
    e('core/services/file_service.py', 'boto3'),
    e('core/services/notification_service.py', 'redis-py'),
    e('core/utils/cache.py', 'redis-py'),
    // Workers -> Services
    e('workers/tasks/send_email.py', 'core/services/notification_service.py'),
    e('workers/tasks/generate_export.py', 'core/services/project_service.py'),
    e('workers/tasks/process_webhook.py', 'core/services/task_service.py'),
    // Workers -> External
    e('workers/tasks/send_email.py', 'celery'),
    e('workers/tasks/process_webhook.py', 'celery'),
    e('workers/tasks/generate_export.py', 'celery'),
    // DRF
    e('api/views/auth_views.py', 'django-rest-framework'),
    e('api/serializers/user_serializer.py', 'django-rest-framework'),
    // Utils
    e('core/services/project_service.py', 'core/utils/validators.py'),
    e('api/views/project_views.py', 'core/utils/pagination.py'),
  ];

  save('django-rest-api', nodes, edges);
}

nextjsEcommerce();
laravelSaas();
djangoRestApi();
console.log('Done! Run: npx ts-node scripts/test-render-real.ts');
