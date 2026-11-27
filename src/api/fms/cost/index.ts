import request from '@/config/axios'

/** FMS 成本参数 */
export interface FmsCostSettingVO {
  accountSetId: number
  productAuxTypeId?: number // 产品对应的辅助核算类别（默认存货）
  materialSubjectId?: number // 生产成本-直接材料
  laborSubjectId?: number // 生产成本-直接人工
  overheadInSubjectId?: number // 生产成本-制造费用（分配转入）
  overheadPoolSubjectId?: number // 制造费用（归集池）
  finishedSubjectId?: number // 库存商品
  cogsSubjectId?: number // 主营业务成本
  overheadAllocMethod: number // 1完工数量 2生产工时 3直接人工 4直接成本
  wipMethod: number // 0不计算在产品 1约当产量法
  materialInputMode: number // 1开工一次投入 2随加工进度投入
}

/** FMS 成本计算单明细（录入与结果共用） */
export interface FmsCostSheetItemVO {
  productItemId: number
  productCode?: string
  productName?: string
  unit?: string
  // 手工录入
  workHours?: number
  completedQty?: number
  wipQty?: number
  wipProgress?: number
  salesQty?: number
  beginWipMaterial?: number
  beginWipLabor?: number
  beginWipOverhead?: number
  beginStockQty?: number
  beginStockAmount?: number
  // 计算结果
  curMaterial?: number
  curLabor?: number
  allocOverhead?: number
  endWipMaterial?: number
  endWipLabor?: number
  endWipOverhead?: number
  doneMaterial?: number
  doneLabor?: number
  doneOverhead?: number
  doneTotal?: number
  unitCost?: number
  cogsAmount?: number
  endStockQty?: number
  endStockAmount?: number
}

/** FMS 成本计算单 */
export interface FmsCostSheetVO {
  id?: number
  accountSetId: number
  period: string
  status: number // 0草稿 1已生成凭证
  overheadTotal: number
  allocVoucherId?: number
  doneVoucherId?: number
  cogsVoucherId?: number
  items: FmsCostSheetItemVO[]
  warnings: string[]
}

export const FMS_COST_SHEET_STATUS = { DRAFT: 0, GENERATED: 1 }

// FMS 成本核算 API
export const FmsCostApi = {
  // 获得成本参数（没设置过时是推荐默认值）
  getSetting: async (accountSetId: number) => {
    return await request.get<FmsCostSettingVO>({ url: '/fms/cost/setting/get', params: { accountSetId } })
  },

  // 保存成本参数
  saveSetting: async (data: FmsCostSettingVO) => {
    return await request.put<boolean>({ url: '/fms/cost/setting/save', data })
  },

  // 获得某月成本计算单
  getSheet: async (accountSetId: number, period: string) => {
    return await request.get<FmsCostSheetVO>({ url: '/fms/cost/sheet/get', params: { accountSetId, period } })
  },

  // 计算某月成本
  calculate: async (data: { accountSetId: number; period: string; items?: FmsCostSheetItemVO[] }) => {
    return await request.post<FmsCostSheetVO>({ url: '/fms/cost/sheet/calculate', data })
  },

  // 生成成本凭证
  generateVouchers: async (accountSetId: number, period: string) => {
    return await request.post<FmsCostSheetVO>({
      url: '/fms/cost/sheet/generate-vouchers',
      params: { accountSetId, period }
    })
  },

  // 撤销成本凭证
  revokeVouchers: async (accountSetId: number, period: string) => {
    return await request.post<FmsCostSheetVO>({
      url: '/fms/cost/sheet/revoke-vouchers',
      params: { accountSetId, period }
    })
  }
}
