<template>
  <el-dialog v-model="visible" title="资产类别管理" width="960px" append-to-body>
    <div class="mb-12px">
      <el-button v-hasPermi="['fms:asset:category']" type="primary" @click="openForm()">
        <Icon icon="ep:plus" class="mr-5px" /> 新增类别
      </el-button>
      <el-button @click="loadList"><Icon icon="ep:refresh" class="mr-5px" /> 刷新</el-button>
      <span class="ml-12px text-[var(--el-text-color-secondary)]">
        类别决定默认折旧月数、净残值率，以及入账用到的三个科目
      </span>
    </div>
    <el-table v-loading="loading" :data="list" border max-height="360">
      <el-table-column label="编码" prop="code" width="80" />
      <el-table-column label="名称" prop="name" width="130" />
      <el-table-column label="默认月数" prop="lifeMonths" width="90" align="right" />
      <el-table-column label="默认残值率%" prop="residualRate" width="100" align="right" />
      <el-table-column label="固定资产科目" prop="assetSubjectName" min-width="130" />
      <el-table-column label="累计折旧科目" prop="accumSubjectName" min-width="130" />
      <el-table-column label="折旧费用科目" prop="expenseSubjectName" min-width="130" />
      <el-table-column label="资产数" prop="assetCount" width="70" align="right" />
      <el-table-column label="操作" width="110" align="center">
        <template #default="{ row }">
          <el-button v-hasPermi="['fms:asset:category']" link type="primary" @click="openForm(row)">编辑</el-button>
          <el-button v-hasPermi="['fms:asset:category']" link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>

  <el-dialog v-model="formVisible" :title="form.id ? '编辑资产类别' : '新增资产类别'" width="560px" append-to-body>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
      <el-form-item label="类别编码" prop="code">
        <el-input v-model="form.code" maxlength="32" placeholder="例如 01" />
      </el-form-item>
      <el-form-item label="类别名称" prop="name">
        <el-input v-model="form.name" maxlength="64" placeholder="例如 电子设备" />
      </el-form-item>
      <el-form-item label="默认折旧月数" prop="lifeMonths">
        <el-input-number v-model="form.lifeMonths" :min="1" :max="1200" :controls="false" class="!w-200px" />
        <span class="ml-8px text-[var(--el-text-color-secondary)]">例如电子设备 36 个月</span>
      </el-form-item>
      <el-form-item label="默认残值率 %" prop="residualRate">
        <el-input-number v-model="form.residualRate" :min="0" :max="100" :precision="2" :controls="false" class="!w-200px" />
      </el-form-item>
      <el-form-item label="固定资产科目" prop="assetSubjectId">
        <FmsSubjectSelect v-model="form.assetSubjectId" class="!w-full" />
      </el-form-item>
      <el-form-item label="累计折旧科目" prop="accumSubjectId">
        <FmsSubjectSelect v-model="form.accumSubjectId" class="!w-full" />
      </el-form-item>
      <el-form-item label="折旧费用科目" prop="expenseSubjectId">
        <FmsSubjectSelect v-model="form.expenseSubjectId" class="!w-full" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" maxlength="255" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="formVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { FmsAssetApi } from '@/api/fms/asset'
import type { FmsAssetCategoryVO } from '@/api/fms/asset'
import FmsSubjectSelect from '@/views/fms/config/subject/components/FmsSubjectSelect.vue'
import { useFmsStore } from '@/views/fms/store/fms'
import type { FormInstance, FormRules } from 'element-plus'

defineOptions({ name: 'FmsAssetCategoryDialog' })

const emit = defineEmits<{ changed: [] }>()

const message = useMessage()
const fmsStore = useFmsStore()
const accountSetId = computed(() => fmsStore.getAccountSetId)

const visible = ref(false)
const loading = ref(false)
const list = ref<FmsAssetCategoryVO[]>([])

const formVisible = ref(false)
const saving = ref(false)
const formRef = ref<FormInstance>()
const emptyForm = (): FmsAssetCategoryVO => ({
  code: '',
  name: '',
  lifeMonths: 60,
  residualRate: 5
})
const form = ref<FmsAssetCategoryVO>(emptyForm())
const rules: FormRules = {
  code: [{ required: true, message: '请填写类别编码', trigger: 'blur' }],
  name: [{ required: true, message: '请填写类别名称', trigger: 'blur' }],
  lifeMonths: [{ required: true, message: '请填写默认折旧月数', trigger: 'blur' }],
  residualRate: [{ required: true, message: '请填写默认残值率', trigger: 'blur' }],
  assetSubjectId: [{ required: true, message: '请选择固定资产科目', trigger: 'change' }],
  accumSubjectId: [{ required: true, message: '请选择累计折旧科目', trigger: 'change' }],
  expenseSubjectId: [{ required: true, message: '请选择折旧费用科目', trigger: 'change' }]
}

async function loadList() {
  if (!accountSetId.value) return
  loading.value = true
  try {
    list.value = await FmsAssetApi.getCategoryList(accountSetId.value)
  } finally {
    loading.value = false
  }
}

function open() {
  visible.value = true
  loadList()
}

function openForm(row?: FmsAssetCategoryVO) {
  form.value = row ? { ...row } : emptyForm()
  formVisible.value = true
}

async function handleSave() {
  await formRef.value?.validate()
  saving.value = true
  try {
    await FmsAssetApi.saveCategory({ ...form.value, accountSetId: accountSetId.value! })
    message.success('保存成功')
    formVisible.value = false
    await loadList()
    emit('changed')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: FmsAssetCategoryVO) {
  await message.confirm(`确定删除类别【${row.name}】吗？`)
  await FmsAssetApi.deleteCategory(accountSetId.value!, row.id!)
  message.success('已删除')
  await loadList()
  emit('changed')
}

defineExpose({ open })
</script>
