export async function getRouter() {
  const mod = await import("./router");
  return mod.getRouter();
}
