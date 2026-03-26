<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

import StatusBadge from '../components/common/StatusBadge.vue'
import { useAppStore } from '../stores/app'

const router = useRouter()
const appStore = useAppStore()
const { currentAccount } = storeToRefs(appStore)
const form = reactive({
  currentPassword: '',
  password: '',
  confirmPassword: ''
})
const errorMessage = ref('')

const isValid = computed(
  () => form.password.length >= 8 && form.password === form.confirmPassword
)

async function handleSubmit() {
  if (!isValid.value) {
    errorMessage.value = '密码至少 8 位，且两次输入需一致。'
    return
  }

  try {
    await appStore.updatePassword(form.currentPassword, form.password)
    errorMessage.value = ''

    if (currentAccount.value?.role === 'member') {
      router.push('/employee/rating')
      return
    }

    if (currentAccount.value?.role === 'leader') {
      router.push('/supervisor/scoring')
      return
    }

    router.push('/admin/dashboard')
  } catch (error: any) {
    errorMessage.value = error.message || '修改密码失败'
  }
}
</script>

<template>
  <section class="reset-view surface-card">
    <div class="reset-view__intro">
      <StatusBadge tone="warning">首次登录强制修改密码</StatusBadge>
      <h3>为 {{ currentAccount?.displayName }} 设置新密码</h3>
      <p>未完成密码修改前，不允许进入评分流程。</p>
    </div>

    <div class="reset-view__form">
      <label>
        <span>当前密码</span>
        <input v-model="form.currentPassword" type="password" placeholder="输入当前密码" />
      </label>
      <label>
        <span>新密码</span>
        <input v-model="form.password" type="password" placeholder="至少 8 位" />
      </label>
      <label>
        <span>确认密码</span>
        <input v-model="form.confirmPassword" type="password" placeholder="再次输入" />
      </label>
      <button class="primary-button" type="button" @click="handleSubmit">确认并继续</button>
      <p v-if="errorMessage" class="reset-view__error">{{ errorMessage }}</p>
    </div>
  </section>
</template>

<style scoped>
.reset-view {
  max-width: 52rem;
  margin: 2rem auto;
  display: grid;
  gap: 2rem;
}

.reset-view__intro h3 {
  margin: 0.85rem 0 0;
  font-family: var(--font-display);
  font-size: 2.1rem;
}

.reset-view__intro p {
  margin: 0.85rem 0 0;
  color: var(--text-muted);
}

.reset-view__form {
  display: grid;
  gap: 1rem;
}

.reset-view__form label {
  display: grid;
  gap: 0.45rem;
}

.reset-view__error {
  margin: 0;
  color: #b24a36;
}
</style>
