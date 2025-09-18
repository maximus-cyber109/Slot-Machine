// netlify/functions/check-order-usage.js
// ✅ Check if order ID has already been used in AllocationLog
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
        
        console.log('🔍 Checking order usage for:', orderNumber, 'by email:', email);
        
        if (!email || !orderNumber) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Email and order number required' 
                })
            };
        }

        // ✅ Check with Google Sheets if order has been used
        const response = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'checkOrderUsage',
                email: email,
                orderNumber: orderNumber
            })
        });

        const result = await response.json();
        console.log('📋 Order usage check result:', result);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };
        
    } catch (error) {
        console.error('❌ Order usage check error:', error);
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
