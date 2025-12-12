function validateRequest(body) {
    const errors = [];
    
    if (!body) {
        errors.push('Request body is required');
        return { valid: false, errors };
    }
    
    if (!body.email) {
        errors.push('email is required');
    } else if (!isValidEmail(body.email)) {
        errors.push('email is invalid');
    }
    
    if (!body.secret) {
        errors.push('secret is required');
    }
    
    if (!body.url) {
        errors.push('url is required');
    } else if (!isValidUrl(body.url)) {
        errors.push('url is invalid');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidUrl(url) {
    try {
        new URL(url);
        return url.startsWith('http://') || url.startsWith('https://');
    } catch (error) {
        return false;
    }
}

function validateAnswer(answer) {
    if (answer === null || answer === undefined) {
        return { valid: false, error: 'Answer cannot be null or undefined' };
    }
    
    // Check size (1MB limit)
    const size = getSize(answer);
    if (size > 1024 * 1024) {
        return { valid: false, error: 'Answer exceeds 1MB limit' };
    }
    
    return { valid: true };
}

function getSize(obj) {
    if (typeof obj === 'string') {
        return obj.length;
    } else if (typeof obj === 'number' || typeof obj === 'boolean') {
        return 8;
    } else if (typeof obj === 'object') {
        return JSON.stringify(obj).length;
    }
    return 0;
}

function sanitizeData(data) {
    if (typeof data === 'string') {
        return data.trim();
    } else if (Array.isArray(data)) {
        return data.map(sanitizeData);
    } else if (typeof data === 'object' && data !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            sanitized[key.trim()] = sanitizeData(value);
        }
        return sanitized;
    }
    return data;
}

function normalizeColumnNames(columns) {
    return columns.map(col => 
        col.trim()
           .toLowerCase()
           .replace(/[^a-z0-9]+/g, '_')
           .replace(/^_+|_+$/g, '')
    );
}

module.exports = {
    validateRequest,
    validateAnswer,
    isValidEmail,
    isValidUrl,
    sanitizeData,
    normalizeColumnNames,
    getSize
};