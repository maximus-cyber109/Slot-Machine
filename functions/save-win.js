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

        // Enhanced win data
        const enhancedWinData = {
            id: `WIN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            orderId: winData.orderId,
            customerEmail: winData.customerEmail,
            customerName: winData.customerName,
            sessionId: winData.sessionId,
            prize: winData.prize,
            prizeCode: winData.prizeCode,
            symbol: winData.symbol,
            timestamp: new Date().toISOString(),
            orderAmount: winData.orderAmount,
            ip: event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown',
            country: event.headers['cf-ipcountry'] || 'unknown',
            source: 'auto_detection'
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
            message: `Auto Win: ${enhancedWinData.prize} - ${enhancedWinData.customerName || 'Customer'} - Order #${enhancedWinData.orderId}`,
            content,
            sha: sha || undefined
        });

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
