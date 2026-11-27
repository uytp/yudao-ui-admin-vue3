import request from '@/config/axios'

/** 资产状态 */
export const FMS_ASSET_STATUS = { IN_USE: 0, DISPOSED: 1 } as const

/** 资产类别 */
export interface FmsAssetCategoryVO {
  id?: number
  accountSetId?: number
  code: string
  name: string
  lifeMonths: number // 默认折旧月数
  residualRate: number // 默认净残值率（百分数）
  assetSubjectId?: number
  assetSubjectName?: string
  accumSubjectId?: number
  accumSubjectName?: string
  expenseSubjectId?: number
  expenseSubjectName?: string
  remark?: string
  assetCount?: number
}

/** 资产卡片 */
export interface FmsAssetVO {
  id?: number
  accountSetId?: number
  code?: string
  name: string
  categoryId?: number
  categoryName?: string
  spec?: string
  unit?: string
  quantity?: number
  purchaseDate?: string
  startDate?: string
  originalValue?: number
  residualRate?: number
  residualValue?: number
  lifeMonths?: number
  initDeprMonths?: number
  initAccumDepr?: number
  depreciatedMonths?: number
  remainMonths?: number
  accumDepr?: number
  netValue?: number
  monthlyDepr?: number
  firstDeprMonth?: string
  missedMonths?: number
  status?: number
  disposeDate?: string
  disposeVoucherId?: number
  hasDepreciation?: boolean
  remark?: string
}

/** 折旧明细一行 */
export interface FmsAssetDepreciationRow {
  assetId?: number
  code?: string
  name: string
  categoryName?: string
  originalValue: number
  amount: number
  accumAfter: number
  netAfter: number
  depreciatedMonths?: number
  lifeMonths?: number
}

export interface FmsAssetDepreciationVO {
  period: string
  generated: boolean
  voucherId?: number
  voucherNo?: string
  warnings: string[]
  rows: FmsAssetDepreciationRow[]
  total: FmsAssetDepreciationRow
  categories: {
    categoryName: string
    expenseSubjectName: string
    accumSubjectName: string
    amount: number
  }[]
}

export interface FmsAssetReconcileVO {
  month: string
  balanced: boolean
  rows: {
    subjectName: string
    type: number // 1 原值 2 累计折旧
    cardAmount: number
    ledgerAmount: number
    diff: number
  }[]
}

// FMS 固定资产 API
export const FmsAssetApi = {
  // 资产类别
  getCategoryList: async (accountSetId: number) => {
    return await request.get<FmsAssetCategoryVO[]>({ url: '/fms/asset/category/list', params: { accountSetId } })
  },
  saveCategory: async (data: FmsAssetCategoryVO & { accountSetId: number }) => {
    return await request.post<number>({ url: '/fms/asset/category/save', data })
  },
  deleteCategory: async (accountSetId: number, id: number) => {
    return await request.delete({ url: '/fms/asset/category/delete', params: { accountSetId, id } })
  },

  // 资产卡片
  getAssetList: async (params: { accountSetId: number; categoryId?: number; status?: number; keyword?: string }) => {
    return await request.get<FmsAssetVO[]>({ url: '/fms/asset/list', params })
  },
  saveAsset: async (data: FmsAssetVO & { accountSetId: number }) => {
    return await request.post<number>({ url: '/fms/asset/save', data })
  },
  deleteAsset: async (accountSetId: number, id: number) => {
    return await request.delete({ url: '/fms/asset/delete', params: { accountSetId, id } })
  },
  disposeAsset: async (data: { accountSetId: number; id: number; disposeDate: string; remark?: string }) => {
    return await request.post<number>({ url: '/fms/asset/dispose', data })
  },
  revokeDispose: async (accountSetId: number, id: number) => {
    return await request.delete({ url: '/fms/asset/dispose/revoke', params: { accountSetId, id } })
  },

  // 折旧
  getDepreciation: async (accountSetId: number, period: string) => {
    return await request.get<FmsAssetDepreciationVO>({
      url: '/fms/asset/depreciation/get',
      params: { accountSetId, period }
    })
  },
  generateDepreciation: async (accountSetId: number, period: string) => {
    return await request.post<number>({ url: '/fms/asset/depreciation/generate', data: { accountSetId, period } })
  },
  revokeDepreciation: async (accountSetId: number, period: string) => {
    return await request.delete({ url: '/fms/asset/depreciation/revoke', params: { accountSetId, period } })
  },

  // 对账
  getReconcile: async (accountSetId: number, month: string) => {
    return await request.get<FmsAssetReconcileVO>({ url: '/fms/asset/reconcile', params: { accountSetId, month } })
  }
}
