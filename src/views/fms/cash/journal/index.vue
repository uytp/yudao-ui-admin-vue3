<template>
  <doc-alert title="【出纳】出纳日记账" url="https://doc.iocoder.cn/fms/ledger/" />
  <ContentWrap>
    <el-form class="-mb-15px" :inline="true" label-width="68px">
      <el-form-item label="会计期间">
        <el-date-picker v-model="month" type="month" value-format="YYYY-MM" :clearable="false" class="!w-160px" />
      </el-form-item>
      <el-form-item label="科目">
        <FmsSubjectSelect v-model="subjectId" class="!w-240px" placeholder="请选择库存现金或银行存款" />
      </el-form-item>
      <el-form-item>
        <el-button @click="getList"><Icon icon="ep:search" class="mr-5px" /> 查询</el-button>
        <el-button type="primary" :disabled="selectedIds.length === 0" @click="handleReconcile(true)">
          <Icon icon="ep:check" class="mr-5px" /> 勾对所选
        </el-button>
        <el-button :disabled="selectedIds.length === 0" @click="handleReconcile(false)">取消勾对</el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <ContentWrap>
    <el-table v-loading="loading" :data="list" border stripe height="calc(100vh - 260px)" @selection-change="handleSelection">
      <el-table-column type="selection" width="50" align="center" :selectable="isSelectable" />
      <el-table-column label="日期" prop="voucherTime" width="110" :formatter="(row: FmsCashJournalVO) => (row.voucherTime ? dayjs(row.voucherTime).format('YYYY-MM-DD') : '')" />
      <el-table-column label="凭证字号" prop="voucherNo" width="110" align="center" />
      <el-table-column label="摘要" prop="digest" min-width="200" />
      <el-table-column label="对方科目" prop="counterpartSubject" min-width="160" />
      <el-table-column label="收入" align="right" width="130">
        <template #default="scope">{{ formatMoney(scope.row.debitAmount) }}</template>
      </el-table-column>
      <el-table-column label="支出" align="right" width="130">
        <template #default="scope">{{ formatMoney(scope.row.creditAmount) }}</template>
      </el-table-column>
      <el-table-column label="余额" align="right" width="140">
        <template #default="scope">{{ formatMoney(scope.row.balance) }}</template>
      </el-table-column>
      <el-table-column label="出纳状态" align="center" width="110">
        <template #default="scope">
          <el-tag :type="scope.row.cashReconciled ? 'success' : 'info'">
            {{ scope.row.cashReconciled ? '已勾对' : '未勾对' }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>
  </ContentWrap>
</template>

<script lang="ts" setup>
import { FmsCashBankApi } from '@/api/fms/cash'
import type { FmsCashJournalVO } from '@/api/fms/cash'
import FmsSubjectSelect from '@/views/fms/config/subject/components/FmsSubjectSelect.vue'
import { useFmsStore } from '@/views/fms/store/fms'
import dayjs from 'dayjs'

defineOptions({ name: 'FmsCashJournal' })

const message = useMessage()
const fmsStore = useFmsStore()
const accountSetId = computed(() => fmsStore.getAccountSetId)
const loading = ref(false)
const list = ref<FmsCashJournalVO[]>([])
const selected = ref<FmsCashJournalVO[]>([])
const month = ref<string>(dayjs().format('YYYY-MM'))
const subjectId = ref<number>()

const selectedIds = computed(() => selected.value.map((item) => item.entryId))

/** 金额按千分位格式化 */
function formatMoney(value?: number) {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 勾对时只能选未勾对的行；取消勾对时只能选已勾对的行 */
function isSelectable(_row: FmsCashJournalVO) {
  // 两类行都可选：“勾对所选”只作用于未勾对行、“取消勾对”只作用于已勾对行，
  // 不再依赖 reconcileMode（它滞后一步，会让已勾对行无法被选中去取消勾对）
  return true
}

function handleSelection(rows: FmsCashJournalVO[]) {
  selected.value = rows
}

/** 查询出纳日记账 */
async function getList() {
  if (!accountSetId.value || !subjectId.value || !month.value) {
    list.value = []
    return
  }
  loading.value = true
  try {
    list.value = await FmsCashBankApi.getCashJournalList({
      accountSetId: accountSetId.value,
      subjectId: subjectId.value,
      month: month.value
    })
  } finally {
    loading.value = false
  }
}

/** 勾对 / 取消勾对所选分录 */
async function handleReconcile(reconciled: boolean) {
  if (!accountSetId.value || selectedIds.value.length === 0) return
  await FmsCashBankApi.updateCashReconciled({
    accountSetId: accountSetId.value,
    entryIds: selectedIds.value,
    reconciled
  })
  message.success(reconciled ? '勾对成功' : '已取消勾对')
  await getList()
}

watch([accountSetId, subjectId, month], () => getList())
</script>
