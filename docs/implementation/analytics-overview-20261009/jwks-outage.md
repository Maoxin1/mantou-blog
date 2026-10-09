# BUG-OVW-QA-004：证书服务异常误报为无权限

PR145 的[自动审查意见](https://github.com/Maoxin1/mantou-blog/pull/145#discussion_r4227085810)指出有效本人会话遇到DNS/TLS、非200证书响应等情况会得到401，而应是临时无法验证的503。已核对固定jose6.2.12实际源码：Timeout独立错误；HTTP/JSON错误为ERR_JOSE_GENERIC，网络TypeError原样传播，坏JWKS为ERR_JWKS_INVALID。意见成立，不据审查者建议直接放宽权限。

正式回归通过真实createRemoteJWKSet+customFetch模拟上述6类依赖失败；3个新用例在原实现因UNAUTHORIZED/401失败，原3用例通过。最小实现使用明确的令牌/签名/声明/密钥选择拒绝错误码表返回401，其他验证异常返回AUTH_UNAVAILABLE/503。所有分支仍拒绝数据；本人身份、签名、issuer/aud/时间约束不变。

恢复测试证明同一resolver在恢复合法JWKS后可验证本人；未知kid和错误真实RSA签名仍401。处理器故障响应保持no-store并且不调用数据读取。单独auth6/6，最终overview25/25及Worker编译通过。真实生产网络失败/本人新版数据流程仍未模拟执行，不把本地受控取证当作线上成功。

[版本/命令证据哈希](jwks-outage-record.json)，原失败日志保存在本地Git忽略证据目录；未删除断言或制造语法/依赖红灯。关联OVW004/005/006、TM003/006/007，属于已采纳失败行为修复，无产品范围扩大。原146浏览器等未受改动流程保持原记录边界；新提交需重新通过GitHub完整验证。
