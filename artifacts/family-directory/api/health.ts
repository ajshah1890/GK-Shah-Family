export const config = { runtime: "edge" };

export default function handler(): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      timestamp: new Date().toISOString(),
      environment: (process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development"),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
