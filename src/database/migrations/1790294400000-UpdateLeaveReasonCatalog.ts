import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateLeaveReasonCatalog1790294400000 implements MigrationInterface {
  name = 'UpdateLeaveReasonCatalog1790294400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const values = [
      'EXTENDED_DEATH',
      'MARRIAGE',
      'UNION_EVENT',
      'COURT_APPEARANCE',
      'CALAMITY',
      'FAMILY_CARE',
      'OFFICIAL_COMMISSION',
      'OTHER_JUSTIFIED',
    ];
    for (const value of values) {
      await queryRunner.query(
        `ALTER TYPE "public"."leave_requests_reason_type_enum" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "marriage_type" character varying(20)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "marriage_type"`,
    );
    // PostgreSQL no permite retirar valores individuales de un enum de forma segura.
  }
}
