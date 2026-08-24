-- Migración controlada de PASES DE SALIDA pendientes en RR. HH.
-- También corrige regional_id en registros antiguos usando la regional del empleado.

BEGIN;

-- Diagnóstico inicial de lo que actualmente aparece pendiente en RR. HH.
SELECT
  COUNT(*) AS total_pendientes_rrhh,
  COUNT(*) FILTER (WHERE permit.regional_id IS NULL) AS sin_regional_en_solicitud,
  COUNT(*) FILTER (
    WHERE permit.regional_id IS NULL AND employee.regional_id IS NULL
  ) AS sin_regional_tambien_en_empleado
FROM public.employee_exit_permits AS permit
INNER JOIN public.employees AS employee
  ON employee.id = permit.employee_id
WHERE permit.stage = 'hr_review'
  AND permit.status = 'pending'
  AND permit.boss_status = 'approved'
  AND permit.hr_status = 'pending';

-- Traslada únicamente pases pendientes que poseen un enlace elegible.
WITH updated_exit_permits AS (
  UPDATE public.employee_exit_permits AS permit
  SET regional_id = COALESCE(permit.regional_id, employee.regional_id),
      liaison_review_required = true,
      liaison_status = 'pending',
      liaison_employee_id = NULL,
      liaison_observation = NULL,
      liaison_reviewed_at = NULL,
      updated_at = NOW()
  FROM public.employees AS employee
  WHERE employee.id = permit.employee_id
    AND COALESCE(permit.regional_id, employee.regional_id) IS NOT NULL
    AND permit.stage = 'hr_review'
    AND permit.status = 'pending'
    AND permit.boss_status = 'approved'
    AND permit.hr_status = 'pending'
    AND permit.liaison_review_required IS NOT TRUE
    AND permit.liaison_reviewed_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.regional_managers AS liaison
      WHERE liaison.regional_id = COALESCE(permit.regional_id, employee.regional_id)
        AND liaison.role = 'hr_liaison'
        AND liaison.is_active = true
        AND liaison.can_review_exit_permits = true
    )
  RETURNING permit.id
)
SELECT COUNT(*) AS pases_trasladados
FROM updated_exit_permits;

COMMIT;

-- Verificación posterior.
SELECT
  COUNT(*) FILTER (
    WHERE permit.liaison_review_required = true
      AND permit.liaison_status = 'pending'
  ) AS pendientes_en_bandeja_enlace,
  COUNT(*) FILTER (
    WHERE permit.liaison_review_required IS NOT TRUE
  ) AS pendientes_que_continuan_en_rrhh
FROM public.employee_exit_permits AS permit
WHERE permit.stage = 'hr_review'
  AND permit.status = 'pending'
  AND permit.boss_status = 'approved'
  AND permit.hr_status = 'pending';

-- Detalle de pases que no pudieron moverse porque empleado/solicitud no tienen regional.
SELECT
  permit.id,
  permit.employee_id,
  employee.first_name,
  employee.last_name,
  permit.regional_id AS regional_solicitud,
  employee.regional_id AS regional_empleado
FROM public.employee_exit_permits AS permit
INNER JOIN public.employees AS employee
  ON employee.id = permit.employee_id
WHERE permit.stage = 'hr_review'
  AND permit.status = 'pending'
  AND permit.boss_status = 'approved'
  AND permit.hr_status = 'pending'
  AND permit.liaison_review_required IS NOT TRUE
  AND COALESCE(permit.regional_id, employee.regional_id) IS NULL
ORDER BY permit.created_at DESC;

-- Si quedaron solicitudes en RR. HH., este resumen muestra la razón por regional.
SELECT
  regional.id AS regional_id,
  regional.name AS regional,
  COUNT(*) AS pases_pendientes,
  EXISTS (
    SELECT 1
    FROM public.regional_managers AS liaison
    WHERE liaison.regional_id = regional.id
      AND liaison.role = 'hr_liaison'
      AND liaison.is_active = true
      AND liaison.can_review_exit_permits = true
  ) AS tiene_enlace_con_permiso_pases
FROM public.employee_exit_permits AS permit
INNER JOIN public.employees AS employee ON employee.id = permit.employee_id
INNER JOIN public.regionals AS regional ON regional.id = COALESCE(permit.regional_id, employee.regional_id)
WHERE permit.stage = 'hr_review'
  AND permit.status = 'pending'
  AND permit.boss_status = 'approved'
  AND permit.hr_status = 'pending'
  AND permit.liaison_review_required IS NOT TRUE
GROUP BY regional.id, regional.name
ORDER BY pases_pendientes DESC;
