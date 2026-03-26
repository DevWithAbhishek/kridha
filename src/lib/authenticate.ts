import { NextRequest} from "next/server";
import jwt from "jsonwebtoken";
import { ERR } from "./errors";
import { JwtPayload } from "@/services/token.service";

export async function authenticate(req: NextRequest): Promise<JwtPayload> {
    //Try cookies first (web clients)
    const cookieToken = req.cookies.get('kridha_access')?.value;

    const token = cookieToken;
    if (!token) {
        throw ERR.UNAUTHENTICATED;
    }
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
        return payload;
    } catch (err) {
        throw ERR.UNAUTHENTICATED;
    }
}