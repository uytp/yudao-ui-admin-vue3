<template>
  <ContentWrap>
    <el-alert
      class="mb-16px"
      :closable="false"
      show-icon
      type="info"
      title="期末调汇：按期末汇率重新折算外币科目的本位币余额，差额记入“汇兑损益”。外币科目分录原币为 0、只调本位币。调汇凭证生成后和普通凭证一样需要审核、过账；同一期间重复调汇时，差额为 0 的不会再生成。"
    />
    <el-form :inline="true" label-width="100px" class="-mb-15px">
      <el-form-item label="调汇期间">
        <el-tag size="large">{{ preview?.month || '-' }}</el-tag>
      </el-form-item>
      <el-form-item label="汇兑损益科目">
        <FmsSubjectSelect v-model="form.profitLossSubjectId" class="!w-260px" placeholder="请选择汇兑损益科目" />
      </el-form-item>
      <el-form-item label="凭证字">
        <FmsVoucherWordSelect v-model="form.voucherWordId" :options="voucherWords" class="!w-120px" />
      </el-form-item>
    </el-form>
  </ContentWrap>

  <ContentWrap title="期末汇率">
    <el-table :data="rates" border stripe>
      <el-table-column label="币别" min-width="160">
        <template #default="scope">{{ scope.row.currencyCode }} {{ scope.row.currencyName }}</template>
      </el-table-column>
      <el-table-column label="期末汇率（1 外币 = ? 本位币）" min-width="220" align="center">
        <template #default="scope">
          <el-input-number v-model="scope.row.rate" :controls="false" :min="0" :precision="6" class="!w-180px" />
        </template>
      </el-table-column>
      <el-table-column label="汇率来源" min-width="160" align="center">
        <template #default="scope">{{ sourceLabel(scope.row.source) }}</template>
      </el-table-column>
    </el-table>
    <div class="mt-12px">
      <el-button type="primary" plain :loading="loading" @click="handlePreview">
        <Icon icon="ep:view" class="mr-5px" /> 计算汇兑差额
      </el-button>
      <el-button
        type="primary"
        :loading="generating"
        :disabled="!hasDifference"
        @click="handleGenerate"
        v-hasPermi="['fms:closing:exchange-adjust']"
      >
        <Icon icon="ep:document-add" class="mr-5px" /> 生成调汇凭证
      </el-button>
    </div>
  </ContentWrap>

  <ContentWrap title="调汇明细">
    <el-table v-loading="loading" :data="preview?.lines || []" border stripe show-summary :summary-method="getSummaries">
      <el-table-column label="科目" min-width="200">
        <template #default="scope">{{ scope.row.subjectCode }} {{ scope.row.subjectName }}</template>
      </el-table-column>
      <el-table-column label="币别" min-width="100">
        <template #default="scope">{{ scope.row.currencyCode }}</template>
      </el-table-column>
      <el-table-column label="方向" prop="direction" align="center" width="60" />
      <el-table-column label="期末原币余额" align="right" min-width="130">
        <template #default="scope">{{ formatAmount(scope.row.endingOriginalAmount) }}</template>
      </el-table-column>
      <el-table-column label="期末汇率" align="right" min-width="100">
        <template #default="scope">{{ formatExchangeRate(scope.row.rate) }}</template>
      </el-table-column>
      <el-table-column label="调汇前本位币" align="right" min-width="130">
        <template #default="scope">{{ formatAmount(scope.row.endingAmount) }}</template>
      </el-table-column>
      <el-table-column label="调汇后本位币" align="right" min-width="130">
        <template #default="scope">{{ formatAmount(scope.row.adjustedAmount) }}</template>
      </el-table-column>
      <el-table-column label="汇兑差额" align="right" min-width="150">
        <template #default="scope">
          <span :class="scope.row.differenceAmount === 0 ? '' : 'font-600'">
            {{ formatDifference(scope.row.differenceAmount) }}
          </span>
        </template>
      </el-table-column>
    </el-table>
  </ContentWrap>
</template>

<script lang="ts" setup>
import { FmsForeignCurrencyApi } from '@/api/fms/foreign-currency'
import type { FmsCurrencyRateVO, FmsExchangeAdjustRespVO } from '@/api/fms/foreign-currency'
import FmsSubjectSelect from '@/views/fms/config/subject/components/FmsSubjectSelect.vue'
import FmsVoucherWordSelect from '@/views/fms/config/voucher-word/components/FmsVoucherWordSelect.vue'
import { useFmsStore } from '@/views/fms/store/fms'
import { FmsVoucherWordApi } from '@/api/fms/config/voucher-word'
import type { FmsVoucherWordVO } from '@/api/fms/config/voucher-word'
import { formatAmount, formatExchangeRate } from '@/views/fms/utils/format'

defineOptions({ name: 'FmsExchangeAdjust' })

const message = useMessage()
const router = useRouter()
const fmsStore = useFmsStore()
const accountSetId = computed(() => fmsStore.getAccountSetId)
const loading = ref(false)
const generating = ref(false)
const preview = ref<FmsExchangeAdjustRespVO>()
const rates = ref<FmsCurrencyRateVO[]>([])
const voucherWords = ref<FmsVoucherWordVO[]>([])
const form = reactive<{ profitLossSubjectId?: number; voucherWordId?: number }>({})
const hasDifference = computed(() =>
  (preview.value?.lines || []).some((line) => Number(line.differenceAmount) !== 0)
)

watch(accountSetId, () => init())

/** 初始化：加载凭证字并计算 */
async function init() {
  if (!accountSetId.value) return
  voucherWords.value = await FmsVoucherWordApi.getVoucherWordSimpleList(accountSetId.value)
  form.voucherWordId =
    voucherWords.value.find((item) => item.defaultStatus)?.id || voucherWords.value[0]?.id
  form.profitLossSubjectId = undefined
  await handlePreview(true)
}

function sourceLabel(source?: number) {
  return source === 1 ? '本期汇率表' : source === 2 ? '沿用以前期间汇率' : '币别默认汇率'
}

/** 正数：借记外币科目（汇兑收益）；负数：贷记外币科目（汇兑损失） */
function formatDifference(value: number) {
  const amount = Number(value || 0)
  if (amount === 0) return '0.00'
  return `${amount > 0 ? '借' : '贷'} ${formatAmount(Math.abs(amount))}`
}

function getSummaries({ columns }: { columns: any[] }) {
  const sums = columns.map(() => '')
  sums[0] = '合计'
  const total = Number(preview.value?.totalDifference || 0)
  sums[columns.length - 1] =
    total === 0 ? '0.00' : `${total > 0 ? '汇兑收益' : '汇兑损失'} ${formatAmount(Math.abs(total))}`
  return sums
}

function buildReq() {
  return {
    accountSetId: accountSetId.value!,
    profitLossSubjectId: form.profitLossSubjectId,
    voucherWordId: form.voucherWordId,
    rates: rates.value.map((rate) => ({ currencyId: rate.currencyId, rate: rate.rate }))
  }
}

/** 计算汇兑差额 */
async function handlePreview(reset = false) {
  if (!accountSetId.value) return
  loading.value = true
  try {
    const req = buildReq()
    if (reset === true) {
      req.rates = []
      req.profitLossSubjectId = undefined
    }
    preview.value = await FmsForeignCurrencyApi.previewExchangeAdjust(req)
    rates.value = preview.value.rates
    if (!form.profitLossSubjectId) form.profitLossSubjectId = preview.value.profitLossSubjectId
  } finally {
    loading.value = false
  }
}

/** 生成调汇凭证 */
async function handleGenerate() {
  if (!form.profitLossSubjectId) {
    message.warning('请选择汇兑损益科目')
    return
  }
  try {
    await message.confirm(`确认按期末汇率生成 ${preview.value?.month} 的调汇凭证吗？`)
  } catch {
    return
  }
  generating.value = true
  try {
    const result = await FmsForeignCurrencyApi.generateExchangeAdjust(buildReq())
    message.success('调汇凭证已生成，请审核、过账')
    await handlePreview()
    if (result.voucherId) {
      router.push({ path: '/fms/voucher/create', query: { id: result.voucherId } })
    }
  } finally {
    generating.value = false
  }
}

onMounted(() => init())
</script>
