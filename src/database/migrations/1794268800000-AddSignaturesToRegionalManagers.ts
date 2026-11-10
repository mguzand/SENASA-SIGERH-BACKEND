import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSignaturesToRegionalManagers1794268800000 implements MigrationInterface {
  name = 'AddSignaturesToRegionalManagers1794268800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "regional_managers"
      ADD COLUMN IF NOT EXISTS "signature_path" text,
      ADD COLUMN IF NOT EXISTS "signature_mime_type" varchar(100),
      ADD COLUMN IF NOT EXISTS "signature_original_name" varchar(255)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "regional_managers"
      DROP COLUMN IF EXISTS "signature_original_name",
      DROP COLUMN IF EXISTS "signature_mime_type",
      DROP COLUMN IF EXISTS "signature_path"
    `);
  }
}
