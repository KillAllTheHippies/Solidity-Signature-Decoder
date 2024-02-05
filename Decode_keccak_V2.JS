const fsp = require('fs').promises; // For Promise-based file operations
const fs = require('fs'); // For synchronous file operations
const path = require('path'); // For handling file paths
const { Web3 } = require('web3'); // Web3 for blockchain interactions and utilities
require('dotenv').config(); // To load environment variables from a .env file

// Initialize Web3 with a WebSocket provider from environment variables
const web3 = new Web3(process.env.WSS_URL);

// Process command-line arguments to get directory and output file paths
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node script.js <directoryPath> <outputFilePath>');
  process.exit(1);
}

const directoryPath = args[0]; // Path to the directory containing Solidity files
const outputFilePath = args[1]; // Path for the output markdown file

// Create a write stream for the output file, handling errors gracefully
let outputFile;
try {
  outputFile = fs.createWriteStream(outputFilePath);
} catch (err) {
  console.error('Error creating write stream:', err);
  process.exit(1);
}

// Function to calculate the keccak256 hash of a given text, returning the first 10 characters
const getKeccak256 = (text) => {
  return web3.utils.keccak256(text).slice(0, 10);
};

// Function to construct the canonical form of a function or error for hashing
const getCanonicalForm = (name, inputs) => {
  const types = inputs.map(input => input.trim().match(/(\w+)(\s+\w+)?(\[\])?$/)[1]);
  return `${name}(${types.join(',')})`;
};

// Function to write the markdown formatted output for functions, errors, and requires
const writeMarkdown = (filePath, functions, errors, requires, getters) => {
  const relativePath = path.relative(directoryPath, filePath);
  outputFile.write(`### ${relativePath}\n\n`);

  if (functions.length > 0) {
    outputFile.write(`#### Functions:\n`);
    functions.forEach(fn => outputFile.write(`- Line ${fn.line}: \`${fn.text}\` | Selector: \`${fn.signature}\`\n`));
    outputFile.write(`\n`);
  }

  if (getters.length > 0) {
    outputFile.write(`#### Getters (for public variables):\n`);
    getters.forEach(getter => outputFile.write(`- \`${getter.text}\` | Selector: \`${getter.signature}\`\n`));
    outputFile.write(`\n`);
  }

  if (errors.length > 0) {
    outputFile.write(`#### Custom Errors:\n`);
    errors.forEach(err => outputFile.write(`- Line ${err.line}: \`${err.text}\` | Signature: \`${err.signature}\`\n`));
    outputFile.write(`\n`);
  }

  if (requires.length > 0) {
    outputFile.write(`#### Require Statements:\n`);
    requires.forEach(req => outputFile.write(`- Line ${req.line}: \`${req.text}\` | Signature: \`${req.signature}\`\n`));
    outputFile.write(`\n`);
  }

  outputFile.write(`---\n\n`); // Add a separator for readability
};

// Function to analyze source code lines for functions, errors, requires, and public variables
const calculateSignatures = (source, filePath) => {
  const lines = source.split('\n');
  let functions = [];
  let errors = [];
  let requires = [];
  let getters = []; // To store detected getters for public variables

  lines.forEach((line, index) => {
    const functionMatch = line.match(/function\s+(\w+)\s*\((.*?)\)\s*/);
    if (functionMatch) {
      const [_, name, params = ''] = functionMatch;
      const inputs = params.split(',').filter(Boolean);
      const canonicalForm = getCanonicalForm(name, inputs);
      const signature = getKeccak256(canonicalForm);
      functions.push({ line: index + 1, text: canonicalForm, signature });
    }

    const errorMatch = line.match(/error\s+(\w+)\s*\((.*?)\);/);
    if (errorMatch) {
      const [_, name, params = ''] = errorMatch;
      const inputs = params.split(',').filter(Boolean);
      const canonicalForm = getCanonicalForm(name, inputs);
      const signature = getKeccak256(canonicalForm);
      errors.push({ line: index + 1, text: canonicalForm, signature });
    }

    const requireMatch = line.match(/require\((.*?),\s*"(.*?)"\);\s*/);
    if (requireMatch) {
      const [_, condition, errorMessage] = requireMatch;
      const errorSignature = getKeccak256(errorMessage);
      requires.push({ line: index + 1, text: `require(${condition}, "${errorMessage}")`, signature: errorSignature });
    }

    // Detect public state variables for getter generation
    const publicVarMatch = line.match(/\bpublic\b/);
    if (publicVarMatch) {
      const varMatch = line.match(/\b(\w+)\s+(\w+)\s*=\s*(.*);/);
      if (varMatch) {
        const [_, type, name] = varMatch;
        const canonicalForm = getCanonicalForm(name, [type]);
        const signature = getKeccak256(canonicalForm);
        getters.push({ text: canonicalForm, signature });
      }
    }
  });

  writeMarkdown(filePath, functions, errors, requires, getters);
};

// Recursive function to read files from a directory and its subdirectories
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

// Main function to start processing
(async () => {
  try {
    await readFilesRecursively(directoryPath);
    console.log('Finished processing all files.');
  } catch (err) {
    console.error('Error during file processing:', err);
  } finally {
    outputFile.end(); // Close the output file stream
  }
})();
