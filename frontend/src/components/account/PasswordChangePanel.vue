<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import { useAppStore } from '../../stores/app'

const appStore = useAppStore()

const form = reactive({
  currentPassword: '',
  nextPassword: '',
  confirmPassword: ''
})

const busy = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const isValid = computed(() => (
  form.nextPassword.length >= 8 &&
  form.nextPassword === form.confirmPassword
))

async function handleSubmit() {
  if (!isValid.value) {
    successMessage.value = ''
    errorMessage.value = '新密码至少 8 位，且两次输入需要一致。'
    return
  }

  busy.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await appStore.updatePassword(form.currentPassword, form.nextPassword)
    form.currentPassword = ''
    form.nextPassword = ''
    form.confirmPassword = ''
    successMessage.value = '密码已更新。'
  } catch (error: any) {
    errorMessage.value = error.message || '修改密码失败'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="password-panel">
    <div class="password-panel__grid">
      <label>
        <span>当前密码</span>
        <input v-model="form.currentPassword" type="password" placeholder="输入当前密码" />
      </label>

      <label>
        <span>新密码</span>
        <input v-model="form.nextPassword" type="password" placeholder="至少 8 位" />
      </label>

      <label>
        <span>确认新密码</span>
        <input v-model="form.confirmPassword" type="password" placeholder="再次输入新密码" />
      </label>
    </div>

    <div class="password-panel__actions">
      <button class="primary-button" type="button" :disabled="busy" @click="handleSubmit">
        {{ busy ? '保存中…' : '修改密码' }}
      </button>
      <p v-if="successMessage" class="password-panel__success">{{ successMessage }}</p>
      <p v-if="errorMessage" class="password-panel__error">{{ errorMessage }}</p>
    </div>
  </section>
</template>

<style scoped>
.password-panel {
  display: grid;
  gap: 1rem;
}

.password-panel__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.9rem;
}

.password-panel label {
  display: grid;
  gap: 0.45rem;
}

.password-panel__actions {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex-wrap: wrap;
}

.password-panel__success,
.password-panel__error {
  margin: 0;
}

.password-panel__success {
  color: #2f6f4f;
}

.password-panel__error {
  color: #b24a36;
}

@media (max-width: 900px) {
  .password-panel__grid {
    grid-template-columns: 1fr;
  }
}
</style>
