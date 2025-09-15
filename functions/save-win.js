const { Octokit } = require("@octokit/rest");

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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
            auth: process.env.GITHUB_TOKEN // Add this to your Netlify environment variables
        });

        const owner = 'maximus-cyber109';
        const repo = 'Slot-Machine';
        const path = 'data/wins.json';

        let wins = [];
        let sha = null;

        // Try to get existing wins file
        try {
            const { data } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path
            });
            
            wins = JSON.parse(Buffer.from(data.content, 'base64').toString());
            sha = data.sha;
        } catch (error) {
            // File doesn't exist, will create new one
            console.log('Creating new wins file');
        }

        // Add new win data
        const newWin = {
            id: `WIN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            orderId: winData.orderId,
            customerEmail: winData.customerEmail,
            prize: winData.prize,
            prizeCode: winData.prizeCode,
            symbol: winData.symbol,
            timestamp: winData.timestamp,
            userAgent: event.headers['user-agent'],
            ip: event.headers['x-forwarded-for'] || 'unknown'
        };

        wins.push(newWin);

        // Update/Create file in GitHub
        const content = Buffer.from(JSON.stringify(wins, null, 2)).toString('base64');
        
        await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path,
            message: `Add win: ${newWin.id}`,
            content,
            sha: sha || undefined
        });

        // Also trigger Google Sheets update
        await updateGoogleSheets(newWin);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                winId: newWin.id,
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
    // Google Sheets integration
    const SHEET_URL = process.env.GOOGLE_SHEETS_WEBHOOK; // Add this to env vars
    
    if (!SHEET_URL) return;

    try {
        await fetch(SHEET_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId: winData.orderId,
                email: winData.customerEmail,
                prize: winData.prize,
                code: winData.prizeCode,
                symbol: winData.symbol,
                timestamp: winData.timestamp,
                ip: winData.ip
            })
        });
    } catch (error) {
        console.error('Google Sheets update failed:', error);
    }
}
