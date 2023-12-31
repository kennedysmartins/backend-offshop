import * as cheerio from "cheerio"
import { MetadataResult } from "../../types"
import { downloadImage } from "../../lib/utils"
import { formatPrice } from "../../lib/utils"

export const extractMagazineLuizaMetadata = async (
  finalUrl: string,
  $: cheerio.CheerioAPI,
  magazine: string,
  user: string,
): Promise<MetadataResult> => {
  const result: MetadataResult = {}
  result.website = "Magazine Luiza"
  let modifiedUrl

  if (magazine) {
    if (finalUrl.includes("magazineluiza.com.br")) {
      modifiedUrl = finalUrl.replace(
        "magazineluiza.com.br",
        `magazinevoce.com.br/${magazine}`
      )
    } else {
      modifiedUrl = finalUrl.replace(
        /https:\/\/www\.magazinevoce\.com\.br\/magazine([^/]+)/,
        `https://www.magazinevoce.com.br/${magazine}`
      )
    }
  }

  result.buyLink = modifiedUrl || finalUrl
  result.website = "Magazine Luiza"
  result.title = $('h1[data-testid="heading-product-title"]').text().trim()
  let currentPriceMagalu = $('p[data-testid="price-value"]').text().trim()

  result.currentPrice = formatPrice(currentPriceMagalu)

  let originalPriceMagalu = $('p[data-testid="price-original"]').text().trim()

  result.originalPrice = formatPrice(originalPriceMagalu)

  result.imagePath = $('img[data-testid="image-selected-thumbnail"]').attr(
    "src"
  )
  if (result.imagePath) {
    downloadImage(result.imagePath, user)
  }

  const codeElement = $("span.sc-dcJsrY.daMqkh:contains('Código')")
    .text()
    .trim()
  if (codeElement) {
    const cleanedCode = codeElement
      .replace(/Código/g, "")
      .replace(/[^0-9ó]/g, "")

    result.productCode = cleanedCode
  }

  result.description = $('div[data-testid="rich-content-container"]')
    .text()
    .trim()
  result.conditionPayment = $('p[data-testid="installment"]').text().trim()

  const breadcrumbsList: string[] = []
  $("div.sc-dhKdcB.cFngep.sc-sLsrZ.lfArPD a.sc-koXPp.bXTNdB").each(
    (i: number, el: cheerio.Element) => {
      const breadcrumb = $(el).text().trim()
      if (breadcrumb) {
        breadcrumbsList.push(breadcrumb)
      }
    }
  )

  let nestedCategories: Record<string, any> = {}
  let currentLevel = nestedCategories
  breadcrumbsList.forEach((category, index) => {
    if (index === breadcrumbsList.length - 1) {
      currentLevel[category] = result.title
    } else {
      currentLevel[category] = {}
      currentLevel = currentLevel[category]
    }
  })

  result.breadcrumbs = nestedCategories
  return result
}
