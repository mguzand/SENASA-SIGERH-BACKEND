import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'Userinfo', schema: 'dbo', synchronize: false })
export class WatchUser {
  @PrimaryColumn({ name: 'Userid', type: 'varchar', length: 20 })
  userId: string;

  @Column({ name: 'UserCode', type: 'varchar', length: 20, nullable: true })
  userCode: string | null;

  @Column({ name: 'Name', type: 'varchar', length: 50, nullable: true })
  name: string | null;

  @Column({ name: 'Sex', type: 'varchar', length: 10, nullable: true })
  sex: string | null;

  @Column({ name: 'Pwd', type: 'varchar', length: 50, nullable: true, select: false })
  password: string | null;

  @Column({ name: 'Deptid', type: 'int', default: 1 })
  departmentId: number;

  @Column({ name: 'Nation', type: 'varchar', length: 50, nullable: true })
  nation: string | null;

  @Column({ name: 'Birthday', type: 'smalldatetime', nullable: true })
  birthday: Date | null;

  @Column({ name: 'EmployDate', type: 'smalldatetime', nullable: true })
  employmentDate: Date | null;

  @Column({ name: 'Telephone', type: 'varchar', length: 50, nullable: true })
  telephone: string | null;

  @Column({ name: 'Duty', type: 'varchar', length: 50, nullable: true })
  duty: string | null;

  @Column({ name: 'NativePlace', type: 'varchar', length: 50, nullable: true })
  nativePlace: string | null;

  @Column({ name: 'IDCard', type: 'varchar', length: 50, nullable: true })
  idCard: string | null;

  @Column({ name: 'Address', type: 'varchar', length: 150, nullable: true })
  address: string | null;

  @Column({ name: 'Mobile', type: 'varchar', length: 50, nullable: true })
  mobile: string | null;

  @Column({ name: 'Educated', type: 'varchar', length: 50, nullable: true })
  education: string | null;

  @Column({ name: 'Polity', type: 'varchar', length: 50, nullable: true })
  polity: string | null;

  @Column({ name: 'Specialty', type: 'varchar', length: 50, nullable: true })
  specialty: string | null;

  @Column({ name: 'IsAtt', type: 'bit', default: true, nullable: true })
  isAttendanceEnabled: boolean | null;

  @Column({ name: 'Isovertime', type: 'bit', default: true, nullable: true })
  isOvertimeEnabled: boolean | null;

  @Column({ name: 'Isrest', type: 'bit', default: true, nullable: true })
  isRestEnabled: boolean | null;

  @Column({ name: 'Remark', type: 'varchar', length: 250, nullable: true })
  remark: string | null;

  @Column({ name: 'MgFlag', type: 'smallint', default: 1, nullable: true })
  managementFlag: number | null;

  @Column({ name: 'CardNum', type: 'varchar', length: 10, nullable: true })
  cardNumber: string | null;

  @Column({ name: 'Picture', type: 'image', nullable: true, select: false })
  picture: Buffer | null;

  @Column({ name: 'UserFlag', type: 'int', default: 0, nullable: true })
  userFlag: number | null;

  @Column({ name: 'Groupid', type: 'int', default: 1, nullable: true })
  groupId: number | null;

  @Column({ name: 'ClassFlag', type: 'int', default: 0, nullable: true })
  classFlag: number | null;

  @Column({ name: 'OtherInfo', type: 'image', nullable: true, select: false })
  otherInfo: Buffer | null;

  @Column({ name: 'admingroupid', type: 'int', default: 0, nullable: true })
  adminGroupId: number | null;

}
