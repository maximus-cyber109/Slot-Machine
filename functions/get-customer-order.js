exports.handler = async (event, context) => {
    console.log('🎰 Function called with method:', event.httpMethod);
    console.log('📧 Headers:', JSON.stringify(event.headers));
    console.log('📦 Body:', event.body);

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        console.log('❌ Wrong method:', event.httpMethod);
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: 'Method not allowed. Use POST.' 
            })
        };
    }

    try {
        const { email, sessionId, detectionMethod } = JSON.parse(event.body || '{}');
        console.log('🔍 Processing email:', email);
        console.log('🎯 Detection method:', detectionMethod);

        if (!email) {
            console.log('❌ No email provided');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Email is required' 
                })
            };
        }

        // SPECIAL TEST FOR YOUR EMAIL
        if (email.toLowerCase() === 'syed.ahmed@theraoralcare.com') {
            console.log('✅ Test email detected, returning mock order');
            const mockOrder = {
                entity_id: '789123',
                increment_id: 'PB000789',
                grand_total: '2450.00',
                status: 'complete',
                created_at: new Date().toISOString(),
                customer_email: email,
                customer_firstname: 'Syed',
                customer_lastname: 'Ahmed',
                order_currency_code: 'INR'
            };

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    order: mockOrder,
                    message: `Auto-detected via ${detectionMethod || 'unknown method'}!`,
                    detectionMethod: detectionMethod
                })
            };
        }

        // For other emails, call Magento API
        console.log('🛒 Calling Magento API for email:', email);
        const API_TOKEN = 't5xkjvxlgitd25cuhxixl9dflw008f4e';
        const BASE_URL = 'https://pinkblue.in/rest/V1';

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const searchUrl = `${BASE_URL}/orders?` +
            `searchCriteria[filterGroups][0][filters][0][field]=customer_email&` +
            `searchCriteria[filterGroups][0][filters][0][value]=${encodeURIComponent(email)}&` +
            `searchCriteria[filterGroups][0][filters][0][conditionType]=eq&` +
            `searchCriteria[filterGroups][1][filters][0][field]=created_at&` +
            `searchCriteria[filterGroups][1][filters][0][value]=${weekAgo.toISOString()}&` +
            `searchCriteria[filterGroups][1][filters][0][conditionType]=from&` +
            `searchCriteria[filterGroups][2][filters][0][field]=status&` +
            `searchCriteria[filterGroups][2][filters][0][value]=complete,processing,pending&` +
            `searchCriteria[filterGroups][2][filters][0][conditionType]=in&` +
            `searchCriteria[sortOrders][0][field]=created_at&` +
            `searchCriteria[sortOrders][0][direction]=DESC&` +
            `searchCriteria[pageSize]=1`;

        console.log('🚀 Making Magento API request...');
        const response = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const orderData = await response.json();
        console.log('📊 Magento API response status:', response.status);
        console.log('📋 Order count:', orderData.total_count || 0);

        if (!response.ok) {
            console.log('❌ Magento API error:', response.status, orderData);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: `Magento API error: ${response.status}`,
                    details: orderData
                })
            };
        }

        if (orderData.items && orderData.items.length > 0) {
            const recentOrder = orderData.items[0];
            console.log('✅ Order found:', recentOrder.increment_id);
            
            if (parseFloat(recentOrder.grand_total) >= 500) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        order: {
                            entity_id: recentOrder.entity_id,
                            increment_id: recentOrder.increment_id,
                            grand_total: recentOrder.grand_total,
                            status: recentOrder.status,
                            created_at: recentOrder.created_at,
                            customer_email: recentOrder.customer_email,
                            customer_firstname: recentOrder.customer_firstname,
                            customer_lastname: recentOrder.customer_lastname,
                            order_currency_code: recentOrder.order_currency_code
                        },
                        detectionMethod: detectionMethod,
                        message: `Order found via ${detectionMethod || 'API lookup'}`
                    })
                };
            } else {
                console.log('❌ Order amount too low:', recentOrder.grand_total);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: `Order amount ₹${recentOrder.grand_total} is below minimum ₹500`
                    })
                };
            }
        } else {
            console.log('❌ No recent orders found');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'No eligible orders found in the last 7 days'
                })
            };
        }

    } catch (error) {
        console.error('💥 Function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: `Internal error: ${error.message}`,
                details: error.stack
            })
        };
    }
};
