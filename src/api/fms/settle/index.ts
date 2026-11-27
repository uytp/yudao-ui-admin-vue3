import request from '@/config/axios'

/** 可以做往来核销的科目 */
export interface FmsSettleSubjectVO {
  id: number
  code: string
  name: string
  balanceDirection: number // 1 借 2 贷
  auxiliaryTypeIds: number[]
}

/** 一笔未核销的往来项目 */
export interface FmsSettleOpenItemVO {
  ref: string // 来源标识：E+分录编号 / O+科目-辅助组合（期初）
  opening: boolean
  voucherId?: number
  voucherNo?: string
  voucherDate: string
  digest: string
  direction: number // 1 借 2 贷
  amount: number
  settledAmount: number
  remainAmount: number
  ageDays: number
  /** 前端用：本次核销金额 */
  settleAmount?: number
}

export interface FmsSettleOpenItemsVO {
  debitItems: FmsSettleOpenItemVO[]
  creditItems: FmsSettleOpenItemVO[]
  debitRemain: number
  creditRemain: number
}

/** 往来单位查询条件 */
export interface FmsSettleItemQuery {
  accountSetId: number
  subjectId: number
  auxiliaryTypeId: number
  auxiliaryItemId: number
  /** 截止月份 yyyy-MM；不传表示看当前最新状态 */
  month?: string
}

/** 一次核销（批次） */
export interface FmsSettleBatchVO {
  batchId: number
  settleDate: string
  amount: number
  debitDesc: string
  creditDesc: string
  remark?: string
  creator?: string
  createTime: string
}

/** 账龄分析一行 */
export interface FmsSettleAgingRow {
  auxiliaryItemId?: number
  code?: string
  name: string
  mainTotal: number
  oppositeTotal: number
  netBalance: number
  buckets: number[]
}

export interface FmsSettleAgingVO {
  asOfDate: string
  balanceDirection: number
  bucketLabels: string[]
  rows: FmsSettleAgingRow[]
  total: FmsSettleAgingRow
}

// FMS 往来核销与账龄 API
export const FmsSettleApi = {
  // 可做往来核销的科目
  getSettleSubjectList: async (accountSetId: number) => {
    return await request.get<FmsSettleSubjectVO[]>({ url: '/fms/settle/subject/list', params: { accountSetId } })
  },

  // 往来单位的借方、贷方未核销项目
  getOpenItems: async (params: FmsSettleItemQuery) => {
    return await request.get<FmsSettleOpenItemsVO>({ url: '/fms/settle/open-item/list', params })
  },

  // 核销
  createSettle: async (data: {
    accountSetId: number
    subjectId: number
    auxiliaryTypeId: number
    auxiliaryItemId: number
    settleDate?: string
    remark?: string
    debitItems: { ref: string; amount: number }[]
    creditItems: { ref: string; amount: number }[]
  }) => {
    return await request.post<number>({ url: '/fms/settle/create', data })
  },

  // 自动核销（借贷未核销余额相等的一对一）
  autoSettle: async (data: {
    accountSetId: number
    subjectId: number
    auxiliaryTypeId: number
    auxiliaryItemId?: number
  }) => {
    return await request.post<number>({ url: '/fms/settle/auto', data })
  },

  // 撤销核销
  revokeSettle: async (accountSetId: number, batchId: number) => {
    return await request.delete({ url: '/fms/settle/revoke', params: { accountSetId, batchId } })
  },

  // 核销记录
  getSettleBatchList: async (params: FmsSettleItemQuery) => {
    return await request.get<FmsSettleBatchVO[]>({ url: '/fms/settle/batch/list', params })
  },

  // 账龄分析
  getAging: async (params: {
    accountSetId: number
    subjectId: number
    auxiliaryTypeId: number
    month: string
    buckets?: string
  }) => {
    return await request.get<FmsSettleAgingVO>({ url: '/fms/settle/aging/list', params })
  }
}
