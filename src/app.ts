import express from "express"
import cors from "cors"
import extractorRoutes from "./routes/extractor.routes"
import statusRoutes from "./routes/status.routes"
import dotenv from "dotenv"

dotenv.config()

const app = express()
const PORT = 4000

// Log da versão do Node.js
console.log("Versão do Node.js:", process.version);

// Use express.json() antes de configurar as rotas
app.use(cors())
app.use(express.static("public"))
app.use(express.json())

// Extractor Routes
app.use("/api/extractor", extractorRoutes)
app.use("/api/status", statusRoutes)

const server: any = app.listen(PORT, () => {
  const address = server.address();
  const host = address?.address === "::" ? "localhost" : address?.address;
  const port = address?.port;

  console.log(`Servidor extractor 01 rodando em http://${host}:${port}`);
});