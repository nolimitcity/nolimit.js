#!/usr/bin/env node

const fs = require('fs');

if(process.argv.length < 4) {
    console.error('Usage:', 'node check-size file size');
    process.exit(1);
}

const file = process.argv[2];
const minSize = process.argv[3];

const stat = fs.statSync(file);

if(stat.size < minSize) {
    console.error(file, 'is', stat.size, 'bytes, which is smaller than', minSize);
    process.exit(1);
}
