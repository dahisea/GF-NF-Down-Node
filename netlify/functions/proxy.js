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

async function handleRequest(event) {
    const method = event.httpMethod;
    const rawPath = event.rawPath || event.path || '/';
    const rawQuery = event.rawQueryString || '';
    
    // 构建完整的目标URL
    let targetUrl = `https://${TARGET_HOST}${rawPath}`;
    if (rawQuery) {
        targetUrl += `?${rawQuery}`;
    }
    
    // 准备请求头
    const headers = {
        'User-Agent': event.headers['user-agent'] || 'Mozilla/5.0',
        'Node': NODE_NAME
    };
    
    try {
        const response = await fetch(targetUrl, {
            method: method,
            headers: headers,
            redirect: 'follow'
        });
        
        // 错误响应重定向到备用URL
        if (response.status >= 400) {
            return {
                statusCode: 302,
                headers: {
                    'Location': FALLBACK_URL
                },
                body: ''
            };
        }
        
        // 仅处理文本响应
        const contentType = response.headers.get('Content-Type') || '';
        if (!contentType.includes('text')) {
            const buffer = await response.arrayBuffer();
            return {
                statusCode: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                body: Buffer.from(buffer).toString('base64'),
                isBase64Encoded: true
            };
        }
        
        let content = await response.text();
        
        // 应用所有替换
        for (const [pattern, replacement] of REPLACEMENTS) {
            content = content.replace(pattern, replacement);
        }
        
        // 准备响应头
        const responseHeaders = Object.fromEntries(response.headers.entries());
        responseHeaders['Cache-Control'] = `public, max-age=${CACHE_MAX_AGE}`;
        responseHeaders['CDN-Cache-Control'] = `public, max-age=${CACHE_MAX_AGE}`;
        
        // 移除可能影响缓存的头
        delete responseHeaders['vary'];
        
        return {
            statusCode: response.status,
            headers: responseHeaders,
            body: content
        };
    } catch (error) {
        console.error('Proxy error:', error);
        return {
            statusCode: 302,
            headers: {
                'Location': FALLBACK_URL
            },
            body: ''
        };
    }
}

exports.handler = async (event, context) => {
    // 处理CORS预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST, PUT, DELETE',
                'Access-Control-Max-Age': CACHE_MAX_AGE.toString()
            },
            body: ''
        };
    }
    
    return handleRequest(event);
};
