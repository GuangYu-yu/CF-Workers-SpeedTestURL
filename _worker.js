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

// ==================== 工具函数 ====================
function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// nginx 404
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
  'Accept-Ranges': 'none',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Download-Options': 'noopen',
  'Referrer-Policy': 'no-referrer',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'Content-Length, Accept-Ranges',
};

// ==================== 下载端点 ====================
function streamDownload(bytes, useZero) {
  let sent = 0;

  return new Response(
    new ReadableStream({
      pull(controller) {
        const rem = bytes - sent;
        if (rem <= 0) return controller.close();
        const size = Math.min(rem, CHUNK_SIZE);
        const chunk = new Uint8Array(size);
        if (!useZero) crypto.getRandomValues(chunk);
        controller.enqueue(chunk);
        sent += size;
      },
    }),
    {
      status: 200,
      headers: { ...DOWNLOAD_HEADERS, 'Content-Length': String(bytes) },
    },
  );
}

async function proxyDownload(bytes) {
  const resp = await fetch(`https://speed.cloudflare.com/__down?bytes=${bytes}`);

  if (!resp.ok) {
    return jsonError(`Upstream error: ${resp.status}`, resp.status);
  }

  const headers = new Headers(DOWNLOAD_HEADERS);
  headers.set('Content-Length', String(bytes));
  return new Response(resp.body, { status: 200, headers });
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
    const bytes = Math.min(Math.max(requested, 1), MAX_BYTES);

    const useZero = url.searchParams.has('zero');
    const useDirect = url.searchParams.has('direct') || useZero;

    return useDirect ? streamDownload(bytes, useZero) : proxyDownload(bytes);
  },
};
