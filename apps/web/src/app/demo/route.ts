import { NextResponse } from "next/server";
import { getAuth } from "@/server/auth";

export const dynamic = "force-dynamic";

/**
 * "View live demo": signs the visitor into the shared demo coordinator account
 * (demo bank only) and opens the dashboard, so judges don't have to sign up.
 */
export async function GET(req: Request) {
  const email = process.env.DEMO_LOGIN_EMAIL;
  const password = process.env.DEMO_LOGIN_PASSWORD;
  const origin = new URL(req.url).origin;
  if (!email || !password) return NextResponse.redirect(`${origin}/signup`);
  const res = await getAuth().api.signInEmail({ body: { email, password }, headers: req.headers, asResponse: true });
  if (!res.ok) return NextResponse.redirect(`${origin}/login`);
  const redirect = NextResponse.redirect(`${origin}/dashboard`, { status: 303 });
  for (const cookie of res.headers.getSetCookie()) redirect.headers.append("Set-Cookie", cookie);
  return redirect;
}
