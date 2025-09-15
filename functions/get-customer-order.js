exports.handler = async (event, context) => {
    console.log('🎰 Function called!', event.httpMethod);
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Test response for your email
    if (event.httpMethod === 'POST') {
        const { email } = JSON.parse(event.body || '{}');
        
        if (email === 'syed.ahmed@theraoralcare.com') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Function working!',
                    order: {
                        entity_id: '12345',
                        increment_id: 'TEST001',
                        grand_total: '2500.00',
                        customer_firstname: 'Syed',
                        customer_email: email
                    }
                })
            };
        }
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: false,
            error: 'Test function - email not recognized',
            method: event.httpMethod
        })
    };
};
