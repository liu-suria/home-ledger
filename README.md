# Family Hub

面向家庭事务的轻量时间轴工具，部署于 EdgeOne Pages。当前版本：**Beta v2.5.0**。

## 环境变量

- `ADMIN_PASSWORD`：网页登录密码
- `SESSION_SECRET`：至少 32 位随机字符串
- `API_KEY`：外部 API 密钥，建议至少 32 位随机字符串

外部 API 请求可携带：

```http
X-API-Key: your-api-key
```

或：

```http
Authorization: Bearer your-api-key
```

## API

- `GET /api/types`：查询全部类型
- `GET /api/events?days=30&type=baby&status=pending&keyword=疫苗`
- `POST /api/events`：新增单条事项
- `PATCH /api/events?id=事项ID`：修改或完成事项
- `DELETE /api/events?id=事项ID`：移入回收站
- `GET /api/today`：查询今天事项
- `GET /api/stats`：查询首页统计
- `GET /api/templates`：查询模板
- `POST /api/templates`：应用模板
- `GET /api/calendar?days=365`：导出 ICS
- `GET /api/backup`：读取最近自动备份
- `POST /api/backup`：恢复最近自动备份
- `GET/PUT /api/ledger`：完整账本读取和保存

### 新增事项示例

```json
{
  "title": "宝宝疫苗",
  "type": "baby",
  "date": "2026-08-15",
  "calendar": "solar",
  "amount": 0,
  "currency": "CNY",
  "note": "社区医院"
}
```

## 数据模型

```json
{
  "version": 8,
  "settings": {
    "siteName": "Family Hub",
    "theme": "system",
    "types": []
  },
  "series": [],
  "events": [],
  "trash": [],
  "logs": [],
  "templates": []
}
```

每次保存前会自动把上一版写入 `ledger/backup-latest.json`。删除事项进入回收站，前端按 30 天保留策略展示。
