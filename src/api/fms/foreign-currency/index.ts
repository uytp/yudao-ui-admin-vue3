import request from '@/config/axios'

/** 币别汇率 */
export interface FmsCurrencyRateVO {
  id?: number // 汇率记录编号
  accountSetId?: number // 账套编号
  currencyId: number // 币别编号
  currencyCode?: string // 币别编码
  currencyName?: string // 币别名称
  month: string // 会计期间 yyyy-MM
  rate: number // 汇率
  source?: number // 1 本期汇率表 2 沿用以前期间 3 币别默认汇率
}

/** 外币期初 */
export interface FmsInitialCurrencyBalanceVO {
  id?: number
  subjectId: number
  subjectCode: string
  subjectName: string
  balanceDirection: number
  auxiliaryAccounting: boolean
  currencyId: number
  currencyCode: string
  currencyName: string
  exchangeRate: number
  openingOriginalAmount: number
  openingAmount: number
  yearDebitOriginalAmount: number
  yearDebitAmount: number
  yearCreditOriginalAmount: number
  yearCreditAmount: number
  subjectOpeningAmount: number
}

/** 外币账簿查询参数 */
export interface FmsLedgerCurrencyReqVO {
  accountSetId: number
  startMonth: string
  endMonth: string
  subjectId?: number
  currencyId?: number
}

/** 外币余额表 */
export interface FmsLedgerCurrencyBalanceVO {
  subjectId: number
  subjectCode: string
  subjectName: string
  currencyId: number
  currencyCode: string
  currencyName: string
  openingDirection: string
  openingOriginalAmount: number
  openingAmount: number
  periodDebitOriginalAmount: number
  periodDebitAmount: number
  periodCreditOriginalAmount: number
  periodCreditAmount: number
  yearDebitOriginalAmount: number
  yearDebitAmount: number
  yearCreditOriginalAmount: number
  yearCreditAmount: number
  endingDirection: string
  endingOriginalAmount: number
  endingAmount: number
}

/** 外币明细账 */
export interface FmsLedgerCurrencyDetailVO {
  rowType: number // 1 期初余额 2 凭证 3 本月合计 4 本年累计
  period: string
  accountDate: string
  voucherId?: number
  voucherNumber?: string
  digest: string
  exchangeRate?: number
  debitOriginalAmount: number
  debitAmount: number
  creditOriginalAmount: number
  creditAmount: number
  balanceDirection: string
  balanceOriginalAmount: number
  balanceAmount: number
}

/** 期末调汇 */
export interface FmsExchangeAdjustReqVO {
  accountSetId: number
  profitLossSubjectId?: number
  voucherWordId?: number
  rates?: { currencyId: number; rate?: number }[]
}

export interface FmsExchangeAdjustLineVO {
  subjectId: number
  subjectCode: string
  subjectName: string
  currencyId: number
  currencyCode: string
  currencyName: string
  rate: number
  direction: string
  endingOriginalAmount: number
  endingAmount: number
  adjustedAmount: number
  differenceAmount: number
}

export interface FmsExchangeAdjustRespVO {
  month: string
  profitLossSubjectId?: number
  profitLossSubjectCode?: string
  profitLossSubjectName?: string
  rates: FmsCurrencyRateVO[]
  lines: FmsExchangeAdjustLineVO[]
  totalDifference: number
  voucherId?: number
}

// FMS 外币核算 API
export const FmsForeignCurrencyApi = {
  getRateList: async (accountSetId: number, currencyId?: number) => {
    return await request.get<FmsCurrencyRateVO[]>({
      url: '/fms/foreign-currency/rate/list',
      params: { accountSetId, currencyId }
    })
  },
  getMonthRateList: async (accountSetId: number, month: string) => {
    return await request.get<FmsCurrencyRateVO[]>({
      url: '/fms/foreign-currency/rate/month-list',
      params: { accountSetId, month }
    })
  },
  saveRate: async (data: FmsCurrencyRateVO & { accountSetId: number }) => {
    return await request.put<number>({ url: '/fms/foreign-currency/rate/save', data })
  },
  deleteRate: async (accountSetId: number, id: number) => {
    return await request.delete({
      url: '/fms/foreign-currency/rate/delete',
      params: { accountSetId, id }
    })
  },
  getInitialBalanceList: async (accountSetId: number) => {
    return await request.get<FmsInitialCurrencyBalanceVO[]>({
      url: '/fms/foreign-currency/initial-balance/list',
      params: { accountSetId }
    })
  },
  saveInitialBalance: async (data: {
    accountSetId: number
    balances: Partial<FmsInitialCurrencyBalanceVO>[]
  }) => {
    return await request.put({ url: '/fms/foreign-currency/initial-balance/save', data })
  },
  getBalanceList: async (params: FmsLedgerCurrencyReqVO) => {
    return await request.get<FmsLedgerCurrencyBalanceVO[]>({
      url: '/fms/foreign-currency/ledger/balance/list',
      params
    })
  },
  getDetailList: async (params: FmsLedgerCurrencyReqVO) => {
    return await request.get<FmsLedgerCurrencyDetailVO[]>({
      url: '/fms/foreign-currency/ledger/detail/list',
      params
    })
  },
  previewExchangeAdjust: async (data: FmsExchangeAdjustReqVO) => {
    return await request.post<FmsExchangeAdjustRespVO>({
      url: '/fms/foreign-currency/exchange-adjust/preview',
      data
    })
  },
  generateExchangeAdjust: async (data: FmsExchangeAdjustReqVO) => {
    return await request.post<FmsExchangeAdjustRespVO>({
      url: '/fms/foreign-currency/exchange-adjust/generate',
      data
    })
  }
}
