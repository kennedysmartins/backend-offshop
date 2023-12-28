import * as cheerio from "cheerio"
import { MetadataResult } from "../../types"
import { downloadImage, extractWebsite } from "../../lib/utils"
import { formatPrice } from "../../lib/utils"

export const extractMercadoLivreMetadata = async (
  finalUrl: string,
  $: cheerio.CheerioAPI,
  amazon: string,
  productUrl: string | undefined
): Promise<MetadataResult> => {
  const result: MetadataResult = {}
  result.website = "Mercado Livre"

  if (productUrl) {
    const resultNewUrl = await extractWebsite(productUrl)
    $ = resultNewUrl.$
  }
  console.log("Mercado Livre")
  result.website = "Mercado Livre"
  result.title = $("h1.ui-pdp-title").text().trim()
  result.conditionPayment = $("div.ui-pdp-price__subtitles").text().trim()
  result.imagePath = $("figure.ui-pdp-gallery__figure")
    .find("img.ui-pdp-image")
    .attr("src")
  // result.image64 = await downloadAndConvertToBase64(result.imagePath || "")
  const priceElement = $(
    "span.andes-money-amount.andes-money-amount--cents-superscript"
  ).first()

  if (result.imagePath) {
    downloadImage(result.imagePath, amazon)
  }

  const priceText = priceElement.text().trim()
  const priceMatch = priceText.match(/R\$\s*([\d.,]*)/)
  if (priceMatch) {
    result.currentPrice = formatPrice(priceMatch[0])
  }
  const oldPrice = $("span.andes-money-amount__fraction").first().text().trim()
  if (oldPrice) {
    result["price-original"] = formatPrice(oldPrice)
  }
  result.buyLink = finalUrl
  return result
}
