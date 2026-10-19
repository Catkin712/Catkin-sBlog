import { handleRequest } from "../../server-core.mjs";
import {
    errorResponse,
    isWriteRequest,
    prepareReadEnv,
    withDatabaseWrite,
} from "../lib/runtime.mjs";

export default async function handler(request) {
    try {
        if (isWriteRequest(request)) {
            return await withDatabaseWrite(async (requestEnv) => {
                return await handleRequest(request, requestEnv);
            });
        }

        const env = await prepareReadEnv();
        return await handleRequest(request, env);
    } catch (error) {
        console.error("Netlify function request failed:", error);
        return errorResponse(request, error);
    }
}

export const config = {
    path: "/*",
    preferStatic: true,
};
