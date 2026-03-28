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
      <div class="auth-hero__content">
        <p class="auth-hero__eyebrow">WORK RATING SYSTEM</p>
        <h1>电控匿名工<br />作评分系统</h1>
        <p class="auth-hero__desc">
          围绕评分、结算、公示三条主流程展开的内部评分系统。仅用于 GDUT-FSAE
          车队电控组内部工作评价。
        </p>
        <div class="auth-hero__chips">
          <span>匿名评分</span>
          <span>实时结算</span>
          <span>周期管理</span>
        </div>
      </div>
    </div>

    <div class="auth-side">
      <div class="auth-card">
        <div class="auth-card__header">
          <p class="auth-card__eyebrow">身份验证</p>
          <h2>欢迎回来</h2>
          <p class="auth-card__desc">登录以进入本期评分结算周期。</p>
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
    </div>
  </section>
</template>

<style scoped>
.auth-page {
  min-height: 100svh;
  display: grid;
  grid-template-columns: 60% 40%;
  gap: 0;
  padding: 0;
  width: 100%;
  background: var(--bg-main);
}

.auth-hero {
  display: grid;
  align-items: center;
  min-height: 100svh;
  padding: clamp(2rem, 5.6vw, 5rem);
  background:
    radial-gradient(circle at 86% 22%, rgba(217, 119, 87, 0.12), transparent 30%),
    radial-gradient(circle at 18% 86%, rgba(0, 0, 0, 0.04), transparent 22%),
    linear-gradient(150deg, #f0ede5 0%, #e8e4dc 100%);
}

.auth-hero__content {
  max-width: 32rem;
}

.auth-hero__eyebrow {
  margin: 0;
  color: var(--brand);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.auth-hero h1 {
  margin: 1rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(3rem, 6.2vw, 5.4rem);
  line-height: 0.92;
  letter-spacing: 0.01em;
}

.auth-hero__desc {
  margin: 1.25rem 0 0;
  max-width: 30rem;
  color: var(--text-muted);
  font-size: 1.05rem;
  line-height: 1.65;
}

.auth-hero__chips {
  display: flex;
  gap: 0.65rem;
  margin-top: 1.5rem;
  flex-wrap: wrap;
}

.auth-hero__chips span {
  padding: 0.3rem 0.65rem;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  color: var(--text-soft);
  font-size: 0.8rem;
}

.auth-side {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100svh;
  padding: clamp(1rem, 1.8vw, 1.4rem);
  background: rgba(250, 250, 242, 0.94);
  border-left: 1px solid var(--line-soft);
}

.auth-card {
  width: min(100%, 23.5rem);
  padding: 2rem;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-lg);
  background: rgba(250, 250, 242, 0.98);
}

.auth-card__eyebrow {
  margin: 0;
  color: var(--brand);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.88rem;
}

.auth-card__header h2 {
  margin: 0.4rem 0 0;
  font-family: var(--font-display);
  font-size: 2.3rem;
}

.auth-card__desc {
  margin: 0.4rem 0 0;
  color: var(--text-muted);
}

.auth-card__form {
  display: grid;
  gap: 1rem;
  margin-top: 1.4rem;
}

.auth-card__form label {
  display: grid;
  gap: 0.5rem;
}

.auth-card__form span {
  color: var(--text-soft);
  font-size: 0.92rem;
}

.auth-card__error {
  margin: 0;
  color: var(--brand-strong);
}

@media (max-width: 1080px) {
  .auth-page {
    grid-template-columns: 1fr;
    min-height: 100svh;
    align-items: center;
    width: 100%;
  }

  .auth-hero {
    display: none;
  }

  .auth-side {
    min-height: 100svh;
    border-left: 0;
    background: transparent;
    margin: 0;
    padding: 1rem;
  }

  .auth-card {
    flex: 1;
  }

  .auth-card h2 {
    font-size: 1.6rem;
  }
}

@media (max-width: 767px) {
  .auth-page {
    padding: 0.8rem;
  }

  .auth-side {
    padding: 0;
  }

  .auth-card {
    width: 100%;
    padding: 1.35rem 1rem;
  }

  .auth-card__header h2 {
    font-size: 1.9rem;
  }
}
</style>
