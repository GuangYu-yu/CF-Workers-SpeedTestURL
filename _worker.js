export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.slice(1); // 去掉前导斜杠
    const MAX_SIZE = 1e9;               // 最大 1GB
    const CHUNK = 64 * 1024;            // 64KB

    // 解析下载字节数，未指定返回 0
    const parseBytes = s => {
      if (!s) return 0;                 // 没有指定大小
      const m = s.match(/^(\d+)([kKmMgG]b?)?$/);
      if (!m) return null;              // 格式错误
      let val = parseInt(m[1], 10);
      const unit = (m[2] || "").toLowerCase();
      if (unit.startsWith("k")) val *= 1e3;
      if (unit.startsWith("m")) val *= 1e6;
      if (unit.startsWith("g")) val *= 1e9;
      return Math.min(val, MAX_SIZE);
    };

    const bytes = parseBytes(path);
    if (bytes === null) return new Response("Bad Request", { status: 400 });
    if (bytes === 0) return new Response(null, { status: 204 }); // 未指定大小返回空

    const useDirect = url.searchParams.has("direct");
    const useZero = url.searchParams.has("zero");

    const headers = new Headers({
      "Content-Type": "application/octet-stream",
      "Content-Length": bytes.toString(),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "X-Download-Options": "noopen",
      "Referrer-Policy": "no-referrer"
    });

    // 转发官方测速接口
    if (!useDirect) {
      const resp = await fetch(`https://speed.cloudflare.com/__down?bytes=${bytes}`);
      return new Response(resp.body, { status: resp.status, headers });
    }

    // Worker 生成数据流
    let sent = 0;
    const stream = new ReadableStream({
      pull(controller) {
        const rem = bytes - sent;
        if (rem <= 0) return controller.close();
        const size = Math.min(rem, CHUNK);
        controller.enqueue(useZero ? new Uint8Array(size) : crypto.getRandomValues(new Uint8Array(size)));
        sent += size;
      }
    });

    return new Response(stream, { status: 200, headers });
  }
};
