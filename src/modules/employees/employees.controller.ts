import {
  Delete,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { Public } from 'src/common/decorators/public.decorator';
import { CreateEmployeeDto } from './dtos/create-employees.dto';
import { UpdateEmployeeEditableDto } from './dtos/update-employee-editable.dto';
import type { Response } from 'express';
import { PublicCriminalRecordUpdateDto } from './dtos/public-criminal-record.dto';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.employeesService.findAll({
      search,
      departmentId,
      status,
      page,
      limit,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Public()
  @Get('test/mails')
  async testMails() {
    return this.employeesService.test({
      email: 'mguzand@gmail.com',
      firstName: 'Test',
      middleName: 'Middle',
      lastName: 'Last',
    });
  }

  @Get('documents/:documentId/download')
  async downloadDocument(
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const { absolutePath, originalName } =
      await this.employeesService.getEmployeeDocumentDownload(documentId);

    return res.download(absolutePath, originalName || 'documento');
  }

  @Get(':id/profile-photo')
  async getProfilePhoto(@Param('id') id: string, @Res() res: Response) {
    const absolutePath = await this.employeesService.getProfilePhoto(id);

    res.type('image/png');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.sendFile(absolutePath);
  }

  @Post()
  create(@Body() createEmployeeDto: CreateEmployeeDto, @Req() req: any) {
    return this.employeesService.create(createEmployeeDto, req.user);
  }

  @Patch(':id/editable-data')
  updateEditableData(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeEditableDto,
  ) {
    return this.employeesService.updateEditableData(id, dto);
  }

  @Public()
  @Get('public/criminal-record/:dni')
  getPublicCriminalRecordStatus(@Param('dni') dni: string) {
    return this.employeesService.getPublicCriminalRecordStatus(dni);
  }

  @Public()
  @Post('public/criminal-record/:dni')
  updatePublicCriminalRecord(
    @Param('dni') dni: string,
    @Body() dto: PublicCriminalRecordUpdateDto,
  ) {
    return this.employeesService.updatePublicCriminalRecord(dni, dto);
  }

  @Public()
  @Get('status/:id')
  getPersonByIdentity(@Param('id') id: string) {
    return this.employeesService.getPersonByIdentity(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }
}
