import express from "express"
import cors from "cors"
import extractorRoutes from "./routes/extractor.routes"
import statusRoutes from "./routes/status.routes"
import dotenv from "dotenv"

dotenv.config()

const app = express()
const PORT = 4000

// Use express.json() antes de configurar as rotas
app.use(express.json())
app.use(cors())

// Extractor Routes
app.use("/api/extractor", extractorRoutes)
app.use("/api/status", statusRoutes)

app.listen(PORT, () => {
  console.log("Servidor extractor 01 rodando em http://localhost:" + PORT)
})
