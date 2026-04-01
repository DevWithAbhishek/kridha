import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get("kridha_lang")?.value;
  const locale = raw === "en" ? "en" : "hi";
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
