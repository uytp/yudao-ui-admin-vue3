<template>
  <Dialog v-model="visible" title="成本参数" width="640px">
    <el-form ref="formRef" v-loading="loading" :model="form" :rules="rules" label-width="150px">
      <el-divider content-position="left">产品与科目</el-divider>
      <el-form-item label="产品辅助核算类别" prop="productAuxTypeId">
        <el-select v-model="form.productAuxTypeId" class="!w-full" placeholder="请选择（一般是“存货”）">
          <el-option v-for="t in auxTypes" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="生产成本-直接材料" prop="materialSubjectId">
        <FmsSubjectSelect v-model="form.materialSubjectId" class="!w-full" />
      </el-form-item>
      <el-form-item label="生产成本-直接人工" prop="laborSubjectId">
        <FmsSubjectSelect v-model="form.laborSubjectId" class="!w-full" />
      </el-form-item>
      <el-form-item label="生产成本-制造费用" prop="overheadInSubjectId">
        <FmsSubjectSelect v-model="form.overheadInSubjectId" class="!w-full" />
      </el-form-item>
      <el-form-item label="制造费用（归集）" prop="overheadPoolSubjectId">
        <FmsSubjectSelect v-model="form.overheadPoolSubjectId" class="!w-full" />
      </el-form-item>
      <el-form-item label="库存商品" prop="finishedSubjectId">
        <FmsSubjectSelect v-model="form.finishedSubjectId" class="!w-full" />
      </el-form-item>
      <el-form-item label="主营业务成本" prop="cogsSubjectId">
        <FmsSubjectSelect v-model="form.cogsSubjectId" class="!w-full" />
      </el-form-item>

      <el-divider content-position="left">计算方法</el-divider>
      <el-form-item label="制造费用分配依据" prop="overheadAllocMethod">
        <el-radio-group v-model="form.overheadAllocMethod">
          <el-radio :value="1">完工数量</el-radio>
          <el-radio :value="2">生产工时</el-radio>
          <el-radio :value="3">直接人工</el-radio>
          <el-radio :value="4">直接成本</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="在产品" prop="wipMethod">
        <el-radio-group v-model="form.wipMethod">
          <el-radio :value="0">不计算在产品（全部完工）</el-radio>
          <el-radio :value="1">约当产量法</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="form.wipMethod === 1" label="材料投入方式" prop="materialInputMode">
        <el-radio-group v-model="form.materialInputMode">
          <el-radio :value="1">开工时一次投入</el-radio>
          <el-radio :value="2">随加工进度投入</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="材料和人工必须在凭证里选上“产品”，才能被归集到对应产品；制造费用不用选产品，会按上面的依据分摊。"
      />
    </el-form>
    <template #footer>
      <el-button type="primary" :loading="saving" @click="submit">保 存</el-button>
      <el-button @click="visible = false">取 消</el-button>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { FmsCostApi } from '@/api/fms/cost'
import type { FmsCostSettingVO } from '@/api/fms/cost'
import { FmsAuxiliaryTypeApi } from '@/api/fms/config/auxiliary/type'
import type { FmsAuxiliaryTypeOptionVO } from '@/api/fms/config/auxiliary/type'
import FmsSubjectSelect from '@/views/fms/config/subject/components/FmsSubjectSelect.vue'
import { useFmsStore } from '@/views/fms/store/fms'
import { parseId } from '@/utils/id'

defineOptions({ name: 'FmsCostSettingDialog' })

const emit = defineEmits<{ success: [] }>()
const message = useMessage()
const fmsStore = useFmsStore()
const accountSetId = computed(() => fmsStore.getAccountSetId)

const visible = ref(false)
const loading = ref(false)
const saving = ref(false)
const formRef = ref()
const auxTypes = ref<FmsAuxiliaryTypeOptionVO[]>([])
const form = ref<FmsCostSettingVO>({
  accountSetId: 0,
  overheadAllocMethod: 1,
  wipMethod: 0,
  materialInputMode: 1
})

const required = (msg: string) => [{ required: true, message: msg, trigger: 'change' }]
const rules = {
  productAuxTypeId: required('请选择产品辅助核算类别'),
  materialSubjectId: required('请选择直接材料科目'),
  laborSubjectId: required('请选择直接人工科目'),
  overheadInSubjectId: required('请选择生产成本-制造费用科目'),
  overheadPoolSubjectId: required('请选择制造费用归集科目'),
  finishedSubjectId: required('请选择库存商品科目'),
  cogsSubjectId: required('请选择主营业务成本科目')
}

/** 打开弹窗并加载当前参数 */
async function open() {
  if (!accountSetId.value) return
  visible.value = true
  loading.value = true
  try {
    auxTypes.value = await FmsAuxiliaryTypeApi.getAuxiliaryTypeSimpleList(accountSetId.value)
    const data = await FmsCostApi.getSetting(accountSetId.value)
    form.value = {
      ...data,
      productAuxTypeId: parseId(data.productAuxTypeId),
      materialSubjectId: parseId(data.materialSubjectId),
      laborSubjectId: parseId(data.laborSubjectId),
      overheadInSubjectId: parseId(data.overheadInSubjectId),
      overheadPoolSubjectId: parseId(data.overheadPoolSubjectId),
      finishedSubjectId: parseId(data.finishedSubjectId),
      cogsSubjectId: parseId(data.cogsSubjectId)
    }
  } finally {
    loading.value = false
  }
}

/** 保存参数 */
async function submit() {
  await formRef.value?.validate()
  saving.value = true
  try {
    await FmsCostApi.saveSetting({ ...form.value, accountSetId: accountSetId.value as number })
    message.success('保存成功')
    visible.value = false
    emit('success')
  } finally {
    saving.value = false
  }
}

defineExpose({ open })
</script>
