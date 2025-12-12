const _ = require('lodash');

function transformData(data, operations) {
    console.log('[TRANSFORMER] Applying transformations...');
    
    let result = _.cloneDeep(data);
    
    for (const op of operations) {
        console.log(`[TRANSFORMER] Operation: ${op.type}`);
        
        switch (op.type) {
            case 'filter':
                result = filterData(result, op.condition);
                break;
            case 'sort':
                result = sortData(result, op.field, op.order);
                break;
            case 'group':
                result = groupData(result, op.field, op.aggregation);
                break;
            case 'aggregate':
                result = aggregateData(result, op.operations);
                break;
            case 'select':
                result = selectColumns(result, op.columns);
                break;
            case 'rename':
                result = renameColumns(result, op.mapping);
                break;
            case 'compute':
                result = computeColumn(result, op.column, op.expression);
                break;
            default:
                console.warn(`[TRANSFORMER] Unknown operation: ${op.type}`);
        }
    }
    
    console.log('[TRANSFORMER] Transformations complete');
    return result;
}

function filterData(data, condition) {
    if (typeof condition === 'function') {
        return data.filter(condition);
    }
    
    if (typeof condition === 'object') {
        return data.filter(row => {
            for (const [key, value] of Object.entries(condition)) {
                if (row[key] !== value) {
                    return false;
                }
            }
            return true;
        });
    }
    
    return data;
}

function sortData(data, field, order = 'asc') {
    return _.orderBy(data, [field], [order]);
}

function groupData(data, field, aggregation = 'count') {
    const grouped = _.groupBy(data, field);
    
    const result = [];
    for (const [key, values] of Object.entries(grouped)) {
        const entry = { [field]: key };
        
        if (aggregation === 'count') {
            entry.count = values.length;
        } else if (typeof aggregation === 'object') {
            for (const [aggField, aggFunc] of Object.entries(aggregation)) {
                const fieldValues = values.map(v => v[aggField]).filter(v => v != null);
                
                if (aggFunc === 'sum') {
                    entry[`${aggField}_sum`] = _.sum(fieldValues);
                } else if (aggFunc === 'mean' || aggFunc === 'avg') {
                    entry[`${aggField}_mean`] = _.mean(fieldValues);
                } else if (aggFunc === 'min') {
                    entry[`${aggField}_min`] = _.min(fieldValues);
                } else if (aggFunc === 'max') {
                    entry[`${aggField}_max`] = _.max(fieldValues);
                } else if (aggFunc === 'count') {
                    entry[`${aggField}_count`] = fieldValues.length;
                }
            }
        }
        
        result.push(entry);
    }
    
    return result;
}

function aggregateData(data, operations) {
    const result = {};
    
    for (const [field, func] of Object.entries(operations)) {
        const values = data.map(row => row[field]).filter(v => v != null);
        
        if (func === 'sum') {
            result[`${field}_sum`] = _.sum(values);
        } else if (func === 'mean' || func === 'avg') {
            result[`${field}_mean`] = _.mean(values);
        } else if (func === 'min') {
            result[`${field}_min`] = _.min(values);
        } else if (func === 'max') {
            result[`${field}_max`] = _.max(values);
        } else if (func === 'count') {
            result[`${field}_count`] = values.length;
        } else if (func === 'median') {
            const sorted = _.sortBy(values);
            const mid = Math.floor(sorted.length / 2);
            result[`${field}_median`] = sorted.length % 2 === 0 
                ? (sorted[mid - 1] + sorted[mid]) / 2 
                : sorted[mid];
        } else if (func === 'std') {
            const mean = _.mean(values);
            const variance = _.mean(values.map(v => Math.pow(v - mean, 2)));
            result[`${field}_std`] = Math.sqrt(variance);
        }
    }
    
    return result;
}

function selectColumns(data, columns) {
    return data.map(row => _.pick(row, columns));
}

function renameColumns(data, mapping) {
    return data.map(row => {
        const newRow = {};
        for (const [key, value] of Object.entries(row)) {
            newRow[mapping[key] || key] = value;
        }
        return newRow;
    });
}

function computeColumn(data, columnName, expression) {
    return data.map(row => {
        const newRow = { ...row };
        
        if (typeof expression === 'function') {
            newRow[columnName] = expression(row);
        } else if (typeof expression === 'string') {
            // Simple expression evaluation (be careful with eval!)
            try {
                const func = new Function('row', `with(row) { return ${expression}; }`);
                newRow[columnName] = func(row);
            } catch (error) {
                console.error('[TRANSFORMER] Error evaluating expression:', error.message);
                newRow[columnName] = null;
            }
        }
        
        return newRow;
    });
}

function pivotData(data, rowField, colField, valueField, aggFunc = 'sum') {
    const pivoted = {};
    
    for (const row of data) {
        const rowKey = row[rowField];
        const colKey = row[colField];
        const value = row[valueField];
        
        if (!pivoted[rowKey]) {
            pivoted[rowKey] = { [rowField]: rowKey };
        }
        
        if (!pivoted[rowKey][colKey]) {
            pivoted[rowKey][colKey] = [];
        }
        
        pivoted[rowKey][colKey].push(value);
    }
    
    // Apply aggregation
    const result = [];
    for (const [rowKey, rowData] of Object.entries(pivoted)) {
        const newRow = { [rowField]: rowKey };
        
        for (const [colKey, values] of Object.entries(rowData)) {
            if (colKey === rowField) continue;
            
            if (aggFunc === 'sum') {
                newRow[colKey] = _.sum(values);
            } else if (aggFunc === 'mean') {
                newRow[colKey] = _.mean(values);
            } else if (aggFunc === 'count') {
                newRow[colKey] = values.length;
            } else if (aggFunc === 'min') {
                newRow[colKey] = _.min(values);
            } else if (aggFunc === 'max') {
                newRow[colKey] = _.max(values);
            }
        }
        
        result.push(newRow);
    }
    
    return result;
}

function joinData(data1, data2, key1, key2 = null, joinType = 'inner') {
    key2 = key2 || key1;
    
    const index2 = _.keyBy(data2, key2);
    const result = [];
    
    if (joinType === 'inner') {
        for (const row1 of data1) {
            const row2 = index2[row1[key1]];
            if (row2) {
                result.push({ ...row1, ...row2 });
            }
        }
    } else if (joinType === 'left') {
        for (const row1 of data1) {
            const row2 = index2[row1[key1]];
            result.push({ ...row1, ...(row2 || {}) });
        }
    }
    
    return result;
}

module.exports = {
    transformData,
    filterData,
    sortData,
    groupData,
    aggregateData,
    selectColumns,
    renameColumns,
    computeColumn,
    pivotData,
    joinData
};