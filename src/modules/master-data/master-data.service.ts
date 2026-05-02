import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../common/services/prisma.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreateDivisionDto,
  UpdateDivisionDto,
  CreateSubDivisionDto,
  UpdateSubDivisionDto,
} from './dto/master-data.dto';
import { Fakultas } from '../../../prisma/generated-client/client';

@Injectable()
export class MasterDataService {
  private readonly CACHE_KEY_DEPARTMENTS = 'master_data:departments';
  private readonly CACHE_KEY_DIVISIONS = 'master_data:divisions';
  private readonly CACHE_KEY_SUBDIVISIONS = 'master_data:subdivisions';
  private readonly CACHE_KEY_PROGRAM_STUDI = 'master_data:program_studi';

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // --- Department ---
  async findAllDepartments() {
    const cached = await this.cacheManager.get(this.CACHE_KEY_DEPARTMENTS);
    if (cached) return cached;

    const departments = await this.prisma.department.findMany({
      orderBy: { name: 'asc' },
    });

    await this.cacheManager.set(this.CACHE_KEY_DEPARTMENTS, departments);
    return departments;
  }

  async createDepartment(dto: CreateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('Department name already exists');

    const result = await this.prisma.department.create({ data: dto });
    await this.clearMasterDataCache();
    return result;
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    await this.findDepartmentOrThrow(id);
    const result = await this.prisma.department.update({
      where: { id },
      data: dto,
    });
    await this.clearMasterDataCache();
    return result;
  }

  async deleteDepartment(id: string) {
    await this.findDepartmentOrThrow(id);
    const result = await this.prisma.department.delete({ where: { id } });
    await this.clearMasterDataCache();
    return result;
  }

  // --- Division ---
  async findAllDivisions(departmentId?: string) {
    const cacheKey = departmentId 
      ? `${this.CACHE_KEY_DIVISIONS}:${departmentId}` 
      : this.CACHE_KEY_DIVISIONS;
    
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const divisions = await this.prisma.division.findMany({
      where: departmentId ? { departmentId } : {},
      orderBy: { name: 'asc' },
    });

    await this.cacheManager.set(cacheKey, divisions);
    return divisions;
  }

  async createDivision(dto: CreateDivisionDto) {
    const existing = await this.prisma.division.findUnique({
      where: {
        departmentId_name: {
          departmentId: dto.departmentId,
          name: dto.name,
        },
      },
    });
    if (existing)
      throw new ConflictException(
        'Division name already exists in this department',
      );

    const result = await this.prisma.division.create({ data: dto });
    await this.clearMasterDataCache();
    return result;
  }

  async updateDivision(id: string, dto: UpdateDivisionDto) {
    await this.findDivisionOrThrow(id);
    const result = await this.prisma.division.update({
      where: { id },
      data: dto,
    });
    await this.clearMasterDataCache();
    return result;
  }

  async deleteDivision(id: string) {
    await this.findDivisionOrThrow(id);
    const result = await this.prisma.division.delete({ where: { id } });
    await this.clearMasterDataCache();
    return result;
  }

  // --- SubDivision ---
  async findAllSubDivisions(divisionId?: string) {
    const cacheKey = divisionId 
      ? `${this.CACHE_KEY_SUBDIVISIONS}:${divisionId}` 
      : this.CACHE_KEY_SUBDIVISIONS;
    
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const subDivisions = await this.prisma.subDivision.findMany({
      where: divisionId ? { divisionId } : {},
      orderBy: { name: 'asc' },
    });

    await this.cacheManager.set(cacheKey, subDivisions);
    return subDivisions;
  }

  async findAllProgramStudi(fakultas?: string) {
    if (fakultas && !Object.values(Fakultas).includes(fakultas as Fakultas)) {
      throw new BadRequestException('Fakultas not found');
    }

    const cacheKey = fakultas
      ? `${this.CACHE_KEY_PROGRAM_STUDI}:${fakultas}`
      : this.CACHE_KEY_PROGRAM_STUDI;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const programs = await this.prisma.programStudi.findMany({
      where: fakultas ? { fakultas: fakultas as Fakultas } : {},
      orderBy: { name: 'asc' },
    });

    await this.cacheManager.set(cacheKey, programs);
    return programs;
  }

  async createSubDivision(dto: CreateSubDivisionDto) {
    const existing = await this.prisma.subDivision.findUnique({
      where: {
        divisionId_name: {
          divisionId: dto.divisionId,
          name: dto.name,
        },
      },
    });
    if (existing)
      throw new ConflictException(
        'Subdivision name already exists in this division',
      );

    const result = await this.prisma.subDivision.create({ data: dto });
    await this.clearMasterDataCache();
    return result;
  }

  async updateSubDivision(id: string, dto: UpdateSubDivisionDto) {
    await this.findSubDivisionOrThrow(id);
    const result = await this.prisma.subDivision.update({
      where: { id },
      data: dto,
    });
    await this.clearMasterDataCache();
    return result;
  }

  async deleteSubDivision(id: string) {
    await this.findSubDivisionOrThrow(id);
    const result = await this.prisma.subDivision.delete({ where: { id } });
    await this.clearMasterDataCache();
    return result;
  }

  // --- Helpers ---
  private async findDepartmentOrThrow(id: string) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  private async findDivisionOrThrow(id: string) {
    const div = await this.prisma.division.findUnique({ where: { id } });
    if (!div) throw new NotFoundException('Division not found');
    return div;
  }

  private async findSubDivisionOrThrow(id: string) {
    const sub = await this.prisma.subDivision.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Subdivision not found');
    return sub;
  }

  private async clearMasterDataCache() {
    await this.cacheManager.del(this.CACHE_KEY_DEPARTMENTS);
    await this.cacheManager.del(this.CACHE_KEY_DIVISIONS);
    await this.cacheManager.del(this.CACHE_KEY_SUBDIVISIONS);
    await this.cacheManager.del(this.CACHE_KEY_PROGRAM_STUDI);

    try {
      const store = (this.cacheManager as any).store;
      if (store && typeof store.keys === 'function') {
        const keys = await store.keys('master_data:*');
        for (const key of keys) {
          await this.cacheManager.del(key);
        }
      }
    } catch (error) {
      console.warn('Failed to clear all master data cache patterns:', error.message);
    }
  }
}
