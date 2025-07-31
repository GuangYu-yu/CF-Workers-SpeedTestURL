<div align="center">

# 🚀 SpeedTest-CloudflareWorker

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## 📖 项目简介

**在Cloudflare Workers上快速搭建专属测速服务** ⚡

---

## 🎯 功能特性

### 📊 测速规格定制

#### 1. 自定义数据大小
支持灵活设置测速数据量，单位可选：**K**、**M**、**G**

| 数据大小 | 示例地址 | 说明 |
|---------|----------|------|
| **1024K** | `https://<your_workers>/1024k` | 1MB测速包 |
| **200M** | `https://<your_workers>/200m` | 200MB测速包 |
| **1G** | `https://<your_workers>/1g` | 1GB测速包 |

#### 2. 智能分块策略
通过 `chunk` 参数自定义分块大小（默认64KB）

| 分块大小 | 示例地址
|----------|----------|
| **默认64KB** | `https://<your_workers>/100m`
| **16KB** | `https://<your_workers>/100m?chunk=16k`

> 💡 **分块范围**：1KB - 1MB

#### 3. 处理模式选择
通过 `direct` 参数控制请求处理方式

| 请求方式                       | 是否转发 Cloudflare 官方测速                |
| -------------------------- | ----------------------------------- |
| **HTTPS + 无 `?direct` 参数** | 转发到 `speed.cloudflare.com/__down` |
| **HTTP**                   | 直接生成数据                    |
| **HTTPS + 有 `?direct` 参数** | 直接生成数据                    |

---

## ⚠️ 重要提醒

- **HTTP协议**：默认使用直连处理（官方接口不支持HTTP）
- **错误处理**：路径格式错误时返回 **400 Bad Request**
- **部署建议**：部署在Workers中，同时支持HTTP/HTTPS双协议测速，而pages只支持HTTPS

---

<div align="center">

</div>
