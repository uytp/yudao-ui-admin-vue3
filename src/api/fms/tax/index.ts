import request from '@/config/axios'

/** 发票方向 */
export const FMS_INVOICE_DIRECTION = { OUTPUT: 1, INPUT: 2 } as const
/** 发票种类 */
export const FMS_INVOICE_TYPE = { SPECIAL: 1, NORMAL: 2 } as const

/** 发票 */
export interface FmsInvoiceVO {
  id?: number
  accountSetId?: number
  direction?: number // 1 销项 2 进项
  invoiceType?: number // 1 专票 2 普票
  invoiceCode?: string
  invoiceNo?: string
  invoiceDate?: string
  invoiceMonth?: string
  counterpartName?: string
  counterpartTaxNo?: string
  amount?: number
  taxRate?: number
  taxAmount?: number
  totalAmount?: number
  status?: number // 0 正常 1 作废
  certifyStatus?: number // 0 未认证 1 已认证
  certifyPeriod?: string
  locked?: boolean
  remark?: string
}

export interface FmsTaxSettingVO {
  accountSetId?: number
  startMonth?: string
  initCarry?: number
  urbanRate?: number
  eduRate?: number
  localEduRate?: number
  effectiveStartMonth?: string
}

export interface FmsTaxRateRow {
  taxRate: number
  count: number
  amount: number
  taxAmount: number
}

export interface FmsTaxVatVO {
  period: string
  salesRows: FmsTaxRateRow[]
  salesAmount: number
  outputTax: number
  inputRows: FmsTaxRateRow[]
  inputTax: number
  uncertifiedCount: number
  uncertifiedTax: number
  priorCarry: number
  net: number
  payable: number
  carryEnd: number
  surcharges: {
    name: string
    rate: number
    base: number
    amount: number
    expenseSubjectName: string
    payableSubjectName: string
  }[]
  surchargeTotal: number
  totalPayable: number
  generated: boolean
  voucherId?: number
  voucherNo?: string
  warnings: string[]
  reconcile: {
    name: string
    subjectName: string
    invoiceAmount: number
    ledgerAmount: number
    diff: number
  }[]
}

// FMS 发票与增值税 API
export const FmsTaxApi = {
  // 发票台账
  getInvoiceList: async (params: {
    accountSetId: number
    direction?: number
    month?: string
    status?: number
    keyword?: string
  }) => {
    return await request.get<FmsInvoiceVO[]>({ url: '/fms/tax/invoice/list', params })
  },
  saveInvoice: async (data: FmsInvoiceVO & { accountSetId: number }) => {
    return await request.post<number>({ url: '/fms/tax/invoice/save', data })
  },
  deleteInvoice: async (accountSetId: number, id: number) => {
    return await request.delete({ url: '/fms/tax/invoice/delete', params: { accountSetId, id } })
  },
  voidInvoices: async (accountSetId: number, ids: number[], flag: boolean) => {
    return await request.put({ url: '/fms/tax/invoice/void', data: { accountSetId, ids, flag } })
  },
  certifyInvoices: async (
    accountSetId: number,
    ids: number[],
    flag: boolean,
    certifyPeriod?: string
  ) => {
    return await request.put({
      url: '/fms/tax/invoice/certify',
      data: { accountSetId, ids, flag, certifyPeriod }
    })
  },

  // 税务参数
  getSetting: async (accountSetId: number) => {
    return await request.get<FmsTaxSettingVO>({ url: '/fms/tax/setting/get', params: { accountSetId } })
  },
  saveSetting: async (data: FmsTaxSettingVO & { accountSetId: number }) => {
    return await request.post({ url: '/fms/tax/setting/save', data })
  },

  // 增值税申报
  getVat: async (accountSetId: number, period: string) => {
    return await request.get<FmsTaxVatVO>({ url: '/fms/tax/vat/get', params: { accountSetId, period } })
  },
  generateTaxVoucher: async (accountSetId: number, period: string) => {
    return await request.post<number>({ url: '/fms/tax/voucher/generate', data: { accountSetId, period } })
  },
  revokeTaxVoucher: async (accountSetId: number, period: string) => {
    return await request.delete({ url: '/fms/tax/voucher/revoke', params: { accountSetId, period } })
  }
}
