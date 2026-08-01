# Family Hub

面向家庭事务的轻量时间轴工具，部署于 EdgeOne Pages。

## 当前架构

- 前端：`index.html` + `v2.css`
- 登录：`/api/auth/login`、`/api/auth/session`、`/api/auth/logout`
- 账本：唯一接口 `/api/ledger`
- 汇率：`/api/exchange-rates`
- 存储：EdgeOne Pages Blob，统一 `events` 数据模型（version 5）

## 环境变量

- `ADMIN_PASSWORD`
- `SESSION_SECRET`（至少 32 位随机字符串）

## 数据结构

```json
{
  "version": 5,
  "updatedAt": null,
  "settings": { "siteName": "Family Hub" },
  "events": []
}
```

仓库不再保留旧版三模块管理台、重复账本接口或 Safari 分叉脚本。
