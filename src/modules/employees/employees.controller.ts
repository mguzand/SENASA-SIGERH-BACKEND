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
  @Get('status/:id')
  getPersonByIdentity(@Param('id') id: string) {
    return this.employeesService.getPersonByIdentity(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }
}
