# browser-use CLI 使用说明

`browser-use CLI` 在本项目中被定义为“开发辅助工具”，不参与正式监控运行。

## 允许用途

- 打开目标页面
- 读取页面标题、URL、按钮文本、可交互元素
- 观察页面结构
- 辅助截图
- 帮助开发者制定 Playwright 选择器策略

## 禁止用途

- 自动点击购买直到成功
- 自动创建订单
- 自动提交订单
- 自动发起支付
- 自动处理验证码
- 伪造请求绕过页面流程
- 风控绕过
- 反检测

## 示例命令

```powershell
browser-use --session glm --headed open https://open.bigmodel.cn/
browser-use --session glm state
browser-use --session glm screenshot ./captures/glm-home.png

browser-use --session aliyun --profile "Default" --headed open https://www.aliyun.com/
browser-use --session aliyun state
browser-use --session aliyun screenshot ./captures/aliyun-home.png
```

