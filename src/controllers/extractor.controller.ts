const fs = require("fs").promises
const path = require("path")
const cheerio = require("cheerio")
const axios = require("axios")
const ogs = require("open-graph-scraper")
const amazonPaapi = require("amazon-paapi")

interface MetadataResult {
  website?: string
  title?: string
  conditionPayment?: string
  imagePath?: string
  currentPrice?: string
  "price-original"?: string
  buyLink?: string
  originalPrice?: string
  description?: string
  recurrencePrice?: string
  productCode?: string
  breadcrumbs?: Record<string, any>
  productName?: string
  image64?: string
}

interface OGSResult {
  title?: string
  ogImage?: { url: string }[]
}

const formatPrice = (currentPrice:string) => {
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

async function downloadAndConvertToBase64(url: string):Promise<string> {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data, 'binary');
    const base64Image = imageBuffer.toString('base64');
    return base64Image;
  } catch (error) {
    console.error('Erro ao baixar e converter a imagem:', error);
    throw error;
  }
}


export const extractMetadata = async (
  url: string,
  amazon: string | undefined,
  magazine: string | undefined,
  maxRetries: number = 5
): Promise<{ metadata?: MetadataResult; error?: string }> => {
  let retries = 0
  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36"

  while (retries < maxRetries) {
    console.log("Extraindo...")
    try {
      const response = await axios.get(url, {
        maxRedirects: 5,
        headers: {
          "User-Agent": userAgent,
        },
      })

      if (response.data.includes("errors/500")) {
        throw new Error("Erro 500 detectado na resposta")
      }

      const finalUrl = response.request.res.responseUrl || url
      const $ = cheerio.load(response.data)
      const result: MetadataResult = {}

      if (/mercadolivre/.test(finalUrl)) {
        result.website = "Mercado Livre"
        result.title = $("div.ui-eshop-item__link")
          .find("h3.ui-eshop-item__title")
          .text()
          .trim()
        result.conditionPayment = $(
          "p.ui-eshop-item__installments.ui-eshop-item__installments--interest"
        )
          .text()
          .trim()
        result.imagePath = $(
          "div.ui-eshop-item__image_container.ui-eshop-item__image_container--row"
        )
          .find("img.ui-eshop-item__image")
          .attr("src")
          result.image64 = await downloadAndConvertToBase64(result.imagePath||'')
        const priceElement = $(
          "span.andes-money-amount.andes-money-amount--cents-superscript"
        ).first()
        const priceText = priceElement.text().trim()
        const priceMatch = priceText.match(/R\$\s*([\d.,]*)/)
        if (priceMatch) {
          result.currentPrice = formatPrice(priceMatch[0])
        }
        const oldPrice = $(
          "s.andes-money-amount.andes-money-amount-combo__previous-value.andes-money-amount--previous.andes-money-amount--cents-comma"
        )
          .text()
          .trim()
        if (oldPrice) {
          result["price-original"] = formatPrice(oldPrice)
        }
        const modifiedUrl = finalUrl
        result.buyLink = url
      } else if (/amzn|amazon/.test(finalUrl)) {
        result.website = "Amazon"

        if (amazon) {
          const parsedUrl = new URL(finalUrl)
          parsedUrl.searchParams.set("tag", amazon)
          const modifiedUrl = parsedUrl.href
          result.buyLink = modifiedUrl || finalUrl
        }

        $("h1#title").each((i: number, el: HTMLElement) => {
          result.title = $(el).text().trim()
        })

        const originalPrice = $(
          'span.a-price[data-a-strike="true"] > .a-offscreen'
        )
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
          (i: number, el: HTMLElement) => {
            const text = $(el).text().trim()
            return text.startsWith("R$")
          }
        )

        const priceValues = priceElement
          .map((i: number, el: HTMLElement) => {
            return $(el).text().trim()
          })
          .get()

        const firstPrice = priceValues.length > 0 ? priceValues[0] : null

        if (firstPrice) {
          result.currentPrice = formatPrice(firstPrice)
        }

        const recurrencePriceText = $("span#sns-base-price")
          .first()
          .text()
          .trim()

        // Fazer split por "R$" e pegar o segundo elemento (o primeiro valor após "R$")
        const recurrencePriceArray = recurrencePriceText.split("R$")
        const firstRecurrencePrice =
          recurrencePriceArray.length > 1
            ? `R$${recurrencePriceArray[1]}`
            : null

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
          result.image64 = await downloadAndConvertToBase64(
            result.imagePath || ""
          )

        }

        const breadcrumbsList: string[] = []
        $("div#wayfinding-breadcrumbs_feature_div ul li").each(
          (i: number, el: HTMLElement) => {
            const breadcrumb = $(el).find("a").text().trim()
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
      } else if (/magazineluiza|magalu|magazinevoce/.test(finalUrl)) {
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
        result.title = $('h1[data-testid="heading-product-title"]')
          .text()
          .trim()
        let currentPriceMagalu = $('p[data-testid="price-value"]').text().trim()

        result.currentPrice = formatPrice(currentPriceMagalu)

        let originalPriceMagalu = $('p[data-testid="price-original"]')
          .text()
          .trim()

        result.originalPrice = formatPrice(originalPriceMagalu)

        result.imagePath = $(
          'img[data-testid="image-selected-thumbnail"]'
        ).attr("src")
          result.image64 = await downloadAndConvertToBase64(
            result.imagePath || ""
          )


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
        result.conditionPayment = $('p[data-testid="installment"]')
          .text()
          .trim()

        const breadcrumbsList: string[] = []
        $("div.sc-dhKdcB.cFngep.sc-sLsrZ.lfArPD a.sc-koXPp.bXTNdB").each(
          (i: number, el: HTMLElement) => {
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
      } else {
        console.log(
          'O URL fornecido não contém "amzn" ou "amazon" ou "magazineluiza" ou "magazinevoce" ou mercadolivre'
        )

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

        if (!error && ogsResult) {
          result.title = ogsResult.title
          result.productName = ogsResult.title
          // Adicione os campos do OGS aos resultados
          ogsResult.ogImage = ogsResult.ogImage || []

          if (ogsResult.ogImage.length > 0) {
            // Use apenas a primeira imagem do OGS
            result.imagePath = ogsResult.ogImage[0].url
          result.image64 = await downloadAndConvertToBase64(
            result.imagePath || ""
          )

          }
        }
      }

      if (result.website !== "Mercado Livre") {
        console.log("OGS disponível...")

        const ogsOptions = {
          url: url,
          fetchOptions: {
            headers: {
              "user-agent":
                "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            },
          },
        }

        const { error, result: ogsResult } = (await ogs(ogsOptions)) as {
          error: any
          result: OGSResult
        }

        if (!error && ogsResult) {
          // Adicione os campos do OGS aos resultados
          ogsResult.ogImage = ogsResult.ogImage || []
          if (ogsResult.ogImage.length > 0) {
            // Use apenas a primeira imagem do OGS
            result.imagePath = ogsResult.ogImage[0].url
          result.image64 = await downloadAndConvertToBase64(
            result.imagePath || ""
          )

          }
        }
      }
      console.log("Finalizada a extração!")

          return { metadata: result, error: undefined };
    } catch (error: any) {
      console.error("Erro ao extrair metadados:", error);
      retries++;
      if (retries < maxRetries) {
        console.log("Tentando extrair novamente.");
        // Aguarde por um curto período antes de tentar novamente
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        console.error(
          "Número máximo de tentativas excedido. Não foi possível extrair os metadados."
        );
        return { error: "Número máximo de tentativas excedido." };
      }
    }
  }

  // Retorno explícito para cobrir todos os caminhos possíveis
  return { error: "Função extractMetadata não retornou resultado ou erro." };
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


