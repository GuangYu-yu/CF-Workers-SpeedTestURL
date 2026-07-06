// ==================== 配置与常量 ====================
// 设为 "abc123" 后需通过 /abc123/100m 访问
const PATH_PREFIX = '';

const UNIT_MAP = {
  k: 1024, kb: 1024,
  m: 1048576, mb: 1048576,
  g: 1073741824, gb: 1073741824,
};
const MAX_BYTES = 1073741824;  // 1 GiB
const CHUNK_SIZE = 65536;      // 64 KB

// ==================== nginx 404 ====================
function fakeNotFound() {
  return new Response(
    '<!DOCTYPE html>\n<html><head><title>404 Not Found</title></head><body><center><h1>404 Not Found</h1></center><hr><center>nginx</center></body></html>',
    {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Server': 'nginx',
        'Connection': 'keep-alive',
      },
    },
  );
}

const DOWNLOAD_HEADERS = {
  'Content-Type': 'application/octet-stream',
  'Content-Disposition': 'attachment; filename="download.bin"',
  'Accept-Ranges': 'bytes',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
};

// ==================== Range 解析 ====================
function parseRange(rangeHeader, totalBytes) {
  if (!rangeHeader) return null;
  const m = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!m) return null;

  const a = m[1] === '' ? null : parseInt(m[1], 10);
  const b = m[2] === '' ? null : parseInt(m[2], 10);

  // bytes=N-M  → 指定区间
  if (a !== null && b !== null) {
    if (a > b || a >= totalBytes) return { error: true };
    const e = Math.min(b, totalBytes - 1);
    return { start: a, end: e, contentLength: e - a + 1 };
  }

  // bytes=N-  → 从 N 到末尾
  if (a !== null && b === null) {
    if (a >= totalBytes) return { error: true };
    return { start: a, end: totalBytes - 1, contentLength: totalBytes - a };
  }

  // bytes=-N  → 最后 N 个字节
  if (a === null && b !== null) {
    if (b <= 0) return { error: true };
    const s = Math.max(0, totalBytes - b);
    return { start: s, end: totalBytes - 1, contentLength: totalBytes - s };
  }

  return null;
}

// ==================== 响应构造（HEAD / GET 共用） ====================
function buildResponse(totalBytes, rangeInfo, useZero) {
  const targetBytes = rangeInfo ? rangeInfo.contentLength : totalBytes;
  const headers = { ...DOWNLOAD_HEADERS, 'Content-Length': String(targetBytes) };
  let status = 200;

  if (rangeInfo) {
    status = 206;
    headers['Content-Range'] = `bytes ${rangeInfo.start}-${rangeInfo.end}/${totalBytes}`;
  }

  // 全零模式内容稳定，ETag 不变；随机模式每次不同，不设 ETag
  if (useZero) {
    headers['ETag'] = `"zero-${totalBytes}"`;
  }

  return { status, headers, targetBytes };
}

// ==================== 下载端点 ====================
function streamDownload(totalBytes, useZero, rangeInfo) {
  const { status, headers, targetBytes } = buildResponse(totalBytes, rangeInfo, useZero);
  let sent = 0;

  return new Response(
    new ReadableStream({
      pull(controller) {
        const rem = targetBytes - sent;
        if (rem <= 0) return controller.close();
        const size = Math.min(rem, CHUNK_SIZE);
        const chunk = new Uint8Array(size);
        if (!useZero) crypto.getRandomValues(chunk);
        controller.enqueue(chunk);
        sent += size;
      },
    }),
    { status, headers },
  );
}

// ==================== 入口 ====================
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.slice(1);

    if (PATH_PREFIX && path !== PATH_PREFIX && !path.startsWith(PATH_PREFIX + '/')) {
      return fakeNotFound();
    }
    const suffix = PATH_PREFIX ? path.slice(PATH_PREFIX.length).replace(/^\//, '') : path;

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 解析后缀中的 <number>[k|m|g][b]
    const match = suffix.match(/^(\d+)([a-z]{0,2})$/i);
    if (!match) {
      return fakeNotFound();
    }

    const unit = match[2].toLowerCase();
    const multiplier = UNIT_MAP[unit];
    if (unit && !multiplier) {
      return fakeNotFound();
    }

    const requested = parseInt(match[1], 10) * (multiplier || 1);
    const totalBytes = Math.min(Math.max(requested, 1), MAX_BYTES);

    // 解析 Range 请求头
    const rangeInfo = parseRange(request.headers.get('Range'), totalBytes);

    if (rangeInfo && rangeInfo.error) {
      return new Response(null, {
        status: 416,
        headers: {
          'Content-Range': `bytes */${totalBytes}`,
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const useZero = !url.searchParams.has('random');

    // HEAD 请求：返回相同响应头但不含 body
    if (request.method === 'HEAD') {
      const { status, headers } = buildResponse(totalBytes, rangeInfo, useZero);
      return new Response(null, { status, headers });
    }

    return streamDownload(totalBytes, useZero, rangeInfo);
  },
};
