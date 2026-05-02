import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Open Recruitment Neo Telemetri 2026 API')
    .setDescription(
      [
        'API documentation for the Open Recruitment Neo Telemetri 2026 backend.',
        'Includes authentication, profile, verification, dashboard, learning, exam, assignment, attendance, payment, and admin flows.',
        'All protected endpoints use Bearer JWT authentication unless stated otherwise.',
      ].join(' '),
    )
    .setVersion('1.0.0')
    // Set the base server to /api. Combined with ignoreGlobalPrefix: true,
    // this ensures all requests are prefixed with /api correctly without duplication.
    .addServer('/api', 'Default Server')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Paste access token in the format: Bearer <token>',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('System', 'Application health and system endpoints')
    .addTag('Authentication', 'User authentication and session management')
    .addTag('Profile', 'Personal profile and user identity')
    .addTag('Verification', 'Document submission and verification process')
    .addTag('Dashboard', 'Main overview for recruitment progress')
    .addTag('Timeline', 'Schedule and recruitment milestones')
    .addTag('Learning Module', 'Educational resources and training materials')
    .addTag('Exam', 'Online examination and assessment tools')
    .addTag('Assignment', 'Task management and project submissions')
    .addTag('Attendance', 'Event presence and check-in system')
    .addTag('Payment', 'Registration fees and billing verification')
    .addTag('Master Data', 'Administrative system configurations')
    .addTag(
      'Admin: Mentor Management',
      'Administrative mentor CRUD and assignment support',
    )
    .addTag(
      'Admin: User Management',
      'Administrative user management and mentor assignment',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });

  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs/json',
    yamlDocumentUrl: 'docs/yaml',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      docExpansion: 'none',
      defaultModelsExpandDepth: -1,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'OR Neo Telemetri 2026 API Docs',
  });

}
