<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'

const router = useRouter()
const appStore = useAppStore()
const submitting = ref(false)
const form = reactive({
  username: '',
  password: ''
})
const errorMessage = ref('')

function navigateByRole() {
  if (appStore.currentAccount?.firstLogin) {
    router.push('/reset-password')
    return
  }

  if (appStore.currentAccount?.role === 'member') {
    router.push('/employee/rating')
    return
  }

  if (appStore.currentAccount?.role === 'leader') {
    router.push('/supervisor/scoring')
    return
  }

  router.push('/admin/dashboard')
}

async function handleLogin() {
  submitting.value = true
  const result = await appStore.login(form.username, form.password)
  submitting.value = false

  if (!result.ok) {
    errorMessage.value = result.reason
    return
  }

  errorMessage.value = ''
  navigateByRole()
}
</script>

<template>
  <section class="auth-page">
    <div class="auth-hero">
      <h1>电控匿名工作评分系统</h1>
      <p class="auth-hero__desc">仅用于 GDUT-FSAE 车队电控组内部工作评价。</p>
    </div>

    <div class="auth-card">
      <div class="auth-card__header">
        <p>登录系统</p>
        <h2>欢迎进入评分结算周期</h2>
      </div>

      <div class="auth-card__form">
        <label>
          <span>账号</span>
          <input v-model="form.username" type="text" placeholder="例如 chenyu" />
        </label>
        <label>
          <span>密码</span>
          <input v-model="form.password" type="password" placeholder="输入密码" />
        </label>
        <button class="primary-button" type="button" @click="handleLogin">{{ submitting ? '登录中...' : '登录并进入' }}</button>
        <p v-if="errorMessage" class="auth-card__error">{{ errorMessage }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.2fr 0.95fr;
  gap: 2rem;
  align-items: stretch;
  padding: 2rem;
}

.auth-hero,
.auth-card {
  border: 1px solid var(--line-soft);
  border-radius: 32px;
  box-shadow: var(--shadow-soft);
}

.auth-hero {
  padding: 3rem;
  background:
    radial-gradient(circle at top left, rgba(242, 187, 107, 0.26), transparent 32%),
    linear-gradient(160deg, rgba(255, 251, 244, 0.96), rgba(246, 236, 219, 0.92));
}

.auth-hero h1 {
  margin: 0 0 1rem;
  font-family: var(--font-display);
  font-size: clamp(2.8rem, 6vw, 4.8rem);
  line-height: 0.95;
}

.auth-hero__desc {
  max-width: 42rem;
  color: var(--text-muted);
  font-size: 1rem;
  line-height: 1.8;
}

.auth-hero__chips {
  display: flex;
  gap: 0.8rem;
  margin-top: 1.5rem;
}

.auth-card {
  padding: 2rem;
  background: rgba(255, 251, 245, 0.94);
}

.auth-card__header p,
.auth-card__label {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.88rem;
}

.auth-card__header h2 {
  margin: 0.45rem 0 0;
  font-family: var(--font-display);
  font-size: 2rem;
}

.auth-card__form {
  display: grid;
  gap: 1rem;
  margin-top: 1.4rem;
}

.auth-card__form label {
  display: grid;
  gap: 0.45rem;
}

.auth-card__form span {
  color: var(--text-soft);
  font-size: 0.92rem;
}

.auth-card__error {
  margin: 0;
  color: #b24a36;
}

.auth-card__accounts {
  display: grid;
  gap: 0.7rem;
  margin-top: 1.6rem;
}

.demo-account {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 0.95rem 1rem;
  border: 1px solid rgba(214, 191, 160, 0.8);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.66);
  color: inherit;
}

.demo-account span {
  color: var(--text-muted);
  font-size: 0.88rem;
}

@media (max-width: 1080px) {
  .auth-page {
    grid-template-columns: 1fr;
  }
}
</style>
