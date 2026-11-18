import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFunctionalPositionToDigitalSignatureRequests1795046400000 implements MigrationInterface {
  name = 'AddFunctionalPositionToDigitalSignatureRequests1795046400000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "digital_signature_requests" ADD COLUMN "functional_position" varchar(180)`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "digital_signature_requests" DROP COLUMN "functional_position"`);
  }
}
