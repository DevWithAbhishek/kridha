import { NextRequest} from "next/server";
import jwt from "jsonwebtoken";
import { ERR } from "./errors";
import { JwtPayload } from "@/services/token.service";

export async function authenticate(req: NextRequest): Promise<JwtPayload> {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw ERR.UNAUTHENTICATED;
    }

    const token = authHeader.slice(7);

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
        return payload;
    } catch (err) {
        throw ERR.UNAUTHENTICATED;
    }
}