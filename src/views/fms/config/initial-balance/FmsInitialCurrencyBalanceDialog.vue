<template>
  <Dialog v-model="dialogVisible" title="外币期初余额" width="1180px">
    <el-alert
      class="mb-12px"
      :closable="false"
      show-icon
      :type="editable ? 'info' : 'warning'"
      :title="
        editable
          ? '按科目 × 币别录入原币和本位币期初（按科目余额方向填正数）。输入原币会按币别默认汇率自动算本位币，可手工修改。保存后，未启用辅助核算的外币科目，其【期初余额】会自动更新为各币别本位币合计。'
          : '账套已结账，外币期初只能查看'
      "
    />
    <el-empty
      v-if="!loading && list.length === 0"
      description="还没有启用外币核算的末级科目：请先在【币别】新增外币，再到【科目】里给科目勾选外币核算"
    />
    <el-table v-else v-loading="loading" :data="list" border stripe max-height="460">
      <el-table-column label="科目" min-width="180" fixed="left">
        <template #default="scope">{{ scope.row.subjectCode }} {{ scope.row.subjectName }}</template>
      </el-table-column>
      <el-table-column label="方向" align="center" width="56">
        <template #default="scope">
          {{ scope.row.balanceDirection === FMS_DEBIT_CREDIT_DIRECTION.DEBIT ? '借' : '贷' }}
        </template>
      </el-table-column>
      <el-table-column label="币别" align="center" width="110">
        <template #default="scope">{{ scope.row.currencyCode }} {{ scope.row.currencyName }}</template>
      </el-table-column>
      <el-table-column
        v-for="group in groups"
        :key="group.label"
        :label="group.label"
        align="center"
      >
        <el-table-column label="原币" align="right" min-width="120">
          <template #default="scope">
            <el-input-number
              v-if="editable"
              v-model="scope.row[group.original]"
              :controls="false"
              :min="0"
              :precision="2"
              class="!w-full"
              @change="handleOriginalChange(scope.row, group)"
            />
            <span v-else>{{ formatAmount(scope.row[group.original]) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="本位币" align="right" min-width="120">
          <template #default="scope">
            <el-input-number
              v-if="editable"
              v-model="scope.row[group.amount]"
              :controls="false"
              :min="0"
              :precision="2"
              class="!w-full"
            />
            <span v-else>{{ formatAmount(scope.row[group.amount]) }}</span>
          </template>
        </el-table-column>
      </el-table-column>
      <el-table-column label="科目期初（本位币）" align="right" min-width="130">
        <template #default="scope">
          <span :class="{ 'text-[var(--el-color-danger)]': isMismatch(scope.row) }">
            {{ formatAmount(scope.row.subjectOpeningAmount) }}
          </span>
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="dialogVisible = false">关 闭</el-button>
      <el-button v-if="editable" type="primary" :loading="saving" @click="handleSave">
        保 存
      </el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { FmsForeignCurrencyApi } from '@/api/fms/foreign-currency'
import type { FmsInitialCurrencyBalanceVO } from '@/api/fms/foreign-currency'
import { FMS_DEBIT_CREDIT_DIRECTION } from '@/views/fms/utils/constants'
import { formatAmount } from '@/views/fms/utils/format'

defineOptions({ name: 'FmsInitialCurrencyBalanceDialog' })

type Row = FmsInitialCurrencyBalanceVO & Record<string, any>
interface Group {
  label: string
  original: keyof FmsInitialCurrencyBalanceVO
  amount: keyof FmsInitialCurrencyBalanceVO
}
const groups: Group[] = [
  { label: '期初余额', original: 'openingOriginalAmount', amount: 'openingAmount' },
  { label: '本年累计借方', original: 'yearDebitOriginalAmount', amount: 'yearDebitAmount' },
  { label: '本年累计贷方', original: 'yearCreditOriginalAmount', amount: 'yearCreditAmount' }
]

const emit = defineEmits(['success'])
const message = useMessage()
const dialogVisible = ref(false)
const loading = ref(false)
const saving = ref(false)
const editable = ref(false)
const accountSetId = ref(0)
const list = ref<Row[]>([])

/** 打开弹窗 */
async function open(id: number, canEdit: boolean) {
  accountSetId.value = id
  editable.value = canEdit
  dialogVisible.value = true
  loading.value = true
  try {
    list.value = (await FmsForeignCurrencyApi.getInitialBalanceList(id)) as Row[]
  } finally {
    loading.value = false
  }
}
defineExpose({ open })

/** 输入原币时按默认汇率带出本位币 */
function handleOriginalChange(row: Row, group: Group) {
  const original = Number(row[group.original] || 0)
  row[group.amount] = Math.round(original * Number(row.exchangeRate || 0) * 100) / 100
}

/** 科目期初与外币本位币合计不一致时标红（只对单币别、无辅助核算的科目提示） */
function isMismatch(row: Row) {
  if (row.auxiliaryAccounting) return false
  const total = list.value
    .filter((item) => item.subjectId === row.subjectId)
    .reduce((sum, item) => sum + Number(item.openingAmount || 0), 0)
  return Math.abs(total - Number(row.subjectOpeningAmount || 0)) > 0.001
}

/** 保存 */
async function handleSave() {
  saving.value = true
  try {
    await FmsForeignCurrencyApi.saveInitialBalance({
      accountSetId: accountSetId.value,
      balances: list.value.map((row) => ({
        subjectId: row.subjectId,
        currencyId: row.currencyId,
        openingOriginalAmount: row.openingOriginalAmount || 0,
        openingAmount: row.openingAmount || 0,
        yearDebitOriginalAmount: row.yearDebitOriginalAmount || 0,
        yearDebitAmount: row.yearDebitAmount || 0,
        yearCreditOriginalAmount: row.yearCreditOriginalAmount || 0,
        yearCreditAmount: row.yearCreditAmount || 0
      }))
    })
    message.success('保存成功，科目期初已同步')
    dialogVisible.value = false
    emit('success')
  } finally {
    saving.value = false
  }
}
</script>
