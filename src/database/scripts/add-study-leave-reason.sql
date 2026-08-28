DO $$
DECLARE
  enum_name text;
BEGIN
  SELECT t.typname
    INTO enum_name
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname = 'public'
     AND e.enumlabel = 'IHSS'
     AND t.typname LIKE '%leave%reason%'
   LIMIT 1;

  IF enum_name IS NULL THEN
    RAISE EXCEPTION 'No se encontró el enum PostgreSQL de reason_type para licencias';
  END IF;

  EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', enum_name, 'STUDY');
END $$;
