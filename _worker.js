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

    // 默认下载字节数为0（无响应体）
    let bytes = 0;

    // 如果路径不为空，尝试从中提取用户指定的大小
    if (path) {
      // 尝试匹配字节大小格式
      const match = path.match(/^(\d+)([kKmMgG]?)$/);
      if (match) {
        const value = parseInt(match[1], 10); // 数字部分
        const unit = match[2] || ""; // 单位部分
        bytes = convertToBytes(value, unit);
      } else {
        // 格式不匹配，返回 400 错误
        return new Response("Bad Request", { status: 400 });
      }
    }
    
    // 如果没有指定大小，返回空响应
    if (bytes === 0) {
      return new Response(null, {
        status: 204, // No Content
        headers: { 'Content-Type': 'text/plain' }
      });
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
          // 创建一个随机数据的分块 - 使用缓存提高性能
          let cachedChunk = null;
          function getRandomChunk(size) {
            // 如果请求的大小与缓存的大小相同，直接返回缓存
            if (cachedChunk && cachedChunk.length === size) {
              return cachedChunk;
            }
            
            // 否则创建新的随机数据块并缓存
            const chunk = new Uint8Array(size);
            crypto.getRandomValues(chunk);
            cachedChunk = chunk;
            return chunk;
          }
          
          let bytesSent = 0; // 记录已推送的字节数
          
          // 定义推送函数
          function push() {
            // 检查是否达到字节限制
            if (bytesSent >= bytes) {
              controller.close();
              return;
            }

            // 计算本次推送大小
            const size = Math.min(bytes - bytesSent, chunkSize);
            
            // 生成并推送随机数据
            const randomChunk = getRandomChunk(size);
            controller.enqueue(randomChunk);
            
            bytesSent += size;

            // 下一轮推送（非阻塞）
            setTimeout(push, 0);
          }

          // 启动第一次推送
          push();
        }
      });

      // 返回自定义响应
      const headers = {
        'Content-Type': 'application/octet-stream', // 二进制流格式
        'X-Content-Type-Options': 'nosniff', // 防止MIME类型嗅探
        'Cache-Control': 'no-store', // 防止缓存
        'X-Download-Options': 'noopen' // 防止下载后自动打开
      };
      
      return new Response(stream, {
        status: 200,
        headers: headers
      });
    }
  }
};
