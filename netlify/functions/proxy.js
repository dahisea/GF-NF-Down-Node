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
    
    // 如果是POST/PUT等方法,传递body
    const fetchOptions = {
        method: method,
        headers: headers,
        redirect: 'follow'
    };
    
    if (event.body && method !== 'GET' && method !== 'HEAD') {
        fetchOptions.body = event.isBase64Encoded ? 
            Buffer.from(event.body, 'base64') : event.body;
    }
    
    try {
        const response = await fetch(targetUrl, fetchOptions);
        
        // 错误响应重定向到备用URL
        if (response.status >= 400) {
            return {
                statusCode: 302,
                headers: {
                    'Location': FALLBACK_URL,
                    'Access-Control-Allow-Origin': '*'
                },
                body: ''
            };
        }
        
        // 获取Content-Type
        const contentType = response.headers.get('Content-Type') || '';
        
        // 处理二进制内容
        if (!contentType.includes('text') && 
            !contentType.includes('javascript') && 
            !contentType.includes('json') &&
            !contentType.includes('xml')) {
            const buffer = await response.arrayBuffer();
            const responseHeaders = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });
            responseHeaders['Access-Control-Allow-Origin'] = '*';
            responseHeaders['Cache-Control'] = `public, max-age=${CACHE_MAX_AGE}`;
            
            return {
                statusCode: response.status,
                headers: responseHeaders,
                body: Buffer.from(buffer).toString('base64'),
                isBase64Encoded: true
            };
        }
        
        // 处理文本内容
        let content = await response.text();
        
        // 确保内容不为空(如果原始响应有内容)
        if (content) {
            // 应用所有替换
            for (const [pattern, replacement] of REPLACEMENTS) {
                content = content.replace(pattern, replacement);
            }
        }
        
        // 准备响应头
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
            // 跳过可能影响缓存的头
            if (key.toLowerCase() !== 'vary') {
                responseHeaders[key] = value;
            }
        });
        
        responseHeaders['Access-Control-Allow-Origin'] = '*';
        responseHeaders['Cache-Control'] = `public, max-age=${CACHE_MAX_AGE}`;
        responseHeaders['CDN-Cache-Control'] = `public, max-age=${CACHE_MAX_AGE}`;
        
        return {
            statusCode: response.status,
            headers: responseHeaders,
            body: content || '' // 确保body不是undefined
        };
    } catch (error) {
        console.error('Proxy error:', error);
        return {
            statusCode: 302,
            headers: {
                'Location': FALLBACK_URL,
                'Access-Control-Allow-Origin': '*'
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
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Max-Age': CACHE_MAX_AGE.toString()
            },
            body: ''
        };
    }
    
    return handleRequest(event);
};