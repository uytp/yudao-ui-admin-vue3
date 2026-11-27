<template>
  <ContentWrap>
    <!-- 查询条件 -->
    <el-form :inline="true" label-width="70px" @submit.prevent>
      <el-form-item label="往来科目">
        <el-select v-model="query.subjectId" class="!w-200px" placeholder="选择科目" @change="handleSubjectChange">
          <el-option v-for="s in subjects" :key="s.id" :label="`${s.code} ${s.name}`" :value="s.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="往来类别">
        <el-select v-model="query.auxiliaryTypeId" class="!w-140px" placeholder="选择类别" @change="handleTypeChange">
          <el-option v-for="t in typeOptions" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="往来单位">
        <el-select
          v-model="query.auxiliaryItemId"
          class="!w-220px"
          filterable
          placeholder="选择客户 / 供应商 / 职员"
          @change="loadAll"
        >
          <el-option v-for="i in itemOptions" :key="i.id" :label="`${i.code} ${i.name}`" :value="i.id" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="loadAll"><Icon icon="ep:refresh" class="mr-5px" /> 刷新</el-button>
        <el-button
          v-hasPermi="['fms:settle:auto']"
          :disabled="!query.subjectId || !query.auxiliaryTypeId"
          @click="handleAuto(false)"
        >
          <Icon icon="ep:magic-stick" class="mr-5px" /> 自动核销当前单位
        </el-button>
        <el-button
          v-hasPermi="['fms:settle:auto']"
          :disabled="!query.subjectId || !query.auxiliaryTypeId"
          @click="handleAuto(true)"
        >
          自动核销全部单位
        </el-button>
      </el-form-item>
    </el-form>
    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="选中左边的借方和右边的贷方，调整“本次核销”金额，让两边合计相等，再点【核销】。自动核销只处理借贷未核销金额完全相等的一对一。"
    />
  </ContentWrap>

  <ContentWrap>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="未核销项目" name="open">
        <el-row :gutter="12">
          <el-col :span="12">
            <div class="mb-8px font-600">
              借方未核销（{{ isDebitNormal ? '应收增加' : '应付减少' }}）
              <span class="ml-8px text-[var(--el-text-color-secondary)] font-normal">
                合计 {{ formatAmount(open.debitRemain) }}
              </span>
            </div>
            <el-table
              ref="debitTableRef"
              v-loading="loading"
              :data="open.debitItems"
              row-key="ref"
              border
              max-height="420"
              @selection-change="(rows: FmsSettleOpenItemVO[]) => handleSelection(true, rows)"
            >
              <el-table-column type="selection" width="45" />
              <el-table-column label="日期" width="100">
                <template #default="{ row }">{{ dateText(row.voucherDate) }}</template>
              </el-table-column>
              <el-table-column label="凭证" width="90">
                <template #default="{ row }">{{ row.opening ? '期初' : row.voucherNo }}</template>
              </el-table-column>
              <el-table-column label="摘要" prop="digest" min-width="140" show-overflow-tooltip />
              <el-table-column label="未核销" width="110" align="right">
                <template #default="{ row }">{{ formatAmount(row.remainAmount) }}</template>
              </el-table-column>
              <el-table-column label="本次核销" width="130">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.settleAmount"
                    :min="0"
                    :max="row.remainAmount"
                    :precision="2"
                    :controls="false"
                    class="!w-full"
                    :disabled="!isSelected(true, row)"
                  />
                </template>
              </el-table-column>
            </el-table>
          </el-col>
          <el-col :span="12">
            <div class="mb-8px font-600">
              贷方未核销（{{ isDebitNormal ? '收款 / 冲减' : '应付增加' }}）
              <span class="ml-8px text-[var(--el-text-color-secondary)] font-normal">
                合计 {{ formatAmount(open.creditRemain) }}
              </span>
            </div>
            <el-table
              ref="creditTableRef"
              v-loading="loading"
              :data="open.creditItems"
              row-key="ref"
              border
              max-height="420"
              @selection-change="(rows: FmsSettleOpenItemVO[]) => handleSelection(false, rows)"
            >
              <el-table-column type="selection" width="45" />
              <el-table-column label="日期" width="100">
                <template #default="{ row }">{{ dateText(row.voucherDate) }}</template>
              </el-table-column>
              <el-table-column label="凭证" width="90">
                <template #default="{ row }">{{ row.opening ? '期初' : row.voucherNo }}</template>
              </el-table-column>
              <el-table-column label="摘要" prop="digest" min-width="140" show-overflow-tooltip />
              <el-table-column label="未核销" width="110" align="right">
                <template #default="{ row }">{{ formatAmount(row.remainAmount) }}</template>
              </el-table-column>
              <el-table-column label="本次核销" width="130">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.settleAmount"
                    :min="0"
                    :max="row.remainAmount"
                    :precision="2"
                    :controls="false"
                    class="!w-full"
                    :disabled="!isSelected(false, row)"
                  />
                </template>
              </el-table-column>
            </el-table>
          </el-col>
        </el-row>

        <!-- 底部：合计与核销 -->
        <div class="mt-12px flex items-center flex-wrap gap-12px">
          <span>借方本次 <b>{{ formatAmount(debitSelected) }}</b></span>
          <span>贷方本次 <b>{{ formatAmount(creditSelected) }}</b></span>
          <span :class="balanced ? 'text-[var(--el-color-success)]' : 'text-[var(--el-color-danger)]'">
            差额 {{ formatAmount(debitSelected - creditSelected) }}
          </span>
          <el-date-picker
            v-model="settleDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="核销日期（默认自动）"
            class="!w-180px"
          />
          <el-input v-model="remark" placeholder="备注（可不填）" class="!w-220px" maxlength="255" />
          <el-button
            v-hasPermi="['fms:settle:verify']"
            type="primary"
            :disabled="!canSettle"
            :loading="settling"
            @click="handleSettle"
          >
            <Icon icon="ep:finished" class="mr-5px" /> 核销
          </el-button>
        </div>
      </el-tab-pane>

      <el-tab-pane label="核销记录" name="batch">
        <el-table v-loading="loading" :data="batches" border>
          <el-table-column label="批次" prop="batchId" width="80" />
          <el-table-column label="核销日期" width="110">
            <template #default="{ row }">{{ dateText(row.settleDate) }}</template>
          </el-table-column>
          <el-table-column label="金额" width="120" align="right">
            <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
          </el-table-column>
          <el-table-column label="借方" prop="debitDesc" min-width="260" show-overflow-tooltip />
          <el-table-column label="贷方" prop="creditDesc" min-width="260" show-overflow-tooltip />
          <el-table-column label="备注" prop="remark" width="120" show-overflow-tooltip />
          <el-table-column label="操作" width="100" align="center">
            <template #default="{ row }">
              <el-button v-hasPermi="['fms:settle:revoke']" link type="danger" @click="handleRevoke(row)">
                撤销
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </ContentWrap>
</template>

<script lang="ts" setup>
import { FmsSettleApi } from '@/api/fms/settle'
import type {
  FmsSettleBatchVO,
  FmsSettleOpenItemsVO,
  FmsSettleOpenItemVO,
  FmsSettleSubjectVO
} from '@/api/fms/settle'
import { FmsAuxiliaryItemApi } from '@/api/fms/config/auxiliary/item'
import type { FmsAuxiliaryItemOptionVO } from '@/api/fms/config/auxiliary/item'
import { FmsAuxiliaryTypeApi } from '@/api/fms/config/auxiliary/type'
import type { FmsAuxiliaryTypeOptionVO } from '@/api/fms/config/auxiliary/type'
import { useFmsStore } from '@/views/fms/store/fms'
import { formatAmount } from '@/views/fms/utils/format'

defineOptions({ name: 'FmsSettleVerify' })

const message = useMessage()
const fmsStore = useFmsStore()
const accountSetId = computed(() => fmsStore.getAccountSetId)

const loading = ref(false)
const settling = ref(false)
const activeTab = ref('open')
const subjects = ref<FmsSettleSubjectVO[]>([])
const allTypes = ref<FmsAuxiliaryTypeOptionVO[]>([])
const itemOptions = ref<FmsAuxiliaryItemOptionVO[]>([])
const query = reactive({ subjectId: undefined as number | undefined, auxiliaryTypeId: undefined as number | undefined, auxiliaryItemId: undefined as number | undefined })
const open = ref<FmsSettleOpenItemsVO>({ debitItems: [], creditItems: [], debitRemain: 0, creditRemain: 0 })
const batches = ref<FmsSettleBatchVO[]>([])
const settleDate = ref<string>()
const remark = ref('')

const debitTableRef = ref()
const creditTableRef = ref()
const debitRows = ref<FmsSettleOpenItemVO[]>([])
const creditRows = ref<FmsSettleOpenItemVO[]>([])

const currentSubject = computed(() => subjects.value.find((s) => s.id === query.subjectId))
const isDebitNormal = computed(() => currentSubject.value?.balanceDirection !== 2)
const typeOptions = computed(() =>
  allTypes.value.filter((t) => currentSubject.value?.auxiliaryTypeIds.includes(t.id))
)

const sum = (rows: FmsSettleOpenItemVO[]) =>
  Math.round(rows.reduce((total, row) => total + Number(row.settleAmount || 0), 0) * 100) / 100
const debitSelected = computed(() => sum(debitRows.value))
const creditSelected = computed(() => sum(creditRows.value))
const balanced = computed(() => debitSelected.value === creditSelected.value)
const canSettle = computed(() => debitSelected.value > 0 && balanced.value)

/** 后端的日期可能是数组 [年, 月, 日]，统一成 yyyy-MM-dd */
function dateText(value: unknown): string {
  if (Array.isArray(value)) {
    return `${value[0]}-${String(value[1]).padStart(2, '0')}-${String(value[2]).padStart(2, '0')}`
  }
  return value ? String(value) : ''
}

function isSelected(debit: boolean, row: FmsSettleOpenItemVO) {
  return (debit ? debitRows.value : creditRows.value).some((r) => r.ref === row.ref)
}

/** 勾选变化：新勾选的行默认核销全部未核销金额，取消勾选的行清零 */
function handleSelection(debit: boolean, rows: FmsSettleOpenItemVO[]) {
  const previous = debit ? debitRows.value : creditRows.value
  const all = debit ? open.value.debitItems : open.value.creditItems
  for (const row of all) {
    const nowSelected = rows.some((r) => r.ref === row.ref)
    const wasSelected = previous.some((r) => r.ref === row.ref)
    if (nowSelected && !wasSelected) row.settleAmount = row.remainAmount
    if (!nowSelected) row.settleAmount = 0
  }
  if (debit) debitRows.value = rows
  else creditRows.value = rows
}

async function init() {
  if (!accountSetId.value) return
  subjects.value = await FmsSettleApi.getSettleSubjectList(accountSetId.value)
  allTypes.value = (await FmsAuxiliaryTypeApi.getAuxiliaryTypeSimpleList(accountSetId.value)) as FmsAuxiliaryTypeOptionVO[]
  if (!query.subjectId && subjects.value.length) {
    query.subjectId = subjects.value[0].id
    await handleSubjectChange()
  }
}

async function handleSubjectChange() {
  query.auxiliaryTypeId = typeOptions.value[0]?.id
  await handleTypeChange()
}

async function handleTypeChange() {
  query.auxiliaryItemId = undefined
  itemOptions.value = []
  clearOpen()
  if (!accountSetId.value || !query.auxiliaryTypeId) return
  itemOptions.value = await FmsAuxiliaryItemApi.getAuxiliaryItemSimpleList(accountSetId.value, query.auxiliaryTypeId)
}

function clearOpen() {
  open.value = { debitItems: [], creditItems: [], debitRemain: 0, creditRemain: 0 }
  batches.value = []
  debitRows.value = []
  creditRows.value = []
}

/** 重新加载未核销项目和核销记录 */
async function loadAll() {
  clearOpen()
  if (!accountSetId.value || !query.subjectId || !query.auxiliaryTypeId || !query.auxiliaryItemId) return
  loading.value = true
  try {
    const params = {
      accountSetId: accountSetId.value,
      subjectId: query.subjectId,
      auxiliaryTypeId: query.auxiliaryTypeId,
      auxiliaryItemId: query.auxiliaryItemId
    }
    const [items, list] = await Promise.all([FmsSettleApi.getOpenItems(params), FmsSettleApi.getSettleBatchList(params)])
    items.debitItems.forEach((row) => (row.settleAmount = 0))
    items.creditItems.forEach((row) => (row.settleAmount = 0))
    open.value = items
    batches.value = list
  } finally {
    loading.value = false
  }
}

async function handleSettle() {
  if (!canSettle.value) return
  settling.value = true
  try {
    const toLines = (rows: FmsSettleOpenItemVO[]) =>
      rows.filter((r) => Number(r.settleAmount) > 0).map((r) => ({ ref: r.ref, amount: Number(r.settleAmount) }))
    await FmsSettleApi.createSettle({
      accountSetId: accountSetId.value!,
      subjectId: query.subjectId!,
      auxiliaryTypeId: query.auxiliaryTypeId!,
      auxiliaryItemId: query.auxiliaryItemId!,
      settleDate: settleDate.value || undefined,
      remark: remark.value || undefined,
      debitItems: toLines(debitRows.value),
      creditItems: toLines(creditRows.value)
    })
    message.success('核销成功')
    settleDate.value = undefined
    remark.value = ''
    await loadAll()
  } finally {
    settling.value = false
  }
}

async function handleAuto(all: boolean) {
  if (!all && !query.auxiliaryItemId) {
    message.warning('请先选择往来单位，或者点【自动核销全部单位】')
    return
  }
  await message.confirm(
    all ? '将对这个类别下所有单位，把借贷未核销金额完全相等的一对一核销，是否继续？' : '将把当前单位借贷未核销金额完全相等的一对一核销，是否继续？'
  )
  const count = await FmsSettleApi.autoSettle({
    accountSetId: accountSetId.value!,
    subjectId: query.subjectId!,
    auxiliaryTypeId: query.auxiliaryTypeId!,
    auxiliaryItemId: all ? undefined : query.auxiliaryItemId
  })
  message.success(count > 0 ? `自动核销了 ${count} 对` : '没有借贷金额完全相等的项目可以自动核销')
  await loadAll()
}

async function handleRevoke(row: FmsSettleBatchVO) {
  await message.confirm(`撤销第 ${row.batchId} 批核销（${formatAmount(row.amount)} 元）？撤销后这些项目会重新变成未核销。`)
  await FmsSettleApi.revokeSettle(accountSetId.value!, row.batchId)
  message.success('已撤销')
  await loadAll()
}

watch(accountSetId, () => {
  query.subjectId = undefined
  clearOpen()
  init()
})
onMounted(init)
</script>
