export interface MetadataResult {
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


export interface OGSResult {
  ogImage: { url: string }[];
  ogTitle: string;
  ogDescription: string;
  // Adicione outras propriedades conforme necessário.
}
