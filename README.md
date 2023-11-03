# Solidity Signature Decoder

This Node.js script recursively scans through all `.sol` (Solidity) files in a given directory and its subdirectories, calculates the keccak256 signatures for all detected functions, custom errors, and require statements. The results are output in a markdown-formatted file.

## Use Cases

- Verifying smart contract interfaces for consistency.
- Detecting selector and error signature collisions in contracts.
- Auto-generating documentation of contract functions and errors.
- Integrating with CI/CD pipelines for pre-deployment checks.

## Features

- Recursively scans a directory for `.sol` files.
- Calculates keccak256 signatures for:
  - Solidity functions.
  - Solidity custom errors.
  - Solidity `require` statement conditions and messages.
- Outputs results in a markdown file with a clear structure.

## Requirements

- Node.js
- NPM or Yarn
- `web3` package
- `dotenv` package for environment variables management

## Installation

Before running the script, you need to install the necessary Node.js packages:

```bash
npm install web3 dotenv
```

Or if you are using Yarn:

```bash
yarn add web3 dotenv
```

Ensure that you have a `.env` file in your project root containing your Websocket URL:

```
WSS_URL=wss://your-websocket-endpoint
```

## Usage

To use this script, run it with Node.js, passing in the directory path to scan and the desired output file path for the markdown report.

```bash
node script.js <directoryPath> <outputFilePath>
```

Example:

```bash
node script.js "./contracts" "./signatures.md"
```

The script will:

1. Connect to the Ethereum blockchain using the Websocket URL specified in the `.env` file.
2. Read `.sol` files from the specified directory and subdirectories.
3. Calculate signatures for functions, custom errors, and require statements.
4. Output the signatures into the specified markdown file.

## Output Format

The output markdown file will have the following format:

```markdown
### Relative/Path/To/Contract.sol

#### Functions:
- Line 23: `functionName(type1,type2,...)` | Selector: `0xSignature`

#### Custom Errors:
- Line 42: `ErrorName(type1,type2,...)` | Signature: `0xSignature`

#### Require Statements:
- Line 69: `require(condition, "error message")` | Signature: `0xSignature`

---
```

Each contract file will be separated by horizontal rules for clarity.


## TODO
- Create check for function selector collisions 
