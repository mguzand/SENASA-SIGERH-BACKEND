import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rol } from './entities/rol.entity';

@Injectable()
export class RolService {
  constructor(
    @InjectRepository(Rol)
    private _rol: Repository<Rol>
  ){}

  async findAll() {
    const roles =  await this._rol.find({
      order: { rol: 'ASC' }
    });
    return roles;
  }



}
