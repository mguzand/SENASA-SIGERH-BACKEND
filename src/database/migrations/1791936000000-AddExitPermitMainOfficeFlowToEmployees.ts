import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExitPermitMainOfficeFlowToEmployees1791936000000 implements MigrationInterface {
  name = 'AddExitPermitMainOfficeFlowToEmployees1791936000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employees"
      ADD COLUMN IF NOT EXISTS "exit_permit_main_office_flow" boolean NOT NULL DEFAULT false
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employees"
      DROP COLUMN IF EXISTS "exit_permit_main_office_flow"
    `);
  }
}
