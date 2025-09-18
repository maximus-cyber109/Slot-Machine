// netlify/functions/check-order-usage.js
exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { email, orderNumber } = JSON.parse(event.body || '{}');
        
        // ✅ Use environment variable in Netlify function (server-side)
        const response = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'checkOrderIdUsage',
                email: email,
                orderNumber: orderNumber
            })
        });

        const result = await response.json();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };
        
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
};
