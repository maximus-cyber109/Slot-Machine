exports.handler = async (event, context) => {
    console.log('🎰 Enhanced function with date validation');
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    if (event.httpMethod !== 'POST') {
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
        const { email, sessionId, detectionMethod, source } = JSON.parse(event.body || '{}');
        
        if (!email) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Email is required' 
                })
            };
        }
        
        // ✅ Check for override codes only (not regular emails)
        const normalizedEmail = email.toLowerCase().trim();
        if (normalizedEmail.includes('test_override_maaz') || normalizedEmail.includes('test_override_valli')) {
            console.log('✅ Override code detected, returning mock order');
            const mockOrderData = {
                entity_id: '789123',
                increment_id: 'TEST_ORDER_' + Date.now(),
                grand_total: '15000.00',
                status: 'complete',
                created_at: new Date().toISOString(),
                customer_email: normalizedEmail.replace(/[_-]?test_override_(maaz|valli)/g, ''),
                customer_firstname: 'Test',
                customer_lastname: 'User',
                order_currency_code: 'INR'
            };
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    orderData: mockOrderData,
                    message: `Override detected - unlimited access`,
                    detectionMethod: 'override'
                })
            };
        }
        
        const API_TOKEN = process.env.MAGENTO_API_TOKEN ||
        const BASE_URL = process.env.MAGENTO_BASE_URL || 
       
        // ✅ ENHANCED: Look for orders from today or max 2 days ago
        const maxDaysAgo = new Date();
        maxDaysAgo.setDate(maxDaysAgo.getDate() - 2);
        maxDaysAgo.setHours(0, 0, 0, 0); // Start of day
        
        const searchUrl = `${BASE_URL}/orders?` +
            `searchCriteria[filterGroups][0][filters][0][field]=customer_email&` +
            `searchCriteria[filterGroups][0][filters][0][value]=${encodeURIComponent(email)}&` +
            `searchCriteria[filterGroups][0][filters][0][conditionType]=eq&` +
            `searchCriteria[filterGroups][1][filters][0][field]=created_at&` +
            `searchCriteria[filterGroups][1][filters][0][value]=${maxDaysAgo.toISOString()}&` +
            `searchCriteria[filterGroups][1][filters][0][conditionType]=from&` +
            `searchCriteria[filterGroups][2][filters][0][field]=status&` +
            `searchCriteria[filterGroups][2][filters][0][value]=complete,processing,pending&` +
            `searchCriteria[filterGroups][2][filters][0][conditionType]=in&` +
            `searchCriteria[sortOrders][0][field]=created_at&` +
            `searchCriteria[sortOrders][0][direction]=DESC&` +
            `searchCriteria[pageSize]=1`;
        
        const response = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        const orderData = await response.json();
        
        if (!response.ok) {
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
            
            // ✅ Check order date
            const orderDate = new Date(recentOrder.created_at);
            const currentDate = new Date();
            const dayDifference = Math.ceil((currentDate.getTime() - orderDate.getTime()) / (1000 * 3600 * 24));
            
            if (dayDifference > 2) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: `Orders older than 2 days are not eligible. Your most recent order is ${dayDifference} days old. Please place a new order to participate.`
                    })
                };
            }
            
            if (parseFloat(recentOrder.grand_total) >= 500) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        orderData: {
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
                        message: `Valid order found (${dayDifference} day${dayDifference === 1 ? '' : 's'} old)`
                    })
                };
            } else {
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
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'No eligible orders found in the last 2 days. Please place a new order to participate.'
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
                error: `Internal error: ${error.message}`
            })
        };
    }
};
