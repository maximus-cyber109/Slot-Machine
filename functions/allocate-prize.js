exports.handler = async (event, context) => {
    console.log('🎁 Prize allocation function called');

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
        
        console.log('🔍 Processing prize allocation for:', email);
        console.log('💰 Order value:', orderValue);

        // Determine prize tier
        const tier = orderValue >= 10000 ? 'premium' : 'standard';
        console.log('🏆 Prize tier:', tier);

        // Get current inventory from Google Sheets
        const inventory = await getInventoryFromSheets();
        
        // Select available prize
        const selectedPrize = await selectAvailablePrize(tier, inventory);
        
        if (!selectedPrize) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'No prizes available. Please try again later.'
                })
            };
        }

        // Generate prize code
        const prizeCode = generatePrizeCode(selectedPrize.sku);
        
        // Update inventory in Google Sheets
        await updateInventoryInSheets(selectedPrize.sku, -1);
        
        // Log the allocation
        await logAllocation({
            email,
            orderValue,
            orderData,
            prize: selectedPrize,
            prizeCode,
            sessionId,
            timestamp: new Date().toISOString()
        });

        // Send WebEngage email
        await sendWebEngageEmail(email, selectedPrize, prizeCode, orderData);

        // Get updated stock info for display
        const stockInfo = await getStockInfo(selectedPrize.sku);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                prize: {
                    ...selectedPrize,
                    prizeCode
                },
                stockInfo,
                message: 'Prize allocated successfully!'
            })
        };

    } catch (error) {
        console.error('💥 Prize allocation error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Internal server error'
            })
        };
    }
};

// Get inventory data from Google Sheets
async function getInventoryFromSheets() {
    try {
        const response = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Sheets API error: ${response.status}`);
        }

        const data = await response.json();
        return data.inventory || {};
    } catch (error) {
        console.error('❌ Failed to get inventory from sheets:', error);
        // Return default inventory structure
        return getDefaultInventory();
    }
}

// Update inventory in Google Sheets
async function updateInventoryInSheets(sku, quantityChange) {
    try {
        const updateData = {
            action: 'updateInventory',
            sku: sku,
            quantityChange: quantityChange,
            timestamp: new Date().toISOString()
        };

        const response = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            throw new Error(`Sheets update error: ${response.status}`);
        }

        console.log('✅ Inventory updated in sheets for SKU:', sku);
        return await response.json();
    } catch (error) {
        console.error('❌ Failed to update inventory in sheets:', error);
        throw error;
    }
}

// Select available prize based on tier and inventory
async function selectAvailablePrize(tier, inventory) {
    const PRIZE_POOLS = {
        premium: [
            {sku: 'SPE02_016_01', name: 'Speedendo E Mate Pro Endomotor', value: 13000, weight: 5},
            {sku: 'DEN06_231_03', name: 'Dentsply SDR Flowable Bulk', value: 10580, weight: 8},
            {sku: 'SPE02_018_01', name: 'Speedendo Apex S Apex Locator', value: 6000, weight: 12},
            {sku: 'HAG01_023_01', name: 'Hager Mira 2 Ton Solution', value: 4668, weight: 15},
            {sku: 'DEN03_019_01', name: 'Dental Avenue Avue T Crown', value: 4553, weight: 15},
            {sku: 'DDT01_009_01', name: 'DDT Walsch Low Speed Handpiece Kit', value: 4000, weight: 20},
            {sku: 'END01_031_10', name: 'EndoStar E3 Azure 8%', value: 1700, weight: 25}
        ],
        standard: [
            {sku: 'DEN14_028_04', name: 'DenSafe Rotary File F1 21mm', value: 900, weight: 20},
            {sku: 'SPE02_010_02', name: 'Speedendo W-One Gold Files', value: 750, weight: 25},
            {sku: 'GCX02_034_02', name: 'GC Tooth Mousse Plus', value: 678, weight: 25},
            {sku: 'RAB01_068_01', name: 'Rabbit Force Titanium Mini Screws', value: 490, weight: 30}
        ]
    };

    // Get available prizes for the tier
    let availablePrizes = PRIZE_POOLS[tier].filter(prize => {
        const stock = inventory[prize.sku]?.quantity || 0;
        return stock > 0;
    });

    // If no premium prizes available, include standard prizes for premium users
    if (tier === 'premium' && availablePrizes.length === 0) {
        availablePrizes = PRIZE_POOLS.standard.filter(prize => {
            const stock = inventory[prize.sku]?.quantity || 0;
            return stock > 0;
        });
    }

    // If still no prizes, fall back to cashback
    if (availablePrizes.length === 0) {
        const cashbackPrizes = [
            {sku: 'PB_CASHBACK_100', name: 'PB CASHBACK ₹100', value: 100, weight: 40},
            {sku: 'PB_CASHBACK_150', name: 'PB CASHBACK ₹150', value: 150, weight: 30},
            {sku: 'PB_CASHBACK_200', name: 'PB CASHBACK ₹200', value: 200, weight: 20},
            {sku: 'PB_CASHBACK_250', name: 'PB CASHBACK ₹250', value: 250, weight: 10}
        ];
        
        availablePrizes = cashbackPrizes.filter(prize => {
            const stock = inventory[prize.sku]?.quantity || 500; // Default high stock for cashback
            return stock > 0;
        });
    }

    if (availablePrizes.length === 0) {
        return null; // No prizes available
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
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `${sku.substring(0, 6)}_${timestamp}_${random}`.toUpperCase();
}

// Log allocation to Google Sheets
async function logAllocation(allocationData) {
    try {
        const logData = {
            action: 'logAllocation',
            ...allocationData
        };

        await fetch(process.env.GOOGLE_SHEETS_WEBHOOK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(logData)
        });

        console.log('✅ Allocation logged successfully');
    } catch (error) {
        console.error('❌ Failed to log allocation:', error);
    }
}

// Send WebEngage email notification
async function sendWebEngageEmail(email, prize, prizeCode, orderData) {
    try {
        if (!process.env.WEBENGAGE_API_KEY || !process.env.WEBENGAGE_ACCOUNT_ID) {
            console.log('⚠️ WebEngage credentials not configured');
            return;
        }

        const emailData = {
            userId: email,
            eventName: 'prize_won',
            eventTime: new Date().toISOString(),
            eventData: {
                prizeName: prize.name,
                prizeValue: prize.value,
                prizeCode: prizeCode,
                prizeSku: prize.sku,
                orderNumber: orderData?.increment_id,
                orderValue: orderData?.grand_total,
                customerName: orderData?.customer_firstname || 'Valued Customer'
            }
        };

        const response = await fetch(`https://api.webengage.com/v1/accounts/${process.env.WEBENGAGE_ACCOUNT_ID}/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.WEBENGAGE_API_KEY}`
            },
            body: JSON.stringify(emailData)
        });

        if (response.ok) {
            console.log('✅ WebEngage email triggered successfully');
        } else {
            console.error('❌ WebEngage email failed:', response.status);
        }
    } catch (error) {
        console.error('❌ WebEngage email error:', error);
    }
}

// Get stock information for display
async function getStockInfo(sku) {
    try {
        const inventory = await getInventoryFromSheets();
        const stock = inventory[sku]?.quantity || 0;
        return `📦 Remaining stock for this prize: ${stock} units`;
    } catch (error) {
        return '📦 Stock information unavailable';
    }
}

// Default inventory structure (fallback)
function getDefaultInventory() {
    return {
        'SPE02_016_01': { quantity: 1, allocated: 0 },
        'DEN06_231_03': { quantity: 1, allocated: 0 },
        'SPE02_018_01': { quantity: 1, allocated: 0 },
        'HAG01_023_01': { quantity: 1, allocated: 0 },
        'DEN03_019_01': { quantity: 1, allocated: 0 },
        'DDT01_009_01': { quantity: 2, allocated: 0 },
        'END01_031_10': { quantity: 5, allocated: 0 },
        'DEN18_046_04': { quantity: 1, allocated: 0 },
        'NUS01_002_01': { quantity: 1, allocated: 0 },
        'DDT01_010_01': { quantity: 1, allocated: 0 },
        'DEN14_028_04': { quantity: 1, allocated: 0 },
        'SPE02_010_02': { quantity: 5, allocated: 0 },
        'GCX02_034_02': { quantity: 1, allocated: 0 },
        'RAB01_068_01': { quantity: 1, allocated: 0 },
        'GDC01_125_04': { quantity: 1, allocated: 0 },
        'PB_CASHBACK_100': { quantity: 500, allocated: 0 },
        'PB_CASHBACK_150': { quantity: 500, allocated: 0 },
        'PB_CASHBACK_200': { quantity: 500, allocated: 0 },
        'PB_CASHBACK_250': { quantity: 500, allocated: 0 }
    };
}
