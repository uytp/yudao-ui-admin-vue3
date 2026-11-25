<template>
  <doc-alert title="【出纳】银行对账" url="https://doc.iocoder.cn/fms/ledger/" />
  <ContentWrap>
    <el-form class="-mb-15px" :inline="true" label-width="68px">
      <el-form-item label="会计期间">
        <el-date-picker v-model="month" type="month" value-format="YYYY-MM" :clearable="false" class="!w-160px" />
      </el-form-item>
      <el-form-item label="银行科目">
        <FmsSubjectSelect v-model="subjectId" class="!w-240px" placeholder="请选择银行存款科目" />
      </el-form-item>
      <el-form-item>
        <el-upload :show-file-list="false" :auto-upload="false" accept=".xlsx" :on-change="handleFileChange">
          <el-button type="warning" plain :disabled="!subjectId"><Icon icon="ep:upload" class="mr-5px" /> 导入对账单</el-button>
        </el-upload>
        <el-button type="primary" :disabled="!subjectId" @click="handleAutoReconcile">
          <Icon icon="ep:connection" class="mr-5px" /> 自动勾对
        </el-button>
        <el-button type="success" :disabled="!subjectId" @click="handleCalculate">生成余额调节表</el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <ContentWrap v-if="reconcile">
    <el-descriptions :column="4" border>
      <el-descriptions-item label="日记账余额">{{ formatMoney(reconcile.bookBalance) }}</el-descriptions-item>
      <el-descriptions-item label="银行对账单余额">{{ formatMoney(reconcile.bankBalance) }}</el-descriptions-item>
      <el-descriptions-item label="加：企业已收银行未收">{{ formatMoney(reconcile.bankPlusDepositInTransit) }}</el-descriptions-item>
      <el-descriptions-item label="减：企业已付银行未付">{{ formatMoney(reconcile.bankLessOutstandingCheck) }}</el-descriptions-item>
      <el-descriptions-item label="加：银行已收企业未收">{{ formatMoney(reconcile.bookPlusBankCollection) }}</el-descriptions-item>
      <el-descriptions-item label="减：银行已付企业未付">{{ formatMoney(reconcile.bookLessBankPayment) }}</el-descriptions-item>
      <el-descriptions-item label="调节后余额">{{ formatMoney(reconcile.adjustedBalance) }}</el-descriptions-item>
      <el-descriptions-item label="两边是否相等">
        <el-tag :type="reconcile.balanced ? 'success' : 'danger'">{{ reconcile.balanced ? '平衡' : '不平衡' }}</el-tag>
      </el-descriptions-item>
    </el-descriptions>
    <el-alert
      v-if="reconcile.warning"
      :title="reconcile.warning"
      type="warning"
      show-icon
      :closable="false"
      style="margin-top: 12px"
    />
    <el-table
      v-if="reconcile.unreconciledSamePeriodItems && reconcile.unreconciledSamePeriodItems.length"
      :data="reconcile.unreconciledSamePeriodItems"
      border
      style="margin-top: 12px"
      :header-cell-style="{ background: '#fdf6ec' }"
    >
      <el-table-column label="日记账日期" prop="bookDate" width="120" :formatter="(row: any) => formatDateArray(row.bookDate)" />
      <el-table-column label="对账单日期" prop="statementDate" width="120" :formatter="(row: any) => formatDateArray(row.statementDate)" />
      <el-table-column label="摘要" prop="summary" min-width="180" />
      <el-table-column label="金额" prop="amount" width="140" align="right" :formatter="(row: any) => formatMoney(row.amount)" />
      <el-table-column label="说明" min-width="220">
        <template #default>两边都有但未勾对，已从未达项中排除</template>
      </el-table-column>
    </el-table>
  </ContentWrap>

  <ContentWrap>
    <el-table v-loading="loading" :data="list" border stripe height="calc(100vh - 420px)">
      <el-table-column label="日期" prop="statementDate" width="120" :formatter="(row: FmsBankStatementVO) => { const d: any = row.statementDate; if (!d) return ''; if (Array.isArray(d)) return `${d[0]}-${String(d[1]).padStart(2, '0')}-${String(d[2]).padStart(2, '0')}`; return dayjs(d).format('YYYY-MM-DD') }" />
      <el-table-column label="摘要" prop="summary" min-width="200" />
      <el-table-column label="收入" align="right" width="130">
        <template #default="scope">{{ formatMoney(scope.row.debitAmount) }}</template>
      </el-table-column>
      <el-table-column label="支出" align="right" width="130">
        <template #default="scope">{{ formatMoney(scope.row.creditAmount) }}</template>
      </el-table-column>
      <el-table-column label="余额" align="right" width="140">
        <template #default="scope">{{ formatMoney(scope.row.balance) }}</template>
      </el-table-column>
      <el-table-column label="流水号" prop="referenceNo" width="180" />
      <el-table-column label="勾对状态" align="center" width="110">
        <template #default="scope">
          <el-tag :type="scope.row.reconciled ? 'success' : 'info'">{{ scope.row.reconciled ? '已勾对' : '未勾对' }}</el-tag>
        </template>
      </el-table-column>
    </el-table>
  </ContentWrap>
</template>

<script lang="ts" setup>
import { FmsCashBankApi } from '@/api/fms/cash'
import type { FmsBankStatementVO, FmsBankReconcileVO } from '@/api/fms/cash'
import FmsSubjectSelect from '@/views/fms/config/subject/components/FmsSubjectSelect.vue'
import { useFmsStore } from '@/views/fms/store/fms'
import dayjs from 'dayjs'

defineOptions({ name: 'FmsBankReconcile' })

const message = useMessage()
const fmsStore = useFmsStore()
const accountSetId = computed(() => fmsStore.getAccountSetId)
const loading = ref(false)
const list = ref<FmsBankStatementVO[]>([])
const reconcile = ref<FmsBankReconcileVO>()
const month = ref<string>(dayjs().format('YYYY-MM'))
const subjectId = ref<number>()

function formatDateArray(value: any) {
  if (!value) return ''
  if (Array.isArray(value)) {
    return `${value[0]}-${String(value[1]).padStart(2, '0')}-${String(value[2]).padStart(2, '0')}`
  }
  return dayjs(value).format('YYYY-MM-DD')
}

function formatMoney(value?: number) {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 查询对账单 */
async function getList() {
  if (!accountSetId.value || !subjectId.value || !month.value) {
    list.value = []
    return
  }
  loading.value = true
  try {
    list.value = await FmsCashBankApi.getBankStatementList({
      accountSetId: accountSetId.value,
      subjectId: subjectId.value,
      month: month.value
    })
  } finally {
    loading.value = false
  }
}

/** 选择 Excel 文件后导入 */
async function handleFileChange(uploadFile: { raw?: File }) {
  if (!accountSetId.value || !subjectId.value || !uploadFile.raw) return
  const count = await FmsCashBankApi.importBankStatement(accountSetId.value, subjectId.value, uploadFile.raw)
  message.success(`导入成功，共 ${count} 条`)
  await getList()
}

/** 自动勾对 */
async function handleAutoReconcile() {
  if (!accountSetId.value || !subjectId.value) return
  const count = await FmsCashBankApi.autoReconcile({
    accountSetId: accountSetId.value,
    subjectId: subjectId.value,
    month: month.value
  })
  message.success(`自动勾对完成，匹配 ${count} 条`)
  await getList()
}

/** 生成余额调节表 */
async function handleCalculate() {
  if (!accountSetId.value || !subjectId.value) return
  reconcile.value = await FmsCashBankApi.calculateBankReconcile({
    accountSetId: accountSetId.value,
    subjectId: subjectId.value,
    month: month.value
  })
}

watch([accountSetId, subjectId, month], () => {
  reconcile.value = undefined
  getList()
})
</script>
