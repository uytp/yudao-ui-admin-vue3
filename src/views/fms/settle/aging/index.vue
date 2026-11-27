<template>
  <ContentWrap>
    <el-form :inline="true" label-width="70px" @submit.prevent>
      <el-form-item label="往来科目">
        <el-select v-model="query.subjectId" class="!w-200px" placeholder="选择科目" @change="handleSubjectChange">
          <el-option v-for="s in subjects" :key="s.id" :label="`${s.code} ${s.name}`" :value="s.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="往来类别">
        <el-select v-model="query.auxiliaryTypeId" class="!w-140px" placeholder="选择类别" @change="handleQuery">
          <el-option v-for="t in typeOptions" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="截止月份">
        <el-date-picker
          v-model="query.month"
          type="month"
          value-format="YYYY-MM"
          :clearable="false"
          class="!w-150px"
          @change="handleQuery"
        />
      </el-form-item>
      <el-form-item label="账龄区间">
        <el-input v-model="query.buckets" class="!w-200px" placeholder="30,60,90,180,365" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 查询</el-button>
        <el-button @click="handleExport"><Icon icon="ep:download" class="mr-5px" /> 导出 CSV</el-button>
      </el-form-item>
    </el-form>
    <el-alert
      type="info"
      :closable="false"
      show-icon
      :title="`账龄按所选月份最后一天（${dateText(aging?.asOfDate) || '-'}）计算；只统计还没核销的金额。` +
        `“${mainLabel}”按凭证日期分到各账龄区间，“${oppositeLabel}”是还没和单据对上的款项。` +
        `余额 = ${mainLabel} - ${oppositeLabel}，应当等于账上这个单位的科目余额。`"
    />
  </ContentWrap>

  <ContentWrap>
    <el-table v-loading="loading" :data="tableRows" border show-summary :summary-method="summaryMethod" row-key="auxiliaryItemId">
      <el-table-column label="编码" prop="code" width="100" />
      <el-table-column label="名称" min-width="140">
        <template #default="{ row }">
          <el-link type="primary" @click="openDetail(row)">{{ row.name }}</el-link>
        </template>
      </el-table-column>
      <el-table-column :label="mainLabel" width="130" align="right">
        <template #default="{ row }">{{ formatAmount(row.mainTotal) }}</template>
      </el-table-column>
      <el-table-column
        v-for="(label, index) in aging?.bucketLabels || []"
        :key="label"
        :label="label"
        width="115"
        align="right"
      >
        <template #default="{ row }">
          <span :class="index >= 2 && row.buckets[index] ? 'text-[var(--el-color-danger)]' : ''">
            {{ row.buckets[index] ? formatAmount(row.buckets[index]) : '-' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column :label="oppositeLabel" width="130" align="right">
        <template #default="{ row }">{{ row.oppositeTotal ? formatAmount(row.oppositeTotal) : '-' }}</template>
      </el-table-column>
      <el-table-column label="余额" width="130" align="right">
        <template #default="{ row }">{{ formatAmount(row.netBalance) }}</template>
      </el-table-column>
    </el-table>
  </ContentWrap>

  <!-- 明细：这个单位在截止日还没核销的每一笔 -->
  <el-dialog v-model="detailVisible" :title="`${detailName} 未核销明细（截止 ${dateText(aging?.asOfDate)}）`" width="860px">
    <el-table v-loading="detailLoading" :data="detailRows" border max-height="460">
      <el-table-column label="方向" width="70">
        <template #default="{ row }">{{ row.direction === 1 ? '借' : '贷' }}</template>
      </el-table-column>
      <el-table-column label="日期" width="110">
        <template #default="{ row }">{{ dateText(row.voucherDate) }}</template>
      </el-table-column>
      <el-table-column label="凭证" width="90">
        <template #default="{ row }">{{ row.opening ? '期初' : row.voucherNo }}</template>
      </el-table-column>
      <el-table-column label="摘要" prop="digest" min-width="180" show-overflow-tooltip />
      <el-table-column label="原金额" width="110" align="right">
        <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
      </el-table-column>
      <el-table-column label="未核销" width="110" align="right">
        <template #default="{ row }">{{ formatAmount(row.remainAmount) }}</template>
      </el-table-column>
      <el-table-column label="账龄(天)" width="90" align="right" prop="ageDays" />
    </el-table>
  </el-dialog>
</template>

<script lang="ts" setup>
import dayjs from 'dayjs'
import { FmsSettleApi } from '@/api/fms/settle'
import type { FmsSettleAgingRow, FmsSettleAgingVO, FmsSettleOpenItemVO, FmsSettleSubjectVO } from '@/api/fms/settle'
import { FmsAuxiliaryTypeApi } from '@/api/fms/config/auxiliary/type'
import type { FmsAuxiliaryTypeOptionVO } from '@/api/fms/config/auxiliary/type'
import { useFmsStore } from '@/views/fms/store/fms'
import { formatAmount } from '@/views/fms/utils/format'

defineOptions({ name: 'FmsSettleAging' })

const message = useMessage()
const fmsStore = useFmsStore()
const accountSetId = computed(() => fmsStore.getAccountSetId)

const loading = ref(false)
const subjects = ref<FmsSettleSubjectVO[]>([])
const allTypes = ref<FmsAuxiliaryTypeOptionVO[]>([])
const aging = ref<FmsSettleAgingVO>()
const query = reactive({
  subjectId: undefined as number | undefined,
  auxiliaryTypeId: undefined as number | undefined,
  month: fmsStore.getCurrentMonth || dayjs().format('YYYY-MM'),
  buckets: '30,60,90,180,365'
})

const currentSubject = computed(() => subjects.value.find((s) => s.id === query.subjectId))
const isDebitNormal = computed(() => currentSubject.value?.balanceDirection !== 2)
const typeOptions = computed(() => allTypes.value.filter((t) => currentSubject.value?.auxiliaryTypeIds.includes(t.id)))
/** 应收类（借方余额）正方向是借方，应付类正方向是贷方 */
const mainLabel = computed(() => (isDebitNormal.value ? '应收未核销' : '应付未核销'))
const oppositeLabel = computed(() => (isDebitNormal.value ? '收款未核销' : '付款未核销'))
const tableRows = computed(() => aging.value?.rows || [])

function dateText(value: unknown): string {
  if (Array.isArray(value)) {
    return `${value[0]}-${String(value[1]).padStart(2, '0')}-${String(value[2]).padStart(2, '0')}`
  }
  return value ? String(value) : ''
}

/** 合计行直接用后端算好的 total，避免前端再累加出误差 */
function summaryMethod({ columns }: { columns: any[] }) {
  const total = aging.value?.total
  return columns.map((column, index) => {
    if (index === 0) return '合计'
    if (!total) return ''
    if (index === 1) return ''
    if (index === 2) return formatAmount(total.mainTotal)
    const bucketCount = aging.value?.bucketLabels.length || 0
    if (index < 3 + bucketCount) return formatAmount(total.buckets[index - 3])
    if (index === 3 + bucketCount) return formatAmount(total.oppositeTotal)
    return formatAmount(total.netBalance)
  })
}

async function init() {
  if (!accountSetId.value) return
  if (!fmsStore.getCurrentMonth) {
    const month = await fmsStore.loadCurrentMonth()
    if (month) query.month = month
  } else {
    query.month = fmsStore.getCurrentMonth
  }
  subjects.value = await FmsSettleApi.getSettleSubjectList(accountSetId.value)
  allTypes.value = (await FmsAuxiliaryTypeApi.getAuxiliaryTypeSimpleList(accountSetId.value)) as FmsAuxiliaryTypeOptionVO[]
  if (!query.subjectId && subjects.value.length) {
    query.subjectId = subjects.value[0].id
    await handleSubjectChange()
  }
}

async function handleSubjectChange() {
  query.auxiliaryTypeId = typeOptions.value[0]?.id
  await handleQuery()
}

async function handleQuery() {
  aging.value = undefined
  if (!accountSetId.value || !query.subjectId || !query.auxiliaryTypeId) return
  loading.value = true
  try {
    aging.value = await FmsSettleApi.getAging({
      accountSetId: accountSetId.value,
      subjectId: query.subjectId,
      auxiliaryTypeId: query.auxiliaryTypeId,
      month: query.month,
      buckets: query.buckets || undefined
    })
  } finally {
    loading.value = false
  }
}

// ---- 明细弹窗 ----
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailName = ref('')
const detailRows = ref<FmsSettleOpenItemVO[]>([])
async function openDetail(row: FmsSettleAgingRow) {
  if (!row.auxiliaryItemId) return
  detailName.value = row.name
  detailVisible.value = true
  detailLoading.value = true
  try {
    const result = await FmsSettleApi.getOpenItems({
      accountSetId: accountSetId.value!,
      subjectId: query.subjectId!,
      auxiliaryTypeId: query.auxiliaryTypeId!,
      auxiliaryItemId: row.auxiliaryItemId,
      month: query.month
    })
    detailRows.value = [...result.debitItems, ...result.creditItems].sort((a, b) =>
      dateText(a.voucherDate).localeCompare(dateText(b.voucherDate))
    )
  } finally {
    detailLoading.value = false
  }
}

/** 导出当前表格为 CSV（带 BOM，Excel 打开不乱码） */
function handleExport() {
  if (!aging.value || !aging.value.rows.length) {
    message.warning('没有可导出的数据')
    return
  }
  const head = ['编码', '名称', mainLabel.value, ...aging.value.bucketLabels, oppositeLabel.value, '余额']
  const toLine = (r: FmsSettleAgingRow) =>
    [r.code || '', r.name, r.mainTotal, ...r.buckets, r.oppositeTotal, r.netBalance].join(',')
  const csv = [head.join(','), ...aging.value.rows.map(toLine), toLine(aging.value.total)].join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `账龄分析_${currentSubject.value?.name || ''}_${query.month}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

watch(accountSetId, () => {
  query.subjectId = undefined
  aging.value = undefined
  init()
})
onMounted(init)
</script>
