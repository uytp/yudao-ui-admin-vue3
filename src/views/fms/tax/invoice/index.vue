<template>
  <ContentWrap>
    <el-form :inline="true" label-width="70px" @submit.prevent>
      <el-form-item label="方向">
        <el-select v-model="query.direction" class="!w-120px" clearable placeholder="全部" @change="loadList">
          <el-option label="销项" :value="1" />
          <el-option label="进项" :value="2" />
        </el-select>
      </el-form-item>
      <el-form-item label="开票月份">
        <el-date-picker
          v-model="query.month"
          type="month"
          value-format="YYYY-MM"
          class="!w-140px"
          placeholder="全部"
          @change="loadList"
        />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" class="!w-110px" clearable placeholder="全部" @change="loadList">
          <el-option label="正常" :value="0" />
          <el-option label="已作废" :value="1" />
        </el-select>
      </el-form-item>
      <el-form-item label="关键字">
        <el-input v-model="query.keyword" class="!w-190px" clearable placeholder="号码 / 对方单位" @keyup.enter="loadList" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadList"><Icon icon="ep:search" class="mr-5px" /> 查询</el-button>
        <el-button v-hasPermi="['fms:invoice:save']" type="success" @click="openForm()">
          <Icon icon="ep:plus" class="mr-5px" /> 新增发票
        </el-button>
        <el-button v-hasPermi="['fms:invoice:certify']" :disabled="!certifiable.length" @click="openCertify(true)">
          <Icon icon="ep:circle-check" class="mr-5px" /> 认证抵扣
        </el-button>
        <el-button v-hasPermi="['fms:invoice:certify']" :disabled="!certifiable.length" @click="openCertify(false)">
          取消认证
        </el-button>
      </el-form-item>
    </el-form>
    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="销项发票：开给客户的；进项发票：供应商开给我们的。只有“进项增值税专用发票”需要【认证抵扣】，认证到哪个月，那个月的增值税里才能扣掉它的税额。某个月已经生成税务凭证后，影响这个月的发票就锁定了，要先到“增值税申报”撤销凭证才能改。"
    />
  </ContentWrap>

  <ContentWrap>
    <el-table
      v-loading="loading"
      :data="list"
      border
      show-summary
      :summary-method="summaryMethod"
      @selection-change="(rows: FmsInvoiceVO[]) => (selected = rows)"
    >
      <el-table-column type="selection" width="45" />
      <el-table-column label="方向" width="70" align="center">
        <template #default="{ row }">
          <el-tag :type="row.direction === 1 ? 'success' : 'warning'" size="small">
            {{ row.direction === 1 ? '销项' : '进项' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="开票日期" width="105">
        <template #default="{ row }">{{ dateText(row.invoiceDate) }}</template>
      </el-table-column>
      <el-table-column label="种类" width="80" align="center">
        <template #default="{ row }">{{ row.invoiceType === 1 ? '专票' : '普票' }}</template>
      </el-table-column>
      <el-table-column label="发票代码" prop="invoiceCode" width="120" show-overflow-tooltip />
      <el-table-column label="发票号码" prop="invoiceNo" width="110" />
      <el-table-column label="对方单位" prop="counterpartName" min-width="130" show-overflow-tooltip />
      <el-table-column label="不含税金额" width="115" align="right">
        <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
      </el-table-column>
      <el-table-column label="税率" width="70" align="right">
        <template #default="{ row }">{{ Number(row.taxRate) }}%</template>
      </el-table-column>
      <el-table-column label="税额" width="105" align="right">
        <template #default="{ row }">{{ formatAmount(row.taxAmount) }}</template>
      </el-table-column>
      <el-table-column label="价税合计" width="115" align="right">
        <template #default="{ row }">{{ formatAmount(row.totalAmount) }}</template>
      </el-table-column>
      <el-table-column label="认证抵扣" width="130" align="center">
        <template #default="{ row }">
          <template v-if="row.direction === 2 && row.invoiceType === 1">
            <el-tag v-if="row.certifyStatus === 1" type="success" size="small">已认证 {{ row.certifyPeriod }}</el-tag>
            <el-tag v-else type="danger" size="small">未认证</el-tag>
          </template>
          <span v-else class="text-[var(--el-text-color-placeholder)]">-</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.status === 1" type="info" size="small">已作废</el-tag>
          <el-tag v-else-if="row.locked" type="warning" size="small">已锁定</el-tag>
          <el-tag v-else size="small" type="success">正常</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="170" align="center" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status !== 1">
            <el-button v-hasPermi="['fms:invoice:save']" link type="primary" :disabled="row.locked" @click="openForm(row)">
              编辑
            </el-button>
            <el-button v-hasPermi="['fms:invoice:save']" link type="warning" :disabled="row.locked" @click="handleVoid(row, true)">
              作废
            </el-button>
            <el-button v-hasPermi="['fms:invoice:delete']" link type="danger" :disabled="row.locked" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
          <template v-else>
            <el-button v-hasPermi="['fms:invoice:save']" link type="primary" :disabled="row.locked" @click="handleVoid(row, false)">
              恢复
            </el-button>
            <el-button v-hasPermi="['fms:invoice:delete']" link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>
  </ContentWrap>

  <!-- 新增 / 编辑发票 -->
  <el-dialog v-model="formVisible" :title="form.id ? '编辑发票' : '新增发票'" width="700px" append-to-body>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="方向" prop="direction">
            <el-radio-group v-model="form.direction">
              <el-radio-button :value="1">销项（开出去）</el-radio-button>
              <el-radio-button :value="2">进项（收进来）</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="发票种类">
            <el-radio-group v-model="form.invoiceType">
              <el-radio-button :value="1">增值税专票</el-radio-button>
              <el-radio-button :value="2">普票</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="发票代码">
            <el-input v-model="form.invoiceCode" maxlength="32" placeholder="没有可以不填" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="发票号码" prop="invoiceNo">
            <el-input v-model="form.invoiceNo" maxlength="32" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="开票日期" prop="invoiceDate">
            <el-date-picker v-model="form.invoiceDate" type="date" value-format="YYYY-MM-DD" class="!w-full" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="form.direction === 2 ? '销售方' : '购买方'" prop="counterpartName">
            <el-input v-model="form.counterpartName" maxlength="128" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="对方税号">
            <el-input v-model="form.counterpartTaxNo" maxlength="32" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="不含税金额" prop="amount">
            <el-input-number v-model="form.amount" :precision="2" :controls="false" class="!w-full" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="税率 %" prop="taxRate">
            <el-select v-model="form.taxRate" filterable allow-create default-first-option class="!w-full">
              <el-option v-for="r in [13, 9, 6, 3, 1, 0]" :key="r" :label="`${r}%`" :value="r" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="税额">
            <el-input-number
              v-model="form.taxAmount"
              :precision="2"
              :controls="false"
              class="!w-full"
              :placeholder="`自动算 ${formatAmount(autoTax)}`"
            />
          </el-form-item>
        </el-col>
        <el-col :span="24">
          <div class="mb-12px ml-110px text-12px text-[var(--el-text-color-secondary)]">
            税额不填就按“金额 × 税率”自动算（现在是 {{ formatAmount(autoTax) }}）；发票上的税额有几分钱尾差时可以照抄，相差不能超过 0.10 元。
            红字发票金额填负数。价税合计：{{ formatAmount(totalPreview) }}
          </div>
        </el-col>
        <el-col :span="24">
          <el-form-item label="备注">
            <el-input v-model="form.remark" maxlength="255" />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
    <template #footer>
      <el-button @click="formVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>

  <!-- 认证 -->
  <el-dialog v-model="certifyVisible" :title="certifyFlag ? '认证抵扣' : '取消认证'" width="460px" append-to-body>
    <div class="mb-12px">选中 {{ certifiable.length }} 张进项专票，税额合计 {{ formatAmount(certifyTax) }}。</div>
    <el-form v-if="certifyFlag" label-width="100px">
      <el-form-item label="认证所属期">
        <el-date-picker v-model="certifyPeriod" type="month" value-format="YYYY-MM" :clearable="true" class="!w-180px" />
        <div class="mt-4px w-full text-12px text-[var(--el-text-color-secondary)]">
          不选就按各自的开票月份。认证到哪个月，就在哪个月的增值税里抵扣。
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="certifyVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleCertify">确定</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import dayjs from 'dayjs'
import { FmsTaxApi } from '@/api/fms/tax'
import type { FmsInvoiceVO } from '@/api/fms/tax'
import { useFmsStore } from '@/views/fms/store/fms'
import { formatAmount } from '@/views/fms/utils/format'
import type { FormInstance, FormRules } from 'element-plus'

defineOptions({ name: 'FmsTaxInvoice' })

const message = useMessage()
const fmsStore = useFmsStore()
const accountSetId = computed(() => fmsStore.getAccountSetId)

const loading = ref(false)
const saving = ref(false)
const list = ref<FmsInvoiceVO[]>([])
const selected = ref<FmsInvoiceVO[]>([])
const query = reactive({
  direction: undefined as number | undefined,
  month: undefined as string | undefined,
  status: undefined as number | undefined,
  keyword: ''
})

/** 后端的日期可能是数组 [年, 月, 日]，统一成 yyyy-MM-dd */
function dateText(value: unknown): string {
  if (Array.isArray(value)) {
    return `${value[0]}-${String(value[1]).padStart(2, '0')}-${String(value[2]).padStart(2, '0')}`
  }
  return value ? String(value) : ''
}

async function loadList() {
  if (!accountSetId.value) return
  loading.value = true
  try {
    const data = await FmsTaxApi.getInvoiceList({
      accountSetId: accountSetId.value,
      direction: query.direction,
      month: query.month || undefined,
      status: query.status,
      keyword: query.keyword || undefined
    })
    list.value = data.map((row) => ({ ...row, invoiceDate: dateText(row.invoiceDate) }))
  } finally {
    loading.value = false
  }
}

/** 合计只算“正常”的发票，销项进项分开会混在一起，所以只在选了方向时才有意义；这里都算，按正负号区分不了，就只合计金额税额 */
function summaryMethod({ columns, data }: { columns: any[]; data: FmsInvoiceVO[] }) {
  const normal = data.filter((r) => r.status !== 1)
  const sum = (key: keyof FmsInvoiceVO) =>
    formatAmount(normal.reduce((total, r) => total + Number(r[key] || 0), 0))
  return columns.map((column, index) => {
    if (index === 0) return '合计'
    if (column.label === '不含税金额') return sum('amount')
    if (column.label === '税额') return sum('taxAmount')
    if (column.label === '价税合计') return sum('totalAmount')
    return ''
  })
}

// ---------- 新增 / 编辑 ----------
const formVisible = ref(false)
const formRef = ref<FormInstance>()
const emptyForm = (): FmsInvoiceVO => ({
  direction: query.direction || 1,
  invoiceType: 1,
  invoiceCode: '',
  invoiceNo: '',
  invoiceDate: dayjs().format('YYYY-MM-DD'),
  counterpartName: '',
  taxRate: 13
})
const form = ref<FmsInvoiceVO>(emptyForm())
const rules: FormRules = {
  direction: [{ required: true, message: '请选择方向', trigger: 'change' }],
  invoiceNo: [{ required: true, message: '请填写发票号码', trigger: 'blur' }],
  invoiceDate: [{ required: true, message: '请选择开票日期', trigger: 'change' }],
  counterpartName: [{ required: true, message: '请填写对方单位', trigger: 'blur' }],
  amount: [{ required: true, message: '请填写不含税金额', trigger: 'blur' }],
  taxRate: [{ required: true, message: '请选择税率', trigger: 'change' }]
}
const autoTax = computed(() => {
  const amount = Number(form.value.amount || 0)
  const rate = Number(form.value.taxRate || 0)
  return Math.round(amount * rate) / 100
})
const totalPreview = computed(
  () => Number(form.value.amount || 0) + Number(form.value.taxAmount ?? autoTax.value)
)

function openForm(row?: FmsInvoiceVO) {
  form.value = row ? { ...row } : emptyForm()
  formVisible.value = true
}

async function handleSave() {
  await formRef.value?.validate()
  saving.value = true
  try {
    await FmsTaxApi.saveInvoice({ ...form.value, accountSetId: accountSetId.value! })
    message.success('保存成功')
    formVisible.value = false
    await loadList()
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: FmsInvoiceVO) {
  await message.confirm(`确定删除发票 ${row.invoiceNo} 吗？`)
  await FmsTaxApi.deleteInvoice(accountSetId.value!, row.id!)
  message.success('已删除')
  await loadList()
}

async function handleVoid(row: FmsInvoiceVO, flag: boolean) {
  await message.confirm(flag ? `作废发票 ${row.invoiceNo}？作废后不再计入增值税。` : `恢复发票 ${row.invoiceNo}？`)
  await FmsTaxApi.voidInvoices(accountSetId.value!, [row.id!], flag)
  message.success(flag ? '已作废' : '已恢复')
  await loadList()
}

// ---------- 认证 ----------
const certifyVisible = ref(false)
const certifyFlag = ref(true)
const certifyPeriod = ref<string>()
/** 选中的发票里，能认证的：正常的进项专票 */
const certifiable = computed(() =>
  selected.value.filter((r) => r.direction === 2 && r.invoiceType === 1 && r.status !== 1)
)
const certifyTax = computed(() => certifiable.value.reduce((total, r) => total + Number(r.taxAmount || 0), 0))

function openCertify(flag: boolean) {
  certifyFlag.value = flag
  certifyPeriod.value = undefined
  certifyVisible.value = true
}

async function handleCertify() {
  saving.value = true
  try {
    await FmsTaxApi.certifyInvoices(
      accountSetId.value!,
      certifiable.value.map((r) => r.id!),
      certifyFlag.value,
      certifyPeriod.value
    )
    message.success(certifyFlag.value ? '已认证' : '已取消认证')
    certifyVisible.value = false
    await loadList()
  } finally {
    saving.value = false
  }
}

watch(accountSetId, loadList)
onMounted(loadList)
</script>
