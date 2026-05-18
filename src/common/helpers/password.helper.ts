import * as bcrypt from "bcrypt";




/////////////////////////////////////////////////////////////////////
//         Funcion para encriptar la contraseña del usurio         //
/////////////////////////////////////////////////////////////////////
export const hashPassword = (plainPassword: string) => {
    const salt = bcrypt.genSaltSync();
    return bcrypt.hashSync(plainPassword, salt);
}


/////////////////////////////////////////////////////////////////////
//     Comparar la contraseña del backend con la base de datos     //
/////////////////////////////////////////////////////////////////////
export const comparePassword = (plainPassword: string, hashPassword: string) => {
    return bcrypt.compareSync(plainPassword, hashPassword);
}


export const isUUIDv4 = (id: string): boolean => {
    const uuidv4Pattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    return uuidv4Pattern.test(id);
};