import { UserRole } from 'src/modules/users/enums/user-role.enum';

export interface JwtPayload {
  id?: string;
  sub?: string;
  username?: string;
  email: string;
  role: UserRole;
}
