import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateTimelineDto } from './dto/create-timeline.dto';
import { PartialType } from '@nestjs/swagger';

export class UpdateTimelineDto extends PartialType(CreateTimelineDto) {}

@Injectable()
export class TimelineService {
  private readonly CACHE_KEY = 'timeline:all';

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findAll() {
    const cached = await this.cacheManager.get(this.CACHE_KEY);
    if (cached) return cached;

    const timeline = await this.prisma.recruitmentTimeline.findMany({
      orderBy: [
        { orderIndex: 'asc' },
        { startAt: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    await this.cacheManager.set(this.CACHE_KEY, timeline);
    return timeline;
  }

  async findOne(id: string) {
    const timeline = await this.prisma.recruitmentTimeline.findUnique({
      where: { id },
    });
    if (!timeline) throw new NotFoundException('Timeline event not found');
    return timeline;
  }

  async create(dto: CreateTimelineDto) {
    await this.ensureOrderIndexAvailable(dto.orderIndex);

    const result = await this.prisma.recruitmentTimeline.create({
      data: {
        ...dto,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
      },
    });

    await this.cacheManager.del(this.CACHE_KEY);
    return result;
  }

  async update(id: string, dto: UpdateTimelineDto) {
    await this.findOne(id);

    if (typeof dto.orderIndex === 'number') {
      await this.ensureOrderIndexAvailable(dto.orderIndex, id);
    }

    const data: Record<string, any> = { ...dto };
    if (dto.startAt) data.startAt = new Date(dto.startAt);
    if (dto.endAt) data.endAt = new Date(dto.endAt);

    const result = await this.prisma.recruitmentTimeline.update({
      where: { id },
      data,
    });

    await this.cacheManager.del(this.CACHE_KEY);
    return result;
  }

  async remove(id: string) {
    await this.findOne(id);
    const result = await this.prisma.recruitmentTimeline.delete({
      where: { id },
    });

    await this.cacheManager.del(this.CACHE_KEY);
    return result;
  }

  private async ensureOrderIndexAvailable(orderIndex: number, excludeId?: string) {
    const existing = await this.prisma.recruitmentTimeline.findFirst({
      where: {
        orderIndex,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('orderIndex already exists');
    }
  }
}
