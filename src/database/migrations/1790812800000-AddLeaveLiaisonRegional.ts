import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeaveLiaisonRegional1790812800000
  implements MigrationInterface
{
  name = 'AddLeaveLiaisonRegional1790812800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "liaison_regional_id" uuid`,
    );
    await queryRunner.query(
      `UPDATE "leave_requests"
       SET "liaison_regional_id" = "regional_id"
       WHERE "liaison_review_required" = true
         AND "liaison_regional_id" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "liaison_regional_id"`,
    );
  }
}
