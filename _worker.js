export default {
    async fetch(request) {
      // 解析当前请求的 URL
      const url = new URL(request.url);
      const path = url.pathname.substring(1); // 去掉前导斜杠，比如 "/100m" => "100m"
  
      // 判断请求协议是否为 HTTPS（用于决定是否转发请求）
      const isSecure = url.protocol.startsWith("https");
  
      // 单位转换函数：将带单位的数值转换为字节数
      function convertToBytes(value, unit) {
        unit = unit.toLowerCase();
        if (unit === "k") return value * 1000;
        if (unit === "m") return value * 1000000;
        if (unit === "g") return value * 1000000000;
        return value;
      }
  
      // 默认下载字节数为 300MB
      let bytes = 300000000;
  
      // 如果路径不为空，尝试从中提取用户指定的大小
      if (path) {
        const match = path.match(/^(\d+)([kKmMgG]?)$/); // 匹配数字+单位，如 100m、10k、1g
        if (match) {
          const value = parseInt(match[1], 10); // 数字部分
          const unit = match[2] || ""; // 单位部分
          bytes = convertToBytes(value, unit);
        } else {
          // 格式不匹配，返回 400 错误
          return new Response("路径格式错误", { status: 400 });
        }
      }
  
      // 获取自定义分块大小参数
      let chunkSize = 64 * 1024; // 默认每次推送 64KB
      const chunkParam = url.searchParams.get('chunk');
      if (chunkParam) {
        const chunkMatch = chunkParam.match(/^(\d+)([kKmMgG]?)$/);
        if (chunkMatch) {
          const value = parseInt(chunkMatch[1], 10);
          const unit = chunkMatch[2] || "";
          let customChunkSize = convertToBytes(value, unit);
          
          // 限制分块大小范围：最小1KB，最大1MB
          const minChunkSize = 1000; // 1KB
          const maxChunkSize = 1000000; // 1MB
          chunkSize = Math.max(minChunkSize, Math.min(customChunkSize, maxChunkSize));
        }
      }
  
      // 获取是否使用 Worker 直接处理的参数
      const useDirect = url.searchParams.has('direct');
  
      // 如果是 HTTPS 请求且不使用直接处理，转发给 Cloudflare 官方测速接口
      if (isSecure && !useDirect) {
        const targetUrl = `https://speed.cloudflare.com/__down?bytes=${bytes}`;
        const response = await fetch(targetUrl, request); // 保留原请求头
        return response;
      } else {
        // HTTP 请求或强制使用 Worker 直接处理
  
        // 创建一个 ReadableStream 流，用来推送字节数据（模拟下载）
        const stream = new ReadableStream({
          start(controller) {
            // 使用自定义或默认的分块大小
            const zeroChunk = new Uint8Array(chunkSize); // 创建一个填满 0 的 buffer
            let bytesSent = 0; // 记录已推送的字节数
  
            // 定义推送函数
            function push() {
              // 如果已经推完指定字节数，关闭流
              if (bytesSent >= bytes) {
                controller.close();
                return;
              }
  
              // 还剩多少未推送
              const remaining = bytes - bytesSent;
              const size = Math.min(chunkSize, remaining); // 本次推送大小
              controller.enqueue(zeroChunk.subarray(0, size)); // 推送 0 填充的 buffer
              bytesSent += size;
  
              // 下一轮推送（非阻塞）
              setTimeout(push, 0);
            }
  
            // 启动第一次推送
            push();
          }
        });
  
        // 返回自定义响应
        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Type': 'application/octet-stream', // 二进制流格式
            'Content-Length': bytes.toString(), // 设置精确长度，curl 需要
            'Cache-Control': 'no-store', // 防止缓存
          }
        });
      }
    }
  };
  
