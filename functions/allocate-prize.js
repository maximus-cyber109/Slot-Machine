// netlify/functions/allocate-prize.js
// ✅ COMPLETE FIXED VERSION - WebEngage Authorization with API Key Only
exports.handler = async (event, context) => {
    console.log('🎁 Enhanced prize allocation started with Google Sheets integration');
    
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
        console.log('🎯 WebEngage Journey will handle email delivery');
        
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
            
            // ✅ Send event to WebEngage (your journey will handle the email)
            try {
                console.log('📧 Sending WebEngage event for journey trigger:', originalEmail);
                console.log('🎁 Prize details:', result.prize.name + ' - Value: ₹' + result.prize.value);
                console.log('🖼️ Prize image:', result.prize.image);
                
                await sendWebEngageJourneyEvent(
                    cleanEmailForNotification, 
                    result.prize, 
                    isTestUser,
                    data // ← Pass original order data for enhanced details
                );
                console.log('✅ WebEngage journey event sent - your journey will handle email delivery');
                
            } catch (emailError) {
                console.error('⚠️ WebEngage event failed (non-critical):', emailError.message);
                // Don't fail the entire process if event fails
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

// ✅ FIXED: WebEngage with correct authorization using only API key
// ✅ CORRECTED: Use License Code in URL, API Key for auth
async function sendWebEngageJourneyEvent(cleanEmail, prize, isTestUser, originalOrderData) {
    try {
        console.log('📧 Sending WebEngage event with correct License Code and API Key...');
        
        if (isTestUser) {
            console.log('🧪 Test user - logging event details instead of sending');
            logTestUserEventDetails(cleanEmail, prize, originalOrderData);
            return true;
        }
        
        // ✅ FIXED: Use separate License Code and API Key
        const WEBENGAGE_LICENSE_CODE = process.env.WEBENGAGE_LICENSE_CODE || '82618240';
        const WEBENGAGE_API_KEY = process.env.WEBENGAGE_API_KEY || '997ecae4-4632-4cb0-a65d-8427472e8f31';
        
        console.log('📧 WebEngage Config:');
        console.log('   - License Code (URL):', WEBENGAGE_LICENSE_CODE);
        console.log('   - API Key (Auth):', WEBENGAGE_API_KEY.substring(0, 8) + '...');
        console.log('📧 Sending to:', cleanEmail);
        
        // ✅ Complete event payload with prize details
        const webEngagePayload = {
            "userId": cleanEmail,
            "eventName": "prize_won",
            "eventTime": new Date().toISOString(),
            "eventData": {
                // ✅ Prize details
                "prize_name": cleanProductName(prize.name),
                "prize_value": parseInt(prize.value) || 0,
                "prize_image_url": prize.image || 'https://email-editor-resources.s3.amazonaws.com/images/82618240/stw-sep25/default-prize.png',
                "prize_category": categorizePrize(prize.name, prize.value),
                "prize_tier": prize.value >= 10000 ? "premium" : prize.value >= 1000 ? "standard" : "basic",
                
                // ✅ Order details
                "order_value": parseFloat(originalOrderData?.orderValue) || 0,
                "order_number": originalOrderData?.orderNumber || 'N/A',
                "order_currency": "INR",
                
                // ✅ Campaign details
                "campaign_name": "PB Days Arcade",
                "campaign_type": "gamification",
                "customer_email": cleanEmail,
                "customer_name": getCustomerName(originalOrderData),
                "customer_segment": (originalOrderData?.orderValue || 0) >= 10000 ? "premium" : "standard",
                
                // ✅ Email template data for journey
                "email_subject": `🎉 You Won: ${cleanProductName(prize.name)}!`,
                "email_preheader": `Your ${categorizePrize(prize.name, prize.value)} prize worth ₹${prize.value} is confirmed! 🎁`,
                "email_heading": "Congratulations! You're a Winner!",
                "email_body": `Thank you for participating in PB Days Arcade! Your prize ${cleanProductName(prize.name)} worth ₹${prize.value} will be sent once your order is delivered.`,
                "cta_text": "View Your Prize",
                "cta_url": "https://pinkblue.in/arcade-winners",
                
                // ✅ Event metadata
                "event_timestamp": new Date().toISOString(),
                "platform": "web",
                "source": "pb_days_arcade"
            }
        };
        
        console.log('📤 WebEngage payload:', JSON.stringify(webEngagePayload, null, 2));
        
        // ✅ CORRECTED: Use License Code in URL path
        const webEngageEndpoint = `https://api.webengage.com/v1/accounts/${WEBENGAGE_LICENSE_CODE}/events`;
        console.log('🎯 CORRECTED WebEngage endpoint:', webEngageEndpoint);
        
        // ✅ CORRECTED: Use API Key for authorization
        const webEngageResponse = await fetch(webEngageEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WEBENGAGE_API_KEY}`, // ✅ API Key in auth header
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'PBDaysArcade/1.0'
            },
            body: JSON.stringify(webEngagePayload)
        });
        
        console.log('📥 WebEngage API response status:', webEngageResponse.status);
        
        if (webEngageResponse.ok) {
            const webEngageResult = await webEngageResponse.json();
            console.log('✅ WebEngage event sent successfully with correct credentials');
            console.log('📋 WebEngage response:', JSON.stringify(webEngageResult));
            console.log('🚀 Journey should trigger with complete event data');
            return true;
        } else {
            const errorText = await webEngageResponse.text();
            console.error('❌ WebEngage still failed:', errorText);
            console.error('❌ Response headers:', Object.fromEntries(webEngageResponse.headers.entries()));
            
            // ✅ Try alternative authentication methods
            console.log('🔄 Trying alternative auth methods...');
            return await tryAlternativeWebEngageAuth(webEngagePayload, WEBENGAGE_LICENSE_CODE, WEBENGAGE_API_KEY, cleanEmail, prize);
        }
        
    } catch (error) {
        console.error('❌ WebEngage event error:', error.message);
        
        // ✅ Enhanced fallback logging
        console.log('📨 WEBENGAGE EVENT FALLBACK:');
        console.log('Email:', cleanEmail);
        console.log('Prize:', cleanProductName(prize.name));
        console.log('Value: ₹' + (prize.value || 0));
        console.log('Campaign: PB Days Arcade');
        
        return false;
    }
}

// ✅ Alternative authentication methods with correct License Code
async function tryAlternativeWebEngageAuth(payload, licenseCode, apiKey, cleanEmail, prize) {
    try {
        // Method 2: Try without Bearer prefix
        console.log('🔄 Method 2: Direct API key without Bearer...');
        
        const response2 = await fetch(`https://api.webengage.com/v1/accounts/${licenseCode}/events`, {
            method: 'POST',
            headers: {
                'Authorization': apiKey, // ✅ Direct API key
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        console.log('📥 Method 2 response status:', response2.status);
        
        if (response2.ok) {
            const result2 = await response2.json();
            console.log('✅ Direct API key method worked');
            return true;
        }
        
        // Method 3: Try Basic Auth
        console.log('🔄 Method 3: Basic Auth...');
        
        const basicAuth = Buffer.from(`${apiKey}:`).toString('base64');
        const response3 = await fetch(`https://api.webengage.com/v1/accounts/${licenseCode}/events`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        console.log('📥 Method 3 response status:', response3.status);
        
        if (response3.ok) {
            console.log('✅ Basic Auth method worked');
            return true;
        }
        
        // Method 4: Try with API key in custom header
        console.log('🔄 Method 4: X-API-Key header...');
        
        const response4 = await fetch(`https://api.webengage.com/v1/accounts/${licenseCode}/events`, {
            method: 'POST',
            headers: {
                'X-API-Key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        console.log('📥 Method 4 response status:', response4.status);
        
        if (response4.ok) {
            console.log('✅ X-API-Key header method worked');
            return true;
        }
        
        console.log('❌ All authorization methods failed');
        return false;
        
    } catch (error) {
        console.error('❌ Alternative auth methods error:', error.message);
        return false;
    }
}


// ✅ Test user event logging
function logTestUserEventDetails(cleanEmail, prize, originalOrderData) {
    console.log('🧪 TEST USER - Complete WebEngage event details:');
    console.log('====================================');
    console.log('📧 Email:', cleanEmail);
    console.log('🎉 Event: prize_won');
    console.log('🎁 Prize Details:');
    console.log('   - Clean Name:', cleanProductName(prize.name));
    console.log('   - Original Name:', prize.name);
    console.log('   - Value: ₹' + (prize.value || 0));
    console.log('   - Category:', categorizePrize(prize.name, prize.value));
    console.log('   - Tier:', (prize.value >= 10000 ? "premium" : prize.value >= 1000 ? "standard" : "basic"));
    console.log('🖼️ Prize Image URL:', prize.image || 'Default image');
    console.log('💰 Order Details:');
    console.log('   - Order Value: ₹' + (originalOrderData?.orderValue || 0));
    console.log('   - Order Number:', originalOrderData?.orderNumber || 'N/A');
    console.log('   - Customer Segment:', (originalOrderData?.orderValue || 0) >= 10000 ? "premium" : "standard");
    console.log('👤 Customer:', getCustomerName(originalOrderData));
    console.log('🎯 Campaign: PB Days Arcade');
    console.log('📧 Email Template Data:');
    console.log('   - Subject: 🎉 You Won: ' + cleanProductName(prize.name) + '!');
    console.log('   - Preheader: Your prize worth ₹' + (prize.value || 0) + ' is confirmed! 🎁');
    console.log('   - CTA: View Your Prize');
    console.log('⏰ Event Time:', new Date().toISOString());
    console.log('🚀 Journey would handle email delivery with this data');
    console.log('====================================');
}

// ✅ WebEngage event fallback logging
function logWebEngageEventFallback(cleanEmail, prize, originalOrderData) {
    console.log('📨 WEBENGAGE EVENT FALLBACK - Complete details:');
    console.log('===============================================');
    console.log('📧 Email:', cleanEmail);
    console.log('🎉 Event: prize_won');
    console.log('🎁 Prize:', cleanProductName(prize.name));
    console.log('💰 Value: ₹' + (prize.value || 0));
    console.log('🖼️ Image:', prize.image || 'No image');
    console.log('📦 Order: #' + (originalOrderData?.orderNumber || 'N/A'));
    console.log('💰 Order Value: ₹' + (originalOrderData?.orderValue || 0));
    console.log('🏷️ Category:', categorizePrize(prize.name, prize.value));
    console.log('👤 Customer:', getCustomerName(originalOrderData));
    console.log('🎯 Campaign: PB Days Arcade');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('🚀 Journey would trigger from this event data');
    console.log('===============================================');
    console.log('✅ Complete event details logged (WebEngage API unavailable)');
}

// ✅ HELPER FUNCTIONS

// Get customer name from order data
function getCustomerName(originalOrderData) {
    const firstName = originalOrderData?.orderData?.customer_firstname || '';
    const lastName = originalOrderData?.orderData?.customer_lastname || '';
    return (firstName + ' ' + lastName).trim() || 'Valued Customer';
}

// Get estimated delivery date
function getEstimatedDelivery() {
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 7); // Add 7 days
    return deliveryDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
}

// Prize categorization helper
function categorizePrize(prizeName, prizeValue) {
    if (!prizeName) return 'unknown';
    
    const name = prizeName.toLowerCase();
    
    // Specific product categories
    if (name.includes('cashback')) return 'cashback';
    if (name.includes('drill') || name.includes('bur')) return 'dental_tools';
    if (name.includes('gate') || name.includes('reamer') || name.includes('endo')) return 'endo_tools';
    if (name.includes('composite') || name.includes('filling')) return 'restorative';
    if (name.includes('polish') || name.includes('paste') || name.includes('gel')) return 'consumables';
    if (name.includes('scaler') || name.includes('ultrasonic')) return 'cleaning_tools';
    if (name.includes('impression') || name.includes('alginate')) return 'impression_materials';
    if (name.includes('syringe') || name.includes('needle')) return 'injection_supplies';
    if (name.includes('suture') || name.includes('surgical')) return 'surgical_supplies';
    
    // Categorize by value if name doesn't match specific categories
    if (prizeValue >= 10000) return 'premium_equipment';
    if (prizeValue >= 5000) return 'advanced_tools';
    if (prizeValue >= 1000) return 'standard_tools';
    if (prizeValue >= 500) return 'basic_supplies';
    
    return 'dental_supplies';
}

// Enhanced product name cleaning
function cleanProductName(prizeName) {
    if (!prizeName) return 'Mystery Prize';
    
    let cleanName = prizeName
        .replace(/^[A-Z0-9_]+\s*[-_]\s*/i, '') // Remove codes like "PB01_001_02 - "
        .replace(/^[A-Z]{2,}\s+/i, '') // Remove prefix codes like "PB "
        .replace(/\s*[-_]\s*[A-Z0-9_]+$/i, '') // Remove suffix codes
        .replace(/\([^)]*\)$/g, '') // Remove parentheses content at end
        .replace(/\s+/g, ' ') // Clean multiple spaces
        .replace(/[-_]+/g, ' ') // Replace dashes and underscores with spaces
        .trim();
    
    // Capitalize first letter of each word
    cleanName = cleanName.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    
    if (!cleanName || cleanName.length < 3) {
        return prizeName;
    }
    
    return cleanName;
}
