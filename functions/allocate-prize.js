exports.handler = async (event, context) => {
    console.log('🎁 Prize allocation started');
    
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
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };
    }

    try {
        const { email, orderValue, orderData, orderNumber, sessionId } = JSON.parse(event.body);
        
        console.log('🔍 Processing for:', email);
        console.log('💰 Order value:', orderValue);
        console.log('📦 Order number:', orderNumber);

        // Check for testing override
        const testEmails = ['syed.ahmed@theraoralcare.com', 'valliappan.km@theraoralcare.com'];
        const isTestUser = testEmails.includes(email);

        // Allocate prize through Google Sheets
        console.log('🎯 Allocating prize...');
        const allocationResponse = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'allocatePrize',
                email: email,
                orderValue: orderValue,
                orderData: orderData,
                orderNumber: orderNumber,
                sessionId: sessionId,
                isTestUser: isTestUser
            })
        });

        if (!allocationResponse.ok) {
            throw new Error(`Allocation failed: ${allocationResponse.status}`);
        }

        const allocationData = await allocationResponse.json();
        
        if (!allocationData.success) {
            throw new Error(allocationData.error || 'Prize allocation failed');
        }

        console.log('✅ Prize allocated:', allocationData.prize.name);

        // Send WebEngage event for email notification
        try {
            await sendWebEngageEvent(email, allocationData.prize, orderData, orderNumber);
            console.log('✅ Email notification sent');
        } catch (webengageError) {
            console.error('⚠️ Email notification failed (non-critical):', webengageError.message);
        }

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
                error: 'Unable to allocate prize: ' + error.message
            })
        };
    }
};

// Send WebEngage email notification
async function sendWebEngageEvent(email, prize, orderData, orderNumber) {
    try {
        console.log('📧 Sending email notification for:', email);
        
        const eventData = {
            userId: email,
            eventName: 'prize_won',
            eventData: {
                prize_name: prize.name,
                prize_value: prize.value.toString(),
                prize_image: prize.image || '',
                customer_name: orderData?.customer_firstname || 'Valued Customer',
                customer_email: email,
                order_number: orderNumber || 'N/A',
                order_value: orderData?.grand_total?.toString() || 'N/A',
                support_email: 'support@pinkblue.in',
                delivery_message: prize.name.includes('CASHBACK') 
                    ? 'Your cashback will be credited once your order is delivered!'
                    : 'This product will be sent once your order is delivered!',
                event_timestamp: Date.now()
            }
        };

        const response = await fetch('https://api.webengage.com/v1/accounts/82618240/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer 997ecae4-4632-4cb0-a65d-8427472e8f31'
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
