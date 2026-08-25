-- Reasigna solicitudes pendientes que quedaron asignadas al mismo empleado
-- solicitante como jefe/delegado. Aplica a vacaciones, pases de salida y licencias.
--
-- Reglas:
--   1. Solo toca la etapa de jefatura todavía PENDIENTE.
--   2. Solo toca registros cuyo aprobador actual es el solicitante.
--   3. Busca el primer jefe/delegado ACTIVO distinto, comenzando en la unidad
--      solicitada y continuando por organizational_units.parent_id.
--   4. Si no encuentra uno, usa el jefe regional activo de la regional principal.
--   5. No modifica decisiones, observaciones ni fechas de revisión ya realizadas.

BEGIN;

CREATE TEMP TABLE pending_self_approval_reassignment
ON COMMIT DROP
AS
WITH requests AS (
  SELECT
    'VACATION'::text AS request_type,
    request.id AS request_id,
    request.employee_id,
    request.area_id
  FROM public.vacation_requests AS request
  WHERE request.stage = 'BOSS_REVIEW'
    AND request.status = 'PENDING'
    AND request.boss_status = 'PENDING'
    AND request.boss_reviewed_at IS NULL
    AND request.boss_employee_id = request.employee_id

  UNION ALL

  SELECT
    'EXIT_PERMIT'::text,
    permit.id,
    permit.employee_id,
    permit.area_id
  FROM public.employee_exit_permits AS permit
  WHERE permit.stage = 'boss_review'
    AND permit.status = 'pending'
    AND permit.boss_status = 'pending'
    AND permit.boss_reviewed_at IS NULL
    AND permit.boss_employee_id = permit.employee_id

  UNION ALL

  SELECT
    'LEAVE'::text,
    leave_request.id,
    leave_request.employee_id,
    leave_request.area_id
  FROM public.leave_requests AS leave_request
  WHERE leave_request.stage IN ('REGIONAL_REVIEW', 'AREA_REVIEW')
    AND leave_request.status = 'PENDING'
    AND leave_request.area_status = 'PENDING'
    AND leave_request.area_reviewed_at IS NULL
    AND leave_request.area_manager_employee_id = leave_request.employee_id
)
SELECT
  request.request_type,
  request.request_id,
  request.employee_id AS previous_approver_employee_id,
  request.area_id AS requested_area_id,
  COALESCE(area_approver.employee_id, main_approver.employee_id) AS new_approver_employee_id,
  area_approver.area_id AS approver_area_id,
  CASE
    WHEN area_approver.employee_id IS NOT NULL THEN 'AREA'
    WHEN main_approver.employee_id IS NOT NULL THEN 'REGIONAL'
    ELSE NULL
  END AS new_approval_scope
FROM requests AS request
LEFT JOIN LATERAL (
  WITH RECURSIVE hierarchy AS (
    SELECT unit.id, unit.parent_id, 0 AS depth
    FROM public.organizational_units AS unit
    WHERE unit.id = request.area_id
      AND unit.is_active = true

    UNION ALL

    SELECT parent.id, parent.parent_id, hierarchy.depth + 1
    FROM public.organizational_units AS parent
    INNER JOIN hierarchy ON hierarchy.parent_id = parent.id
    WHERE parent.is_active = true
  )
  SELECT
    manager.employee_id,
    manager.area_id,
    hierarchy.depth
  FROM hierarchy
  INNER JOIN public.area_managers AS manager
    ON manager.area_id = hierarchy.id
   AND manager.role = 'boss'
   AND manager.is_active = true
   AND manager.employee_id <> request.employee_id
  ORDER BY hierarchy.depth ASC, manager.created_at DESC
  LIMIT 1
) AS area_approver ON true
LEFT JOIN LATERAL (
  SELECT manager.employee_id
  FROM public.regional_managers AS manager
  INNER JOIN public.regionals AS regional
    ON regional.id = manager.regional_id
   AND regional.is_main_office = true
   AND regional.is_active = true
  WHERE manager.role = 'regional_manager'
    AND manager.is_active = true
    AND manager.employee_id <> request.employee_id
  ORDER BY manager.created_at DESC
  LIMIT 1
) AS main_approver ON area_approver.employee_id IS NULL;

-- Vista previa exacta de las reasignaciones calculadas.
SELECT
  reassignment.request_type,
  reassignment.request_id,
  employee.first_name,
  employee.last_name,
  requested_area.name AS requested_area,
  reassignment.previous_approver_employee_id,
  reassignment.new_approver_employee_id,
  approver.first_name AS approver_first_name,
  approver.last_name AS approver_last_name,
  approver_area.name AS approver_area,
  reassignment.new_approval_scope
FROM pending_self_approval_reassignment AS reassignment
INNER JOIN public.employees AS employee
  ON employee.id = reassignment.previous_approver_employee_id
LEFT JOIN public.employees AS approver
  ON approver.id = reassignment.new_approver_employee_id
LEFT JOIN public.organizational_units AS requested_area
  ON requested_area.id = reassignment.requested_area_id
LEFT JOIN public.organizational_units AS approver_area
  ON approver_area.id = reassignment.approver_area_id
ORDER BY reassignment.request_type, requested_area.name, employee.first_name;

-- Vacaciones pendientes en jefatura.
WITH updated AS (
  UPDATE public.vacation_requests AS request
  SET boss_employee_id = reassignment.new_approver_employee_id,
      approval_scope = reassignment.new_approval_scope,
      updated_at = NOW()
  FROM pending_self_approval_reassignment AS reassignment
  WHERE reassignment.request_type = 'VACATION'
    AND reassignment.new_approver_employee_id IS NOT NULL
    AND request.id = reassignment.request_id
    AND request.stage = 'BOSS_REVIEW'
    AND request.status = 'PENDING'
    AND request.boss_status = 'PENDING'
    AND request.boss_reviewed_at IS NULL
    AND request.boss_employee_id = request.employee_id
  RETURNING request.id
)
SELECT COUNT(*) AS vacaciones_reasignadas FROM updated;

-- Pases pendientes en jefatura.
WITH updated AS (
  UPDATE public.employee_exit_permits AS permit
  SET boss_employee_id = reassignment.new_approver_employee_id,
      approval_scope = reassignment.new_approval_scope,
      updated_at = NOW()
  FROM pending_self_approval_reassignment AS reassignment
  WHERE reassignment.request_type = 'EXIT_PERMIT'
    AND reassignment.new_approver_employee_id IS NOT NULL
    AND permit.id = reassignment.request_id
    AND permit.stage = 'boss_review'
    AND permit.status = 'pending'
    AND permit.boss_status = 'pending'
    AND permit.boss_reviewed_at IS NULL
    AND permit.boss_employee_id = permit.employee_id
  RETURNING permit.id
)
SELECT COUNT(*) AS pases_reasignados FROM updated;

-- Licencias cuya revisión de área todavía no se ha efectuado. Puede estar
-- pendiente primero del jefe regional; únicamente se corrige su futuro revisor de área.
WITH updated AS (
  UPDATE public.leave_requests AS leave_request
  SET area_manager_employee_id = reassignment.new_approver_employee_id,
      updated_at = NOW()
  FROM pending_self_approval_reassignment AS reassignment
  WHERE reassignment.request_type = 'LEAVE'
    AND reassignment.new_approver_employee_id IS NOT NULL
    AND leave_request.id = reassignment.request_id
    AND leave_request.stage IN ('REGIONAL_REVIEW', 'AREA_REVIEW')
    AND leave_request.status = 'PENDING'
    AND leave_request.area_status = 'PENDING'
    AND leave_request.area_reviewed_at IS NULL
    AND leave_request.area_manager_employee_id = leave_request.employee_id
  RETURNING leave_request.id
)
SELECT COUNT(*) AS licencias_reasignadas FROM updated;

-- Debe devolver cero en las tres filas. Si aparece un registro, no existía
-- ningún encargado superior distinto ni un jefe de regional principal elegible.
SELECT 'VACATION' AS request_type, COUNT(*) AS pendientes_autoasignadas
FROM public.vacation_requests
WHERE stage = 'BOSS_REVIEW'
  AND status = 'PENDING'
  AND boss_status = 'PENDING'
  AND boss_reviewed_at IS NULL
  AND boss_employee_id = employee_id
UNION ALL
SELECT 'EXIT_PERMIT', COUNT(*)
FROM public.employee_exit_permits
WHERE stage = 'boss_review'
  AND status = 'pending'
  AND boss_status = 'pending'
  AND boss_reviewed_at IS NULL
  AND boss_employee_id = employee_id
UNION ALL
SELECT 'LEAVE', COUNT(*)
FROM public.leave_requests
WHERE stage IN ('REGIONAL_REVIEW', 'AREA_REVIEW')
  AND status = 'PENDING'
  AND area_status = 'PENDING'
  AND area_reviewed_at IS NULL
  AND area_manager_employee_id = employee_id;

COMMIT;

