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
  user: string,
  maxRetries: number = 1
): Promise<{ metadata?: MetadataResult; error?: string }> => {
  let retries = 0
  console.log("user", user)


  while (retries < maxRetries) {
    console.log("♦ Extraindo...")
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
      console.log("♦ Extraído", finalUrl)
      const $ = cheerio.load(response.data)
      // return response.data
      const result: MetadataResult = await extractMetadataFromUrl(
        finalUrl,
        $,
        amazon,
        magazine,
        user
      )

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
  magazine: string,
  user: string
): Promise<any> => {
  const result: MetadataResult = {}

  if (/mercadolivre/.test(finalUrl)) {
    const productUrl: string | undefined = $(
      "a.poly-component__link--action-link"
    ).attr("href")
    return await extractMercadoLivreMetadata(
      finalUrl,
      $,
      amazon,
      productUrl,
      user
    )
  } else if (/amzn|amazon/.test(finalUrl)) {
    return await extractAmazonMetadata(finalUrl, $, amazon, user)
  } else if (/magazineluiza|magalu|magazinevoce/.test(finalUrl)) {
    return await extractMagazineLuizaMetadata(
      finalUrl,
      $,
      magazine,
      user
    )
  } else if (/pincei/.test(finalUrl)) {
    let productUrl = ""
    if (/pincei.com.br/.test(finalUrl)) {
      const scriptTag: any = $("#__NEXT_DATA__")
      const scriptContent: string = scriptTag.html()
      const scriptData: any = JSON.parse(scriptContent)
      productUrl = scriptData.props.pageProps.offer.url
    } else {
      productUrl = finalUrl
    }
    if (/pincei.com.br/.test(finalUrl)) {
      const resultNewUrl = await extractWebsite(productUrl)
      $ = resultNewUrl.$
      const resultNewUrl2 = await extractWebsite(resultNewUrl.finalUrl)
      $ = resultNewUrl2.$
      return await extractMetadataFromUrl(
        resultNewUrl.finalUrl,
        $,
        amazon,
        magazine,
        user
      )
    } else {
      return await extractMetadataFromUrl(productUrl, $, amazon, magazine, user)
    }
  } else if (/t.me|telegram/.test(finalUrl)) {
    let descricao: any = ""
    let links: RegExpMatchArray | null = null
    let productUrl: string | undefined

    const regexLinks = /(https?:\/\/\S+)/g

    descricao = $("meta[property='og:description']").attr("content")

    if (descricao) {
      links = descricao.match(regexLinks)
    }

    if (links && links.length > 0) {
      productUrl = links[0]
    }

    if (productUrl) {
      const resultNewUrl = await extractWebsite(productUrl)
      const resultNewUrl2 = await extractWebsite(resultNewUrl.finalUrl)
      const $new = resultNewUrl2.$

      return await extractMetadataFromUrl(
        resultNewUrl.finalUrl,
        $new,
        amazon,
        magazine,
        user
      )
    } else {
      console.error("URL de produto não encontrada em telegram.")
      return { error: "URL de produto não encontrada em telegram." }
    }
  } else if (/peguepromo.com.br/.test(finalUrl)) {
    const refreshMetaTag = $('meta[http-equiv="refresh"]')
    const contentAttribute = refreshMetaTag.attr("content")
    const match = contentAttribute?.match(/URL=(.+)/i) // Use optional chaining

    if (match && match[1]) {
      const productUrl = match[1]
      const resultNewUrl = await extractWebsite(productUrl)
      const $new = resultNewUrl.$

      return await extractMetadataFromUrl(
        productUrl,
        $new,
        amazon,
        magazine,
        user
      )
    } else {
      console.error("Unable to extract the URL.")
      return { error: "Unable to extract the URL." }
    }
  } else if (/offshop|offshop|offshop/.test(finalUrl)) {
    const productUrl: string | undefined = $("a[target='_blank']").attr("href")
    if (productUrl) {
      const resultNewUrl = await extractWebsite(productUrl)
      $ = resultNewUrl.$

      return await extractMetadataFromUrl(productUrl, $, amazon, magazine, user)
    } else {
      console.error("URL de produto não encontrada em offshop.")
      return { error: "URL de produto não encontrada em offshop." }
    }
  } else {
    return await extractDefaultMetadata(finalUrl, user)
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
    PartnerTag: PartnerTag, // your-tag-20
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
