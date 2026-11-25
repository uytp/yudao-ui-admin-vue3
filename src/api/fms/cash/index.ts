import request from '@/config/axios'

/** FMS 出纳日记账分录 */
export interface FmsCashJournalVO {
  entryId: number // 分录编号
  voucherId: number // 凭证编号
  voucherTime: string // 凭证日期
  voucherNo: string // 凭证字号
  digest: string // 摘要
  counterpartSubject: string // 对方科目
  debitAmount: number // 借方金额
  creditAmount: number // 贷方金额
  balance: number // 余额
  cashReconciled: boolean // 出纳已勾对
}

/** FMS 银行对账单 */
export interface FmsBankStatementVO {
  id: number
  statementDate: string
  summary: string
  debitAmount: number
  creditAmount: number
  balance: number
  referenceNo: string
  reconciled: boolean
  voucherEntryId?: number
}

/** FMS 银行余额调节表 */
export interface FmsBankReconcileVO {
  bookBalance: number
  bankBalance: number
  bankPlusDepositInTransit: number
  bankLessOutstandingCheck: number
  bookPlusBankCollection: number
  bookLessBankPayment: number
  adjustedBalance: number
  balanced: boolean
}

// FMS 出纳与银行对账 API
export const FmsCashBankApi = {
  // 查询出纳日记账
  getCashJournalList: async (params: { accountSetId: number; subjectId: number; month: string }) => {
    return await request.get<FmsCashJournalVO[]>({ url: '/fms/cash/journal/list', params })
  },

  // 勾对 / 取消勾对
  updateCashReconciled: async (data: { accountSetId: number; entryIds: number[]; reconciled: boolean }) => {
    return await request.put({ url: '/fms/cash/reconcile/update', data })
  },

  // 导入银行对账单
  importBankStatement: async (accountSetId: number, subjectId: number, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return await request.upload({
      url: `/fms/cash/bank-statement/import?accountSetId=${accountSetId}&subjectId=${subjectId}`,
      data: formData
    })
  },

  // 查询银行对账单
  getBankStatementList: async (params: { accountSetId: number; subjectId: number; month: string }) => {
    return await request.get<FmsBankStatementVO[]>({ url: '/fms/cash/bank-statement/list', params })
  },

  // 自动勾对
  autoReconcile: async (params: { accountSetId: number; subjectId: number; month: string }) => {
    return await request.post<number>({ url: '/fms/cash/reconcile/auto', params })
  },

  // 生成 / 计算银行余额调节表
  calculateBankReconcile: async (params: { accountSetId: number; subjectId: number; month: string }) => {
    return await request.post<FmsBankReconcileVO>({ url: '/fms/cash/bank-reconcile/calculate', params })
  }
}
