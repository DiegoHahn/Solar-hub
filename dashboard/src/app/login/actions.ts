"use server";

import { cookies } from "next/headers";

export async function clearDemoCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("solarhub_demo", "", {
    path: "/",
    maxAge: 0,
  });
}
