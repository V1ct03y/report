# Anonymous Rating Settlement API

## Stack
- Node.js
- Express
- SQLite (better-sqlite3)

## Quick start

```bash
cd backend
cp .env.example .env
npm install
npm run db:init
npm run dev
```

API default: `http://localhost:4300`

## Seed accounts
Default password: `ChangeMe123!`

- admin: `kwok-admin`
- manager A: `manager-a`
- manager B: `manager-b`
- employees: `zhangsan`, `lisi`, `wangwu`, `zhaoliu`

## Main routes
- `POST /api/auth/login`
- `POST /api/auth/change-password`
- `GET /api/employee/current-cycle`
- `POST /api/employee/scores`
- `GET /api/employee/public-results`
- `GET /api/admin/dashboard`
- `POST /api/admin/manager-scores`
- `POST /api/admin/settle`
- `GET /api/admin/results`
- `GET /api/admin/members`
- `POST /api/admin/members`
- `DELETE /api/admin/members/:id`
- `GET /api/cycles/current`
- `GET /api/cycles/history`
- `GET /api/cycles/:id/results`

## Notes
- Employees must score all employees including themselves.
- Incomplete submissions => `used_voting_right = false`
- Invalid rows are shown as `false` in the public matrix.
- Manager scores participate in settlement but are not shown in the public matrix.
