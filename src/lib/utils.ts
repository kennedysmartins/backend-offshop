import axios from "axios"
import fs from "fs"
import path from "path"
import * as cheerio from "cheerio"
import ogs from "open-graph-scraper"
import { MetadataResult } from "../types"


export const formatPrice = (currentPrice: string) => {
  if (typeof currentPrice === "string") {
    let priceWithoutSymbol = currentPrice.replace(/^R\$\s?/, "")

    if (priceWithoutSymbol.includes(",") && priceWithoutSymbol.includes(".")) {
      priceWithoutSymbol = priceWithoutSymbol.replace(/\./g, "")
      priceWithoutSymbol = priceWithoutSymbol.replace(/\,/g, ".")
    } else {
      priceWithoutSymbol = priceWithoutSymbol.replace(/\,/g, ".")
    }

    if (
      priceWithoutSymbol.split(".").length === 2 &&
      priceWithoutSymbol.split(".")[1].length === 3
    ) {
      priceWithoutSymbol = priceWithoutSymbol.replace(/\./g, "")
    }
    parseFloat(priceWithoutSymbol)

    return priceWithoutSymbol
  }
  return currentPrice
}

export async function downloadAndConvertToBase64(url: string): Promise<string> {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" })
    const imageBuffer = Buffer.from(response.data, "binary")
    const base64Image = imageBuffer.toString("base64")
    return base64Image
  } catch (error) {
    console.error("Erro ao baixar e converter a imagem:", error)
    throw error
  }
}

export const downloadImage = async (url: string, imageName: string) => {
  const publicFolderPath = path.join(__dirname, "../../public")

  // Verifica se a pasta 'public' existe, se não, cria.
  if (!fs.existsSync(publicFolderPath)) {
    fs.mkdirSync(publicFolderPath)
  }

  const response = await axios({
    method: "GET",
    url: url,
    responseType: "stream",
  })

  const writer = fs.createWriteStream(
    path.join(publicFolderPath, `${imageName}.jpg`)
  )

  return new Promise<void>((resolve, reject) => {
    response.data.pipe(writer)
    let error: any = null

    writer.on("error", (err) => {
      error = err
      writer.close()
      reject(err)
    })

    writer.on("close", () => {
      if (!error) {
        resolve()
      }
    })
  })
}

export const extractWebsite = async (
  url: string,
): Promise<any> => {

    console.log("Extraindo...")
    try {
      const response = await axios.get(url, {
        maxRedirects: 5,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 OPR/38.0.2220.41",
        },
      })
      const $ = cheerio.load(response.data)

      return { response, $ }
    } catch (error: any) {
      console.error("Erro ao extrair metadados:", error)
    }

  // Retorno explícito para cobrir todos os caminhos possíveis
  return { error: "Função extractMetadata não retornou resultado ou erro." }
}

export const extractOG = async (
  url: string
): Promise<{ metadata?: MetadataResult; error?: string }> => {
  const data = await ogs({
    url: url,
    fetchOptions: {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
    },
  })

  const { error, result: ogsResult } = data

  return ogsResult
}
