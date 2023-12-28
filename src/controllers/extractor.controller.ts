import { extractWebsite } from "../lib/utils"
import { extractAmazonMetadata } from "../lib/extractors/amazon"
import { extractDefaultMetadata } from "../lib/extractors/default"
import { extractMagazineLuizaMetadata } from "../lib/extractors/magalu"
import { extractMercadoLivreMetadata } from "../lib/extractors/mercadolivre"
import { MetadataResult } from "../types"
import * as cheerio from "cheerio"

const axios = require("axios")
const amazonPaapi = require("amazon-paapi")


export const extractMetadata = async (
  url: string,
  amazon: string,
  magazine: string,
  maxRetries: number = 1
): Promise<{ metadata?: MetadataResult; error?: string }> => {
  let retries = 0

  while (retries < maxRetries) {
    console.log("Extraindo...")
    try {
      const response = await axios.get(url, {
        maxRedirects: 5,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36",
        },
      })

      if (response.data.includes("errors/500")) {
        throw new Error("Erro 500 detectado na resposta")
      }

      const finalUrl = response.request.res.responseUrl || url
      const $ = cheerio.load(response.data)
      const result: MetadataResult = await extractMetadataFromUrl(
        finalUrl,
        $,
        amazon,
        magazine
      )

      // Additional processing, if neede

      return { metadata: result, error: undefined }
    } catch (error: any) {
      console.error("Erro ao extrair metadados:", error)
      retries++
      if (retries < maxRetries) {
        console.log("Tentando extrair novamente.")
        // Aguarde por um curto período antes de tentar novamente
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } else {
        console.error(
          "Número máximo de tentativas excedido. Não foi possível extrair os metadados."
        )
        return { error: "Número máximo de tentativas excedido." }
      }
    }
  }

  // Retorno explícito para cobrir todos os caminhos possíveis
  return { error: "Função extractMetadata não retornou resultado ou erro." }
}


const extractMetadataFromUrl = async (
  finalUrl: string,
  $: cheerio.CheerioAPI,
  amazon: string,
  magazine: string
): Promise<any> => {
const result: MetadataResult = {}

  if (/mercadolivre/.test(finalUrl)) {
    const productUrl:string|undefined  = $("a.poly-component__link--action-link").attr("href")
    return await extractMercadoLivreMetadata(finalUrl, $, amazon, productUrl)
  } else if (/amzn|amazon/.test(finalUrl)) {
    return await extractAmazonMetadata(finalUrl, $, amazon)
  } else if (/magazineluiza|magalu|magazinevoce/.test(finalUrl)) {
    return await extractMagazineLuizaMetadata(finalUrl, $, magazine)
    } else if (/offshop|offshop|offshop/.test(finalUrl)) {
      const productUrl: string | undefined = $(
        "a[target='_blank']"
      ).attr("href")
      if (productUrl) {
        const resultNewUrl = await extractWebsite(productUrl)
        $ = resultNewUrl.$
        return await extractMetadataFromUrl(productUrl, $, amazon, magazine)
      } else {
        console.error("URL de produto não encontrada em offshop.")
        return { error: "URL de produto não encontrada em offshop." }
      }
    } else {
      return await extractDefaultMetadata(finalUrl, amazon)
    }
}


export const extractAmazonAPI = async (
  AccessKey: string,
  SecretKey: string,
  PartnerTag: string,
  ASIN: string
): Promise<void> => {
  const commonParameters = {
    AccessKey: AccessKey,
    SecretKey: SecretKey,
    PartnerTag: PartnerTag, // yourtag-20
    PartnerType: "Associates", // Default value is Associates.
    Marketplace: "www.amazon.com.br", // Default value is US.
  }

  const requestParameters = {
    ItemIds: [ASIN],
    ItemIdType: "ASIN",
    Condition: "Any",
    Resources: [
      "Images.Primary.Medium",
      "ItemInfo.Title",
      "Offers.Listings.Price",
    ],
  }

  try {
    const data = await amazonPaapi.GetItems(commonParameters, requestParameters)
    // Faça algo com a resposta de sucesso.
    console.log(data)
  } catch (error) {
    // Capture um erro.
    console.log(error)
  }
}


