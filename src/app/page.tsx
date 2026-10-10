import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LandingPage } from "@/features/board/landing-page";
import { getAuth } from "@/server/auth";

async function hasSession() {
  const requestHeaders = await headers();
  try {
    return Boolean(await getAuth().api.getSession({ headers: requestHeaders }));
  } catch {
    // Keep the landing page available when the account service is unconfigured or unreachable.
    return false;
  }
}

export default async function Home() {
  if (await hasSession()) redirect("/dashboard");
  return <LandingPage />;
}
