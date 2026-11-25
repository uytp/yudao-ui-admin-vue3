<template>
  <ContentWrap>
    <el-form class="-mb-15px" :inline="true" label-width="68px">
      <el-form-item label="会计期间">
        <FmsLedgerMonthRangePicker v-model="monthRange" />
      </el-form-item>
      <el-form-item label="科目">
        <el-select v-model="queryParams.subjectId" filterable placeholder="请选择外币科目" class="!w-240px" @change="handleSubjectChange">
          <el-option
            v-for="subject in foreignSubjects"
            :key="subject.id"
            :label="`${subject.code} ${subject.name}`"
            :value="subject.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="币别">
        <el-select v-model="queryParams.currencyId" placeholder="请选择币别" class="!w-160px">
          <el-option
            v-for="currency in subjectCurrencies"
            :key="currency.id"
            :label="`${currency.code} ${currency.name}`"
            :value="currency.id!"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="getList"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <ContentWrap>
    <el-empty
      v-if="!loading && foreignSubjects.length === 0"
      description="还没有启用外币核算的科目：请先在【科目】里给科目勾选外币核算"
    />
    <el-table
      v-else
      id="fms-currency-detail-table"
      v-loading="loading"
      :data="list"
      :row-class-name="getRowClassName"
      border
      stripe
      height="calc(100vh - 245px)"
    >
      <el-table-column label="日期" prop="accountDate" align="center" width="110" />
      <el-table-column label="凭证字号" align="center" width="100">
        <template #default="scope">
          <el-button v-if="scope.row.voucherId" link type="primary" @click="openVoucher(scope.row)">
            {{ scope.row.voucherNumber }}
          </el-button>
        </template>
      </el-table-column>
      <el-table-column label="摘要" prop="digest" min-width="200" />
      <el-table-column label="汇率" align="right" width="100">
        <template #default="scope">
          {{ scope.row.exchangeRate ? formatExchangeRate(scope.row.exchangeRate) : '' }}
        </template>
      </el-table-column>
      <el-table-column label="借方" align="center">
        <el-table-column label="原币" align="right" min-width="110">
          <template #default="scope">{{ formatMoney(scope.row.debitOriginalAmount) }}</template>
        </el-table-column>
        <el-table-column label="本位币" align="right" min-width="120">
          <template #default="scope">{{ formatMoney(scope.row.debitAmount) }}</template>
        </el-table-column>
      </el-table-column>
      <el-table-column label="贷方" align="center">
        <el-table-column label="原币" align="right" min-width="110">
          <template #default="scope">{{ formatMoney(scope.row.creditOriginalAmount) }}</template>
        </el-table-column>
        <el-table-column label="本位币" align="right" min-width="120">
          <template #default="scope">{{ formatMoney(scope.row.creditAmount) }}</template>
        </el-table-column>
      </el-table-column>
      <el-table-column label="方向" prop="balanceDirection" align="center" width="56" />
      <el-table-column label="余额" align="center">
        <el-table-column label="原币" align="right" min-width="110">
          <template #default="scope">{{ formatAmount(scope.row.balanceOriginalAmount) }}</template>
        </el-table-column>
        <el-table-column label="本位币" align="right" min-width="120">
          <template #default="scope">{{ formatAmount(scope.row.balanceAmount) }}</template>
        </el-table-column>
      </el-table-column>
    </el-table>
  </ContentWrap>
</template>

<script lang="ts" setup>
import { parseId } from '@/utils/id'
import { FmsCurrencyApi } from '@/api/fms/config/currency'
import type { FmsCurrencyVO } from '@/api/fms/config/currency'
import * as FmsSubjectApi from '@/api/fms/config/subject'
import type { FmsSubjectVO } from '@/api/fms/config/subject'
import { FmsForeignCurrencyApi } from '@/api/fms/foreign-currency'
import type { FmsLedgerCurrencyDetailVO, FmsLedgerCurrencyReqVO } from '@/api/fms/foreign-currency'
import FmsLedgerMonthRangePicker from '@/views/fms/ledger/components/FmsLedgerMonthRangePicker.vue'
import { useFmsStore } from '@/views/fms/store/fms'
import { formatAmount, formatExchangeRate, formatMoney } from '@/views/fms/utils/format'
import { formatDate } from '@/utils/formatTime'

defineOptions({ name: 'FmsCurrencyDetailLedger' })

const route = useRoute()
const router = useRouter()
const fmsStore = useFmsStore()
const accountSetId = computed(() => fmsStore.getAccountSetId)
const loading = ref(false)
const list = ref<FmsLedgerCurrencyDetailVO[]>([])
const foreignSubjects = ref<FmsSubjectVO[]>([])
const currencies = ref<FmsCurrencyVO[]>([])
const currentMonth = formatDate(new Date(), 'YYYY-MM')
const monthRange = ref<string[]>([currentMonth, currentMonth])
const queryParams = reactive<FmsLedgerCurrencyReqVO>({
  accountSetId: 0,
  startMonth: currentMonth,
  endMonth: currentMonth
})
const subjectCurrencies = computed(() => {
  const subject = foreignSubjects.value.find((item) => item.id === queryParams.subjectId)
  return currencies.value.filter((currency) => subject?.currencyIds?.includes(currency.id!))
})

watch(accountSetId, () => init())

/** 初始化 */
async function init() {
  if (!accountSetId.value) return
  const accountingMonth = await fmsStore.loadCurrentMonth()
  monthRange.value = [
    String(route.query.startMonth || accountingMonth || currentMonth),
    String(route.query.endMonth || accountingMonth || currentMonth)
  ]
  const [subjects, currencyList] = await Promise.all([
    FmsSubjectApi.getSubjectSimpleList(accountSetId.value),
    FmsCurrencyApi.getCurrencySimpleList(accountSetId.value)
  ])
  currencies.value = currencyList
  const parentIds = new Set(subjects.map((subject) => subject.parentId))
  foreignSubjects.value = subjects.filter(
    (subject) => subject.currencyIds?.length && !parentIds.has(subject.id)
  )
  queryParams.subjectId = parseId(route.query.subjectId) || foreignSubjects.value[0]?.id
  queryParams.currencyId = parseId(route.query.currencyId) || subjectCurrencies.value[0]?.id
  await getList()
}

/** 切换科目时默认选第一个币别 */
function handleSubjectChange() {
  queryParams.currencyId = subjectCurrencies.value[0]?.id
}

/** 查询外币明细账 */
async function getList() {
  if (!accountSetId.value || !queryParams.subjectId || !queryParams.currencyId) {
    list.value = []
    return
  }
  Object.assign(queryParams, {
    accountSetId: accountSetId.value,
    startMonth: monthRange.value[0],
    endMonth: monthRange.value[1]
  })
  loading.value = true
  try {
    list.value = await FmsForeignCurrencyApi.getDetailList(queryParams)
  } finally {
    loading.value = false
  }
}

function getRowClassName({ row }: { row: FmsLedgerCurrencyDetailVO }) {
  return row.rowType === 2 ? '' : '[--el-table-tr-bg-color:var(--el-fill-color-light)] font-600'
}

function openVoucher(row: FmsLedgerCurrencyDetailVO) {
  router.push({ path: '/fms/voucher/create', query: { id: row.voucherId } })
}

onMounted(() => init())
</script>
