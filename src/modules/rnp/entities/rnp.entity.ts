import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'censo_nacional', synchronize: false })
export class Rnp {
  @PrimaryColumn({ name: 'numero_identidad', type: 'varchar', length: 255 })
  numeroIdentidad: string;

  @Column({
    name: 'primer_nombre',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  primerNombre: string;

  @Column({
    name: 'segundo_nombre',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  segundoNombre: string;

  @Column({
    name: 'primer_apellido',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  primerApellido: string;

  @Column({
    name: 'segundo_apellido',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  segundoApellido: string;

  @Column({ name: 'codigo_sexo', type: 'int', nullable: true })
  codigoSexo: number;

  @Column({
    name: 'fecha_nacimiento',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  fechaNacimiento: string;
}
