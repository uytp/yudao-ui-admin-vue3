<template>
  <ContentWrap>
    <el-form :inline="true" label-width="70px" @submit.prevent>
      <el-form-item label="会计期间">
        <el-date-picker
          v-model="period"
          type="month"
          value-format="YYYY-MM"
          :clearable="false"
          class="!w-150px"
          @change="loadData"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="loadData"><Icon icon="ep:refresh" class="mr-5px" /> 刷新</el-button>
        <el-button
          v-if="!data?.generated"
          v-hasPermi="['fms:asset:depreciate']"
          type="primary"
          :loading="working"
          :disabled="!data?.rows.length"
          @click="handleGenerate"
        >
          <Icon icon="ep:finished" class="mr-5px" /> 计提折旧并生成凭证
        </el-button>
        <el-button v-else v-hasPermi="['fms:asset:revoke']" type="warning" :loading="working" @click="handleRevoke">
          <Icon icon="ep:refresh-left" class="mr-5px" /> 撤销本月折旧
        </el-button>
      </el-form-item>
      <el-form-item v-if="data?.generated">
        <el-tag type="success">已计提</el-tag>
        <span class="ml-8px">折旧凭证：{{ data.voucherNo || data.voucherId }}</span>
      </el-form-item>
    </el-form>
    <el-alert
      v-for="w in data?.warnings || []"
      :key="w"
      type="warning"
      :closable="false"
      show-icon
      class="mb-8px"
      :title="w"
    />
    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="折旧用年限平均法：每月折旧额 =（原值 - 净残值）÷ 折旧月数；当月增加的资产下月开始折旧，最后一个月把剩余全部提完。折旧要一个月一个月往后做，撤销只能从最近计提的月份往前撤销。"
    />
  </ContentWrap>

  <ContentWrap>
    <div class="mb-8px font-600">
      {{ data?.generated ? '本月折旧明细（已计提）' : '本月折旧预览（还没有计提）' }}
    </div>
    <el-table v-loading="loading" :data="data?.rows || []" border show-summary :summary-method="summaryMethod">
      <el-table-column label="资产编号" prop="code" width="100" />
      <el-table-column label="资产名称" prop="name" min-width="140" show-overflow-tooltip />
      <el-table-column label="类别" prop="categoryName" width="110" />
      <el-table-column label="原值" width="120" align="right">
        <template #default="{ row }">{{ formatAmount(row.originalValue) }}</template>
      </el-table-column>
      <el-table-column label="本月折旧" width="120" align="right">
        <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
      </el-table-column>
      <el-table-column label="计提后累计折旧" width="140" align="right">
        <template #default="{ row }">{{ formatAmount(row.accumAfter) }}</template>
      </el-table-column>
      <el-table-column label="计提后净值" width="130" align="right">
        <template #default="{ row }">{{ formatAmount(row.netAfter) }}</template>
      </el-table-column>
      <el-table-column label="已折旧 / 总月数" width="130" align="center">
        <template #default="{ row }">{{ row.depreciatedMonths }} / {{ row.lifeMonths }}</template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!loading && data && !data.rows.length" description="这个月没有需要计提折旧的资产" :image-size="80" />
  </ContentWrap>

  <ContentWrap v-if="data?.categories?.length">
    <div class="mb-8px font-600">折旧凭证分录（按类别汇总）</div>
    <el-table :data="data.categories" border>
      <el-table-column label="类别" prop="categoryName" width="140" />
      <el-table-column label="借：折旧费用" prop="expenseSubjectName" min-width="180" />
      <el-table-column label="贷：累计折旧" prop="accumSubjectName" min-width="180" />
      <el-table-column label="金额" width="140" align="right">
        <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
      </el-table-column>
    </el-table>
  </ContentWrap>
</template>

<script lang="ts" setup>
import dayjs from 'dayjs'
import { FmsAssetApi } from '@/api/fms/asset'
import type { FmsAssetDepreciationVO } from '@/api/fms/asset'
import { useFmsStore } from '@/views/fms/store/fms'
import { formatAmount } from '@/views/fms/utils/format'

defineOptions({ name: 'FmsAssetDepreciation' })

const message = useMessage()
const fmsStore = useFmsStore()
const accountSetId = computed(() => fmsStore.getAccountSetId)

const loading = ref(false)
const working = ref(false)
const period = ref<string>(fmsStore.getCurrentMonth || dayjs().format('YYYY-MM'))
const data = ref<FmsAssetDepreciationVO>()

/** 合计行用后端算好的合计，避免前端累加出误差 */
function summaryMethod({ columns }: { columns: any[] }) {
  const total = data.value?.total
  return columns.map((column, index) => {
    if (index === 0) return '合计'
    if (!total) return ''
    if (column.label === '原值') return formatAmount(total.originalValue)
    if (column.label === '本月折旧') return formatAmount(total.amount)
    if (column.label === '计提后累计折旧') return formatAmount(total.accumAfter)
    if (column.label === '计提后净值') return formatAmount(total.netAfter)
    return ''
  })
}

async function loadData() {
  data.value = undefined
  if (!accountSetId.value || !period.value) return
  loading.value = true
  try {
    data.value = await FmsAssetApi.getDepreciation(accountSetId.value, period.value)
  } finally {
    loading.value = false
  }
}

async function handleGenerate() {
  await message.confirm(`将为 ${period.value} 的 ${data.value?.rows.length} 个资产计提折旧，共 ${formatAmount(data.value?.total.amount)} 元，并生成一张折旧凭证（待审核）。是否继续？`)
  working.value = true
  try {
    await FmsAssetApi.generateDepreciation(accountSetId.value!, period.value)
    message.success('折旧已计提，凭证已生成（待审核）')
    await loadData()
  } finally {
    working.value = false
  }
}

async function handleRevoke() {
  await message.confirm(`撤销 ${period.value} 的折旧？将删除折旧凭证（凭证已审核的要先反审核）和折旧明细。`)
  working.value = true
  try {
    await FmsAssetApi.revokeDepreciation(accountSetId.value!, period.value)
    message.success('已撤销')
    await loadData()
  } finally {
    working.value = false
  }
}

watch(accountSetId, loadData)
onMounted(async () => {
  if (!fmsStore.getCurrentMonth && accountSetId.value) {
    const month = await fmsStore.loadCurrentMonth()
    if (month) period.value = month
  } else if (fmsStore.getCurrentMonth) {
    period.value = fmsStore.getCurrentMonth
  }
  await loadData()
})
</script>
