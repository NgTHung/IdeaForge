import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth";
import { apiResponse } from "@/server/http";

export const runtime = "nodejs";

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler((request: Request) =>
  apiResponse(() => getAuth().handler(request)));
