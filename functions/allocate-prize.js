// netlify/functions/allocate-prize.js
// ✅ COMPLETE ENHANCED VERSION with Product Images & Custom Events
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
            
            // ✅ Send enhanced email notification with product images
            try {
                console.log('📧 Sending enhanced WebEngage email notification for:', originalEmail);
                console.log('🎁 Prize details:', result.prize.name + ' - Value: ₹' + result.prize.value);
                console.log('🖼️ Prize image:', result.prize.image);
                
                await sendEnhancedWebEngageNotification(
                    cleanEmailForNotification, 
                    result.prize, 
                    isTestUser,
                    data // ← Pass original order data for enhanced details
                );
                console.log('✅ Enhanced WebEngage email notification sent');
                
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

// ✅ ENHANCED: WebEngage notification with complete product details & images
async function sendEnhancedWebEngageNotification(cleanEmail, prize, isTestUser, originalOrderData) {
    try {
        console.log('📧 Enhanced WebEngage notification starting...');
        
        // ✅ Enhanced logging for test users
        if (isTestUser) {
            console.log('🧪 Test user - logging enhanced email details instead of sending');
            logEnhancedTestUserEmailDetails(cleanEmail, prize, originalOrderData);
            return true;
        }
        
        const WEBENGAGE_API_KEY = process.env.WEBENGAGE_API_KEY || '~4c6729b7';
        const WEBENGAGE_TOKEN = process.env.WEBENGAGE_TOKEN || 'gu3bqwq4';
        
        console.log('📧 WebEngage Config - API Key:', WEBENGAGE_API_KEY);
        console.log('📧 Sending enhanced notification to:', cleanEmail);
        
        // ✅ Enhanced prize details with cleaned data
        const cleanPrizeName = cleanProductName(prize.name);
        const prizeImageUrl = prize.image || 'https://email-editor-resources.s3.amazonaws.com/images/82618240/stw-sep25/default-prize.png';
        const orderValue = originalOrderData?.orderValue || originalOrderData?.orderData?.grand_total || 0;
        const orderNumber = originalOrderData?.orderNumber || originalOrderData?.orderData?.increment_id || 'N/A';
        
        console.log('🎁 Enhanced prize details for WebEngage:');
        console.log('   - Clean name:', cleanPrizeName);
        console.log('   - Original name:', prize.name);
        console.log('   - Image URL:', prizeImageUrl);
        console.log('   - Prize value: ₹' + (prize.value || 0));
        console.log('   - Order value: ₹' + orderValue);
        console.log('   - Order number:', orderNumber);
        
        // ✅ ENHANCED: Complete WebEngage payload with all product details
        const enhancedWebEngagePayload = {
            "userId": cleanEmail,
            "eventName": "arcade_prize_won", // WebEngage-friendly event name
            "eventTime": new Date().toISOString(),
            "eventData": {
                // ✅ Prize Information
                "prize_name": cleanPrizeName,
                "prize_original_name": prize.name || 'Unknown Prize',
                "prize_sku": prize.sku || 'N/A',
                "prize_value": parseInt(prize.value) || 0,
                "prize_image_url": prizeImageUrl,
                "prize_category": categorizePrize(prize.name, prize.value),
                "prize_tier": prize.value >= 10000 ? "premium" : prize.value >= 1000 ? "standard" : "basic",
                
                // ✅ Order Information  
                "order_value": parseFloat(orderValue) || 0,
                "order_number": orderNumber,
                "order_currency": "INR",
                
                // ✅ Campaign Information
                "campaign_name": "PB Days Arcade",
                "campaign_type": "gamification",
                "game_type": "slot_machine",
                "promotion_code": "PBDAYS2025",
                
                // ✅ Customer Information
                "customer_email": cleanEmail,
                "customer_name": getCustomerName(originalOrderData),
                "customer_segment": orderValue >= 10000 ? "premium" : "standard",
                
                // ✅ Event Metadata
                "event_timestamp": new Date().toISOString(),
                "event_date": new Date().toISOString().split('T')[0],
                "is_test_allocation": false,
                "platform": "web",
                "source": "pb_days_arcade",
                "user_agent": "arcade_game",
                
                // ✅ Email Template Data (for dynamic content)
                "email_subject": `🎉 You Won: ${cleanPrizeName}!`,
                "email_heading": "Congratulations! You're a Winner!",
                "email_subheading": `You've won ${cleanPrizeName} worth ₹${prize.value}`,
                "email_body": `Thank you for participating in PB Days Arcade! Your prize ${cleanPrizeName} worth ₹${prize.value} will be sent once your order #${orderNumber} is delivered.`,
                "cta_text": "View Your Prize",
                "cta_url": "https://pinkblue.in/arcade-winners",
                "footer_text": "PinkBlue - Your Dental Care Partner",
                
                // ✅ Additional Marketing Data
                "prize_availability": "limited",
                "next_action": "wait_for_delivery",
                "estimated_delivery": getEstimatedDelivery(),
                "support_email": "support@pinkblue.in",
                "website_url": "https://pinkblue.in"
            }
        };
        
        console.log('📤 Enhanced WebEngage payload:', JSON.stringify(enhancedWebEngagePayload, null, 2));
        
        // ✅ Method 1: Try WebEngage Events API
        try {
            const webEngageEndpoint = `https://api.webengage.com/v1/accounts/${WEBENGAGE_API_KEY}/events`;
            console.log('🎯 WebEngage endpoint:', webEngageEndpoint);
            
            const webEngageResponse = await fetch(webEngageEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${WEBENGAGE_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(enhancedWebEngagePayload)
            });
            
            console.log('📥 WebEngage API response status:', webEngageResponse.status);
            
            if (webEngageResponse.ok) {
                const webEngageResult = await webEngageResponse.json();
                console.log('✅ Enhanced WebEngage event sent successfully');
                console.log('📋 WebEngage response:', JSON.stringify(webEngageResult));
                
                // ✅ Additional: Send user attributes for better personalization
                await sendWebEngageUserAttributes(cleanEmail, prize, originalOrderData);
                
                return true;
            } else {
                const errorText = await webEngageResponse.text();
                console.error('❌ WebEngage Method 1 failed:', errorText);
                console.error('❌ Response headers:', Object.fromEntries(webEngageResponse.headers.entries()));
                throw new Error(`WebEngage API error: ${webEngageResponse.status}`);
            }
            
        } catch (method1Error) {
            console.log('🔄 WebEngage Method 1 failed, trying alternative format...');
            
            // ✅ Method 2: Try alternative payload format
            try {
                const alternativePayload = {
                    "users": [
                        {
                            "userId": cleanEmail,
                            "email": cleanEmail,
                            "events": [
                                {
                                    "name": "arcade_prize_won",
                                    "time": new Date().toISOString(),
                                    "attributes": {
                                        "prize_name": cleanPrizeName,
                                        "prize_value": prize.value || 0,
                                        "prize_image": prizeImageUrl,
                                        "order_value": orderValue,
                                        "campaign": "PB Days Arcade",
                                        "prize_category": categorizePrize(prize.name, prize.value)
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
                    console.error('❌ Alternative WebEngage also failed:', altErrorText);
                    throw new Error(`Alternative WebEngage failed: ${altResponse.status}`);
                }
                
            } catch (method2Error) {
                console.log('🔄 Both WebEngage methods failed, using enhanced logging fallback...');
                
                // ✅ Enhanced fallback logging with complete details
                logEnhancedEmailFallback(cleanEmail, prize, originalOrderData);
                return true;
            }
        }
        
    } catch (error) {
        console.error('❌ Enhanced WebEngage notification error:', error.message);
        console.error('❌ Full error stack:', error.stack);
        
        // ✅ Final enhanced fallback
        logEnhancedEmailFallback(cleanEmail, prize, originalOrderData);
        return false;
    }
}

// ✅ NEW: Send user attributes to WebEngage for better personalization
async function sendWebEngageUserAttributes(cleanEmail, prize, originalOrderData) {
    try {
        const WEBENGAGE_API_KEY = process.env.WEBENGAGE_API_KEY || '~4c6729b7';
        const WEBENGAGE_TOKEN = process.env.WEBENGAGE_TOKEN || 'gu3bqwq4';
        
        const userAttributesPayload = {
            "userId": cleanEmail,
            "attributes": {
                "last_prize_won": cleanProductName(prize.name),
                "last_prize_value": prize.value || 0,
                "last_order_value": originalOrderData?.orderValue || 0,
                "arcade_participant": true,
                "last_game_played": new Date().toISOString(),
                "customer_segment": (originalOrderData?.orderValue || 0) >= 10000 ? "premium" : "standard",
                "total_arcade_wins": 1, // This could be incremented if you track history
                "preferred_prize_category": categorizePrize(prize.name, prize.value),
                "last_activity": new Date().toISOString()
            }
        };
        
        console.log('👤 Sending user attributes:', JSON.stringify(userAttributesPayload, null, 2));
        
        const attributesEndpoint = `https://api.webengage.com/v1/accounts/${WEBENGAGE_API_KEY}/users`;
        
        const response = await fetch(attributesEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WEBENGAGE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userAttributesPayload)
        });
        
        console.log('👤 User attributes response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ User attributes sent to WebEngage successfully');
            console.log('👤 Attributes response:', JSON.stringify(result));
        } else {
            const errorText = await response.text();
            console.log('⚠️ User attributes failed (non-critical):', errorText);
        }
        
    } catch (error) {
        console.log('⚠️ User attributes error (non-critical):', error.message);
    }
}

// ✅ NEW: Enhanced test user email details logging
function logEnhancedTestUserEmailDetails(cleanEmail, prize, originalOrderData) {
    console.log('🧪 ENHANCED TEST USER EMAIL DETAILS:');
    console.log('=====================================');
    console.log('📧 Would send to:', cleanEmail);
    console.log('🎉 Email Subject: You Won: ' + cleanProductName(prize.name) + '!');
    console.log('🎁 Prize Details:');
    console.log('   - Clean Name:', cleanProductName(prize.name));
    console.log('   - Original Name:', prize.name);
    console.log('   - SKU:', prize.sku || 'N/A');
    console.log('   - Value: ₹' + (prize.value || 0));
    console.log('   - Category:', categorizePrize(prize.name, prize.value));
    console.log('   - Tier:', (prize.value >= 10000 ? "premium" : prize.value >= 1000 ? "standard" : "basic"));
    console.log('🖼️ Prize Image URL:', prize.image || 'No image');
    console.log('💰 Order Details:');
    console.log('   - Order Value: ₹' + (originalOrderData?.orderValue || 0));
    console.log('   - Order Number:', originalOrderData?.orderNumber || 'N/A');
    console.log('   - Customer Segment:', (originalOrderData?.orderValue || 0) >= 10000 ? "premium" : "standard");
    console.log('📅 Event Details:');
    console.log('   - Timestamp:', new Date().toISOString());
    console.log('   - Campaign: PB Days Arcade');
    console.log('   - Source: arcade_game');
    console.log('📧 Email Template Data:');
    console.log('   - Heading: Congratulations! You\'re a Winner!');
    console.log('   - CTA: View Your Prize');
    console.log('   - Support: support@pinkblue.in');
    console.log('=====================================');
}

// ✅ NEW: Enhanced email fallback logging
function logEnhancedEmailFallback(cleanEmail, prize, originalOrderData) {
    console.log('📨 ENHANCED FALLBACK EMAIL NOTIFICATION:');
    console.log('==========================================');
    console.log('📧 To:', cleanEmail);
    console.log('🎉 Subject: You Won: ' + cleanProductName(prize.name) + '!');
    console.log('');
    console.log('🎁 PRIZE DETAILS:');
    console.log('   Name:', cleanProductName(prize.name));
    console.log('   Original Name:', prize.name);
    console.log('   SKU:', prize.sku);
    console.log('   Value: ₹' + (prize.value || 0));
    console.log('   Image URL:', prize.image || 'No image available');
    console.log('   Category:', categorizePrize(prize.name, prize.value));
    console.log('   Tier:', prize.value >= 10000 ? "premium" : prize.value >= 1000 ? "standard" : "basic");
    console.log('');
    console.log('💰 ORDER DETAILS:');
    console.log('   Order Value: ₹' + (originalOrderData?.orderValue || 0));
    console.log('   Order Number:', originalOrderData?.orderNumber || 'N/A');
    console.log('   Customer Segment:', (originalOrderData?.orderValue || 0) >= 10000 ? "premium" : "standard");
    console.log('');
    console.log('📧 EMAIL CONTENT:');
    console.log('   Heading: Congratulations! You\'re a Winner!');
    console.log('   Message: You\'ve won ' + cleanProductName(prize.name) + ' worth ₹' + (prize.value || 0));
    console.log('   Body: Your prize will be sent once your order is delivered.');
    console.log('   CTA: View Your Prize → https://pinkblue.in/arcade-winners');
    console.log('   Support: support@pinkblue.in');
    console.log('');
    console.log('⏰ TIMESTAMP:', new Date().toISOString());
    console.log('🏷️ CAMPAIGN: PB Days Arcade');
    console.log('==========================================');
    console.log('✅ Enhanced fallback email notification logged successfully');
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

// ✅ NEW: Prize categorization helper
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

// ✅ Enhanced product name cleaning
function cleanProductName(prizeName) {
    if (!prizeName) return 'Mystery Prize';
    
    let cleanName = prizeName
        .replace(/^[A-Z0-9_]+\s*[-_]\s*/i, '') // Remove codes like "PB01_001_02 - "
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
