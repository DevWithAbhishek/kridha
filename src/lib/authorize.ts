import { Role } from "@prisma/client";
import { ERR } from "./errors";
import { JwtPayload } from "@/services/token.service";

export function authorize(user: JwtPayload, role: Role) {
    if (!user.roles.includes(role) && !user.roles.includes(Role.ADMIN)) {
        throw ERR.FORBIDDEN;
    }
}
