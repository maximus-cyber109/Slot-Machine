// netlify/functions/allocate-prize.js
// ✅ COMPLETE UPDATED VERSION - No SKU + WebEngage Journey Optimized
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

// ✅ OPTIMIZED: WebEngage event for journey trigger (No SKU)
async function sendWebEngageJourneyEvent(cleanEmail, prize, isTestUser, originalOrderData) {
    try {
        console.log('📧 Sending WebEngage event for journey automation...');
        
        // ✅ Enhanced logging for test users
        if (isTestUser) {
            console.log('🧪 Test user - logging journey event details instead of sending');
            logTestUserJourneyEvent(cleanEmail, prize, originalOrderData);
            return true;
        }
        
        const WEBENGAGE_API_KEY = process.env.WEBENGAGE_API_KEY || '~4c6729b7';
        const WEBENGAGE_TOKEN = process.env.WEBENGAGE_TOKEN || 'gu3bqwq4';
        
        console.log('📧 WebEngage Config - API Key:', WEBENGAGE_API_KEY);
        console.log('📧 Sending journey trigger event to:', cleanEmail);
        
        // ✅ Enhanced prize details with cleaned data (No SKU)
        const cleanPrizeName = cleanProductName(prize.name);
        const prizeImageUrl = prize.image || 'https://email-editor-resources.s3.amazonaws.com/images/82618240/stw-sep25/default-prize.png';
        const orderValue = originalOrderData?.orderValue || originalOrderData?.orderData?.grand_total || 0;
        const orderNumber = originalOrderData?.orderNumber || originalOrderData?.orderData?.increment_id || 'N/A';
        
        console.log('🎁 Journey event details (No SKU):');
        console.log('   - Clean name:', cleanPrizeName);
        console.log('   - Original name:', prize.name);
        console.log('   - Image URL:', prizeImageUrl);
        console.log('   - Prize value: ₹' + (prize.value || 0));
        console.log('   - Order value: ₹' + orderValue);
        console.log('   - Order number:', orderNumber);
        console.log('   - Category:', categorizePrize(prize.name, prize.value));
        
        // ✅ OPTIMIZED: WebEngage payload for journey trigger (No SKU)
        const journeyEventPayload = {
            "userId": cleanEmail,
            "eventName": "prize_won", // Your journey listens for this event
            "eventTime": new Date().toISOString(),
            "eventData": {
                // ✅ Prize Information (No SKU)
                "prize_name": cleanPrizeName,
                "prize_original_name": prize.name || 'Unknown Prize',
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
                
                // ✅ Journey Template Data (available in your journey)
                "email_subject": `🎉 You Won: ${cleanPrizeName}!`,
                "email_heading": "Congratulations! You're a Winner!",
                "email_subheading": `You've won ${cleanPrizeName} worth ₹${prize.value}`,
                "email_body": `Thank you for participating in PB Days Arcade! Your prize ${cleanPrizeName} worth ₹${prize.value} will be sent once your order #${orderNumber} is delivered.`,
                "cta_text": "View Your Prize",
                "cta_url": "https://pinkblue.in/arcade-winners",
                "footer_text": "PinkBlue - Your Dental Care Partner",
                
                // ✅ Event Metadata
                "event_timestamp": new Date().toISOString(),
                "event_date": new Date().toISOString().split('T')[0],
                "platform": "web",
                "source": "pb_days_arcade",
                "estimated_delivery": getEstimatedDelivery(),
                "support_email": "support@pinkblue.in",
                "website_url": "https://pinkblue.in"
            }
        };
        
        console.log('📤 WebEngage journey event payload (No SKU):', JSON.stringify(journeyEventPayload, null, 2));
        
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
                body: JSON.stringify(journeyEventPayload)
            });
            
            console.log('📥 WebEngage API response status:', webEngageResponse.status);
            
            if (webEngageResponse.ok) {
                const webEngageResult = await webEngageResponse.json();
                console.log('✅ WebEngage journey event sent successfully');
                console.log('📋 WebEngage response:', JSON.stringify(webEngageResult));
                console.log('🚀 Your dedicated journey will now handle email delivery');
                
                // ✅ Update user attributes for better personalization
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
            
            // ✅ Method 2: Alternative format for journey trigger
            try {
                const alternativePayload = {
                    "users": [
                        {
                            "userId": cleanEmail,
                            "email": cleanEmail,
                            "events": [
                                {
                                    "name": "prize_won",
                                    "time": new Date().toISOString(),
                                    "attributes": {
                                        "prize_name": cleanPrizeName,
                                        "prize_value": prize.value || 0,
                                        "prize_image": prizeImageUrl,
                                        "order_value": orderValue,
                                        "campaign": "PB Days Arcade",
                                        "prize_category": categorizePrize(prize.name, prize.value)
                                        // ✅ No SKU included
                                    }
                                }
                            ]
                        }
                    ]
                };
                
                console.log('🔄 Alternative WebEngage payload (No SKU):', JSON.stringify(alternativePayload, null, 2));
                
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
                    console.log('🚀 Your journey will handle email delivery from this event');
                    return true;
                } else {
                    const altErrorText = await altResponse.text();
                    console.error('❌ Alternative WebEngage also failed:', altErrorText);
                    throw new Error(`Alternative WebEngage failed: ${altResponse.status}`);
                }
                
            } catch (method2Error) {
                console.log('🔄 Both WebEngage methods failed, using enhanced logging fallback...');
                
                // ✅ Enhanced fallback logging
                logJourneyEventFallback(cleanEmail, prize, originalOrderData);
                return true;
            }
        }
        
    } catch (error) {
        console.error('❌ WebEngage journey event error:', error.message);
        console.error('❌ Full error stack:', error.stack);
        
        // ✅ Final enhanced fallback
        logJourneyEventFallback(cleanEmail, prize, originalOrderData);
        return false;
    }
}

// ✅ UPDATED: User attributes (No SKU)
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
                "total_arcade_wins": 1,
                "preferred_prize_category": categorizePrize(prize.name, prize.value),
                "last_activity": new Date().toISOString()
                // ✅ No SKU attributes
            }
        };
        
        console.log('👤 Sending user attributes (No SKU):', JSON.stringify(userAttributesPayload, null, 2));
        
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
            console.log('✅ User attributes sent successfully (No SKU)');
        } else {
            console.log('⚠️ User attributes failed (non-critical)');
        }
        
    } catch (error) {
        console.log('⚠️ User attributes error (non-critical):', error.message);
    }
}

// ✅ UPDATED: Test user logging (No SKU)
function logTestUserJourneyEvent(cleanEmail, prize, originalOrderData) {
    console.log('🧪 TEST USER JOURNEY EVENT (No SKU):');
    console.log('====================================');
    console.log('📧 Would trigger journey for:', cleanEmail);
    console.log('🎉 Event: prize_won');
    console.log('🎁 Prize Details:');
    console.log('   - Clean Name:', cleanProductName(prize.name));
    console.log('   - Original Name:', prize.name);
    console.log('   - Value: ₹' + (prize.value || 0));
    console.log('   - Category:', categorizePrize(prize.name, prize.value));
    console.log('   - Tier:', (prize.value >= 10000 ? "premium" : prize.value >= 1000 ? "standard" : "basic"));
    console.log('🖼️ Prize Image URL:', prize.image || 'No image');
    console.log('💰 Order Details:');
    console.log('   - Order Value: ₹' + (originalOrderData?.orderValue || 0));
    console.log('   - Order Number:', originalOrderData?.orderNumber || 'N/A');
    console.log('🚀 Journey would handle email delivery');
    console.log('====================================');
}

// ✅ UPDATED: Journey event fallback logging (No SKU)
function logJourneyEventFallback(cleanEmail, prize, originalOrderData) {
    console.log('📨 JOURNEY EVENT FALLBACK (No SKU):');
    console.log('===================================');
    console.log('📧 Email:', cleanEmail);
    console.log('🎉 Event: prize_won');
    console.log('🎁 Prize:', cleanProductName(prize.name));
    console.log('💰 Value: ₹' + (prize.value || 0));
    console.log('🖼️ Image:', prize.image || 'No image');
    console.log('📦 Order: #' + (originalOrderData?.orderNumber || 'N/A'));
    console.log('💰 Order Value: ₹' + (originalOrderData?.orderValue || 0));
    console.log('🏷️ Category:', categorizePrize(prize.name, prize.value));
    console.log('🚀 Journey would trigger from this event');
    console.log('===================================');
    console.log('✅ Journey event logged (WebEngage unavailable)');
}

// ✅ HELPER FUNCTIONS (Updated - No SKU)

function getCustomerName(originalOrderData) {
    const firstName = originalOrderData?.orderData?.customer_firstname || '';
    const lastName = originalOrderData?.orderData?.customer_lastname || '';
    return (firstName + ' ' + lastName).trim() || 'Valued Customer';
}

function getEstimatedDelivery() {
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 7);
    return deliveryDate.toISOString().split('T')[0];
}

function categorizePrize(prizeName, prizeValue) {
    if (!prizeName) return 'unknown';
    
    const name = prizeName.toLowerCase();
    
    if (name.includes('cashback')) return 'cashback';
    if (name.includes('drill') || name.includes('bur')) return 'dental_tools';
    if (name.includes('gate') || name.includes('reamer') || name.includes('endo')) return 'endo_tools';
    if (name.includes('composite') || name.includes('filling')) return 'restorative';
    if (name.includes('polish') || name.includes('paste') || name.includes('gel')) return 'consumables';
    if (name.includes('scaler') || name.includes('ultrasonic')) return 'cleaning_tools';
    if (name.includes('impression') || name.includes('alginate')) return 'impression_materials';
    if (name.includes('syringe') || name.includes('needle')) return 'injection_supplies';
    if (name.includes('suture') || name.includes('surgical')) return 'surgical_supplies';
    
    if (prizeValue >= 10000) return 'premium_equipment';
    if (prizeValue >= 5000) return 'advanced_tools';
    if (prizeValue >= 1000) return 'standard_tools';
    if (prizeValue >= 500) return 'basic_supplies';
    
    return 'dental_supplies';
}

function cleanProductName(prizeName) {
    if (!prizeName) return 'Mystery Prize';
    
    let cleanName = prizeName
        .replace(/^[A-Z0-9_]+\s*[-_]\s*/i, '')
        .replace(/^[A-Z]{2,}\s+/i, '')
        .replace(/\s*[-_]\s*[A-Z0-9_]+$/i, '')
        .replace(/\([^)]*\)$/g, '')
        .replace(/\s+/g, ' ')
        .replace(/[-_]+/g, ' ')
        .trim();
    
    cleanName = cleanName.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    
    if (!cleanName || cleanName.length < 3) {
        return prizeName;
    }
    
    return cleanName;
}
