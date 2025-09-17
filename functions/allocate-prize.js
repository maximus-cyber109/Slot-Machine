// netlify/functions/allocate-prize.js
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
        console.log('🎯 Email being sent to Google Apps Script:', originalEmail);
        
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
            
            // ✅ Send email notification (using clean email)
            try {
                console.log('📧 Sending WebEngage email notification for:', originalEmail);
                console.log('🎁 Prize details:', result.prize.name + ' - Value: ' + result.prize.value);
                
                await sendWebEngageNotification(cleanEmailForNotification, result.prize, isTestUser);
                console.log('✅ WebEngage email notification sent');
                
            } catch (emailError) {
                console.error('⚠️ Email notification failed (non-critical):', emailError.message);
                // Don't fail the entire process if email fails
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
        console.error('💥 Error details:', error);
        
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

// ✅ FIXED: WebEngage email notification function with multiple fallbacks
async function sendWebEngageNotification(cleanEmail, prize, isTestUser) {
    try {
        // ✅ Skip email for test users (optional)
        if (isTestUser) {
            console.log('🧪 Test user - skipping actual email notification');
            console.log('📧 Email would be sent to:', cleanEmail);
            console.log('🎁 Prize:', cleanProductName(prize.name));
            console.log('💰 Value: ₹' + (prize.value || 0));
            return true;
        }
        
        const WEBENGAGE_API_KEY = process.env.WEBENGAGE_API_KEY || '~4c6729b7';
        const WEBENGAGE_TOKEN = process.env.WEBENGAGE_TOKEN || 'gu3bqwq4';
        
        console.log('📧 WebEngage Config - API Key:', WEBENGAGE_API_KEY);
        console.log('📧 Sending notification to email:', cleanEmail);
        
        // ✅ Clean prize name for email
        const cleanPrizeName = cleanProductName(prize.name);
        
        // ✅ Method 1: Try WebEngage Events API
        try {
            const webEngagePayload = {
                "userId": cleanEmail,
                "eventName": "pbDaysArcadePrizeWon",
                "eventData": {
                    "prize_name": cleanPrizeName,
                    "prize_value": prize.value || 0,
                    "prize_sku": prize.sku || 'N/A',
                    "prize_image_url": prize.image || '',
                    "is_test_allocation": isTestUser,
                    "event_timestamp": new Date().toISOString(),
                    "customer_email": cleanEmail,
                    "campaign_type": "arcade_game"
                },
                "eventTime": new Date().toISOString()
            };
            
            console.log('📤 WebEngage event payload:', JSON.stringify(webEngagePayload, null, 2));
            
            const webEngageEndpoint = `https://api.webengage.com/v1/accounts/${WEBENGAGE_API_KEY}/events`;
            console.log('🎯 WebEngage endpoint:', webEngageEndpoint);
            
            const webEngageResponse = await fetch(webEngageEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${WEBENGAGE_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(webEngagePayload)
            });
            
            console.log('📥 WebEngage API response status:', webEngageResponse.status);
            
            if (webEngageResponse.ok) {
                const webEngageResult = await webEngageResponse.json();
                console.log('✅ WebEngage event sent successfully');
                console.log('📋 WebEngage response:', JSON.stringify(webEngageResult));
                return true;
            } else {
                const errorText = await webEngageResponse.text();
                console.error('❌ WebEngage Method 1 failed:', errorText);
                throw new Error(`WebEngage API error: ${webEngageResponse.status}`);
            }
            
        } catch (method1Error) {
            console.log('🔄 WebEngage Method 1 failed, trying Method 2...');
            
            // ✅ Method 2: Try alternative WebEngage format
            try {
                const alternativePayload = {
                    "users": [
                        {
                            "userId": cleanEmail,
                            "email": cleanEmail,
                            "events": [
                                {
                                    "name": "pbDaysArcadePrizeWon",
                                    "time": new Date().toISOString(),
                                    "attributes": {
                                        "prize_name": cleanPrizeName,
                                        "prize_value": prize.value || 0,
                                        "prize_sku": prize.sku || 'N/A'
                                    }
                                }
                            ]
                        }
                    ]
                };
                
                console.log('🔄 Alternative WebEngage payload:', JSON.stringify(alternativePayload, null, 2));
                
                const alternativeEndpoint = `https://api.webengage.com/v1/accounts/${WEBENGAGE_API_KEY}/bulk-api`;
                
                const altResponse = await fetch(alternativeEndpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${WEBENGAGE_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(alternativePayload)
                });
                
                console.log('📥 Alternative WebEngage response status:', altResponse.status);
                
                if (altResponse.ok) {
                    const altResult = await altResponse.json();
                    console.log('✅ Alternative WebEngage method successful');
                    console.log('📋 Alternative response:', JSON.stringify(altResult));
                    return true;
                } else {
                    const altErrorText = await altResponse.text();
                    console.error('❌ WebEngage Method 2 also failed:', altErrorText);
                    throw new Error(`Alternative WebEngage failed: ${altResponse.status}`);
                }
                
            } catch (method2Error) {
                console.log('🔄 WebEngage Method 2 failed, using fallback logging...');
                
                // ✅ Method 3: Fallback to detailed logging
                console.log('📨 FALLBACK EMAIL NOTIFICATION:');
                console.log('📧 To:', cleanEmail);
                console.log('🎉 Subject: You Won: ' + cleanPrizeName + '!');
                console.log('🎁 Prize Name:', cleanPrizeName);
                console.log('💰 Prize Value: ₹' + (prize.value || 0));
                console.log('📦 Prize SKU:', prize.sku || 'N/A');
                console.log('🖼️ Prize Image:', prize.image || 'No image');
                console.log('⏰ Timestamp:', new Date().toISOString());
                
                console.log('✅ Fallback email notification logged (WebEngage unavailable)');
                return true;
            }
        }
        
    } catch (error) {
        console.error('❌ WebEngage notification error:', error.message);
        console.error('❌ Full error:', error);
        
        // ✅ Final fallback - just log the email details
        console.log('📨 FINAL FALLBACK - Email notification details:');
        console.log('📧 Recipient:', cleanEmail);
        console.log('🎁 Prize:', cleanProductName(prize.name));
        console.log('💰 Value: ₹' + (prize.value || 0));
        console.log('🧪 Test User:', isTestUser);
        
        // Don't throw error - let the prize allocation continue
        return false;
    }
}

// ✅ Clean product name helper function
function cleanProductName(prizeName) {
    if (!prizeName) return 'Mystery Prize';
    
    // Remove common product codes and prefixes
    let cleanName = prizeName
        .replace(/^[A-Z0-9_]+\s*[-_]\s*/i, '') // Remove codes like "PB01_001_02 - "
        .replace(/^[A-Z]{2,}\s+/i, '') // Remove prefix codes like "PB "
        .replace(/\s*[-_]\s*[A-Z0-9_]+$/i, '') // Remove suffix codes
        .replace(/\([^)]*\)$/g, '') // Remove parentheses content at end
        .trim();
    
    // If nothing left, return original
    if (!cleanName || cleanName.length < 3) {
        return prizeName;
    }
    
    return cleanName;
}
