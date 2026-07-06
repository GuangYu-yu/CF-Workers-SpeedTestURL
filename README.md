<div align="center">

# SpeedTest-CloudflareWorker

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)

</div>

---

## 项目简介

在 Cloudflare Workers 上快速搭建专属测速服务。

---

## 功能特性

### 自定义数据大小

支持灵活设置测速数据量，单位可选：**K**、**M**、**G**

| 数据大小 | 示例地址 | 说明 |
|---------|----------|------|
| **1024K** | `https://<your_workers>/1024k` | 1MB 测速包 |
| **200M** | `https://<your_workers>/200m` | 200MB 测速包 |
| **1G** | `https://<your_workers>/1g` | 1GB 测速包 |

### 数据生成模式

| 模式 | 示例 | 说明 |
|------|------|------|
| **全零**（默认） | `/100m` | 内容稳定，支持断点续传、多线程 |
| **随机** | `/100m?random` | `crypto.getRandomValues()` 生成 |

### 访问控制

`PATH_PREFIX` 配置路径前缀，防止被随意扫描：

```javascript
const PATH_PREFIX = 'mykey';  // 需通过 /mykey/100m 访问
```

| PATH_PREFIX | 有效地址 | 无效地址 |
|-------------|---------|---------|
| `''`（默认） | `/100m` | - |
| `'abc'` | `/abc/100m` | `/100m`、`/abc123/100m` |

---

## 部署

1. 复制 `js.js` 内容到 Cloudflare Worker 编辑器
2. 按需修改 `PATH_PREFIX`
3. 部署
