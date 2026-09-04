-- PostgreSQL. Idempotente: conserva las jefaturas y crea la asignación inicial.
BEGIN;
INSERT INTO regional_managers (id, regional_id, employee_id, is_active, role, can_review_vacations, can_review_exit_permits, can_review_leaves, created_at, updated_at)
SELECT gen_random_uuid(), rm.regional_id, rm.employee_id, true, 'leave_final_approver', false, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM regional_managers rm JOIN regionals r ON r.id = rm.regional_id
WHERE rm.is_active = true AND rm.role = 'regional_manager' AND r.is_main_office = true
  AND NOT EXISTS (SELECT 1 FROM regional_managers x WHERE x.is_active = true AND x.role = 'leave_final_approver')
ORDER BY rm.created_at DESC LIMIT 1;
COMMIT;

SELECT id, employee_id, role FROM regional_managers WHERE role = 'leave_final_approver' AND is_active = true;
