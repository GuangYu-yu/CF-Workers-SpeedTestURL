# SpeedTest-CloudflareWorker

## 一、项目简介

本项目是一个使用Cloudflare的Worker搭建SpeedTest测速地址的工程，主要代码在`worker.js`文件中。通过本项目，你可以很容易地在Cloudflare上搭建起自己的测速服务。

## 二、功能介绍

例如您的项目域名为 `<your_workers>`

1. **默认测速大小为300MB**：当未在路径中指定测速大小时，项目会默认进行300MB的测速。

- 300M   默认测试下载地址: `https://<your_workers>`
 

2. **自定义测速大小**：通过在路径中指定数字和单位（可选的单位包括 K，M，G），可以设定想要进行测速的数据大小，如"/500M"表示进行500MB的测速。

- 1024K  测试下载地址: `https://<your_workers>/1024k`
- 200M   测试下载地址: `https://<your_workers>/200m`
- 1G     测试下载地址: `https://<your_workers>/1g`
- sec    以秒数控制
- min    以分钟控制

3. **自定义分块大小**：通过在URL参数中添加`chunk`参数，可以自定义数据分块的大小，默认为64KB。分块大小最小为1KB，最大为1MB。

- 100M，使用默认分块大小: `https://<your_workers>/100m`
- 100M，使用16KB分块: `https://<your_workers>/100m?chunk=16k`
- 100M，使用512KB分块: `https://<your_workers>/100m?chunk=512k`

4. **强制使用Worker直接处理**：通过在URL参数中添加`direct`参数，可以强制使用Worker直接处理请求，而不是转发到Cloudflare官方测速接口。

- 使用Cloudflare官方测速接口: `https://<your_workers>/100m`（转发到 `https://speed.cloudflare.com/__down?bytes=100000000`）
- 强制使用Worker直接处理: `https://<your_workers>/100m?direct`
- 同时自定义分块大小: `https://<your_workers>/100m?direct&chunk=128k`

5. **推荐使用workers部署方案并绑定自定义域，即可同时具备 http/https 两种测速途径。**

- HTTP请求默认使用Worker直接处理（官方测速使用HTTP无效）
- HTTPS请求默认转发到Cloudflare官方测速接口（`https://speed.cloudflare.com/__down?bytes=xxx`），除非添加`direct`参数

## 三、使用指南

1. 克隆或下载本项目到你的本地设备。

2. 在Cloudflare的Worker中创建一个新的项目，并将`worker.js`文件中的代码复制粘贴到你的项目中。

3. 部署你的Worker项目。

现在，你可以访问你的Worker的URL，进行网速测试了。

## 四、注意事项

- 代码中的路径需要做适当修改，以反映你自己的Cloudflare Worker的URL。
- 当路径不符合预设的格式时，程序将返回400错误。
- 分块大小会影响下载速度和资源使用，较小的分块可能导致更多的处理开销，较大的分块可能导致内存使用增加。
