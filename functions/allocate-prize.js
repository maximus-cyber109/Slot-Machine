exports.handler = async (event, context) => {
    console.log('🎁 Prize allocation started with Google Sheets');
    
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
        // Parse request body safely
        let requestData;
        try {
            requestData = JSON.parse(event.body || '{}');
        } catch (parseError) {
            console.error('❌ JSON parse error:', parseError);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid request format'
                })
            };
        }

        const { email, orderValue, orderData, orderNumber, sessionId } = requestData;
        
        console.log('🔍 Processing for:', email);
        console.log('💰 Order value:', orderValue);

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

        // Validate Google Sheets webhook URL
        if (!process.env.GOOGLE_SHEETS_WEBHOOK) {
            console.error('❌ GOOGLE_SHEETS_WEBHOOK not configured');
            // Fallback to mock data if not configured
            return await handleMockAllocation(email, orderValue, orderData, orderNumber, headers);
        }

        // Prepare allocation request for Google Sheets
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
            
            // Fallback to mock allocation on Google Sheets failure
            console.log('🔄 Falling back to mock allocation');
            return await handleMockAllocation(email, orderValue, orderData, orderNumber, headers);
        }

        let allocationData;
        try {
            allocationData = await allocationResponse.json();
        } catch (parseError) {
            console.error('❌ Google Sheets response parse error:', parseError);
            return await handleMockAllocation(email, orderValue, orderData, orderNumber, headers);
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
                message: 'Prize won successfully! Check your email for details.',
                source: 'google_sheets'
            })
        };

    } catch (error) {
        console.error('💥 Prize allocation error:', error);
        
        // Final fallback to mock allocation
        try {
            const { email, orderValue, orderData, orderNumber } = JSON.parse(event.body || '{}');
            return await handleMockAllocation(email, orderValue, orderData, orderNumber, headers);
        } catch (fallbackError) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Server error. Please try again.'
                })
            };
        }
    }
};

// Fallback mock allocation when Google Sheets is unavailable
async function handleMockAllocation(email, orderValue, orderData, orderNumber, headers) {
    console.log('🎭 Using mock allocation for:', email);
    
    const mockPrizes = [
        {
            sku: 'SPE02_010_02',
            name: 'Speedendo W-One Gold Files 21mm #25',
            value: 750,
            image: 'https://email-editor-resources.s3.amazonaws.com/images/82618240/stw-sep25/se-w-one.png'
        },
        {
            sku: 'DEN14_028_04',
            name: 'DenSafe Rotary File F1 21mm',
            value: 900,
            image: 'https://email-editor-resources.s3.amazonaws.com/images/82618240/stw-sep25/medicept_k_files.png'
        },
        {
            sku: 'PB01_001_01',
            name: 'PB CASHBACK Rs.100',
            value: 100,
            image: ''
        }
    ];

    // Select prize based on order value
    let selectedPrize;
    if (orderValue >= 10000) {
        selectedPrize = mockPrizes[0]; // High value prize
    } else if (orderValue >= 1000) {
        selectedPrize = mockPrizes[1]; // Medium value prize
    } else {
        selectedPrize = mockPrizes[2]; // Cashback
    }

    // Send WebEngage event
    try {
        await sendWebEngageEvent(email, selectedPrize, orderData, orderNumber);
    } catch (error) {
        console.error('⚠️ Mock allocation email failed:', error.message);
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            prize: selectedPrize,
            message: 'Prize won successfully! Check your email for details.',
            source: 'mock_fallback'
        })
    };
}

// Send WebEngage email notification
async function sendWebEngageEvent(email, prize, orderData, orderNumber) {
    try {
        console.log('📧 Sending email notification for:', email);
        
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

        const response = await fetch(`https://api.webengage.com/v1/accounts/82618240/events`, {
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
    }
}
