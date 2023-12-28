import * as cheerio from "cheerio"
import { MetadataResult } from "../../types"
import { downloadAndConvertToBase64, downloadImage } from "../../lib/utils"
import { formatPrice } from "../../lib/utils"

export const extractAmazonMetadata = async (
  finalUrl: string,
  $: cheerio.CheerioAPI,
  amazon: string
): Promise<MetadataResult> => {
  const result: MetadataResult = {}
  result.website = "Amazon"

  if (amazon) {
    const parsedUrl = new URL(finalUrl)
    parsedUrl.searchParams.set("tag", amazon)
    const modifiedUrl = parsedUrl.href
    result.buyLink = modifiedUrl || finalUrl
  }

  $("h1#title").each((i: number, el: cheerio.Element) => {
    result.title = $(el).text().trim()
  })

  const originalPrice = $('span.a-price[data-a-strike="true"] > .a-offscreen')
    .first()
    .text()
  if (originalPrice) {
    result.originalPrice = formatPrice(originalPrice)
  }

  const conditionElement = $("span.best-offer-name")
  result.conditionPayment = conditionElement.text().trim()

  const oneTimePaymentElement = $(
    "#oneTimePaymentPrice_feature_div span.a-size-base.a-color-secondary"
  )
  if (oneTimePaymentElement.length > 0) {
    const oneTimePaymentText = oneTimePaymentElement.text().trim()
    result.conditionPayment = result.conditionPayment
      ? `${oneTimePaymentText} ${result.conditionPayment}`
      : oneTimePaymentText
  }

  const descriptionElement = $("#feature-bullets .a-list-item").first()
  result.description = descriptionElement.text().trim()

  const priceElement = $("span.a-offscreen").filter(
    (i: number, el: cheerio.Element) => {
      const text = $(el).text().trim()
      return text.startsWith("R$")
    }
  )

  const priceValues = priceElement
    .map(function (i: number, el: cheerio.Element) {
      return $(el).text().trim()
    })
    .get()

  const firstPrice = priceValues.length > 0 ? priceValues[0] : null

  if (firstPrice) {
    result.currentPrice = formatPrice(firstPrice)
  }

  const recurrencePriceText = $("span#sns-base-price").first().text().trim()

  // Fazer split por "R$" e pegar o segundo elemento (o primeiro valor após "R$")
  const recurrencePriceArray = recurrencePriceText.split("R$")
  const firstRecurrencePrice =
    recurrencePriceArray.length > 1 ? `R$${recurrencePriceArray[1]}` : null

  if (firstRecurrencePrice) {
    result.recurrencePrice = formatPrice(firstRecurrencePrice)
  }

  const codeElement = $(
    "th.a-color-secondary.a-size-base.prodDetSectionEntry:contains('ASIN')"
  )
    .nextAll("td")
    .first()
    .text()
    .trim()
  if (codeElement) {
    const cleanedCode = codeElement.replace(/[^a-zA-Z0-9]/g, "")
    result.productCode = cleanedCode
  }

  const imageElement = $("div#imgTagWrapperId").find("img")
  const dynamicImageData = imageElement.attr("data-a-dynamic-image")

  if (dynamicImageData) {
    const imageMap = JSON.parse(dynamicImageData)
    let maxWidth = 0
    let imageUrl = ""

    // Iterating over the entries to find the image with the maximum width
    Object.entries(imageMap).forEach(([url, dimensions]) => {
      if (
        Array.isArray(dimensions) &&
        dimensions.length > 0 &&
        typeof dimensions[0] === "number"
      ) {
        if (dimensions[0] > maxWidth) {
          maxWidth = dimensions[0]
          imageUrl = url
        }
      }
    })

    result.imagePath = imageUrl
    if(result.imagePath) {
      downloadImage(result.imagePath, amazon)
    }
  }

  const breadcrumbsList: string[] = []
  $("div#wayfinding-breadcrumbs_feature_div ul li").each(function (i, el) {
    const breadcrumb = $(this).find("a").text().trim()
    if (breadcrumb) {
      breadcrumbsList.push(breadcrumb)
    }
  })

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

  return result;
}