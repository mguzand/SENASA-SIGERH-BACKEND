import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateRolUserModuleDto } from './dto/create-rol-module.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RolUser } from './entities/rol-user.entity';

@Injectable()
export class RolUserService {
  constructor(
    @InjectRepository(RolUser)
    private _rolUser: Repository<RolUser>,
    private readonly dataSource: DataSource,
  ) {}

  async getAllByUser(id_user: string, system: string) {
    const rol_user = await this._rolUser
      .createQueryBuilder('rol_user')
      .innerJoinAndSelect('rol_user.components', 'components')
      .where('rol_user.user_id = :id_user', { id_user })
      .andWhere('components.system_id = :system', { system })
      .getMany();
    return rol_user;
  }

  async getCountPermissions(id_user: string, system: string) {
    const count = await this._rolUser
      .createQueryBuilder('rol_user')
      .innerJoin('rol_user.components', 'components')
      .where('rol_user.user_id = :id_user', { id_user })
      .andWhere('components.system_id = :system', { system })
      .getCount();
    return count;
  }

  //↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓//
  //                          Crear Permisos de usuario a modulos                         //
  //↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑//
  async create(_createRolUserModuleDto: CreateRolUserModuleDto) {
    //<<<<<<<<<<<<<<<<<<<<<<<<<<<< Iniciamos una nueva Transaccion >>>>>>>>>>>>>>>>>>>>>>>>>>>>
    //await this._rolUser.delete( { user_id: _createRolUserModuleDto.user_id } );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.delete(RolUser, {
        user_id: _createRolUserModuleDto.user_id,
      });
      for (const item of _createRolUserModuleDto.Roles) {
        const createPerson = this._rolUser.create({
          user_id: _createRolUserModuleDto.user_id,
          rol: item.rol,
          component_id: item.id_modulo,
        });
        await queryRunner.manager.save(createPerson);
      }

      //<<<<<<<<<<<<<<<<<<<<< Ejecutamos la transaccion y la desconectamos >>>>>>>>>>>>>>>>>>>>>
      await queryRunner.commitTransaction();
      await queryRunner.release();

      return { ok: true };
    } catch (error) {
      //<<<<<<<<<<<<<< Si hay un error regresamos los cambios a su estado actual >>>>>>>>>>>>>>>
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDBExceptions(error);
    }
  }

  private handleDBExceptions(error: any) {
    if (error.code === '23505') throw new BadRequestException(error.detail);
    throw new InternalServerErrorException(error);
  }
}
