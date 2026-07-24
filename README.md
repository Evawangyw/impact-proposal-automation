# Impact Proposal Console

一个用于 Impact Partner Marketplace 的半自动邀约控制台。

它可以按联盟客名字搜索 Impact，判断结果卡片右上角是否有绿色勾；没有绿色勾时，会打开 Send Proposal 流程并自动填写：

- Template Term
- Contract Start Date
- Partner Group
- Message

发送前会停在 Impact 的最终确认步骤，最后确认仍由人工完成。

## 启动方式

1. 双击 `outputs/start-impact-proposal-runner.cmd`。
2. 在弹出的 Chrome 里登录 Impact。
3. 打开控制台：`http://127.0.0.1:8798/`。
4. 输入联盟客名字，点击“开始排查并填表”。

## 数据文件

运行时会读取：

- `work/impact-prospect-results.json`
- `work/eu-impact-prospect-results.json`

这两个文件来自前置表格排查结果，可能包含联盟客名单，不建议提交到公开 GitHub 仓库。

## 功能点

- 自动保持 Impact Marketplace 的 Active / Prospective / Joined 筛选条件。
- 搜索结果为多个时，控制台会暂停并要求人工选择正确结果。
- Impact 加载较慢时使用较长 timeout。
- Template Term 选择后会补充确认点击和失焦动作，减少“看起来选了但实际没选中”的情况。

## 注意

- 不会上传或保存 Impact 密码。
- Chrome 登录资料保存在本机 `work/impact-automation-chrome-profile-*`，已通过 `.gitignore` 排除。
- 日志、Excel 原表、导出的结果清单默认不提交。
