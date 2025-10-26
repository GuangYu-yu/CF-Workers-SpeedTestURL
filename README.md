<div align="center">

# 🚀 SpeedTest-CloudflareWorker

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)

</div>

---

## 📖 项目简介

**在Cloudflare Workers上快速搭建专属测速服务** ⚡

---

## 🎯 功能特性

### 📊 测速规格

#### 1. 自定义数据大小
支持灵活设置测速数据量，单位可选：**K**、**M**、**G**

| 数据大小 | 示例地址 | 说明 |
|---------|----------|------|
| **1024K** | `https://<your_workers>/1024k` | 1MB测速包 |
| **200M** | `https://<your_workers>/200m` | 200MB测速包 |
| **1G** | `https://<your_workers>/1g` | 1GB测速包 |
| **默认** | `https://<your_workers>/` | 无效 |

#### 2. 数据生成模式
- **官方模式**（默认）：转发Cloudflare官方测速
- **直连模式**：Worker直接生成随机数据或全0数据
  - 添加 `?direct` 参数启用直连模式
  - 添加 `?zero` 参数生成全0数据
---

<div align="center">

</div>
