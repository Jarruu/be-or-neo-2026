import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { CloudinaryStorageService } from './services/storage/cloudinary-storage.service';
import { PrismaService } from './services/prisma.service';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
          },
          ttl: parseInt(process.env.REDIS_TTL || '3600'),
        }),
      }),
    }),
  ],
  providers: [
    {
      provide: 'IStorageService',
      useClass: CloudinaryStorageService,
    },
    CloudinaryStorageService,
    PrismaService,
  ],
  exports: [
    'IStorageService',
    CloudinaryStorageService,
    PrismaService,
    CacheModule,
  ],
})
export class CommonModule {}

//Developement version without Redis integration for simplicity and to avoid potential issues with Redis setup in different environments.
// import { Module, Global } from '@nestjs/common';
// import { CacheModule } from '@nestjs/cache-manager';
// import { CloudinaryStorageService } from './services/storage/cloudinary-storage.service';
// import { PrismaService } from './services/prisma.service';

// @Global()
// @Module({
//   imports: [
//     CacheModule.register({
//       isGlobal: true,
//       ttl: 3600, // optional
//     }),
//   ],
//   providers: [
//     {
//       provide: 'IStorageService',
//       useClass: CloudinaryStorageService,
//     },
//     CloudinaryStorageService,
//     PrismaService,
//   ],
//   exports: [
//     'IStorageService',
//     CloudinaryStorageService,
//     PrismaService,
//     CacheModule,
//   ],
// })
// export class CommonModule {}
