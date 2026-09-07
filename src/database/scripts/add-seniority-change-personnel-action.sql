-- Habilita el nuevo tipo de acción al personal en PostgreSQL.
-- Es idempotente y no modifica registros existentes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'employee_job_actions_action_type_enum'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum enum_value
    JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
    WHERE enum_type.typname = 'employee_job_actions_action_type_enum'
      AND enum_value.enumlabel = 'SENIORITY_CHANGE'
  ) THEN
    ALTER TYPE employee_job_actions_action_type_enum
      ADD VALUE 'SENIORITY_CHANGE';
  END IF;
END
$$;
