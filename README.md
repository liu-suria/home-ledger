# HomeLedger

自部署的家庭生活管理工具：账单订阅、物品保修维修档案与提醒看板。原生 HTML/CSS/JavaScript，使用 EdgeOne Pages Functions 与 Blob，不需要构建步骤。

## EdgeOne 配置

部署后在 EdgeOne Makers 的环境变量（Secrets）中设置：

- `ADMIN_PASSWORD`：登录密码
- `SESSION_SECRET`：至少 32 位的随机字符串

首页与 `/admin/` 使用同一个受保护的会话 Cookie；首次保存数据会创建私有 Blob 存储空间。

## 功能

- 三个模块：账单订阅、保修维修、倒计时提醒
- 单条录入、编辑、删除、上下排序和模块展示排序
- JSON 全量导入、导出备份
- 手机/电脑自适应与密码登录
