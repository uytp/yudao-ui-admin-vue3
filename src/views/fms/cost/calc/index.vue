<template>
  <doc-alert title="【成本】成本核算" url="https://doc.iocoder.cn/fms/cost/" />
  <ContentWrap>
    <el-form class="-mb-15px" :inline="true" label-width="68px">
      <el-form-item label="会计期间">
        <el-date-picker
          v-model="period"
          type="month"
          value-format="YYYY-MM"
          :clearable="false"
          class="!w-160px"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="loadSheet"><Icon icon="ep:refresh" class="mr-5px" /> 刷新</el-button>
        <el-button v-hasPermi="['fms:cost:setting']" @click="settingRef?.open()">
          <Icon icon="ep:setting" class="mr-5px" /> 成本参数
        </el-button>
        <el-button
          v-hasPermi="['fms:cost:calculate']"
          type="primary"
          :disabled="generated"
          :loading="calculating"
          @click="handleCalculate"
        >
          <Icon icon="ep:data-analysis" class="mr-5px" /> 计算成本
        </el-button>
        <el-button
          v-if="!generated"
          v-hasPermi="['fms:cost:generate']"
          type="success"
          :disabled="!sheet.id || unallocatedAmount > 0.005"
          @click="handleGenerate"
        >
          <Icon icon="ep:document-checked" class="mr-5px" /> 生成凭证
        </el-button>
        <el-button v-else v-hasPermi="['fms:cost:generate']" type="warning" @click="handleRevoke">
          <Icon icon="ep:refresh-left" class="mr-5px" /> 撤销凭证
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <ContentWrap>
    <div class="mb-10px flex items-center flex-wrap gap-12px">
      <el-tag :type="generated ? 'success' : 'info'">{{ generated ? '已生成凭证' : '草稿' }}</el-tag>
      <span>本期制造费用归集：<b>{{ formatAmount(sheet.overheadTotal) }}</b> 元</span>
      <template v-if="generated">
        <el-link type="primary" @click="openVoucher(sheet.allocVoucherId)">制造费用分配凭证</el-link>
        <el-link type="primary" @click="openVoucher(sheet.doneVoucherId)">完工入库凭证</el-link>
        <el-link type="primary" @click="openVoucher(sheet.cogsVoucherId)">销售成本凭证</el-link>
      </template>
    </div>
    <el-alert
      v-for="w in sheet.warnings"
      :key="w"
      class="mb-10px"
      type="warning"
      show-icon
      :closable="false"
      :title="w"
    />
    <el-alert
      v-if="unallocatedAmount > 0.005"
      class="mb-10px"
      type="warning"
      show-icon
      :closable="false"
      :title="`本期制造费用 ${formatAmount(sheet.overheadTotal)} 元，只分摊了 ${formatAmount(allocatedTotal)} 元：请在下表填写各产品的【${allocBaseLabel}】后，再点【计算成本】。分摊完才能生成凭证。`"
    />
    <el-alert
      v-if="!sheet.id"
      class="mb-10px"
      type="info"
      show-icon
      :closable="false"
      title="本期还没有成本计算单：先在凭证里用“产品”辅助核算记好直接材料和直接人工，再点【计算成本】；产品行会按凭证自动出现。"
    />

    <el-table v-loading="loading" :data="rows" border stripe show-summary :summary-method="summaryMethod">
      <el-table-column label="产品" fixed min-width="150">
        <template #default="{ row }">{{ row.productCode }} {{ row.productName }}</template>
      </el-table-column>
      <el-table-column label="手工录入" align="center">
        <el-table-column label="本期完工数量" width="130">
          <template #default="{ row }">
            <el-input-number v-model="row.completedQty" :disabled="generated" :min="0" :precision="4" :controls="false" class="!w-full" />
          </template>
        </el-table-column>
        <el-table-column v-if="setting.overheadAllocMethod === 2" label="生产工时" width="120">
          <template #default="{ row }">
            <el-input-number v-model="row.workHours" :disabled="generated" :min="0" :precision="2" :controls="false" class="!w-full" />
          </template>
        </el-table-column>
        <el-table-column v-if="setting.wipMethod === 1" label="期末在产品数量" width="130">
          <template #default="{ row }">
            <el-input-number v-model="row.wipQty" :disabled="generated" :min="0" :precision="4" :controls="false" class="!w-full" />
          </template>
        </el-table-column>
        <el-table-column v-if="setting.wipMethod === 1" label="完工程度%" width="110">
          <template #default="{ row }">
            <el-input-number v-model="row.wipProgress" :disabled="generated" :min="0" :max="100" :precision="2" :controls="false" class="!w-full" />
          </template>
        </el-table-column>
        <el-table-column label="本期销售数量" width="130">
          <template #default="{ row }">
            <el-input-number v-model="row.salesQty" :disabled="generated" :min="0" :precision="4" :controls="false" class="!w-full" />
          </template>
        </el-table-column>
      </el-table-column>

      <el-table-column label="本期发生" align="center">
        <el-table-column label="直接材料" prop="curMaterial" align="right" width="110" :formatter="money" />
        <el-table-column label="直接人工" prop="curLabor" align="right" width="110" :formatter="money" />
        <el-table-column label="分配制造费用" prop="allocOverhead" align="right" width="120" :formatter="money" />
      </el-table-column>

      <el-table-column label="期初结转" align="center">
        <el-table-column label="期初在产品" align="right" width="110">
          <template #default="{ row }">
            {{ formatAmount((row.beginWipMaterial || 0) + (row.beginWipLabor || 0) + (row.beginWipOverhead || 0)) }}
          </template>
        </el-table-column>
        <el-table-column label="期初库存数量" prop="beginStockQty" align="right" width="110" :formatter="qty" />
        <el-table-column label="期初库存金额" prop="beginStockAmount" align="right" width="110" :formatter="money" />
      </el-table-column>

      <el-table-column label="完工产品成本" align="center">
        <el-table-column label="材料" prop="doneMaterial" align="right" width="100" :formatter="money" />
        <el-table-column label="人工" prop="doneLabor" align="right" width="100" :formatter="money" />
        <el-table-column label="制造费用" prop="doneOverhead" align="right" width="100" :formatter="money" />
        <el-table-column label="合计" prop="doneTotal" align="right" width="110" :formatter="money" />
        <el-table-column label="单位成本" prop="unitCost" align="right" width="110" :formatter="unit" />
      </el-table-column>

      <el-table-column label="期末在产品" align="center">
        <el-table-column label="材料" prop="endWipMaterial" align="right" width="100" :formatter="money" />
        <el-table-column label="人工" prop="endWipLabor" align="right" width="100" :formatter="money" />
        <el-table-column label="制造费用" prop="endWipOverhead" align="right" width="100" :formatter="money" />
      </el-table-column>

      <el-table-column label="销售与库存" align="center">
        <el-table-column label="销售成本" prop="cogsAmount" align="right" width="110" :formatter="money" />
        <el-table-column label="期末库存数量" prop="endStockQty" align="right" width="110" :formatter="qty" />
        <el-table-column label="期末库存金额" prop="endStockAmount" align="right" width="120" :formatter="money" />
      </el-table-column>
    </el-table>
  </ContentWrap>

  <CostSettingDialog ref="settingRef" @success="onSettingSaved" />
</template>

<script lang="ts" setup>
import { FmsCostApi } from '@/api/fms/cost'
import type { FmsCostSettingVO, FmsCostSheetItemVO, FmsCostSheetVO } from '@/api/fms/cost'
import { FMS_COST_SHEET_STATUS } from '@/api/fms/cost'
import { useFmsStore } from '@/views/fms/store/fms'
import { formatAmount } from '@/views/fms/utils/format'
import CostSettingDialog from './CostSettingDialog.vue'
import dayjs from 'dayjs'

defineOptions({ name: 'FmsCostCalc' })

const message = useMessage()
const router = useRouter()
const fmsStore = useFmsStore()
const accountSetId = computed(() => fmsStore.getAccountSetId)

const loading = ref(false)
const calculating = ref(false)
const settingRef = ref<InstanceType<typeof CostSettingDialog>>()
const period = ref<string>(fmsStore.getCurrentMonth || dayjs().format('YYYY-MM'))
// 当前会计期间加载完成后（或切换账套后），默认选中当前会计期间
watch(() => fmsStore.getCurrentMonth, (month) => {
  if (month) period.value = month
})
onMounted(async () => {
  // 直接打开本页时 store 里可能还没有会计期间，主动加载一次
  if (!fmsStore.getCurrentMonth && accountSetId.value) {
    await fmsStore.loadCurrentMonth()
  }
})
const setting = ref<Partial<FmsCostSettingVO>>({ overheadAllocMethod: 1, wipMethod: 0 })
const sheet = ref<FmsCostSheetVO>(emptySheet())
const rows = computed(() => sheet.value.items)
const generated = computed(() => sheet.value.status === FMS_COST_SHEET_STATUS.GENERATED)
/** 已经分摊到各产品的制造费用合计 */
const allocatedTotal = computed(() =>
  sheet.value.items.reduce((total, item) => total + Number(item.allocOverhead || 0), 0)
)
/** 还没分摊的制造费用（大于 0 说明需要先填分摊依据） */
const unallocatedAmount = computed(() => Number(sheet.value.overheadTotal || 0) - allocatedTotal.value)
const allocBaseLabel = computed(
  () => ({ 1: '完工数量', 2: '生产工时', 3: '直接人工', 4: '直接成本' })[setting.value.overheadAllocMethod || 1]
)

function emptySheet(): FmsCostSheetVO {
  return { accountSetId: 0, period: '', status: 0, overheadTotal: 0, items: [], warnings: [] }
}

const money = (_r: unknown, _c: unknown, v?: number) => formatAmount(v)
const qty = (_r: unknown, _c: unknown, v?: number) =>
  v === undefined || v === null ? '' : Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 4 })
const unit = (_r: unknown, _c: unknown, v?: number) =>
  v === undefined || v === null ? '' : Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 6 })

/** 合计行：只对金额列求和 */
function summaryMethod({ columns, data }: { columns: any[]; data: FmsCostSheetItemVO[] }) {
  const sumProps = [
    'curMaterial', 'curLabor', 'allocOverhead', 'beginStockAmount', 'doneMaterial', 'doneLabor',
    'doneOverhead', 'doneTotal', 'endWipMaterial', 'endWipLabor', 'endWipOverhead', 'cogsAmount',
    'endStockAmount'
  ]
  return columns.map((col, index) => {
    if (index === 0) return '合计'
    if (!sumProps.includes(col.property)) return ''
    const total = data.reduce((s, r) => s + Number((r as any)[col.property] || 0), 0)
    return formatAmount(total)
  })
}

/** 读取本月成本单和成本参数 */
async function loadSheet() {
  if (!accountSetId.value || !period.value) return
  loading.value = true
  try {
    setting.value = await FmsCostApi.getSetting(accountSetId.value)
    sheet.value = await FmsCostApi.getSheet(accountSetId.value, period.value)
  } finally {
    loading.value = false
  }
}

/** 计算成本：把表格里录入的数据一起提交 */
async function handleCalculate() {
  if (!accountSetId.value) return
  calculating.value = true
  try {
    const items = sheet.value.items.map((r) => ({
      productItemId: r.productItemId,
      completedQty: r.completedQty,
      workHours: r.workHours,
      wipQty: r.wipQty,
      wipProgress: r.wipProgress,
      salesQty: r.salesQty
    }))
    sheet.value = await FmsCostApi.calculate({ accountSetId: accountSetId.value, period: period.value, items })
    message.success('计算完成')
  } finally {
    calculating.value = false
  }
}

/** 生成三张成本凭证 */
async function handleGenerate() {
  if (!accountSetId.value) return
  await message.confirm('将生成“制造费用分配、完工入库、销售成本结转”三张凭证，是否继续？')
  sheet.value = await FmsCostApi.generateVouchers(accountSetId.value, period.value)
  message.success('凭证已生成')
}

/** 撤销成本凭证（凭证已审核时需先反审核） */
async function handleRevoke() {
  if (!accountSetId.value) return
  await message.confirm('将删除本期三张成本凭证并回到草稿状态，是否继续？')
  sheet.value = await FmsCostApi.revokeVouchers(accountSetId.value, period.value)
  message.success('已撤销，可以重新计算')
}

/** 跳转到凭证 */
function openVoucher(id?: number) {
  if (id) router.push({ path: '/fms/voucher/create', query: { id } })
}

/** 参数保存后刷新页面（参数会影响显示哪些录入列） */
function onSettingSaved() {
  loadSheet()
}

watch([accountSetId, period], loadSheet, { immediate: true })
</script>
