exports.handler = async (event, context) => {
    console.log('🎁 Prize allocation function started');
    
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
        const { email, orderValue, orderData, sessionId } = JSON.parse(event.body);
        
        console.log('🔍 Processing allocation for:', email);
        console.log('💰 Order value:', orderValue);

        // Get current inventory from Google Sheets
        console.log('📋 Fetching inventory...');
        const inventoryResponse = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK + '?action=getInventory', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!inventoryResponse.ok) {
            throw new Error(`Sheets API error: ${inventoryResponse.status}`);
        }

        const inventoryData = await inventoryResponse.json();
        
        if (!inventoryData.success) {
            throw new Error('Failed to get inventory: ' + inventoryData.error);
        }

        console.log('✅ Inventory fetched successfully');
        
        // Determine prize tier based on order value
        const tier = orderValue >= 10000 ? 'premium' : 'standard';
        console.log('🏆 Prize tier:', tier);

        // Select available prize
        const selectedPrize = selectAvailablePrize(tier, inventoryData.inventory);
        
        if (!selectedPrize) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'No prizes available. Please contact support.'
                })
            };
        }

        console.log('🎯 Selected prize:', selectedPrize.name);

        // Generate unique prize code
        const prizeCode = generatePrizeCode(selectedPrize.sku);
        
        // Update inventory in Google Sheets
        console.log('📝 Updating inventory...');
        const updateResponse = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'updateInventory',
                sku: selectedPrize.sku,
                quantityChange: -1,
                timestamp: new Date().toISOString()
            })
        });

        if (!updateResponse.ok) {
            throw new Error(`Inventory update failed: ${updateResponse.status}`);
        }

        console.log('✅ Inventory updated successfully');
        
        // Log the allocation
        console.log('📊 Logging allocation...');
        await fetch(process.env.GOOGLE_SHEETS_WEBHOOK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'logAllocation',
                timestamp: new Date().toISOString(),
                email: email,
                orderValue: orderValue,
                prizeSku: selectedPrize.sku,
                prizeName: selectedPrize.name,
                prizeCode: prizeCode,
                sessionId: sessionId
            })
        });

        console.log('✅ Allocation logged successfully');

        // Send WebEngage event for real prize winners
        try {
            await sendWebEngageEvent(email, selectedPrize, prizeCode, orderData);
            console.log('✅ WebEngage event sent successfully');
        } catch (webengageError) {
            console.error('⚠️ WebEngage error (non-critical):', webengageError.message);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                prize: {
                    ...selectedPrize,
                    prizeCode
                },
                message: 'Prize allocated successfully!',
                tier: tier
            })
        };

    } catch (error) {
        console.error('💥 Prize allocation error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Internal server error: ' + error.message
            })
        };
    }
};

// Select available prize based on tier and inventory
function selectAvailablePrize(tier, inventory) {
    const PRIZE_POOLS = {
        premium: [ // For orders >= ₹10,000
            {sku: 'SPE02_016_01', name: 'Speedendo E Mate Pro Endomotor', value: 13000, weight: 5},
            {sku: 'DEN06_231_03', name: 'Dentsply SDR Flowable Bulk (Refill Of 50)', value: 10580, weight: 8},
            {sku: 'SPE02_018_01', name: 'Speedendo Apex S Apex Locator', value: 6000, weight: 12},
            {sku: 'HAG01_023_01', name: 'Hager Mira 2 Ton Solution 60ml', value: 4668, weight: 15},
            {sku: 'DEN03_019_01', name: 'Dental Avenue Avue T Crown Automix (76 gm)', value: 4553, weight: 15},
            {sku: 'DDT01_009_01', name: 'DDT Walsch Low Speed Handpiece Kit', value: 4000, weight: 20},
            {sku: 'END01_031_10', name: 'EndoStar E3 Azure 8% #30 25mm', value: 1700, weight: 25}
        ],
        standard: [ // For all customers
            {sku: 'DEN14_028_04', name: 'DenSafe Rotary File F1 21mm', value: 900, weight: 30},
            {sku: 'SPE02_010_02', name: 'Speedendo W-One Gold Files 21mm #25', value: 750, weight: 35},
            {sku: 'GCX02_034_02', name: 'GC Tooth Mousse Plus Flavour 1-Pack', value: 678, weight: 35}
        ]
    };

    // Get available prizes for the tier
    let availablePrizes = PRIZE_POOLS[tier].filter(prize => {
        const stock = inventory[prize.sku]?.currentStock || 0;
        return stock > 0;
    });

    // If no premium prizes available, premium users can get standard prizes
    if (tier === 'premium' && availablePrizes.length === 0) {
        console.log('🔄 No premium prizes available, checking standard prizes...');
        availablePrizes = PRIZE_POOLS.standard.filter(prize => {
            const stock = inventory[prize.sku]?.currentStock || 0;
            return stock > 0;
        });
    }

    // If still no prizes, fall back to cashback
    if (availablePrizes.length === 0) {
        console.log('💰 Falling back to cashback prizes...');
        const cashbackPrizes = [
            {sku: 'PB_CASHBACK_100', name: 'PB CASHBACK ₹100', value: 100, weight: 40},
            {sku: 'PB_CASHBACK_150', name: 'PB CASHBACK ₹150', value: 150, weight: 30},
            {sku: 'PB_CASHBACK_200', name: 'PB CASHBACK ₹200', value: 200, weight: 20},
            {sku: 'PB_CASHBACK_250', name: 'PB CASHBACK ₹250', value: 250, weight: 10}
        ];
        
        availablePrizes = cashbackPrizes.filter(prize => {
            const stock = inventory[prize.sku]?.currentStock || 500;
            return stock > 0;
        });
    }

    if (availablePrizes.length === 0) {
        console.log('❌ No prizes available at all');
        return null;
    }

    // Weighted random selection
    const totalWeight = availablePrizes.reduce((sum, prize) => sum + prize.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const prize of availablePrizes) {
        random -= prize.weight;
        if (random <= 0) {
            return prize;
        }
    }

    return availablePrizes[0]; // Fallback
}

// Generate unique prize code
function generatePrizeCode(sku) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PB${sku.substring(0, 6)}_${timestamp}_${random}`;
}

// Send WebEngage event for real prize winners
async function sendWebEngageEvent(email, prize, prizeCode, orderData) {
    try {
        console.log('📧 Sending WebEngage event for:', email);
        
        const eventData = {
            userId: email,
            eventName: 'prize_won',
            eventTime: new Date().toISOString(),
            eventData: {
                prize_name: prize.name,
                prize_value: prize.value.toString(),
                prize_code: prizeCode,
                prize_sku: prize.sku,
                customer_name: orderData?.customer_firstname || 'Valued Customer',
                customer_email: email,
                order_number: orderData?.increment_id || 'N/A',
                order_value: orderData?.grand_total?.toString() || 'N/A',
                support_email: 'support@pinkblue.in'
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
    }
}
