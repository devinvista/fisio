import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import path from "path";
import router from "./routes";

const app: Express = express();

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  const publicDir = path.resolve(process.cwd(), "artifacts/fisiogest/dist/public");
  app.use(express.static(publicDir));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Global Error Handler]", err);
  const message = err instanceof Error ? err.message : "Internal Server Error";
  res.status(500).json({ error: "Internal Server Error", message });
});

export default app;
