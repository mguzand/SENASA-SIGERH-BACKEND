import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Components } from './entities/components.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ComponentsService {

  constructor(
    @InjectRepository(Components)
    private readonly _components: Repository< Components>
  ){}


    async findAll(user_id: number) {
    const values = await this._components.createQueryBuilder("modules")
                  .leftJoinAndSelect("modules.rolUser", "rolUser", "rolUser.user_id = :user_id", { user_id })
                  .getMany();
    return values;
    // return await this._modules.find({
    //   relations: ['rolUser'],
    //   where: {id_sistema}
    // })
  }




}
