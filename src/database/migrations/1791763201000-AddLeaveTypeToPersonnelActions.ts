import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeaveTypeToPersonnelActions1791763201000
  implements MigrationInterface
{
  name = 'AddLeaveTypeToPersonnelActions1791763201000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employee_job_actions" ADD COLUMN IF NOT EXISTS "leave_request_type" varchar(20)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employee_job_actions" DROP COLUMN IF EXISTS "leave_request_type"`,
    );
  }
}
