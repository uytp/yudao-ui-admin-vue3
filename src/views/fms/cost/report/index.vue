<template>
  <doc-alert title="【成本】成本报表" url="https://doc.iocoder.cn/fms/cost/" />
  <ContentWrap>
    <el-form class="-mb-15px" :inline="true" label-width="68px">
      <el-form-item label="期间">
        <el-date-picker
          v-model="range"
          type="monthrange"
          value-format="YYYY-MM"
          range-separator="至"
          start-placeholder="开始月份"
          end-placeholder="结束月份"
          :clearable="false"
          class="!w-280px"
        />
      </el-form-item>
      <el-form-item label="未生成凭证">
        <el-switch v-model="includeDraft" active-text="包含草稿" inactive-text="只看已生成" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadReport"><Icon icon="ep:search" class="mr-5px" /> 查询</el-button>
        <el-button @click="handleExport"><Icon icon="ep:download" class="mr-5px" /> 导出 CSV</el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <ContentWrap>
    <el-alert
      v-if="report && report.sheetCount === 0"
      type="info"
      show-icon
      :closable="false"
      title="这段时间还没有成本计算单。请先到【成本核算】里计算成本；如果只看“已生成凭证”的月份，可以把右上方开关切到“包含草稿”。"
    />
    <el-alert
      v-else-if="report && report.draftCount > 0"
      type="warning"
      show-icon
      :closable="false"
      :title="`其中 ${report.draftCount} 个月的成本单还是草稿（没生成凭证），数字可能还会变化。`"
    />
    <el-tabs v-model="activeTab" class="mt-10px">
      <el-tab-pane label="产品成本汇总表" name="summary">
        <el-table v-loading="loading" :data="summaryRows" border stripe :row-class-name="rowClass">
          <el-table-column label="产品" min-width="150" fixed>
            <template #default="{ row }">{{ row.productCode }} {{ row.productName }}</template>
          </el-table-column>
          <el-table-column label="完工数量" prop="completedQty" align="right" width="110" :formatter="qty" />
          <el-table-column label="完工成本" align="center">
            <el-table-column label="直接材料" prop="doneMaterial" align="right" width="110" :formatter="money" />
            <el-table-column label="直接人工" prop="doneLabor" align="right" width="110" :formatter="money" />
            <el-table-column label="制造费用" prop="doneOverhead" align="right" width="110" :formatter="money" />
            <el-table-column label="合计" prop="doneTotal" align="right" width="120" :formatter="money" />
            <el-table-column label="单位成本" prop="unitCost" align="right" width="110" :formatter="unit" />
          </el-table-column>
          <el-table-column label="成本构成占比" align="center">
            <el-table-column label="材料" prop="materialRate" align="right" width="80" :formatter="percent" />
            <el-table-column label="人工" prop="laborRate" align="right" width="80" :formatter="percent" />
            <el-table-column label="费用" prop="overheadRate" align="right" width="80" :formatter="percent" />
          </el-table-column>
          <el-table-column label="销售" align="center">
            <el-table-column label="销售数量" prop="salesQty" align="right" width="110" :formatter="qty" />
            <el-table-column label="销售成本" prop="cogsAmount" align="right" width="120" :formatter="money" />
          </el-table-column>
          <el-table-column label="期末（最后一个月）" align="center">
            <el-table-column label="在产品" prop="endWipTotal" align="right" width="110" :formatter="money" />
            <el-table-column label="库存数量" prop="endStockQty" align="right" width="110" :formatter="qty" />
            <el-table-column label="库存金额" prop="endStockAmount" align="right" width="120" :formatter="money" />
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="成本明细表（按月）" name="detail">
        <el-table v-loading="loading" :data="report?.detail || []" border stripe>
          <el-table-column label="产品" min-width="150" fixed>
            <template #default="{ row }">{{ row.productCode }} {{ row.productName }}</template>
          </el-table-column>
          <el-table-column label="月份" prop="period" align="center" width="90" />
          <el-table-column label="状态" align="center" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '已生成凭证' : '草稿' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="完工数量" prop="completedQty" align="right" width="110" :formatter="qty" />
          <el-table-column label="直接材料" prop="doneMaterial" align="right" width="110" :formatter="money" />
          <el-table-column label="直接人工" prop="doneLabor" align="right" width="110" :formatter="money" />
          <el-table-column label="制造费用" prop="doneOverhead" align="right" width="110" :formatter="money" />
          <el-table-column label="完工成本" prop="doneTotal" align="right" width="120" :formatter="money" />
          <el-table-column label="单位成本" prop="unitCost" align="right" width="110" :formatter="unit" />
          <el-table-column label="销售数量" prop="salesQty" align="right" width="110" :formatter="qty" />
          <el-table-column label="销售成本" prop="cogsAmount" align="right" width="120" :formatter="money" />
          <el-table-column label="期末在产品" prop="endWipTotal" align="right" width="110" :formatter="money" />
          <el-table-column label="期末库存数量" prop="endStockQty" align="right" width="110" :formatter="qty" />
          <el-table-column label="期末库存金额" prop="endStockAmount" align="right" width="120" :formatter="money" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </ContentWrap>
</template>

<script lang="ts" setup>
import { FmsCostReportApi } from '@/api/fms/cost/report'
import type { FmsCostReportRowVO, FmsCostReportVO } from '@/api/fms/cost/report'
import { useFmsStore } from '@/views/fms/store/fms'
import { formatAmount } from '@/views/fms/utils/format'
import dayjs from 'dayjs'

defineOptions({ name: 'FmsCostReport' })

const fmsStore = useFmsStore()
const accountSetId = computed(() => fmsStore.getAccountSetId)
const loading = ref(false)
const activeTab = ref('summary')
const includeDraft = ref(true)
// 默认查今年 1 月到当前会计期间
const currentMonth = () => fmsStore.getCurrentMonth || dayjs().format('YYYY-MM')
const range = ref<[string, string]>([dayjs(currentMonth() + '-01').format('YYYY') + '-01', currentMonth()])
const report = ref<FmsCostReportVO>()

/** 汇总表 = 各产品 + 合计行 */
const summaryRows = computed<FmsCostReportRowVO[]>(() => {
  if (!report.value) return []
  return report.value.sheetCount > 0 ? [...report.value.summary, report.value.total] : []
})

const rowClass = ({ row }: { row: FmsCostReportRowVO }) => (row.productName === '合计' ? 'font-bold' : '')
const money = (_r: unknown, _c: unknown, v?: number | null) => (v === undefined || v === null ? '' : formatAmount(v))
const qty = (_r: unknown, _c: unknown, v?: number | null) =>
  v === undefined || v === null ? '' : Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 4 })
const unit = (_r: unknown, _c: unknown, v?: number | null) =>
  v === undefined || v === null ? '' : Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
const percent = (_r: unknown, _c: unknown, v?: number | null) =>
  v === undefined || v === null ? '' : `${Number(v).toFixed(2)}%`

/** 查询成本报表 */
async function loadReport() {
  if (!accountSetId.value || !range.value) return
  loading.value = true
  try {
    report.value = await FmsCostReportApi.getReport({
      accountSetId: accountSetId.value,
      startPeriod: range.value[0],
      endPeriod: range.value[1],
      includeDraft: includeDraft.value
    })
  } finally {
    loading.value = false
  }
}

/** 导出当前页签的表格为 CSV（带 BOM，Excel 打开不乱码） */
function handleExport() {
  if (!report.value) return
  const isSummary = activeTab.value === 'summary'
  const rows = isSummary ? summaryRows.value : report.value.detail
  const columns: [string, (r: FmsCostReportRowVO) => unknown][] = [
    ['产品', (r) => `${r.productCode || ''} ${r.productName || ''}`.trim()],
    ...(isSummary ? [] : ([['月份', (r: FmsCostReportRowVO) => r.period]] as [string, (r: FmsCostReportRowVO) => unknown][])),
    ['完工数量', (r) => r.completedQty],
    ['直接材料', (r) => r.doneMaterial],
    ['直接人工', (r) => r.doneLabor],
    ['制造费用', (r) => r.doneOverhead],
    ['完工成本合计', (r) => r.doneTotal],
    ['单位成本', (r) => r.unitCost],
    ...(isSummary
      ? ([
          ['材料占比%', (r: FmsCostReportRowVO) => r.materialRate],
          ['人工占比%', (r: FmsCostReportRowVO) => r.laborRate],
          ['费用占比%', (r: FmsCostReportRowVO) => r.overheadRate]
        ] as [string, (r: FmsCostReportRowVO) => unknown][])
      : []),
    ['销售数量', (r) => r.salesQty],
    ['销售成本', (r) => r.cogsAmount],
    ['期末在产品', (r) => r.endWipTotal],
    ['期末库存数量', (r) => r.endStockQty],
    ['期末库存金额', (r) => r.endStockAmount]
  ]
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [columns.map((c) => cell(c[0])).join(',')]
  rows.forEach((r) => lines.push(columns.map((c) => cell(c[1](r))).join(',')))
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${isSummary ? '产品成本汇总表' : '成本明细表'}_${range.value[0]}_${range.value[1]}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

// 当前会计期间加载完成后，把结束月份对齐到当前会计期间
watch(
  () => fmsStore.getCurrentMonth,
  (month) => {
    if (month) range.value = [month.slice(0, 4) + '-01', month]
  }
)
watch([accountSetId, range, includeDraft], loadReport, { immediate: true })

onMounted(async () => {
  if (!fmsStore.getCurrentMonth && accountSetId.value) {
    await fmsStore.loadCurrentMonth()
  }
})
</script>
