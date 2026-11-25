<template>
  <ContentWrap>
    <el-form class="-mb-15px" :inline="true" label-width="68px">
      <el-form-item label="会计期间">
        <FmsLedgerMonthRangePicker v-model="monthRange" />
      </el-form-item>
      <el-form-item label="科目">
        <el-select v-model="queryParams.subjectId" clearable filterable placeholder="全部外币科目" class="!w-240px">
          <el-option
            v-for="subject in foreignSubjects"
            :key="subject.id"
            :label="`${subject.code} ${subject.name}`"
            :value="subject.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="币别">
        <FmsCurrencySelect v-model="queryParams.currencyId" exclude-standard placeholder="全部外币" class="!w-180px" />
      </el-form-item>
      <el-form-item>
        <el-button @click="getList"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <ContentWrap>
    <el-table
      id="fms-currency-balance-table"
      v-loading="loading"
      :data="list"
      border
      stripe
      show-summary
      :summary-method="getSummaries"
      height="calc(100vh - 245px)"
    >
      <el-table-column label="科目编码" prop="subjectCode" min-width="100" fixed="left" />
      <el-table-column label="科目名称" prop="subjectName" min-width="140" fixed="left" />
      <el-table-column label="币别" min-width="90" fixed="left">
        <template #default="scope">{{ scope.row.currencyCode }} {{ scope.row.currencyName }}</template>
      </el-table-column>
      <el-table-column label="期初余额" align="center">
        <el-table-column label="方向" prop="openingDirection" align="center" width="56" />
        <el-table-column label="原币" align="right" min-width="110">
          <template #default="scope">{{ formatMoney(scope.row.openingOriginalAmount) }}</template>
        </el-table-column>
        <el-table-column label="本位币" align="right" min-width="120">
          <template #default="scope">{{ formatMoney(scope.row.openingAmount) }}</template>
        </el-table-column>
      </el-table-column>
      <el-table-column label="本期借方" align="center">
        <el-table-column label="原币" align="right" min-width="110">
          <template #default="scope">{{ formatMoney(scope.row.periodDebitOriginalAmount) }}</template>
        </el-table-column>
        <el-table-column label="本位币" align="right" min-width="120">
          <template #default="scope">{{ formatMoney(scope.row.periodDebitAmount) }}</template>
        </el-table-column>
      </el-table-column>
      <el-table-column label="本期贷方" align="center">
        <el-table-column label="原币" align="right" min-width="110">
          <template #default="scope">{{ formatMoney(scope.row.periodCreditOriginalAmount) }}</template>
        </el-table-column>
        <el-table-column label="本位币" align="right" min-width="120">
          <template #default="scope">{{ formatMoney(scope.row.periodCreditAmount) }}</template>
        </el-table-column>
      </el-table-column>
      <el-table-column label="本年累计借方" align="center">
        <el-table-column label="原币" align="right" min-width="110">
          <template #default="scope">{{ formatMoney(scope.row.yearDebitOriginalAmount) }}</template>
        </el-table-column>
        <el-table-column label="本位币" align="right" min-width="120">
          <template #default="scope">{{ formatMoney(scope.row.yearDebitAmount) }}</template>
        </el-table-column>
      </el-table-column>
      <el-table-column label="本年累计贷方" align="center">
        <el-table-column label="原币" align="right" min-width="110">
          <template #default="scope">{{ formatMoney(scope.row.yearCreditOriginalAmount) }}</template>
        </el-table-column>
        <el-table-column label="本位币" align="right" min-width="120">
          <template #default="scope">{{ formatMoney(scope.row.yearCreditAmount) }}</template>
        </el-table-column>
      </el-table-column>
      <el-table-column label="期末余额" align="center">
        <el-table-column label="方向" prop="endingDirection" align="center" width="56" />
        <el-table-column label="原币" align="right" min-width="110">
          <template #default="scope">{{ formatMoney(scope.row.endingOriginalAmount) }}</template>
        </el-table-column>
        <el-table-column label="本位币" align="right" min-width="120">
          <template #default="scope">
            <el-button link type="primary" @click="openDetail(scope.row)">
              {{ formatMoney(scope.row.endingAmount) || '0.00' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table-column>
    </el-table>
  </ContentWrap>
</template>

<script lang="ts" setup>
import * as FmsSubjectApi from '@/api/fms/config/subject'
import type { FmsSubjectVO } from '@/api/fms/config/subject'
import { FmsForeignCurrencyApi } from '@/api/fms/foreign-currency'
import FmsCurrencySelect from '@/views/fms/config/currency/components/FmsCurrencySelect.vue'
import FmsLedgerMonthRangePicker from '@/views/fms/ledger/components/FmsLedgerMonthRangePicker.vue'
import { useFmsStore } from '@/views/fms/store/fms'
import { formatMoney } from '@/views/fms/utils/format'
import { formatDate } from '@/utils/formatTime'
import type { FmsLedgerCurrencyBalanceVO, FmsLedgerCurrencyReqVO } from '@/api/fms/foreign-currency'

defineOptions({ name: 'FmsCurrencyBalance' })

const router = useRouter()
const fmsStore = useFmsStore()
const accountSetId = computed(() => fmsStore.getAccountSetId) // 当前账套编号
const loading = ref(false)
const list = ref<FmsLedgerCurrencyBalanceVO[]>([])
const foreignSubjects = ref<FmsSubjectVO[]>([]) // 启用外币核算的末级科目
const currentMonth = formatDate(new Date(), 'YYYY-MM')
const monthRange = ref<string[]>([currentMonth, currentMonth])
const queryParams = reactive<FmsLedgerCurrencyReqVO>({
  accountSetId: 0,
  startMonth: currentMonth,
  endMonth: currentMonth
})

watch(accountSetId, () => init())

/** 初始化 */
async function init() {
  if (!accountSetId.value) return
  const accountingMonth = await fmsStore.loadCurrentMonth()
  if (accountingMonth) monthRange.value = [accountingMonth, accountingMonth]
  const subjects = await FmsSubjectApi.getSubjectSimpleList(accountSetId.value)
  const parentIds = new Set(subjects.map((subject) => subject.parentId))
  foreignSubjects.value = subjects.filter(
    (subject) => subject.currencyIds?.length && !parentIds.has(subject.id)
  )
  await getList()
}

/** 查询外币余额表 */
async function getList() {
  if (!accountSetId.value || monthRange.value.length !== 2) return
  Object.assign(queryParams, {
    accountSetId: accountSetId.value,
    startMonth: monthRange.value[0],
    endMonth: monthRange.value[1]
  })
  loading.value = true
  try {
    list.value = await FmsForeignCurrencyApi.getBalanceList(queryParams)
  } finally {
    loading.value = false
  }
}

/** 重置 */
async function resetQuery() {
  queryParams.subjectId = undefined
  queryParams.currencyId = undefined
  await init()
}

/** 合计行：只合计本位币（不同币别原币不能相加） */
function getSummaries({ columns }: { columns: any[] }) {
  const sums: string[] = []
  columns.forEach((column, index) => {
    if (index === 0) {
      sums[index] = '本位币合计'
      return
    }
    sums[index] = ''
  })
  const sum = (field: keyof FmsLedgerCurrencyBalanceVO, signed = false) =>
    list.value.reduce((total, row) => {
      const value = Number(row[field] || 0)
      if (!signed) return total + value
      const direction = field === 'openingAmount' ? row.openingDirection : row.endingDirection
      return total + (direction === '贷' ? -value : value)
    }, 0)
  const opening = sum('openingAmount', true)
  const ending = sum('endingAmount', true)
  const fmt = (value: number) => formatMoney(Math.abs(value)) || '0.00'
  // 列顺序：编码、名称、币别、方向、原币、本位币、借原、借本、贷原、贷本、年借原、年借本、年贷原、年贷本、方向、原币、本位币
  sums[3] = opening > 0 ? '借' : opening < 0 ? '贷' : '平'
  sums[5] = fmt(opening)
  sums[7] = fmt(sum('periodDebitAmount'))
  sums[9] = fmt(sum('periodCreditAmount'))
  sums[11] = fmt(sum('yearDebitAmount'))
  sums[13] = fmt(sum('yearCreditAmount'))
  sums[14] = ending > 0 ? '借' : ending < 0 ? '贷' : '平'
  sums[16] = fmt(ending)
  return sums
}

/** 打开外币明细账 */
function openDetail(row: FmsLedgerCurrencyBalanceVO) {
  router.push({
    path: '/fms/ledger/currency-detail',
    query: {
      subjectId: row.subjectId,
      currencyId: row.currencyId,
      startMonth: queryParams.startMonth,
      endMonth: queryParams.endMonth
    }
  })
}

onMounted(() => init())
</script>
