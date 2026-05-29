import { Module } from '@nestjs/common';
import { ComponentsService } from './components.service';
import { ComponentsController } from './components.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Components } from './entities/components.entity';
import { System } from '../system/entities/system.entity';

@Module({
  controllers: [ComponentsController],
  providers: [ComponentsService],
  imports: [
      TypeOrmModule.forFeature([Components, System])
  ],
})
export class ComponentsModule {

  

}
