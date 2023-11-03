const fsp = require('fs').promises; // For Promise-based operations
const fs = require('fs'); // For createWriteStream
const path = require('path');
const { Web3 } = require('web3'); // Make sure this matches the export of web3 in your installed package
require('dotenv').config();
// Websocket Connection as per your specification
const web3 = new Web3(process.env.WSS_URL);

// Get command-line arguments for directory and output file
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node script.js <directoryPath> <outputFilePath>');
  process.exit(1);
}
const directoryPath = args[0]; // First argument: directory path
const outputFilePath = args[1]; // Second argument: output file path

// Ensure the output file stream is created correctly
let outputFile;
try {
  outputFile = fs.createWriteStream(outputFilePath);
} catch (err) {
  console.error('Error creating write stream:', err);
  process.exit(1);
}
// Function to calculate the keccak256 hash of the canonical form or error message
const getKeccak256 = (text) => {
  return web3.utils.keccak256(text).slice(0, 10); // Only the first 4 bytes (8 characters + '0x' prefix)
};

// Function to get the canonical form of function or error
const getCanonicalForm = (name, inputs) => {
  const types = inputs.map(input => {
    const match = input.trim().match(/(\w+)(\s+\w+)?(\[\])?$/);
    return match ? match[1] + (match[3] || '') : '';
  });
  return `${name}(${types.join(',')})`;
};

// Function to write a markdown formatted output
const writeMarkdown = (filePath, functions, errors, requires) => {
  const relativePath = path.relative(directoryPath, filePath);
  outputFile.write(`### ${relativePath}\n\n`);

  if (functions.length > 0) {
    outputFile.write(`#### Functions:\n`);
    functions.forEach(fn => {
      outputFile.write(`- Line ${fn.line}: \`${fn.text}\` | Selector: \`${fn.signature}\`\n`);
    });
    outputFile.write(`\n`);
  }

  if (errors.length > 0) {
    outputFile.write(`#### Custom Errors:\n`);
    errors.forEach(err => {
      outputFile.write(`- Line ${err.line}: \`${err.text}\` | Signature: \`${err.signature}\`\n`);
    });
    outputFile.write(`\n`);
  }

  if (requires.length > 0) {
    outputFile.write(`#### Require Statements:\n`);
    requires.forEach(req => {
      outputFile.write(`- Line ${req.line}: \`${req.text}\` | Signature: \`${req.signature}\`\n`);
    });
    outputFile.write(`\n`);
  }

  outputFile.write(`---\n\n`); // Markdown horizontal rule for separation
};

// Function to calculate signatures and organize them in markdown format
const calculateSignatures = (source, filePath) => {
  const lines = source.split('\n');
  let functions = [];
  let errors = [];
  let requires = [];
  
  lines.forEach((line, index) => {
    // Match function
    const functionMatch = line.match(/function\s+(\w+)\s*\((.*?)\)\s*/);
    if (functionMatch) {
      const name = functionMatch[1];
      const params = functionMatch[2] || '';
      const inputs = params.split(',').filter(Boolean); // Filter out empty strings
      const canonicalForm = getCanonicalForm(name, inputs);
      const signature = getKeccak256(canonicalForm);
      functions.push({
        line: index + 1,
        text: canonicalForm,
        signature: signature
      });
    }

    // Match custom error
    const errorMatch = line.match(/error\s+(\w+)\s*\((.*?)\);/);
    if (errorMatch) {
      const name = errorMatch[1];
      const params = errorMatch[2] || '';
      const inputs = params.split(',').filter(Boolean); // Filter out empty strings
      const canonicalForm = getCanonicalForm(name, inputs);
      const signature = getKeccak256(canonicalForm);
      errors.push({
        line: index + 1,
        text: canonicalForm,
        signature: signature
      });
    }

    // Match require statement
    const requireMatch = line.match(/require\((.*?),\s*"(.*?)"\);\s*/);
    if (requireMatch) {
      const condition = requireMatch[1];
      const errorMessage = requireMatch[2];
      const errorSignature = getKeccak256(errorMessage);
      requires.push({
        line: index + 1,
        text: `require(${condition}, "${errorMessage}")`,
        signature: errorSignature
      });
    }
  });

  writeMarkdown(filePath, functions, errors, requires);
};

// Function to recursively read all files in a directory and its subdirectories
async function readFilesRecursively(dir) {
  const items = await fsp.readdir(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      await readFilesRecursively(fullPath);
    } else if (item.isFile() && path.extname(fullPath) === '.sol') {
      try {
        const content = await fsp.readFile(fullPath, 'utf8');
        calculateSignatures(content, fullPath);
      } catch (err) {
        console.error(`Error processing file ${fullPath}:`, err);
      }
    }
  }
}

// Start reading files and calculating signatures
(async () => {
  try {
    await readFilesRecursively(directoryPath);
    console.log('Finished processing all files.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    outputFile.end(); // Ensure to close the stream when done
  }
})();




