<template>
  <ContentWrap>
    <el-form :inline="true" label-width="70px" @submit.prevent>
      <el-form-item label="资产类别">
        <el-select v-model="query.categoryId" class="!w-160px" clearable placeholder="全部" @change="loadList">
          <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" class="!w-120px" clearable placeholder="全部" @change="loadList">
          <el-option label="在用" :value="0" />
          <el-option label="已处置" :value="1" />
        </el-select>
      </el-form-item>
      <el-form-item label="编号/名称">
        <el-input v-model="query.keyword" class="!w-180px" clearable placeholder="输入关键字" @keyup.enter="loadList" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadList"><Icon icon="ep:search" class="mr-5px" /> 查询</el-button>
        <el-button v-hasPermi="['fms:asset:save']" type="success" @click="openForm()">
          <Icon icon="ep:plus" class="mr-5px" /> 新增资产
        </el-button>
        <el-button v-hasPermi="['fms:asset:category']" @click="categoryRef?.open()">
          <Icon icon="ep:setting" class="mr-5px" /> 类别管理
        </el-button>
        <el-button @click="openReconcile"><Icon icon="ep:scale-to-original" class="mr-5px" /> 与总账对账</el-button>
      </el-form-item>
    </el-form>
    <el-alert
      v-if="!categories.length"
      type="warning"
      :closable="false"
      show-icon
      title="还没有资产类别：先点【类别管理】建一个（比如“电子设备”，36 个月，残值率 5%），再新增资产。"
    />
  </ContentWrap>

  <ContentWrap>
    <el-table v-loading="loading" :data="list" border show-summary :summary-method="summaryMethod">
      <el-table-column label="编号" prop="code" width="90" fixed />
      <el-table-column label="名称" prop="name" min-width="130" fixed show-overflow-tooltip />
      <el-table-column label="类别" prop="categoryName" width="100" />
      <el-table-column label="启用日期" width="105">
        <template #default="{ row }">{{ dateText(row.startDate) }}</template>
      </el-table-column>
      <el-table-column label="原值" width="110" align="right">
        <template #default="{ row }">{{ formatAmount(row.originalValue) }}</template>
      </el-table-column>
      <el-table-column label="净残值" width="100" align="right">
        <template #default="{ row }">{{ formatAmount(row.residualValue) }}</template>
      </el-table-column>
      <el-table-column label="月折旧额" width="100" align="right">
        <template #default="{ row }">{{ formatAmount(row.monthlyDepr) }}</template>
      </el-table-column>
      <el-table-column label="已折旧 / 总月数" width="120" align="center">
        <template #default="{ row }">{{ row.depreciatedMonths }} / {{ row.lifeMonths }}</template>
      </el-table-column>
      <el-table-column label="累计折旧" width="110" align="right">
        <template #default="{ row }">{{ formatAmount(row.accumDepr) }}</template>
      </el-table-column>
      <el-table-column label="净值" width="110" align="right">
        <template #default="{ row }">{{ formatAmount(row.netValue) }}</template>
      </el-table-column>
      <el-table-column label="开始折旧" width="190">
        <template #default="{ row }">
          <span v-if="row.status === 1">-</span>
          <template v-else>
            {{ row.firstDeprMonth }}
            <el-tooltip
              v-if="row.missedMonths"
              :content="`应该从更早的月份开始折旧，但其中 ${row.missedMonths} 个月已经结账，没有计提。需要补的话，把“进入系统前已折旧月数 / 累计折旧”填上并自己补一张折旧凭证。`"
              placement="top"
            >
              <el-tag type="warning" size="small" class="ml-4px">漏提 {{ row.missedMonths }} 个月</el-tag>
            </el-tooltip>
          </template>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.status === 1" type="info">已处置 {{ dateText(row.disposeDate) }}</el-tag>
          <el-tag v-else type="success">在用</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" align="center" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status !== 1">
            <el-button v-hasPermi="['fms:asset:save']" link type="primary" @click="openForm(row)">编辑</el-button>
            <el-button v-hasPermi="['fms:asset:dispose']" link type="warning" @click="openDispose(row)">处置</el-button>
            <el-button
              v-if="!row.hasDepreciation"
              v-hasPermi="['fms:asset:delete']"
              link
              type="danger"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
          <el-button v-else v-hasPermi="['fms:asset:dispose']" link type="primary" @click="handleRevokeDispose(row)">
            撤销处置
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </ContentWrap>

  <!-- 新增 / 编辑资产 -->
  <el-dialog v-model="formVisible" :title="form.id ? '编辑资产卡片' : '新增资产卡片'" width="720px" append-to-body>
    <el-alert
      v-if="form.hasDepreciation"
      type="info"
      :closable="false"
      show-icon
      class="mb-12px"
      title="这个资产已经计提过折旧，类别、日期、原值、残值率、折旧月数和已折旧情况不能再改，其它信息可以改。"
    />
    <el-form ref="formRef" :model="form" :rules="rules" label-width="130px">
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="资产编号">
            <el-input v-model="form.code" maxlength="32" placeholder="不填自动生成 ZC0001" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="资产名称" prop="name">
            <el-input v-model="form.name" maxlength="128" placeholder="例如 办公电脑" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="资产类别" prop="categoryId">
            <el-select v-model="form.categoryId" class="!w-full" :disabled="locked" @change="handleCategoryChange">
              <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="规格型号">
            <el-input v-model="form.spec" maxlength="128" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="购入日期" prop="purchaseDate">
            <el-date-picker
              v-model="form.purchaseDate"
              type="date"
              value-format="YYYY-MM-DD"
              class="!w-full"
              @change="handlePurchaseChange"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="启用日期">
            <el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" class="!w-full" :disabled="locked" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="原值（元）" prop="originalValue">
            <el-input-number v-model="form.originalValue" :min="0.01" :precision="2" :controls="false" class="!w-full" :disabled="locked" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="数量 / 单位">
            <el-input-number v-model="form.quantity" :min="0.01" :precision="2" :controls="false" class="!w-100px" />
            <el-input v-model="form.unit" class="!w-80px ml-8px" placeholder="台" maxlength="16" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="净残值率 %">
            <el-input-number v-model="form.residualRate" :min="0" :max="100" :precision="2" :controls="false" class="!w-full" :disabled="locked" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="折旧月数">
            <el-input-number v-model="form.lifeMonths" :min="1" :max="1200" :controls="false" class="!w-full" :disabled="locked" />
          </el-form-item>
        </el-col>
        <el-col :span="24">
          <el-form-item label="预计月折旧额">
            <b>{{ formatAmount(previewMonthly) }}</b>
            <span class="ml-8px text-[var(--el-text-color-secondary)]">
              = （原值 - 原值 × 残值率）÷ 折旧月数；当月增加、下月开始折旧
            </span>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="已折旧月数">
            <el-input-number v-model="form.initDeprMonths" :min="0" :max="1200" :controls="false" class="!w-full" :disabled="locked" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="已提累计折旧">
            <el-input-number v-model="form.initAccumDepr" :min="0" :precision="2" :controls="false" class="!w-full" :disabled="locked" />
          </el-form-item>
        </el-col>
        <el-col :span="24">
          <div class="mb-12px ml-130px text-12px text-[var(--el-text-color-secondary)]">
            新买的资产这两项留 0。进入系统之前就在用的旧资产，把已经折旧的月数和累计折旧金额填在这里。
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

  <!-- 处置 -->
  <el-dialog v-model="disposeVisible" title="处置资产" width="520px" append-to-body>
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="mb-12px"
      title="处置会生成一张“转入固定资产清理”凭证：借 累计折旧、固定资产清理（净值），贷 固定资产（原值）。卖了多少钱、怎么收款，请在清理科目里另外记账。"
    />
    <el-form label-width="90px">
      <el-form-item label="资产">{{ disposeRow?.code }} {{ disposeRow?.name }}（净值 {{ formatAmount(disposeRow?.netValue) }}）</el-form-item>
      <el-form-item label="处置日期">
        <el-date-picker v-model="disposeDate" type="date" value-format="YYYY-MM-DD" class="!w-200px" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="disposeRemark" maxlength="100" placeholder="例如 报废 / 出售" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="disposeVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="!disposeDate" @click="handleDispose">确定处置</el-button>
    </template>
  </el-dialog>

  <!-- 对账 -->
  <el-dialog v-model="reconcileVisible" title="固定资产卡片与总账对账" width="720px" append-to-body>
    <el-form :inline="true">
      <el-form-item label="截止月份">
        <el-date-picker v-model="reconcileMonth" type="month" value-format="YYYY-MM" :clearable="false" class="!w-150px" />
      </el-form-item>
      <el-form-item><el-button type="primary" @click="loadReconcile">对账</el-button></el-form-item>
    </el-form>
    <el-table v-loading="reconcileLoading" :data="reconcile?.rows || []" border>
      <el-table-column label="科目" prop="subjectName" min-width="150" />
      <el-table-column label="对账内容" width="100">
        <template #default="{ row }">{{ row.type === 1 ? '原值' : '累计折旧' }}</template>
      </el-table-column>
      <el-table-column label="卡片合计" width="130" align="right">
        <template #default="{ row }">{{ formatAmount(row.cardAmount) }}</template>
      </el-table-column>
      <el-table-column label="总账余额" width="130" align="right">
        <template #default="{ row }">{{ formatAmount(row.ledgerAmount) }}</template>
      </el-table-column>
      <el-table-column label="差额" width="110" align="right">
        <template #default="{ row }">
          <span :class="Number(row.diff) === 0 ? 'text-[var(--el-color-success)]' : 'text-[var(--el-color-danger)]'">
            {{ formatAmount(row.diff) }}
          </span>
        </template>
      </el-table-column>
    </el-table>
    <el-alert
      v-if="reconcile"
      class="mt-12px"
      :type="reconcile.balanced ? 'success' : 'warning'"
      :closable="false"
      show-icon
      :title="reconcile.balanced ? '卡片和总账完全一致' : '有差额：多半是购入固定资产的凭证和卡片没对上，或者有资产没建卡片'"
    />
  </el-dialog>

  <AssetCategoryDialog ref="categoryRef" @changed="loadCategories" />
</template>

<script lang="ts" setup>
import dayjs from 'dayjs'
import { FmsAssetApi } from '@/api/fms/asset'
import type { FmsAssetCategoryVO, FmsAssetReconcileVO, FmsAssetVO } from '@/api/fms/asset'
import { useFmsStore } from '@/views/fms/store/fms'
import { formatAmount } from '@/views/fms/utils/format'
import AssetCategoryDialog from './components/AssetCategoryDialog.vue'
import type { FormInstance, FormRules } from 'element-plus'

defineOptions({ name: 'FmsAssetCard' })

const message = useMessage()
const fmsStore = useFmsStore()
const accountSetId = computed(() => fmsStore.getAccountSetId)

const loading = ref(false)
const saving = ref(false)
const list = ref<FmsAssetVO[]>([])
const categories = ref<FmsAssetCategoryVO[]>([])
const categoryRef = ref<InstanceType<typeof AssetCategoryDialog>>()
const query = reactive({
  categoryId: undefined as number | undefined,
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

function summaryMethod({ columns, data }: { columns: any[]; data: FmsAssetVO[] }) {
  const sums: string[] = []
  columns.forEach((column, index) => {
    if (index === 0) {
      sums[index] = '合计'
      return
    }
    const sumOf = (key: keyof FmsAssetVO) =>
      formatAmount(data.filter((r) => r.status !== 1).reduce((total, r) => total + Number(r[key] || 0), 0))
    if (column.label === '原值') sums[index] = sumOf('originalValue')
    else if (column.label === '净残值') sums[index] = sumOf('residualValue')
    else if (column.label === '月折旧额') sums[index] = sumOf('monthlyDepr')
    else if (column.label === '累计折旧') sums[index] = sumOf('accumDepr')
    else if (column.label === '净值') sums[index] = sumOf('netValue')
    else sums[index] = ''
  })
  return sums
}

async function loadCategories() {
  if (!accountSetId.value) return
  categories.value = await FmsAssetApi.getCategoryList(accountSetId.value)
}

async function loadList() {
  if (!accountSetId.value) return
  loading.value = true
  try {
    list.value = (await FmsAssetApi.getAssetList({ accountSetId: accountSetId.value, ...query })).map((row) => ({
      ...row,
      startDate: dateText(row.startDate),
      purchaseDate: dateText(row.purchaseDate),
      disposeDate: dateText(row.disposeDate)
    }))
  } finally {
    loading.value = false
  }
}

// ---------- 新增 / 编辑 ----------
const formVisible = ref(false)
const formRef = ref<FormInstance>()
const emptyForm = (): FmsAssetVO => ({
  name: '',
  quantity: 1,
  unit: '',
  initDeprMonths: 0,
  initAccumDepr: 0,
  residualRate: 5,
  lifeMonths: 60
})
const form = ref<FmsAssetVO>(emptyForm())
const locked = computed(() => !!form.value.hasDepreciation)
const rules: FormRules = {
  name: [{ required: true, message: '请填写资产名称', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择资产类别', trigger: 'change' }],
  purchaseDate: [{ required: true, message: '请选择购入日期', trigger: 'change' }],
  originalValue: [{ required: true, message: '请填写原值', trigger: 'blur' }]
}
const previewMonthly = computed(() => {
  const original = Number(form.value.originalValue || 0)
  const life = Number(form.value.lifeMonths || 0)
  if (!original || !life) return 0
  const residual = Math.round(original * Number(form.value.residualRate || 0)) / 100
  return (original - residual) / life
})

function openForm(row?: FmsAssetVO) {
  form.value = row ? { ...row } : emptyForm()
  if (!row && categories.value.length === 1) {
    form.value.categoryId = categories.value[0].id
    handleCategoryChange(form.value.categoryId)
  }
  formVisible.value = true
}

/** 选类别后，折旧月数和残值率自动带出类别的默认值（可再改） */
function handleCategoryChange(id?: number) {
  const category = categories.value.find((c) => c.id === id)
  if (category && !form.value.hasDepreciation) {
    form.value.lifeMonths = category.lifeMonths
    form.value.residualRate = category.residualRate
  }
}

/** 启用日期没填过，就跟着购入日期走 */
function handlePurchaseChange(value?: string) {
  if (!form.value.hasDepreciation && value) form.value.startDate = value
}

async function handleSave() {
  await formRef.value?.validate()
  saving.value = true
  try {
    await FmsAssetApi.saveAsset({ ...form.value, accountSetId: accountSetId.value! })
    message.success('保存成功')
    formVisible.value = false
    await loadList()
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: FmsAssetVO) {
  await message.confirm(`确定删除资产【${row.name}】吗？`)
  await FmsAssetApi.deleteAsset(accountSetId.value!, row.id!)
  message.success('已删除')
  await loadList()
}

// ---------- 处置 ----------
const disposeVisible = ref(false)
const disposeRow = ref<FmsAssetVO>()
const disposeDate = ref<string>()
const disposeRemark = ref('')

function openDispose(row: FmsAssetVO) {
  disposeRow.value = row
  disposeDate.value = dayjs().format('YYYY-MM-DD')
  disposeRemark.value = ''
  disposeVisible.value = true
}

async function handleDispose() {
  saving.value = true
  try {
    await FmsAssetApi.disposeAsset({
      accountSetId: accountSetId.value!,
      id: disposeRow.value!.id!,
      disposeDate: disposeDate.value!,
      remark: disposeRemark.value || undefined
    })
    message.success('已处置，转入清理凭证已生成（待审核）')
    disposeVisible.value = false
    await loadList()
  } finally {
    saving.value = false
  }
}

async function handleRevokeDispose(row: FmsAssetVO) {
  await message.confirm(`撤销【${row.name}】的处置？将删除转入清理凭证，资产恢复为在用。`)
  await FmsAssetApi.revokeDispose(accountSetId.value!, row.id!)
  message.success('已撤销处置')
  await loadList()
}

// ---------- 对账 ----------
const reconcileVisible = ref(false)
const reconcileLoading = ref(false)
const reconcileMonth = ref(fmsStore.getCurrentMonth || dayjs().format('YYYY-MM'))
const reconcile = ref<FmsAssetReconcileVO>()

function openReconcile() {
  if (fmsStore.getCurrentMonth) reconcileMonth.value = fmsStore.getCurrentMonth
  reconcileVisible.value = true
  loadReconcile()
}

async function loadReconcile() {
  reconcileLoading.value = true
  try {
    reconcile.value = await FmsAssetApi.getReconcile(accountSetId.value!, reconcileMonth.value)
  } finally {
    reconcileLoading.value = false
  }
}

watch(accountSetId, async () => {
  await loadCategories()
  await loadList()
})
onMounted(async () => {
  if (!fmsStore.getCurrentMonth && accountSetId.value) await fmsStore.loadCurrentMonth()
  await loadCategories()
  await loadList()
})
</script>
