import * as bcrypt from "bcrypt";

/////////////////////////////////////////////////////////////////////
//     Comparar la contraseña del backend con la base de datos     //
/////////////////////////////////////////////////////////////////////
export const comparePassword = (plainPassword: string, hashPassword: string) => {
    return bcrypt.compareSync(plainPassword, hashPassword);
}