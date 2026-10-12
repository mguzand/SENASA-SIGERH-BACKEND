import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkPersonnelActionsToLeaves1791763200000 implements MigrationInterface {
  name = 'LinkPersonnelActionsToLeaves1791763200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "employee_job_actions" ADD COLUMN IF NOT EXISTS "leave_request_id" uuid`);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "employee_job_actions"
        ADD CONSTRAINT "FK_employee_job_actions_leave_request"
        FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_employee_job_actions_leave_request" ON "employee_job_actions" ("leave_request_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "employee_job_actions" DROP CONSTRAINT IF EXISTS "FK_employee_job_actions_leave_request"`);
    await queryRunner.query(`ALTER TABLE "employee_job_actions" DROP COLUMN IF EXISTS "leave_request_id"`);
  }
}
