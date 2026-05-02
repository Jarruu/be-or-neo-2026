import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Get,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiOperation,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { MasterDataService } from './master-data.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreateDivisionDto,
  UpdateDivisionDto,
  CreateSubDivisionDto,
  UpdateSubDivisionDto,
} from './dto/master-data.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../../prisma/generated-client/client';
import { Fakultas } from '../../../prisma/generated-client/client';

@ApiTags('Master Data')
@ApiBearerAuth('JWT-auth')
@Controller('master-data')
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  // --- Department ---
  @Get('departments')
  @ApiOperation({ summary: 'Public: Get all departments' })
  @ApiResponse({ status: 200, description: 'Return all departments' })
  findAllDepartments() {
    return this.masterDataService.findAllDepartments();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('departments')
  @ApiOperation({ summary: 'Admin: Create new department' })
  @ApiResponse({ status: 201, description: 'Department successfully created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.masterDataService.createDepartment(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('departments/:id')
  @ApiOperation({ summary: 'Admin: Update department' })
  @ApiResponse({ status: 200, description: 'Department successfully updated' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Department not found' })
  updateDepartment(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.masterDataService.updateDepartment(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('departments/:id')
  @ApiOperation({ summary: 'Admin: Delete department' })
  @ApiResponse({ status: 200, description: 'Department successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Department not found' })
  deleteDepartment(@Param('id') id: string) {
    return this.masterDataService.deleteDepartment(id);
  }

  // --- Division ---
  @Get('divisions')
  @ApiOperation({ summary: 'Public: Get all divisions' })
  @ApiQuery({
    name: 'departmentId',
    required: false,
    description: 'Filter divisions by department ID',
  })
  @ApiResponse({ status: 200, description: 'Return all divisions' })
  findAllDivisions(@Query('departmentId') departmentId?: string) {
    return this.masterDataService.findAllDivisions(departmentId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('divisions')
  @ApiOperation({ summary: 'Admin: Create new division' })
  @ApiResponse({ status: 201, description: 'Division successfully created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  createDivision(@Body() dto: CreateDivisionDto) {
    return this.masterDataService.createDivision(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('divisions/:id')
  @ApiOperation({ summary: 'Admin: Update division' })
  @ApiResponse({ status: 200, description: 'Division successfully updated' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Division not found' })
  updateDivision(@Param('id') id: string, @Body() dto: UpdateDivisionDto) {
    return this.masterDataService.updateDivision(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('divisions/:id')
  @ApiOperation({ summary: 'Admin: Delete division' })
  @ApiResponse({ status: 200, description: 'Division successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Division not found' })
  deleteDivision(@Param('id') id: string) {
    return this.masterDataService.deleteDivision(id);
  }

  // --- SubDivision ---
  @Get('sub-divisions')
  @ApiOperation({ summary: 'Public: Get all sub-divisions' })
  @ApiQuery({
    name: 'divisionId',
    required: false,
    description: 'Filter sub-divisions by division ID',
  })
  @ApiResponse({ status: 200, description: 'Return all sub-divisions' })
  findAllSubDivisions(@Query('divisionId') divisionId?: string) {
    return this.masterDataService.findAllSubDivisions(divisionId);
  }

  @Get('fakultas')
  @ApiOperation({ summary: 'Public: Get all fakultas values' })
  @ApiOkResponse({
    description: 'Return all available fakultas enum values',
    schema: {
      type: 'array',
      items: { type: 'string', enum: Object.values(Fakultas) },
      example: Object.values(Fakultas),
    },
  })
  findAllFakultas() {
    return Object.values(Fakultas);
  }

  @Get('program-studi')
  @ApiOperation({ summary: 'Public: Get all study programs' })
  @ApiQuery({ name: 'fakultas', required: false, enum: Fakultas })
  @ApiResponse({ status: 200, description: 'Return study programs' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  findAllProgramStudi(@Query('fakultas') fakultas?: string) {
    return this.masterDataService.findAllProgramStudi(fakultas);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('sub-divisions')
  @ApiOperation({ summary: 'Admin: Create new sub-division' })
  @ApiResponse({
    status: 201,
    description: 'Sub-division successfully created',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  createSubDivision(@Body() dto: CreateSubDivisionDto) {
    return this.masterDataService.createSubDivision(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('sub-divisions/:id')
  @ApiOperation({ summary: 'Admin: Update sub-division' })
  @ApiResponse({
    status: 200,
    description: 'Sub-division successfully updated',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Sub-division not found' })
  updateSubDivision(
    @Param('id') id: string,
    @Body() dto: UpdateSubDivisionDto,
  ) {
    return this.masterDataService.updateSubDivision(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('sub-divisions/:id')
  @ApiOperation({ summary: 'Admin: Delete sub-division' })
  @ApiResponse({
    status: 200,
    description: 'Sub-division successfully deleted',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Sub-division not found' })
  deleteSubDivision(@Param('id') id: string) {
    return this.masterDataService.deleteSubDivision(id);
  }
}
