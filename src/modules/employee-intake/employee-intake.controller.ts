import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { CreateEmployeeIntakeDto } from './dto/create-employee-intake.dto';
import { ListEmployeeIntakeDto } from './dto/list-employee-intake.dto';
import { StorageService } from 'src/common/services/storage.service';
import { EmployeeIntakeService } from './employee-intake.service';

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

  @Get(':id/cv')
  async downloadCv(@Param('id') id: string, @Res() res: any) {
    const request = await this.employeeIntakeService.findOne(id);
    const fullPath = this.storageService.getAbsolutePath(request.cvFilePath);

    return res.download(fullPath, request.cvOriginalName || `cv-${request.identity}`);
  }
}
