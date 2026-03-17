// FLAT LAYOUT — for external hosting (Hostinger/Railway/Render) only.
// In Replit, use artifacts/api-server instead (port 8080 via pnpm --filter @workspace/api-server run dev).
import app from "./app.js";

const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
