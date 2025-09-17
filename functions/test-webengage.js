// Test function to create the 'prize_won' event in WebEngage
exports.handler = async (event, context) => {
    try {
        const testEventData = {
            userId: 'test@pinkblue.in',
            eventName: 'prize_won',
            eventTime: new Date().toISOString(),
            eventData: {
                prize_name: 'Test Prize - Speedendo E Mate Pro',
                prize_value: '13000',
                prize_code: 'TEST_PB123456',
                prize_sku: 'SPE02_016_01',
                customer_name: 'Test User',
                customer_email: 'test@pinkblue.in',
                order_number: 'TEST001',
                order_value: '15000',
                support_email: 'support@pinkblue.in'
            }
        };

        console.log('🔄 Sending test event to WebEngage...');
        
        const response = await fetch('https://api.webengage.com/v1/accounts/82618240/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer 997ecae4-4632-4cb0-a65d-8427472e8f31'
            },
            body: JSON.stringify(testEventData)
        });

        const responseText = await response.text();
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: response.ok,
                status: response.status,
                response: responseText
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};
