import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

export interface HierarchyUnit {
  id: string;
  parent_id: string | null;
  is_active: boolean;
}

export function validateAreaMove(
  units: HierarchyUnit[],
  id: string,
  parentId: string | null,
  expectedParentId: string | null,
) {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const unit = byId.get(id);
  if (!unit) throw new NotFoundException('El área ya no existe.');
  if (unit.parent_id !== expectedParentId) {
    throw new ConflictException(
      'Otro usuario cambió esta área. Actualice la estructura antes de moverla.',
    );
  }
  if (parentId === id)
    throw new BadRequestException('Un área no puede depender de sí misma.');
  if (parentId) {
    const parent = byId.get(parentId);
    if (!parent)
      throw new NotFoundException('El área de destino ya no existe.');
    if (!parent.is_active)
      throw new BadRequestException('El área de destino debe estar activa.');
  }
  const visited = new Set<string>([id]);
  let current = parentId;
  while (current) {
    if (visited.has(current)) {
      throw new BadRequestException(
        'No puede mover un área dentro de una de sus subáreas ni crear una relación circular.',
      );
    }
    visited.add(current);
    const ancestor = byId.get(current);
    if (!ancestor)
      throw new BadRequestException(
        'El destino tiene una dependencia inválida. Revise su estructura.',
      );
    current = ancestor.parent_id;
  }
}
