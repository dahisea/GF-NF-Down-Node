const TARGET_HOST = 'sgejd-hdbidb-datanodeserver.dahi.edu.eu.org';
const FALLBACK_URL = 'https://www.baidu.com/';
const NODE_NAME = 'UPDATE';
const CACHE_MAX_AGE = 360000; // 100 hours
const REPLACEMENTS = [
    [/@connect\s+greasyfork\.org/g, '@connect greasyfork.org.cn'],
    [/@connect\s+update\.greasyfork\.org/g, '@connect update.greasyfork.org.cn'],
    [/@connect\s+api\.greasyfork\.org/g, '@connect api.greasyfork.org.cn'],
    [/greasyfork\.org\//g, 'greasyfork.org.cn/']
];

export default async (request, context) => {
    const url = new URL(request.url);
    
    // 处理CORS预检请求
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST, PUT, DELETE',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Max-Age': CACHE_MAX_AGE.toString()
            }
        });
    }
    
    // 构建目标URL
    const targetUrl = `https://${TARGET_HOST}${url.pathname}${url.search}`;
    
    // 准备请求头
    const headers = new Headers(request.headers);
    headers.set('User-Agent', request.headers.get('user-agent') || 'Mozilla/5.0');
    headers.set('Node', NODE_NAME);
    headers.delete('host'); // 删除原始host
    
    try {
        // 发起代理请求
        const response = await fetch(targetUrl, {
            method: request.method,
            headers: headers,
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
            redirect: 'follow'
        });
        
        // 错误响应重定向到备用URL
        if (!response.ok && response.status >= 400) {
            return Response.redirect(FALLBACK_URL, 302);
        }
        
        // 获取Content-Type
        const contentType = response.headers.get('Content-Type') || '';
        
        // 判断是否为文本类型
        const isText = contentType.includes('text') || 
                       contentType.includes('javascript') || 
                       contentType.includes('json') || 
                       contentType.includes('xml') ||
                       contentType.includes('ecmascript');
        
        // 如果是二进制内容,直接返回
        if (!isText) {
            const newHeaders = new Headers(response.headers);
            newHeaders.set('Access-Control-Allow-Origin', '*');
            newHeaders.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
            newHeaders.set('CDN-Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
            
            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders
            });
        }
        
        // 处理文本内容
        let content = await response.text();
        
        // 应用所有替换规则
        if (content) {
            for (const [pattern, replacement] of REPLACEMENTS) {
                content = content.replace(pattern, replacement);
            }
        }
        
        // 准备响应头
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
        newHeaders.set('CDN-Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
        newHeaders.delete('vary'); // 移除可能影响缓存的头
        
        return new Response(content, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });
        
    } catch (error) {
        console.error('Proxy error:', error);
        return Response.redirect(FALLBACK_URL, 302);
    }
};