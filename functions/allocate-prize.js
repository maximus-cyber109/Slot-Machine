// netlify/functions/allocate-prize.js
// ✅ INCLUDES ORDER ID in WebEngage payload
exports.handler = async (event, context) => {
    console.log('🎁 Prize allocation started with Google Sheets integration');
    
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
        const data = JSON.parse(event.body || '{}');
        
        console.log('🔍 Processing for:', data.email);
        console.log('💰 Order value:', data.orderValue);
        console.log('📦 Order number:', data.orderNumber);
        
        // ✅ CRITICAL: Preserve original email with test_override suffix
        const originalEmail = data.email;
        const isTestUser = originalEmail && (
            originalEmail.includes('test_override_maaz') || 
            originalEmail.includes('test_override_valli')
        );
        
        // ✅ Clean email for notifications (remove test suffix)
        const cleanEmailForNotification = originalEmail ? 
            originalEmail.replace(/[_-]?test_override_(maaz|valli)/g, '') : '';
        
        console.log('🧪 Is test user:', isTestUser);
        console.log('📧 Clean email for notification:', cleanEmailForNotification);
        
        // ✅ Validate required data
        if (!originalEmail) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Email is required' 
                })
            };
        }

        // ✅ Prepare payload with ORIGINAL email (preserving test suffix)
        const googleSheetsPayload = {
            action: 'allocatePrize',
            email: originalEmail, // ← CRITICAL: Keep test suffix intact!
            orderValue: data.orderValue || 0,
            orderData: data.orderData || {},
            orderNumber: data.orderNumber || data.orderData?.increment_id,
            sessionId: data.sessionId || Date.now().toString()
        };
        
        console.log('📤 Sending to Google Sheets API');
        
        // ✅ Call Google Apps Script
        const response = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(googleSheetsPayload)
        });

        console.log('📥 Google Sheets response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Google Sheets API error:', errorText);
            throw new Error(`Google Sheets API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('📋 Google Sheets allocation result:', JSON.stringify(result));
        
        if (result.success) {
            console.log('✅ Prize allocated via Google Sheets:', result.prize.name);
            
            // ✅ Send event to WebEngage with ORDER ID included
            try {
                console.log('📧 Sending WebEngage event with order ID');
                
                await sendSimpleWebEngageEvent(
                    cleanEmailForNotification, 
                    result.prize, 
                    isTestUser,
                    data
                );
                console.log('✅ WebEngage event sent with order ID');
                
            } catch (emailError) {
                console.error('⚠️ WebEngage event failed (non-critical):', emailError.message);
            }
            
            // ✅ Return successful result
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result)
            };
            
        } else {
            console.error('❌ Prize allocation failed:', result.error);
            throw new Error(result.error || 'Prize allocation failed');
        }
        
    } catch (error) {
        console.error('💥 Prize allocation error:', error.message);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message || 'Internal server error'
            })
        };
    }
};

// ✅ WebEngage with ORDER ID included
async function sendSimpleWebEngageEvent(cleanEmail, prize, isTestUser, originalOrderData) {
    try {
        console.log('📧 Sending WebEngage event with order ID...');
        
        if (isTestUser) {
            console.log('🧪 Test user - logging event details with order ID');
            console.log('📧 Would send prize_won event to:', cleanEmail);
            console.log('🎁 Prize:', cleanProductName(prize.name));
            console.log('💰 Value: ₹' + (prize.value || 0));
            console.log('📦 Order ID:', originalOrderData?.orderNumber);
            console.log('👤 Customer:', getCustomerName(originalOrderData));
            return true;
        }
        
        // ✅ WebEngage credentials
        const WEBENGAGE_LICENSE_CODE = process.env.WEBENGAGE_LICENSE_CODE || '82618240';
        const WEBENGAGE_API_KEY = process.env.WEBENGAGE_API_KEY || '997ecae4-4632-4cb0-a65d-8427472e8f31';
        
        if (!WEBENGAGE_LICENSE_CODE || !WEBENGAGE_API_KEY) {
            console.error('❌ WebEngage credentials missing');
            return false;
        }
        
        console.log('📧 Sending to:', cleanEmail);
        
        // ✅ Payload with ORDER ID included
        const simplePayload = {
            "userId": cleanEmail,
            "eventName": "prize_won",
            "eventData": {
                "prize_name": cleanProductName(prize.name),
                "prize_value": parseInt(prize.value) || 0,
                "prize_image_url": prize.image || '',
                "customer_name": getCustomerName(originalOrderData),
                "order_id": originalOrderData?.orderNumber || 'N/A' // ✅ ORDER ID ADDED
            }
        };
        
        console.log('📤 WebEngage payload with order ID:', JSON.stringify(simplePayload, null, 2));
        
        const webEngageEndpoint = `https://api.webengage.com/v1/accounts/${WEBENGAGE_LICENSE_CODE}/events`;
        
        // ✅ Try Method 1: Simple payload without eventTime
        const response1 = await fetch(webEngageEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WEBENGAGE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(simplePayload)
        });
        
        console.log('📥 Method 1 response status:', response1.status);
        
        if (response1.ok) {
            const result1 = await response1.json();
            console.log('✅ WebEngage event sent successfully with order ID');
            return true;
        }
        
        // ✅ Try Method 2: Add simple eventTime
        console.log('🔄 Method 2: Adding eventTime...');
        const payloadWithTime = {
            ...simplePayload,
            "eventTime": Math.floor(Date.now() / 1000)
        };
        
        const response2 = await fetch(webEngageEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WEBENGAGE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadWithTime)
        });
        
        if (response2.ok) {
            console.log('✅ WebEngage event with timestamp worked');
            return true;
        }
        
        console.log('❌ All WebEngage methods failed');
        return false;
        
    } catch (error) {
        console.error('❌ WebEngage event error:', error.message);
        return false;
    }
}

// ✅ Helper functions
function getCustomerName(originalOrderData) {
    const firstName = originalOrderData?.orderData?.customer_firstname || '';
    const lastName = originalOrderData?.orderData?.customer_lastname || '';
    return (firstName + ' ' + lastName).trim() || 'Valued Customer';
}

function cleanProductName(prizeName) {
    if (!prizeName) return 'Mystery Prize';
    
    let cleanName = prizeName
        .replace(/^[A-Z0-9_]+\s*[-_]\s*/i, '')
        .replace(/^[A-Z]{2,}\s+/i, '')
        .replace(/\s*[-_]\s*[A-Z0-9_]+$/i, '')
        .replace(/\([^)]*\)$/g, '')
        .trim();
    
    if (!cleanName || cleanName.length < 3) {
        return prizeName;
    }
    
    return cleanName;
}
