import { downloadImage, extractOG } from "../../lib/utils"
import { MetadataResult } from "../../types"

export const extractDefaultMetadata = async (
  url: string,
  amazon: string): Promise<MetadataResult> => {
  console.log("DefaultMetadata")
  let result: MetadataResult = {}

  const ogsResult: any = await extractOG(url)

  if (ogsResult) {
    if (ogsResult.ogImage) {
      result.imagePath = ogsResult.ogImage[0].url
      downloadImage(ogsResult.ogImage[0].url, amazon)
    }
    result.title = ogsResult.ogTitle
    result.productName = ogsResult.ogTitle
    result.description = ogsResult.ogDescription
    result.buyLink = url
    result.originalPrice = ''
    result.currentPrice = ''
    result.productCode = ''
    result.conditionPayment = ''
    result.website = ''

    console.log("Extraído com sucesso")
  }

  return result
}
