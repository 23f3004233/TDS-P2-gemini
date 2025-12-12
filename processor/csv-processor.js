const Papa = require('papaparse');
const XLSX = require('xlsx');

async function processCSV(buffer) {
    console.log('[CSV] Processing CSV file...');
    
    try {
        const csvText = buffer.toString('utf-8');
        
        const result = Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim()
        });

        if (result.errors.length > 0) {
            console.warn('[CSV] Parse warnings:', result.errors);
        }

        console.log(`[CSV] Parsed ${result.data.length} rows, ${result.meta.fields.length} columns`);
        console.log(`[CSV] Columns:`, result.meta.fields);

        return {
            data: result.data,
            columns: result.meta.fields,
            rowCount: result.data.length,
            summary: generateSummary(result.data, result.meta.fields)
        };
    } catch (error) {
        console.error('[CSV] Error processing CSV:', error.message);
        throw error;
    }
}

async function processExcel(buffer) {
    console.log('[EXCEL] Processing Excel file...');
    
    try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            raw: false,
            defval: null
        });

        const columns = Object.keys(jsonData[0] || {});
        
        console.log(`[EXCEL] Parsed ${jsonData.length} rows, ${columns.length} columns from sheet "${sheetName}"`);
        console.log(`[EXCEL] Columns:`, columns);

        return {
            data: jsonData,
            columns: columns,
            rowCount: jsonData.length,
            sheetName: sheetName,
            allSheets: workbook.SheetNames,
            summary: generateSummary(jsonData, columns)
        };
    } catch (error) {
        console.error('[EXCEL] Error processing Excel:', error.message);
        throw error;
    }
}

function generateSummary(data, columns) {
    if (!data || data.length === 0) {
        return 'No data';
    }

    const summary = {
        rowCount: data.length,
        columns: {}
    };

    for (const col of columns) {
        const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined && v !== '');
        const numericValues = values.filter(v => typeof v === 'number' || !isNaN(Number(v))).map(Number);

        summary.columns[col] = {
            type: numericValues.length > values.length * 0.5 ? 'numeric' : 'text',
            nonNullCount: values.length,
            uniqueCount: new Set(values).size,
            sample: values.slice(0, 5)
        };

        if (numericValues.length > 0) {
            summary.columns[col].min = Math.min(...numericValues);
            summary.columns[col].max = Math.max(...numericValues);
            summary.columns[col].sum = numericValues.reduce((a, b) => a + b, 0);
            summary.columns[col].mean = summary.columns[col].sum / numericValues.length;
        }
    }

    return summary;
}

module.exports = {
    processCSV,
    processExcel
};