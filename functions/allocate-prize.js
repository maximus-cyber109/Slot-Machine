exports.handler = async (event, context) => {
    console.log('🎁 Prize allocation system started');

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

        // Determine prize tier based on order value
        const tier = orderValue >= 10000 ? 'premium' : 'standard';
        console.log('🏆 Prize tier:', tier);

        // Get current inventory from Google Sheets
        const inventory = await getInventoryFromSheets();
        
        // Select available prize based on tier and stock
        const selectedPrize = await selectAvailablePrize(tier, inventory);
        
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

        // Generate unique prize code
        const prizeCode = generatePrizeCode(selectedPrize.sku);
        
        // Update inventory in Google Sheets
        await updateInventoryInSheets(selectedPrize.sku, -1);
        
        // Log the allocation
        await logAllocationToSheets({
            email,
            orderValue,
            orderNumber: orderData?.increment_id,
            prize: selectedPrize,
            prizeCode,
            sessionId,
            timestamp: new Date().toISOString()
        });

        // Send WebEngage event to trigger email
        await sendWebEngageEvent(email, selectedPrize, prizeCode, orderData);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                prize: {
                    ...selectedPrize,
                    prizeCode
                },
                message: 'Prize allocated successfully! Check your email for details.',
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
                error: 'Unable to allocate prize. Please try again.'
            })
        };
    }
};

// Get current inventory from Google Sheets
async function getInventoryFromSheets() {
    try {
        console.log('📋 Fetching inventory from Google Sheets...');
        
        const response = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK + '?action=getInventory', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Sheets API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ Inventory fetched successfully');
        return data.inventory || getDefaultInventory();
    } catch (error) {
        console.error('❌ Failed to get inventory:', error);
        return getDefaultInventory();
    }
}

// Update inventory in Google Sheets
async function updateInventoryInSheets(sku, quantityChange) {
    try {
        console.log(`📝 Updating inventory for ${sku}: ${quantityChange}`);
        
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

        console.log('✅ Inventory updated successfully');
        return await response.json();
    } catch (error) {
        console.error('❌ Failed to update inventory:', error);
        throw error;
    }
}

// Log allocation to Google Sheets
async function logAllocationToSheets(allocationData) {
    try {
        console.log('📊 Logging allocation to sheets...');
        
        const logData = {
            action: 'logAllocation',
            timestamp: allocationData.timestamp,
            email: allocationData.email,
            orderValue: allocationData.orderValue,
            orderNumber: allocationData.orderNumber,
            prizeSku: allocationData.prize.sku,
            prizeName: allocationData.prize.name,
            prizeValue: allocationData.prize.value,
            prizeCode: allocationData.prizeCode,
            sessionId: allocationData.sessionId
        };

        const response = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK, {
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

// Select available prize based on tier and inventory
async function selectAvailablePrize(tier, inventory) {
    // Prize configuration based on your specifications
    const PRIZE_POOLS = {
        premium: [ // For orders > ₹10,000
            {sku: 'SPE02_016_01', name: 'Speedendo E Mate Pro Endomotor', value: 13000, weight: 5},
            {sku: 'DEN06_231_03', name: 'Dentsply SDR Flowable Bulk (Refill Of 50)', value: 10580, weight: 8},
            {sku: 'SPE02_018_01', name: 'Speedendo Apex S Apex Locator', value: 6000, weight: 12},
            {sku: 'HAG01_023_01', name: 'Hager Mira 2 Ton Solution 60ml', value: 4668, weight: 15},
            {sku: 'DEN03_019_01', name: 'Dental Avenue Avue T Crown Automix (76 gm)', value: 4553, weight: 15},
            {sku: 'DDT01_009_01', name: 'DDT Walsch Low Speed Handpiece Kit', value: 4000, weight: 20},
            {sku: 'END01_031_10', name: 'EndoStar E3 Azure 8% #30 25mm', value: 1700, weight: 25},
            {sku: 'DEN18_046_04', name: 'Denext Handpiece Push Type (Supertorque Head)', value: 1651, weight: 20},
            {sku: 'NUS01_002_01', name: 'NuSmile ZR Posterior Crown 1st Primary Molar (D)', value: 1650, weight: 20},
            {sku: 'DDT01_010_01', name: 'DDT Walsch Air Motor Handpiece', value: 1500, weight: 25}
        ],
        standard: [ // For all customers
            {sku: 'DEN14_028_04', name: 'DenSafe Rotary File F1 21mm', value: 900, weight: 25},
            {sku: 'DEN14_028_05', name: 'DenSafe Rotary File F2 21mm', value: 900, weight: 25},
            {sku: 'SPE02_010_02', name: 'Speedendo W-One Gold Files 21mm #25', value: 750, weight: 30},
            {sku: 'SPE02_010_01', name: 'Speedendo W-One Gold Files 21mm #20', value: 750, weight: 30},
            {sku: 'GCX02_034_02', name: 'GC Tooth Mousse Plus Flavour 1-Pack', value: 678, weight: 35},
            {sku: 'RAB01_068_01', name: 'Rabbit Force Titanium Mini Screws - Self Drilling', value: 490, weight: 40}
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
            const stock = inventory[prize.sku]?.currentStock || 500; // Default high stock for cashback
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
            console.log('🎯 Selected prize:', prize.name);
            return prize;
        }
    }

    return availablePrizes[0]; // Fallback to first available
}

// Generate unique prize code
function generatePrizeCode(sku) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PB${sku.substring(0, 6)}_${timestamp}_${random}`;
}

// Send event to WebEngage to trigger email
async function sendWebEngageEvent(email, prize, prizeCode, orderData) {
    try {
        console.log('📧 Sending WebEngage event for:', email);
        
        const eventData = {
            userId: email,
            eventName: 'prize_won',
            eventTime: new Date().toISOString(),
            eventData: {
                prize_name: prize.name,
                prize_value: prize.value,
                prize_code: prizeCode,
                prize_sku: prize.sku,
                order_number: orderData?.increment_id || 'N/A',
                order_value: orderData?.grand_total || 'N/A',
                customer_name: orderData?.customer_firstname || 'Valued Customer',
                customer_email: email
            }
        };

        const response = await fetch(`https://api.webengage.com/v1/accounts/${process.env.WEBENGAGE_LICENSE_CODE}/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.WEBENGAGE_API_KEY}`
            },
            body: JSON.stringify(eventData)
        });

        if (response.ok) {
            console.log('✅ WebEngage event sent successfully');
        } else {
            const errorText = await response.text();
            console.error('❌ WebEngage event failed:', response.status, errorText);
        }
    } catch (error) {
        console.error('❌ WebEngage event error:', error);
    }
}

// Default inventory fallback (in case sheets are unavailable)
function getDefaultInventory() {
    return {
        'SPE02_016_01': { currentStock: 1, allocated: 0 },
        'DEN06_231_03': { currentStock: 1, allocated: 0 },
        'SPE02_018_01': { currentStock: 1, allocated: 0 },
        'HAG01_023_01': { currentStock: 1, allocated: 0 },
        'DEN03_019_01': { currentStock: 1, allocated: 0 },
        'DDT01_009_01': { currentStock: 2, allocated: 0 },
        'END01_031_10': { currentStock: 5, allocated: 0 },
        'DEN18_046_04': { currentStock: 1, allocated: 0 },
        'NUS01_002_01': { currentStock: 1, allocated: 0 },
        'DDT01_010_01': { currentStock: 1, allocated: 0 },
        'DEN14_028_04': { currentStock: 1, allocated: 0 },
        'DEN14_028_05': { currentStock: 1, allocated: 0 },
        'SPE02_010_02': { currentStock: 5, allocated: 0 },
        'SPE02_010_01': { currentStock: 5, allocated: 0 },
        'GCX02_034_02': { currentStock: 1, allocated: 0 },
        'RAB01_068_01': { currentStock: 1, allocated: 0 },
        'PB_CASHBACK_100': { currentStock: 500, allocated: 0 },
        'PB_CASHBACK_150': { currentStock: 500, allocated: 0 },
        'PB_CASHBACK_200': { currentStock: 500, allocated: 0 },
        'PB_CASHBACK_250': { currentStock: 500, allocated: 0 }
    };
}
