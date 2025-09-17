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

// ✅ WebEngage email notification function
async function sendWebEngageNotification(cleanEmail, prize, isTestUser) {
    try {
        const WEBENGAGE_API_KEY = process.env.WEBENGAGE_API_KEY || '~4c6729b7';
        const WEBENGAGE_TOKEN = process.env.WEBENGAGE_TOKEN || 'gu3bqwq4';
        
        // ✅ Clean prize name for email
        const cleanPrizeName = cleanProductName(prize.name);
        
        // ✅ Prepare WebEngage payload
        const webEngagePayload = {
            userId: cleanEmail,
            eventName: 'arcadePrizeWon',
            eventData: {
                prizeName: cleanPrizeName,
                prizeValue: prize.value || 0,
                prizeSKU: prize.sku || 'N/A',
                prizeImage: prize.image || '',
                isTestUser: isTestUser,
                winTimestamp: new Date().toISOString(),
                customerEmail: cleanEmail
            }
        };
        
        console.log('📤 WebEngage event payload prepared');
        
        const webEngageResponse = await fetch(`https://api.webengage.com/v1/accounts/${WEBENGAGE_API_KEY}/events`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WEBENGAGE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(webEngagePayload)
        });
        
        console.log('📥 WebEngage API response status:', webEngageResponse.status);
        
        if (webEngageResponse.ok) {
            const webEngageResult = await webEngageResponse.json();
            console.log('✅ WebEngage event sent successfully');
            console.log('📋 WebEngage response:', JSON.stringify(webEngageResult));
        } else {
            const errorText = await webEngageResponse.text();
            console.error('❌ WebEngage API error:', errorText);
            throw new Error(`WebEngage API error: ${webEngageResponse.status}`);
        }
        
    } catch (error) {
        console.error('❌ WebEngage notification error:', error.message);
        throw error;
    }
}

// ✅ Clean product name helper function
function cleanProductName(prizeName) {
    if (!prizeName) return 'Mystery Prize';
    
    // Remove common product codes and prefixes
    let cleanName = prizeName
    .replace(/^\(?[A-Z]+\d+_\d+_\d+\)?\s*[-_]\s*/i, '') // Remove leading SKU like "(PB01_001_01) -"
    .replace(/\s*[-_]\s*\(?[A-Z]+\d+_\d+_\d+\)?$/i, '') // Remove trailing SKU like "- (PB01_001_01)"
    .trim();
    
    // If nothing left, return original
    if (!cleanName || cleanName.length < 3) {
        return prizeName;
    }
    
    return cleanName;
}
