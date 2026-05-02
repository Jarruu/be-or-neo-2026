import {
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { IStorageService } from '../../common/services/storage/storage.interface';
import { CreateMentorDto } from './dto/create-mentor.dto';
import { UpdateMentorDto } from './dto/update-mentor.dto';

@Injectable()
export class MentorService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('IStorageService') private readonly storageService: IStorageService,
  ) {}

  async create(dto: CreateMentorDto, file?: Express.Multer.File) {
    let photoUrl: string | undefined;

    if (file) {
      photoUrl = await this.storageService.uploadFile(file, 'mentors/photos');
    }

    return this.prisma.mentor.create({
      data: {
        name: dto.name,
        whatsappNumber: dto.whatsappNumber,
        instagramUsername: dto.instagramUsername,
        photoUrl,
      },
    });
  }

  async findAll() {
    return this.prisma.mentor.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const mentor = await this.prisma.mentor.findUnique({
      where: { id },
    });

    if (!mentor) {
      throw new NotFoundException(`Mentor with ID ${id} not found`);
    }

    return mentor;
  }

  async update(
    id: string,
    dto: UpdateMentorDto,
    file?: Express.Multer.File,
  ) {
    const mentor = await this.findOne(id);
    let photoUrl = mentor.photoUrl;

    if (file) {
      photoUrl = await this.storageService.uploadFile(file, 'mentors/photos');
    }

    return this.prisma.mentor.update({
      where: { id },
      data: {
        name: dto.name,
        whatsappNumber: dto.whatsappNumber,
        instagramUsername: dto.instagramUsername,
        photoUrl,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.mentor.delete({
      where: { id },
    });
  }
}
