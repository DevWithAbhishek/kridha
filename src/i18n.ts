import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export default getRequestConfig(async () => {
  // kridha_lang cookie set after login (user.preferredLang from server)
  // Falls back to 'hi' — Hindi is always the default for unauthenticated users
  const cookieStore = await cookies();
  const locale = (cookieStore.get("kridha_lang")?.value ?? "hi") as "hi" | "en";

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
