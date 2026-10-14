import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExitPermitRetroactiveAuthorizations1791849600000 implements MigrationInterface {
  name = 'AddExitPermitRetroactiveAuthorizations1791849600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "exit_permit_retroactive_authorizations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "employee_id" uuid NOT NULL,
        "authorized_by_employee_id" uuid NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_exit_permit_retroactive_authorizations" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_exit_permit_retroactive_authorization_dates" CHECK ("end_date" >= "start_date"),
        CONSTRAINT "FK_exit_permit_retroactive_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_exit_permit_retroactive_authorizer" FOREIGN KEY ("authorized_by_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_exit_permit_retroactive_employee_dates" ON "exit_permit_retroactive_authorizations" ("employee_id", "start_date", "end_date") WHERE "is_active" = true`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "exit_permit_retroactive_authorizations"`);
  }
}
