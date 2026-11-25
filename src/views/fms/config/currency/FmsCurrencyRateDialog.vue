<template>
  <Dialog v-model="dialogVisible" :title="`汇率表 - ${currency?.name || ''}`" width="640px">
    <el-alert
      class="mb-12px"
      :closable="false"
      show-icon
      type="info"
      title="按会计期间维护汇率（1 外币 = ? 本位币）。录凭证时自动带出凭证所在期间的汇率；本期没有设置时沿用最近一期，都没有时用币别的默认汇率。期末调汇生成凭证时也会把期末汇率写到这里。"
    />
    <el-form v-if="writable" :inline="true" class="-mb-10px">
      <el-form-item label="会计期间">
        <el-date-picker
          v-model="form.month"
          type="month"
          value-format="YYYY-MM"
          placeholder="选择期间"
          class="!w-150px"
        />
      </el-form-item>
      <el-form-item label="汇率">
        <el-input-number
          v-model="form.rate"
          :controls="false"
          :min="0"
          :precision="6"
          class="!w-150px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </el-form-item>
    </el-form>
    <el-table v-loading="loading" :data="list" border stripe max-height="360">
      <el-table-column label="会计期间" prop="month" align="center" width="160" />
      <el-table-column label="汇率" align="right">
        <template #default="scope">{{ formatExchangeRate(scope.row.rate) }}</template>
      </el-table-column>
      <el-table-column v-if="writable" label="操作" align="center" width="140">
        <template #default="scope">
          <el-button link type="primary" @click="handleEdit(scope.row)">编辑</el-button>
          <el-button link type="danger" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </Dialog>
</template>

<script lang="ts" setup>
import type { FmsCurrencyVO } from '@/api/fms/config/currency'
import { FmsForeignCurrencyApi } from '@/api/fms/foreign-currency'
import type { FmsCurrencyRateVO } from '@/api/fms/foreign-currency'
import { checkPermi } from '@/utils/permission'
import { useFmsStore } from '@/views/fms/store/fms'
import { formatExchangeRate } from '@/views/fms/utils/format'

defineOptions({ name: 'FmsCurrencyRateDialog' })

const message = useMessage()
const fmsStore = useFmsStore()
const dialogVisible = ref(false)
const loading = ref(false)
const saving = ref(false)
const accountSetId = ref(0)
const currency = ref<FmsCurrencyVO>()
const list = ref<FmsCurrencyRateVO[]>([])
const form = reactive<{ id?: number; month?: string; rate?: number }>({})
const writable = computed(
  () => fmsStore.isAccountSetWritable && checkPermi(['fms:config:currency:update'])
)

/** 打开汇率表 */
async function open(id: number, row: FmsCurrencyVO) {
  accountSetId.value = id
  currency.value = row
  dialogVisible.value = true
  resetForm()
  await getList()
}
defineExpose({ open })

function resetForm() {
  form.id = undefined
  form.month = fmsStore.getCurrentMonth || undefined
  form.rate = currency.value?.exchangeRate
}

async function getList() {
  if (!currency.value?.id) return
  loading.value = true
  try {
    list.value = await FmsForeignCurrencyApi.getRateList(accountSetId.value, currency.value.id)
  } finally {
    loading.value = false
  }
}

function handleEdit(row: FmsCurrencyRateVO) {
  form.id = row.id
  form.month = row.month
  form.rate = row.rate
}

async function handleSave() {
  if (!form.month || !form.rate || form.rate <= 0) {
    message.warning('请选择会计期间并填写大于 0 的汇率')
    return
  }
  saving.value = true
  try {
    await FmsForeignCurrencyApi.saveRate({
      id: form.id,
      accountSetId: accountSetId.value,
      currencyId: currency.value!.id!,
      month: form.month,
      rate: form.rate
    })
    message.success('保存成功')
    resetForm()
    await getList()
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: FmsCurrencyRateVO) {
  try {
    await message.confirm(`确认删除 ${row.month} 的汇率吗？`)
    await FmsForeignCurrencyApi.deleteRate(accountSetId.value, row.id!)
    message.success('删除成功')
    await getList()
  } catch {}
}
</script>
