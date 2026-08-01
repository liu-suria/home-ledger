# Family Hub

面向家庭事务的轻量时间轴工具，部署于 EdgeOne Pages。当前版本：**Beta v2.6.0**。

## 环境变量

- `ADMIN_PASSWORD`：网页登录密码
- `SESSION_SECRET`：至少 32 位随机字符串
- `API_KEY`：外部 API 密钥，建议至少 32 位随机字符串

外部 API 请求可携带 `X-API-Key`，或 `Authorization: Bearer <API_KEY>`。

## API

- `GET /api/types`：查询全部类型
- `GET /api/events?days=30&type=baby&status=pending&keyword=疫苗`
- `POST /api/events`：新增单条事项
- `PATCH /api/events?id=事项ID`：修改或完成事项
- `DELETE /api/events?id=事项ID`：移入回收站
- `GET /api/today`：查询今天事项
- `GET /api/stats`：查询首页统计
- `GET /api/templates`、`POST /api/templates`：查询或应用模板
- `GET /api/calendar?days=365`：导出 ICS
- `GET /api/series`：查询循环规则
- `POST /api/series`：暂停、恢复、补齐、修改或删除循环规则及未来实例
- `POST /api/files`：设置事项 Logo 或添加附件
- `DELETE /api/files?eventId=...&attachmentId=...`：删除附件
- `GET /api/backup`：查询最近 7 个历史备份
- `GET /api/backup?slot=0`：读取指定备份
- `POST /api/backup`：按 slot 恢复指定备份
- `GET/PUT /api/ledger`：完整账本读取和保存

## 主要能力

- 公历、阴历事项
- 自定义类型与拖动排序
- 循环规则与独立实例
- 每条实例独立完成、延期、编辑和删除
- 每日自动补齐未来一年循环实例
- 循环规则暂停、恢复、编辑未来实例、删除未来实例
- 原币与人民币汇率换算
- 订阅 30 天、季度、年度金额统计
- JSON、CSV、Markdown、ICS 导出
- JSON 导入、回收站、操作日志、模板
- Logo 与附件；单附件不超过 160KB，每条最多 5 个
- 最近 7 个自动备份版本
- 首屏缓存、每次最多渲染 100 条，支持继续加载
- 浅色、深色、跟随系统主题

## 数据模型

```json
{
  "version": 8,
  "settings": {
    "siteName": "Family Hub",
    "theme": "system",
    "types": [],
    "typeOrder": []
  },
  "series": [],
  "events": [],
  "trash": [],
  "logs": [],
  "templates": []
}
```

删除事项进入回收站。每次写入前会将当前数据保存进 7 个循环备份槽之一，并同步保留 `ledger/backup-latest.json`。
