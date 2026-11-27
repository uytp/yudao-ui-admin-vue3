<template>
  <ContentWrap>
    <el-form :inline="true" label-width="70px" @submit.prevent>
      <el-form-item label="税款所属期">
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
        <el-button v-hasPermi="['fms:tax:setting']" @click="openSetting"><Icon icon="ep:setting" class="mr-5px" /> 税务参数</el-button>
        <el-button
          v-if="data && !data.generated"
          v-hasPermi="['fms:tax:generate']"
          type="primary"
          :loading="working"
          :disabled="data.totalPayable <= 0"
          @click="handleGenerate"
        >
          <Icon icon="ep:finished" class="mr-5px" /> 生成税务凭证
        </el-button>
        <el-button v-if="data?.generated" v-hasPermi="['fms:tax:revoke']" type="warning" :loading="working" @click="handleRevoke">
          <Icon icon="ep:refresh-left" class="mr-5px" /> 撤销税务凭证
        </el-button>
        <el-button :disabled="!data" @click="exportCsv"><Icon icon="ep:download" class="mr-5px" /> 导出 CSV</el-button>
      </el-form-item>
      <el-form-item v-if="data?.generated">
        <el-tag type="success">已生成</el-tag>
        <span class="ml-8px">税务凭证：{{ data.voucherNo || data.voucherId }}</span>
      </el-form-item>
    </el-form>
    <el-alert
      v-for="w in data?.warnings || []"
      :key="w"
      :type="w.includes('又有变化') ? 'error' : 'warning'"
      :closable="false"
      show-icon
      class="mb-8px"
      :title="w"
    />
    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="一般纳税人按月算：应纳增值税 = 销项税额 - 本月认证的进项专票税额 - 上期留抵。为正就是本月要交的税，为负就是留抵，带到下个月继续抵扣。附加税 = 应纳增值税 × 税率。点【生成税务凭证】会把“未交增值税”和附加税结转成一张凭证。"
    />
  </ContentWrap>

  <template v-if="data">
    <ContentWrap>
      <div class="mb-8px font-600">一、销项（本月开出的发票，不含作废）</div>
      <el-table :data="data.salesRows" border show-summary :summary-method="() => ['合计', '', fmt(data!.salesAmount), fmt(data!.outputTax)]">
        <el-table-column label="税率" width="120"><template #default="{ row }">{{ Number(row.taxRate) }}%</template></el-table-column>
        <el-table-column label="发票张数" prop="count" width="110" align="right" />
        <el-table-column label="销售额（不含税）" align="right">
          <template #default="{ row }">{{ fmt(row.amount) }}</template>
        </el-table-column>
        <el-table-column label="销项税额" align="right">
          <template #default="{ row }">{{ fmt(row.taxAmount) }}</template>
        </el-table-column>
      </el-table>

      <div class="mb-8px mt-16px font-600">二、进项（本月认证抵扣的专票）</div>
      <el-table :data="data.inputRows" border show-summary :summary-method="() => ['合计', '', fmt(data!.inputRows.reduce((t, r) => t + Number(r.amount), 0)), fmt(data!.inputTax)]">
        <el-table-column label="税率" width="120"><template #default="{ row }">{{ Number(row.taxRate) }}%</template></el-table-column>
        <el-table-column label="发票张数" prop="count" width="110" align="right" />
        <el-table-column label="金额（不含税）" align="right">
          <template #default="{ row }">{{ fmt(row.amount) }}</template>
        </el-table-column>
        <el-table-column label="可抵扣进项税额" align="right">
          <template #default="{ row }">{{ fmt(row.taxAmount) }}</template>
        </el-table-column>
      </el-table>
    </ContentWrap>

    <ContentWrap>
      <div class="mb-8px font-600">三、本月应交税费</div>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="销项税额">{{ fmt(data.outputTax) }}</el-descriptions-item>
        <el-descriptions-item label="可抵扣进项税额">{{ fmt(data.inputTax) }}</el-descriptions-item>
        <el-descriptions-item label="上期留抵税额">{{ fmt(data.priorCarry) }}</el-descriptions-item>
        <el-descriptions-item label="抵扣后净额（正：要交；负：留抵）">{{ fmt(data.net) }}</el-descriptions-item>
        <el-descriptions-item label="本月应纳增值税">
          <b class="text-[var(--el-color-danger)]">{{ fmt(data.payable) }}</b>
        </el-descriptions-item>
        <el-descriptions-item label="期末留抵税额（带到下月）">
          <b class="text-[var(--el-color-success)]">{{ fmt(data.carryEnd) }}</b>
        </el-descriptions-item>
      </el-descriptions>
      <el-table :data="data.surcharges" border class="mt-12px">
        <el-table-column label="附加税" prop="name" width="170" />
        <el-table-column label="税率" width="90" align="right"><template #default="{ row }">{{ Number(row.rate) }}%</template></el-table-column>
        <el-table-column label="计税依据（应纳增值税）" width="170" align="right">
          <template #default="{ row }">{{ fmt(row.base) }}</template>
        </el-table-column>
        <el-table-column label="金额" width="130" align="right"><template #default="{ row }">{{ fmt(row.amount) }}</template></el-table-column>
        <el-table-column label="借：税金及附加" prop="expenseSubjectName" min-width="160" />
        <el-table-column label="贷：应交税费" prop="payableSubjectName" min-width="160" />
      </el-table>
      <div class="mt-12px text-right">
        附加税合计 <b>{{ fmt(data.surchargeTotal) }}</b>，本月合计应交税费（增值税 + 附加税）
        <b class="text-[var(--el-color-danger)] text-18px">{{ fmt(data.totalPayable) }}</b>
      </div>
    </ContentWrap>

    <ContentWrap v-if="data.reconcile.length">
      <div class="mb-8px font-600">四、与总账对数（发票汇总的税额 vs 总账科目本期发生额）</div>
      <el-table :data="data.reconcile" border>
        <el-table-column label="项目" prop="name" width="150" />
        <el-table-column label="总账科目" prop="subjectName" min-width="170" />
        <el-table-column label="发票汇总" width="140" align="right"><template #default="{ row }">{{ fmt(row.invoiceAmount) }}</template></el-table-column>
        <el-table-column label="总账本期发生额" width="150" align="right"><template #default="{ row }">{{ fmt(row.ledgerAmount) }}</template></el-table-column>
        <el-table-column label="差额" width="120" align="right">
          <template #default="{ row }">
            <span :class="Number(row.diff) === 0 ? 'text-[var(--el-color-success)]' : 'text-[var(--el-color-danger)]'">
              {{ fmt(row.diff) }}
            </span>
          </template>
        </el-table-column>
      </el-table>
      <div class="mt-8px text-12px text-[var(--el-text-color-secondary)]">
        有差额多半是：发票登记了但没录对应的收入/采购凭证（或税额录得不一致）；或者凭证录了没登记发票；进项税额在凭证里记了，但专票还没认证。
      </div>
    </ContentWrap>
  </template>

  <!-- 税务参数 -->
  <el-dialog v-model="settingVisible" title="税务参数" width="520px" append-to-body>
    <el-form label-width="150px">
      <el-form-item label="开始月份">
        <el-date-picker v-model="setting.startMonth" type="month" value-format="YYYY-MM" class="!w-180px" placeholder="不填取账套启用月" />
        <div class="mt-4px w-full text-12px text-[var(--el-text-color-secondary)]">
          从这个月开始算增值税和留抵（现在实际用：{{ setting.effectiveStartMonth }}）
        </div>
      </el-form-item>
      <el-form-item label="开始月份的上期留抵">
        <el-input-number v-model="setting.initCarry" :min="0" :precision="2" :controls="false" class="!w-180px" />
        <div class="mt-4px w-full text-12px text-[var(--el-text-color-secondary)]">
          从别的系统迁过来时，上月申报表“期末留抵税额”填这里；没有就填 0
        </div>
      </el-form-item>
      <el-form-item label="城市维护建设税 %">
        <el-input-number v-model="setting.urbanRate" :min="0" :max="100" :precision="2" :controls="false" class="!w-180px" />
        <span class="ml-8px text-12px text-[var(--el-text-color-secondary)]">市区 7，县城镇 5，其它 1</span>
      </el-form-item>
      <el-form-item label="教育费附加 %">
        <el-input-number v-model="setting.eduRate" :min="0" :max="100" :precision="2" :controls="false" class="!w-180px" />
      </el-form-item>
      <el-form-item label="地方教育费附加 %">
        <el-input-number v-model="setting.localEduRate" :min="0" :max="100" :precision="2" :controls="false" class="!w-180px" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="settingVisible = false">取消</el-button>
      <el-button type="primary" :loading="working" @click="handleSaveSetting">保存</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import dayjs from 'dayjs'
import { FmsTaxApi } from '@/api/fms/tax'
import type { FmsTaxSettingVO, FmsTaxVatVO } from '@/api/fms/tax'
import { useFmsStore } from '@/views/fms/store/fms'
import { formatAmount } from '@/views/fms/utils/format'

defineOptions({ name: 'FmsTaxVat' })

const message = useMessage()
const fmsStore = useFmsStore()
const accountSetId = computed(() => fmsStore.getAccountSetId)

const loading = ref(false)
const working = ref(false)
const period = ref<string>(fmsStore.getCurrentMonth || dayjs().format('YYYY-MM'))
const data = ref<FmsTaxVatVO>()

const fmt = (value: unknown) => formatAmount(value as number)

async function loadData() {
  data.value = undefined
  if (!accountSetId.value || !period.value) return
  loading.value = true
  try {
    data.value = await FmsTaxApi.getVat(accountSetId.value, period.value)
  } finally {
    loading.value = false
  }
}

async function handleGenerate() {
  await message.confirm(
    `将为 ${period.value} 生成税务凭证：结转未交增值税 ${fmt(data.value?.payable)} 元，计提附加税 ${fmt(data.value?.surchargeTotal)} 元，凭证为“待审核”。是否继续？`
  )
  working.value = true
  try {
    await FmsTaxApi.generateTaxVoucher(accountSetId.value!, period.value)
    message.success('税务凭证已生成（待审核）')
    await loadData()
  } finally {
    working.value = false
  }
}

async function handleRevoke() {
  await message.confirm(`撤销 ${period.value} 的税务凭证？将删除这张凭证（已审核的要先反审核）。`)
  working.value = true
  try {
    await FmsTaxApi.revokeTaxVoucher(accountSetId.value!, period.value)
    message.success('已撤销')
    await loadData()
  } finally {
    working.value = false
  }
}

// ---------- 税务参数 ----------
const settingVisible = ref(false)
const setting = ref<FmsTaxSettingVO>({})

async function openSetting() {
  setting.value = await FmsTaxApi.getSetting(accountSetId.value!)
  settingVisible.value = true
}

async function handleSaveSetting() {
  working.value = true
  try {
    await FmsTaxApi.saveSetting({ ...setting.value, accountSetId: accountSetId.value! })
    message.success('保存成功')
    settingVisible.value = false
    await loadData()
  } finally {
    working.value = false
  }
}

// ---------- 导出 ----------
/** 导出一份简单的申报汇总 CSV（带 BOM，Excel 直接打开不乱码） */
function exportCsv() {
  const d = data.value
  if (!d) return
  const lines: (string | number)[][] = [
    [`增值税申报汇总 ${d.period}`],
    [],
    ['一、销项', '税率%', '发票张数', '销售额（不含税）', '销项税额'],
    ...d.salesRows.map((r) => ['', Number(r.taxRate), r.count, Number(r.amount), Number(r.taxAmount)]),
    ['销项合计', '', '', Number(d.salesAmount), Number(d.outputTax)],
    [],
    ['二、进项（本月认证抵扣）', '税率%', '发票张数', '金额（不含税）', '进项税额'],
    ...d.inputRows.map((r) => ['', Number(r.taxRate), r.count, Number(r.amount), Number(r.taxAmount)]),
    ['可抵扣进项合计', '', '', '', Number(d.inputTax)],
    [],
    ['三、应交税费'],
    ['销项税额', Number(d.outputTax)],
    ['可抵扣进项税额', Number(d.inputTax)],
    ['上期留抵税额', Number(d.priorCarry)],
    ['抵扣后净额', Number(d.net)],
    ['本月应纳增值税', Number(d.payable)],
    ['期末留抵税额', Number(d.carryEnd)],
    ...d.surcharges.map((s) => [s.name, Number(s.rate), Number(s.amount)]),
    ['附加税合计', Number(d.surchargeTotal)],
    ['合计应交税费', Number(d.totalPayable)]
  ]
  const csv = lines.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `增值税申报汇总_${d.period}.csv`
  a.click()
  URL.revokeObjectURL(url)
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
