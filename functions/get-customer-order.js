exports.handler = async (event, context) => {
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
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const API_TOKEN = 't5xkjvxlgitd25cuhxixl9dflw008f4e';
    const BASE_URL = 'https://pinkblue.in/rest/V1';

    try {
        const { email, sessionId } = JSON.parse(event.body);

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

        // Calculate date range (last 7 days)
        const today = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);
        
        // Search for orders by customer email (last 7 days)
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

        console.log('Searching for orders with URL:', searchUrl.replace(API_TOKEN, 'HIDDEN'));

        const response = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const orderData = await response.json();

        if (!response.ok) {
            throw new Error(`Magento API error: ${response.status} - ${JSON.stringify(orderData)}`);
        }

        if (orderData.items && orderData.items.length > 0) {
            const recentOrder = orderData.items[0];
            
            // Check minimum order amount (₹500)
            const minAmount = 500;
            if (parseFloat(recentOrder.grand_total) < minAmount) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: `Order amount must be at least ₹${minAmount} to play`
                    })
                };
            }

            // Log successful lookup for tracking
            console.log(`Order found for ${email}: #${recentOrder.increment_id} - ₹${recentOrder.grand_total}`);

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
                    }
                })
            };
        } else {
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
        console.error('Order lookup error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: `Unable to lookup orders: ${error.message}`
            })
        };
    }
};
