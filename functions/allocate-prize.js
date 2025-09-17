exports.handler = async (event, context) => {
    console.log('🎁 Prize allocation started');
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
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
                error: 'Method not allowed' 
            })
        };
    }

    try {
        // Parse request body
        let requestData;
        try {
            requestData = JSON.parse(event.body);
        } catch (parseError) {
            console.error('❌ JSON parse error:', parseError);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid JSON in request body'
                })
            };
        }

        const { email, orderValue, orderData, orderNumber, sessionId } = requestData;
        
        console.log('🔍 Processing for:', email);
        console.log('💰 Order value:', orderValue);
        console.log('📦 Order number:', orderNumber);

        // Validate required fields
        if (!email || !email.includes('@')) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Valid email is required'
                })
            };
        }

        // Check for testing override
        const testEmails = ['syed.ahmed@theraoralcare.com', 'valliappan.km@theraoralcare.com'];
        const isTestUser = testEmails.includes(email);
        console.log('🧪 Is test user:', isTestUser);

        // Validate Google Sheets webhook URL
        if (!process.env.GOOGLE_SHEETS_WEBHOOK) {
            console.error('❌ GOOGLE_SHEETS_WEBHOOK not configured');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Server configuration error'
                })
            };
        }

        // Prepare allocation request
        const allocationRequest = {
            action: 'allocatePrize',
            email: email,
            orderValue: orderValue || 0,
            orderData: orderData,
            orderNumber: orderNumber,
            sessionId: sessionId,
            isTestUser: isTestUser,
            timestamp: new Date().toISOString()
        };

        console.log('📤 Sending to Google Sheets:', JSON.stringify(allocationRequest));

        // Call Google Sheets for prize allocation
        const allocationResponse = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(allocationRequest)
        });

        console.log('📥 Google Sheets response status:', allocationResponse.status);

        if (!allocationResponse.ok) {
            const errorText = await allocationResponse.text();
            console.error('❌ Google Sheets error:', errorText);
            throw new Error(`Prize allocation service error: ${allocationResponse.status}`);
        }

        let allocationData;
        try {
            allocationData = await allocationResponse.json();
        } catch (parseError) {
            console.error('❌ Google Sheets response parse error:', parseError);
            throw new Error('Invalid response from prize allocation service');
        }

        console.log('📋 Allocation result:', JSON.stringify(allocationData));
        
        if (!allocationData.success) {
            throw new Error(allocationData.error || 'Prize allocation failed');
        }

        console.log('✅ Prize allocated:', allocationData.prize?.name);

        // Send WebEngage event for email notification
        try {
            await sendWebEngageEvent(email, allocationData.prize, orderData, orderNumber);
            console.log('✅ Email notification sent');
        } catch (webengageError) {
            console.error('⚠️ Email notification failed (non-critical):', webengageError.message);
        }

        // Return success response
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                prize: allocationData.prize,
                message: 'Prize won successfully! Check your email for details.'
            })
        };

    } catch (error) {
        console.error('💥 Prize allocation error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Unable to allocate prize. Please try again later.'
            })
        };
    }
};

// Send WebEngage email notification
async function sendWebEngageEvent(email, prize, orderData, orderNumber) {
    try {
        console.log('📧 Sending email notification for:', email);
        
        // Skip if no WebEngage config
        if (!process.env.WEBENGAGE_API_KEY || !process.env.WEBENGAGE_LICENSE_CODE) {
            console.log('⚠️ WebEngage not configured, skipping email');
            return;
        }
        
        const eventData = {
            userId: email,
            eventName: 'prize_won',
            eventData: {
                prize_name: prize?.name || 'Unknown Prize',
                prize_value: (prize?.value || 0).toString(),
                prize_image: prize?.image || '',
                customer_name: orderData?.customer_firstname || 'Valued Customer',
                customer_email: email,
                order_number: orderNumber || 'N/A',
                order_value: orderData?.grand_total?.toString() || 'N/A',
                support_email: 'support@pinkblue.in',
                delivery_message: (prize?.name && prize.name.includes('CASHBACK')) 
                    ? 'Your cashback will be credited once your order is delivered!'
                    : 'This product will be sent once your order is delivered!',
                event_timestamp: Date.now()
            }
        };

        const webengageUrl = `https://api.webengage.com/v1/accounts/${process.env.WEBENGAGE_LICENSE_CODE}/events`;
        
        const response = await fetch(webengageUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.WEBENGAGE_API_KEY}`
            },
            body: JSON.stringify(eventData)
        });

        if (response.ok) {
            console.log('✅ WebEngage event sent successfully');
        } else {
            const errorText = await response.text();
            console.error('❌ WebEngage API error:', response.status, errorText);
        }
    } catch (error) {
        console.error('❌ WebEngage event error:', error);
        throw error;
    }
}
