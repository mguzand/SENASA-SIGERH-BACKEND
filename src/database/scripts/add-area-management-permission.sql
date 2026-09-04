-- PostgreSQL / SIGERH. Ejecutar después de desplegar FrontEnd y BackEnd.
-- No agrega tablas ni columnas ni cambia áreas, empleados o jefaturas.
-- Registra únicamente el componente de permisos; no concede acceso automáticamente.
-- Si DEFAULT_SYSTEM_ID tiene otro valor, sustituir el UUID antes de ejecutar.
BEGIN;
LOCK TABLE components IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE
  target_system uuid := '6816a2e5-085a-4d96-8a36-a8546d886051';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM systems WHERE id = target_system) THEN
    RAISE EXCEPTION 'No existe el sistema SIGERH indicado. Revise target_system / DEFAULT_SYSTEM_ID.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM components
    WHERE system_id = target_system AND description = 'Gestión de áreas'
  ) THEN
    INSERT INTO components (description, orden, visible, system_id)
    SELECT 'Gestión de áreas', COALESCE(MAX(orden), 0) + 1, true, target_system
    FROM components WHERE system_id = target_system;
  END IF;
END $$;
COMMIT;

SELECT components_id, description, visible, system_id
FROM components
WHERE description = 'Gestión de áreas';

-- Luego, en Usuarios y permisos, asignar «Gestión de áreas» a los usuarios autorizados.
-- Recargar la sesión para actualizar el menú. Ruta: /areas/manage.
-- Es seguro volver a ejecutar este script: no duplica el componente existente.
