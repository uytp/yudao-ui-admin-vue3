import request from '@/config/axios'

/** FMS 成本报表的一行：汇总表里 period 为空，明细表里 period 是具体月份 */
export interface FmsCostReportRowVO {
  period?: string
  status?: number // 0草稿 1已生成凭证
  productItemId?: number
  productCode?: string
  productName?: string
  unit?: string
  completedQty?: number | null
  doneMaterial: number
  doneLabor: number
  doneOverhead: number
  doneTotal: number
  unitCost?: number | null
  materialRate: number
  laborRate: number
  overheadRate: number
  salesQty?: number | null
  cogsAmount: number
  endWipTotal: number
  endStockQty?: number | null
  endStockAmount: number
}

/** FMS 成本报表 */
export interface FmsCostReportVO {
  startPeriod: string
  endPeriod: string
  sheetCount: number
  draftCount: number
  summary: FmsCostReportRowVO[]
  total: FmsCostReportRowVO
  detail: FmsCostReportRowVO[]
}

// FMS 成本报表 API
export const FmsCostReportApi = {
  // 获得成本报表（产品成本汇总表 + 成本明细表）
  getReport: async (params: {
    accountSetId: number
    startPeriod: string
    endPeriod: string
    includeDraft: boolean
  }) => {
    return await request.get<FmsCostReportVO>({ url: '/fms/cost/report/get', params })
  }
}
