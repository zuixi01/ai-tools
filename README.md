# cloud-offer-watch

一个面向 `GLM + 阿里云` 的“机会监控与人工确认平台”。

本项目严格定位为：jksjkkj

- 观察页面中的套餐、价格、库存、倒计时、按钮状态等公开信号
- 记录变化、生成快照、发出提醒
- 提供“打开官方页面”入口，交由用户手动完成后续操作

本项目明确**不实现**以下能力：

- 自动下单
- 自动支付
- 自动提交订单
- 自动处理验证码
- 伪造请求绕过前端流程
- 反检测、风控绕过
- 多账号批量轮询与批量提交

所有触发结果都必须落到“人工确认”。

## 当前进度

当前已完成 `Phase 1`：

- 初始化 monorepo
- 初始化 `frontend` / `backend`
- 接入 `.env.example`
- 配置 Docker Compose
- 跑通前后端 hello world
- 搭建前端管理台壳子

当前已完成 `Phase 2`：

- 接入 providers / targets 数据模型与 CRUD API
- 前端完成 providers / targets 基础管理表格页

当前已完成 `Phase 3`：

- 接入 Playwright 通用页面抓取器
- 支持手动执行目标观察
- 可采集标题、按钮文本、HTML 摘要、公开响应摘要与截图
- 可写入 run_records / snapshots

当前已完成 `Phase 4 / 5` 的基础闭环：

- 接入 glm / aliyun 第一版平台规则
- 支持快照 diff、告警生成、执行记录与告警列表
- 支持打开官方页面入口

当前已完成执行保护与通知基础设施：

- settings 先通过环境变量配置，并提供只读 API
- target 支持手动启停
- 执行链路加入并发上限、全局频率限制、目标最小轮询间隔保护
- 可选最小 webhook 推送

## 目录

```text
cloud-offer-watch/
├─ backend/
│  ├─ app/
│  │  ├─ api/
│  │  ├─ browser/
│  │  ├─ core/
│  │  ├─ models/
│  │  ├─ providers/
│  │  ├─ schemas/
│  │  ├─ services/
│  │  └─ utils/
│  ├─ Dockerfile
│  └─ requirements.txt
├─ docs/
├─ frontend/
│  ├─ app/
│  ├─ components/
│  ├─ lib/
│  ├─ services/
│  └─ types/
├─ scripts/
│  └─ dev-tools/
├─ docker-compose.yml
└─ .env.example
```

## 开发启动

### 方式 1：本地分别启动

后端：

```powershell
cd D:\ai-tools\backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

前端：

```powershell
cd D:\ai-tools\frontend
cmd /c npm install
cmd /c npm run dev
```

### 方式 2：Docker Compose

```powershell
cd D:\ai-tools
docker compose up --build
```

启动后：

- 前端管理台：[http://localhost:3000](http://localhost:3000)
- 后端 API：[http://localhost:8000](http://localhost:8000)
- 后端健康检查：[http://localhost:8000/healthz](http://localhost:8000/healthz)
- 后端 OpenAPI：[http://localhost:8000/docs](http://localhost:8000/docs)

## browser-use CLI 的定位

`browser-use CLI` 在本项目中只作为**开发辅助工具**，用于页面探路、元素观察和选择器调试，不作为正式运行 worker。

参考命令：

```powershell
browser-use --session glm --headed open https://open.bigmodel.cn/
browser-use --session glm state
browser-use --session glm screenshot ./captures/glm-home.png

browser-use --session aliyun --profile "Default" --headed open https://www.aliyun.com/
browser-use --session aliyun state
browser-use --session aliyun screenshot ./captures/aliyun-home.png
```

其用途仅限：

- 快速摸清页面结构
- 查看标题和可交互元素
- 辅助确定后续 Playwright 选择器策略
- 辅助截图与页面状态调试

正式运行时只允许使用 `Playwright` 执行“观察、采集、摘要、告警、人工打开官方页面入口”。

## Phase 3 手动验证

先启动后端后，确保本地 Playwright Chromium 可用：

```powershell
cd D:\ai-tools\backend
python -m playwright install chromium
```

然后：

1. 在 `http://localhost:3000/providers` 创建一个 provider
2. 在 `http://localhost:3000/targets` 创建一个 target
3. 调用手动执行接口：

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/v1/runs/targets/1/execute"
```

4. 查看执行记录：

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/runs"
```

返回结果中会包含：

- 页面标题
- 主按钮文本
- HTML 摘要
- 公开响应摘要
- 截图路径

## 执行保护与 webhook

可用环境变量：

```env
MAX_CONCURRENT_WATCHERS=2
GLOBAL_RATE_LIMIT_PER_MINUTE=30
ENFORCE_TARGET_POLL_INTERVAL=true
WEBHOOK_ENABLED=false
WEBHOOK_URL=
WEBHOOK_TIMEOUT_SECONDS=10
```

说明：

- `MAX_CONCURRENT_WATCHERS`：限制同一时刻最多执行多少个观察任务
- `GLOBAL_RATE_LIMIT_PER_MINUTE`：限制每分钟最多触发多少次观察
- `ENFORCE_TARGET_POLL_INTERVAL`：是否强制遵守 target 自身轮询间隔
- `WEBHOOK_ENABLED` 和 `WEBHOOK_URL`：用于发送变化或机会提醒

手动启停 target：

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/v1/targets/1/enable"
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/v1/targets/1/disable"
```

## 参考包处理说明

你提供的 `D:/aliyun_claw/glm-rush-master.zip` 是一个偏向自动抢购的 userscript 示例。由于它包含自动重试、自动点击、支付恢复、反检测等与本项目安全边界冲突的能力，本项目**不会复用其执行逻辑**，只保留“可观察信号项”的分析思路。
