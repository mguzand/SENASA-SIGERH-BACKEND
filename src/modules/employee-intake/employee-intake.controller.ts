import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { CreateEmployeeIntakeDto } from './dto/create-employee-intake.dto';
import { ListEmployeeIntakeDto } from './dto/list-employee-intake.dto';
import { StorageService } from 'src/common/services/storage.service';
import { EmployeeIntakeService } from './employee-intake.service';
import { ReviewEmployeeIntakeDto } from './dto/review-employee-intake.dto';

@Controller('employee-intake')
export class EmployeeIntakeController {
  constructor(
    private readonly employeeIntakeService: EmployeeIntakeService,
    private readonly storageService: StorageService,
  ) {}

  @Public()
  @Post('public-request')
  create(@Body() dto: CreateEmployeeIntakeDto) {
    return this.employeeIntakeService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListEmployeeIntakeDto) {
    return this.employeeIntakeService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeeIntakeService.findOne(id);
  }

  @Patch(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewEmployeeIntakeDto) {
    return this.employeeIntakeService.review(id, dto);
  }

  @Get(':id/cv')
  async downloadCv(@Param('id') id: string, @Res() res: any) {
    const request = await this.employeeIntakeService.findOne(id);
    const fullPath = this.storageService.getAbsolutePath(request.cvFilePath);

    return res.download(fullPath, request.cvOriginalName || `cv-${request.identity}`);
  }

  @Get(':id/criminal-record')
  async downloadCriminalRecord(@Param('id') id: string, @Res() res: any) {
    const request = await this.employeeIntakeService.findOne(id);

    if (!request.criminalRecordFilePath) {
      return res.status(404).json({
        message: 'La solicitud no tiene antecedentes penales adjuntos',
      });
    }

    const fullPath = this.storageService.getAbsolutePath(request.criminalRecordFilePath);

    return res.download(
      fullPath,
      request.criminalRecordOriginalName || `antecedentes-${request.identity}`,
    );
  }
}
