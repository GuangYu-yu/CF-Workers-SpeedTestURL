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
      // 默认不按时间限制
      let timeLimit = 0;
  
      // 如果路径不为空，尝试从中提取用户指定的大小或时间
      if (path) {
        // 检查是否是时间格式 (例如 30sec, 2min)
        const timeMatch = path.match(/^(\d+)(sec|min)$/);
        if (timeMatch) {
          const value = parseInt(timeMatch[1], 10);
          const unit = timeMatch[2];
          // 转换为毫秒
          if (unit === "sec") {
            timeLimit = value * 1000;
          } else if (unit === "min") {
            timeLimit = value * 60 * 1000;
          }
          // 时间模式下，不限制字节数
          bytes = Number.MAX_SAFE_INTEGER;
        } else {
          // 尝试匹配字节大小格式
          const match = path.match(/^(\d+)([kKmMgG]?)$/);
          if (match) {
            const value = parseInt(match[1], 10); // 数字部分
            const unit = match[2] || ""; // 单位部分
            bytes = convertToBytes(value, unit);
          } else {
            // 格式不匹配，返回 400 错误
            return new Response("路径格式错误，请使用如 100m 或 30sec 的格式", { status: 400 });
          }
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
  
      // 如果是 HTTPS 请求且不使用直接处理，且不是时间模式，转发给 Cloudflare 官方测速接口
      if (isSecure && !useDirect && timeLimit === 0) {
        const targetUrl = `https://speed.cloudflare.com/__down?bytes=${bytes}`;
        const response = await fetch(targetUrl, request); // 保留原请求头
        return response;
      } else {
        // HTTP 请求或强制使用 Worker 直接处理或时间模式
  
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
            const startTime = Date.now(); // 记录开始时间
  
            // 定义推送函数
            function push() {
              // 检查是否达到时间限制（如果有）
              if (timeLimit > 0 && (Date.now() - startTime) >= timeLimit) {
                controller.close();
                return;
              }
              
              // 检查是否达到字节限制（如果不是时间模式）
              if (timeLimit === 0 && bytesSent >= bytes) {
                controller.close();
                return;
              }
  
              // 还剩多少未推送（时间模式下不限制）
              const remaining = timeLimit > 0 ? chunkSize : Math.min(bytes - bytesSent, chunkSize);
              const size = remaining; // 本次推送大小
              
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
        };
        
        // 只有在非时间模式下才设置 Content-Length
        if (timeLimit === 0) {
          headers['Content-Length'] = bytes.toString();
        }
        
        return new Response(stream, {
          status: 200,
          headers: headers
        });
      }
    }
  };
  
