import { Module } from '@nestjs/common';
import { ComponentsService } from './components.service';
import { ComponentsController } from './components.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Components } from './entities/components.entity';

@Module({
  controllers: [ComponentsController],
  providers: [ComponentsService],
  imports: [
      TypeOrmModule.forFeature([Components])
  ],
})
export class ComponentsModule {

  

}
