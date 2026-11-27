<template>
  <el-empty v-if="!hasData" description="这段时间没有成本数据，请先到【成本核算】里计算成本" />
  <div v-else class="grid grid-cols-1 gap-16px xl:grid-cols-2">
    <div>
      <div class="mb-12px text-16px font-600 text-[var(--el-text-color-primary)]">
        成本构成（完工成本，单位：元）
      </div>
      <Echart :height="340" :options="compositionOptions" :not-merge="true" />
    </div>
    <div>
      <div class="mb-12px text-16px font-600 text-[var(--el-text-color-primary)]">
        各产品完工成本构成（单位：元）
      </div>
      <Echart :height="340" :options="productOptions" :not-merge="true" />
    </div>
    <div class="xl:col-span-2">
      <div class="mb-12px text-16px font-600 text-[var(--el-text-color-primary)]">
        单位成本趋势（单位：元 / 件，没有完工的月份不画点）
      </div>
      <Echart :height="340" :options="unitCostOptions" :not-merge="true" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { EChartsOption } from 'echarts'
import type { FmsCostReportVO } from '@/api/fms/cost/report'
import { formatAmount } from '@/views/fms/utils/format'

defineOptions({ name: 'FmsCostReportCharts' })

const props = defineProps<{
  report: FmsCostReportVO
}>()

/** 材料、人工、制造费用三部分固定配色，三张图里保持一致 */
const COST_COLORS = ['#5470c6', '#91cc75', '#fac858']

const hasData = computed(() => props.report.sheetCount > 0 && props.report.summary.length > 0)

/** 产品显示名：编码 + 名称 */
function productLabel(row: { productCode?: string; productName?: string }) {
  return `${row.productCode || ''} ${row.productName || ''}`.trim()
}

/** 单位成本最多显示 6 位小数 */
function formatUnitCost(value: unknown) {
  return Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

/** 成本构成：材料 / 人工 / 制造费用占完工成本的比例 */
const compositionOptions = computed<EChartsOption>(() => {
  const total = props.report.total
  const data = [
    { name: '直接材料', value: Number(total.doneMaterial) },
    { name: '直接人工', value: Number(total.doneLabor) },
    { name: '制造费用', value: Number(total.doneOverhead) }
  ].filter((item) => item.value > 0)
  return {
    color: COST_COLORS,
    tooltip: { trigger: 'item', valueFormatter: (value) => formatAmount(Number(value)) },
    legend: { bottom: 0 },
    series: [
      {
        name: '完工成本',
        type: 'pie',
        radius: ['46%', '72%'],
        center: ['50%', '44%'],
        label: { formatter: '{b}\n{d}%' },
        data
      }
    ]
  }
})

/** 各产品成本构成：堆叠柱，柱顶看合计，分段看构成 */
const productOptions = computed<EChartsOption>(() => {
  const rows = props.report.summary
  const series = [
    { name: '直接材料', key: 'doneMaterial' },
    { name: '直接人工', key: 'doneLabor' },
    { name: '制造费用', key: 'doneOverhead' }
  ] as const
  return {
    color: COST_COLORS,
    grid: { left: 16, right: 24, top: 48, bottom: 12, containLabel: true },
    legend: { top: 0 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (value) => formatAmount(Number(value)) },
    xAxis: { type: 'category', data: rows.map((row) => productLabel(row)) },
    yAxis: { type: 'value', axisLabel: { formatter: (value: number) => formatCompactAmount(value) } },
    series: series.map((item) => ({
      name: item.name,
      type: 'bar',
      stack: 'cost',
      barMaxWidth: 64,
      data: rows.map((row) => Number(row[item.key]))
    }))
  }
})

/** 单位成本趋势：每个产品一条线，横轴是月份 */
const unitCostOptions = computed<EChartsOption>(() => {
  const detail = props.report.detail
  const months = Array.from(new Set(detail.map((row) => row.period as string))).sort()
  const products = new Map<number, string>()
  detail.forEach((row) => {
    if (row.productItemId !== undefined && !products.has(row.productItemId)) {
      products.set(row.productItemId, productLabel(row))
    }
  })
  return {
    grid: { left: 16, right: 24, top: 48, bottom: 12, containLabel: true },
    legend: { top: 0 },
    tooltip: { trigger: 'axis', valueFormatter: (value) => (value === undefined || value === null ? '-' : formatUnitCost(value)) },
    xAxis: { type: 'category', boundaryGap: months.length <= 1, data: months },
    yAxis: { type: 'value', scale: true },
    series: Array.from(products.entries()).map(([productItemId, name]) => ({
      name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      connectNulls: true,
      label: { show: months.length <= 3, formatter: (p: { value: unknown }) => formatUnitCost(p.value) },
      data: months.map((month) => {
        const row = detail.find((item) => item.period === month && item.productItemId === productItemId)
        return row && Number(row.completedQty) > 0 ? Number(row.unitCost) : null
      })
    }))
  }
})

/** 格式化坐标轴金额 */
function formatCompactAmount(amount: number) {
  const value = Number(amount || 0)
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万`
  return value.toFixed(0)
}
</script>
