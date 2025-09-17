exports.handler = async (event, context) => {
    console.log('🎁 Prize allocation started with Google Sheets integration');
    
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
        const isTestUser = testEmails.includes(email.toLowerCase());

        // Validate Google Sheets webhook URL
        if (!process.env.GOOGLE_SHEETS_WEBHOOK) {
            console.error('❌ GOOGLE_SHEETS_WEBHOOK not configured');
            return await handleFallbackAllocation(email, orderValue, orderData, orderNumber, headers);
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

        console.log('📤 Sending to Google Sheets API');

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
            return await handleFallbackAllocation(email, orderValue, orderData, orderNumber, headers);
        }

        let allocationData;
        try {
            allocationData = await allocationResponse.json();
        } catch (parseError) {
            console.error('❌ Google Sheets response parse error:', parseError);
            return await handleFallbackAllocation(email, orderValue, orderData, orderNumber, headers);
        }

        console.log('📋 Google Sheets allocation result:', JSON.stringify(allocationData));
        
        if (!allocationData.success) {
            console.error('❌ Google Sheets allocation failed:', allocationData.error);
            return await handleFallbackAllocation(email, orderValue, orderData, orderNumber, headers);
        }

        console.log('✅ Prize allocated via Google Sheets:', allocationData.prize?.name);

        // Send WebEngage email notification
        try {
            await sendWebEngageEvent(email, allocationData.prize, orderData, orderNumber);
            console.log('✅ WebEngage email notification sent');
        } catch (webengageError) {
            console.error('⚠️ WebEngage email failed (non-critical):', webengageError.message);
        }

        // Return success response
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                prize: allocationData.prize,
                message: 'Prize won successfully! Check your email for details.',
                source: 'google_sheets',
                allocationInfo: allocationData.allocationInfo || {}
            })
        };

    } catch (error) {
        console.error('💥 Prize allocation error:', error);
        
        // Final fallback attempt
        try {
            const { email, orderValue, orderData, orderNumber } = JSON.parse(event.body || '{}');
            return await handleFallbackAllocation(email, orderValue, orderData, orderNumber, headers);
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

// Fallback allocation when Google Sheets is unavailable
async function handleFallbackAllocation(email, orderValue, orderData, orderNumber, headers) {
    console.log('🎭 Using fallback allocation for:', email);
    
    const fallbackPrizes = [
        {
            sku: 'SPE02_010_02',
            name: 'Speedendo W-One Gold Files 21mm #25',
            value: 980,
            image: 'https://email-editor-resources.s3.amazonaws.com/images/82618240/stw-sep25/se-w-one.png'
        },
        {
            sku: 'DEN14_028_04',
            name: 'DenSafe Rotary File F1 21mm',
            value: 900,
            image: 'https://email-editor-resources.s3.amazonaws.com/images/82618240/stw-sep25/medicept_k_files.png'
        },
        {
            sku: 'GCX02_034_02',
            name: 'GC Tooth Mousse Plus Flavour 1-Pack',
            value: 880,
            image: 'https://email-editor-resources.s3.amazonaws.com/images/82618240/stw-sep25/GC%20Tooth%20Mousse%20Plus%20Flavour.png'
        },
        {
            sku: 'PB01_001_02',
            name: 'PB CASHBACK RS.150',
            value: 150,
            image: ''
        }
    ];

    // Select prize based on order value
    let selectedPrize;
    const parsedOrderValue = parseFloat(orderValue) || 0;
    
    if (parsedOrderValue >= 10000) {
        selectedPrize = fallbackPrizes[0]; // High value prize
    } else if (parsedOrderValue >= 2000) {
        selectedPrize = fallbackPrizes[1]; // Medium value prize  
    } else if (parsedOrderValue >= 1000) {
        selectedPrize = fallbackPrizes[2]; // Lower value prize
    } else {
        selectedPrize = fallbackPrizes[3]; // Cashback
    }

    console.log('🎯 Fallback prize selected:', selectedPrize.name);

    // Send WebEngage event for fallback allocation
    try {
        await sendWebEngageEvent(email, selectedPrize, orderData, orderNumber);
        console.log('✅ Fallback WebEngage notification sent');
    } catch (error) {
        console.error('⚠️ Fallback WebEngage failed:', error.message);
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            prize: selectedPrize,
            message: 'Prize won successfully! Check your email for details.',
            source: 'fallback_system'
        })
    };
}

// Send WebEngage email notification with complete event data
async function sendWebEngageEvent(email, prize, orderData, orderNumber) {
    try {
        console.log('📧 Sending WebEngage email notification for:', email);
        console.log('🎁 Prize details:', prize?.name, '- Value:', prize?.value);
        
        if (!prize) {
            throw new Error('Prize data is missing');
        }

        // Prepare comprehensive event data for email template
        const eventData = {
            userId: email,
            eventName: 'prize_won',
            eventData: {
                // Prize information
                prize_name: prize.name || 'Mystery Prize',
                prize_value: (prize.value || 0).toString(),
                prize_image: prize.image || '',
                prize_sku: prize.sku || '',
                
                // Customer information
                customer_name: orderData?.customer_firstname || 'Valued Customer',
                customer_email: email,
                
                // Order information
                order_number: orderNumber || orderData?.increment_id || 'N/A',
                order_value: orderData?.grand_total?.toString() || 'N/A',
                order_currency: orderData?.order_currency_code || 'INR',
                
                // Delivery message based on prize type
                delivery_message: (prize.name && prize.name.includes('CASHBACK')) 
                    ? 'Your cashback will be credited once your order is delivered!'
                    : 'This product will be sent once your order is delivered!',
                
                // Support contact information
                support_email: 'support@pinkblue.in',
                support_phone: '+91-98765-43210',
                support_hours: 'Monday - Saturday, 9:00 AM - 6:00 PM IST',
                
                // Campaign information
                campaign_source: 'pb_days_arcade',
                campaign_name: 'PB Days Arcade - Spin The Wheel',
                
                // Timestamp and metadata
                event_timestamp: Date.now(),
                allocated_date: new Date().toISOString().split('T')[0],
                
                // Allocation details (if available)
                total_stock: prize.stock || 'N/A',
                allocated_qty: prize.allocatedQty || 'N/A',
                remaining_qty: prize.remainingQty || 'N/A'
            }
        };

        console.log('📤 WebEngage event payload prepared');

        // Send to WebEngage API
        const webengageResponse = await fetch('https://api.webengage.com/v1/accounts/82618240/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer 997ecae4-4632-4cb0-a65d-8427472e8f31'
            },
            body: JSON.stringify(eventData)
        });

        console.log('📥 WebEngage API response status:', webengageResponse.status);

        if (webengageResponse.ok) {
            console.log('✅ WebEngage event sent successfully');
            
            // Log the response for debugging
            try {
                const responseText = await webengageResponse.text();
                console.log('📋 WebEngage response:', responseText);
            } catch (logError) {
                console.log('📋 WebEngage response logged successfully (no body)');
            }
        } else {
            const errorText = await webengageResponse.text();
            console.error('❌ WebEngage API error:', webengageResponse.status, errorText);
            throw new Error(`WebEngage API error: ${webengageResponse.status} - ${errorText}`);
        }
        
    } catch (error) {
        console.error('❌ WebEngage event error:', error);
        throw error; // Re-throw to be caught by caller
    }
}
