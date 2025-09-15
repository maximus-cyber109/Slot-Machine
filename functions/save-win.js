const { Octokit } = require("@octokit/rest");

exports.handler = async (event, context) => {
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
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const winData = JSON.parse(event.body);

        // Initialize GitHub API
        const octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN
        });

        const owner = 'maximus-cyber109';
        const repo = 'Slot-Machine';
        const path = 'data/wins.json';

        let wins = [];
        let sha = null;

        // Get existing wins
        try {
            const { data } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path
            });
            
            wins = JSON.parse(Buffer.from(data.content, 'base64').toString());
            sha = data.sha;
        } catch (error) {
            console.log('Creating new wins file');
        }

        // Enhanced win data with auto-detection info
        const enhancedWinData = {
            id: `WIN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            orderId: winData.orderId,
            customerEmail: winData.customerEmail,
            customerName: winData.customerName,
            customerId: winData.customerId,
            sessionId: winData.sessionId,
            prize: winData.prize,
            prizeCode: winData.prizeCode,
            symbol: winData.symbol,
            timestamp: new Date().toISOString(),
            orderAmount: winData.orderAmount,
            detectionMethod: winData.detectionMethod,
            ip: event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown',
            country: event.headers['cf-ipcountry'] || 'unknown',
            userAgent: event.headers['user-agent'] || 'unknown',
            source: 'magento_auto_detection'
        };

        wins.push(enhancedWinData);

        // Keep only last 1000 wins
        if (wins.length > 1000) {
            wins = wins.slice(-1000);
        }

        // Update GitHub file
        const content = Buffer.from(JSON.stringify(wins, null, 2)).toString('base64');
        
        await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path,
            message: `Auto Win: ${enhancedWinData.prize} - ${enhancedWinData.customerName || 'Customer'} - ${enhancedWinData.detectionMethod}`,
            content,
            sha: sha || undefined
        });

        // Update Google Sheets if configured
        await updateGoogleSheets(enhancedWinData);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                winId: enhancedWinData.id,
                message: 'Win saved successfully'
            })
        };

    } catch (error) {
        console.error('Error saving win:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};

async function updateGoogleSheets(winData) {
    const SHEET_URL = process.env.GOOGLE_SHEETS_WEBHOOK;
    
    if (!SHEET_URL) return;

    try {
        await fetch(SHEET_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                timestamp: winData.timestamp,
                orderId: winData.orderId,
                customerName: winData.customerName,
                email: winData.customerEmail,
                prize: winData.prize,
                code: winData.prizeCode,
                symbol: winData.symbol,
                detectionMethod: winData.detectionMethod,
                orderAmount: winData.orderAmount,
                ip: winData.ip,
                country: winData.country
            })
        });
    } catch (error) {
        console.error('Google Sheets update failed:', error);
    }
}
