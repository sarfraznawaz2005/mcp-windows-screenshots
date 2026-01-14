# MCP Windows Screenshots

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that provides screenshot capture functionality on Windows systems.

## Features

- **Full-screen screenshots**: Capture entire monitors or all monitors
- **Region screenshots**: Interactive area selection for targeted captures
- **Screenshot management**: List and manage captured screenshots
- **Image embedding**: Optional base64 image embedding in MCP responses
- **Cross-monitor support**: Handle multi-monitor setups

## Prerequisites

- **Windows OS** (currently Windows-only)
- **Node.js** >= 18.0.0
- **Helper executable**: A Windows executable (RegionSnip.exe) that handles the actual screenshot capture

## Installation

1. Clone the repository

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Ensure the helper executable exists at `bin/RegionSnip.exe`

## Usage

### As an MCP Server

This server communicates via stdio and can be used with any MCP-compatible client (like Claude Desktop).

Start the server:
```bash
npm start
```

Or with the MCP inspector for debugging:
```bash
npm run inspector
```

### Usage with npx

You can run this MCP server directly using npx without installing it globally:

#### Cursor
Add to your `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "windows-screenshots": {
      "command": "npx",
      "args": ["mcp-windows-screenshot"]
    }
  }
}
```

#### Claude Desktop
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "windows-screenshots": {
      "command": "npx",
      "args": ["mcp-windows-screenshot"]
    }
  }
}
```

#### Windsurf
Add to your `~/.codeium/windsurf/mcp_config.json`:
```json
{
  "mcpServers": {
    "windows-screenshots": {
      "command": "npx",
      "args": ["mcp-windows-screenshot"]
    }
  }
}
```

### Available Tools

#### `takeScreenshot`

Captures a full-screen screenshot.

**Parameters:**
- `mode`: Always "full" (default)
- `allMonitors`: Capture all monitors (default: true)
- `monitor`: Specific monitor number (optional)
- `includeImage`: Embed image as base64 in response (default: false)
- `timeoutMs`: Timeout in milliseconds (default: 60000)

**Example:**
```json
{
  "mode": "full",
  "allMonitors": true,
  "includeImage": true
}
```

**Response:**
```json
{
  "ok": true,
  "cancelled": false,
  "path": "screenshots/full-2024-01-14T10-53-52-000Z.png",
  "rect": {"x": 0, "y": 0, "width": 1920, "height": 1080},
  "width": 1920,
  "height": 1080,
  "mode": "full",
  "allMonitors": true,
  "monitor": null
}
```

#### `takeSelectedAreaScreenshot`

Allows interactive selection of a screen region to capture.

**Parameters:**
- `mode`: Always "region" (default)
- `includeImage`: Embed image as base64 in response (default: false)
- `timeoutMs`: Timeout in milliseconds (default: 120000)

**Example:**
```json
{
  "includeImage": true
}
```

**Response:**
```json
{
  "ok": true,
  "cancelled": false,
  "path": "screenshots/region-2024-01-14T10-53-52-000Z.png",
  "rect": {"x": 100, "y": 100, "width": 800, "height": 600},
  "width": 800,
  "height": 600,
  "mode": "region"
}
```

#### `listScreenshots`

Lists saved screenshots in the screenshots directory.

**Parameters:**
- `limit`: Maximum number of screenshots to return (default: 50, max: 200)

**Example:**
```json
{
  "limit": 10
}
```

**Response:**
```json
{
  "items": [
    {
      "path": "screenshots/region-2024-01-14T10-53-52-000Z.png",
      "sizeBytes": 245760,
      "createdAt": "2024-01-14T10:53:52.000Z"
    }
  ]
}
```

## Configuration

### Helper Executable

The server requires a helper executable at `bin/RegionSnip.exe` that supports the following command-line arguments:

- `--mode full|region`: Capture mode
- `--out <path>`: Output file path
- `--all`: Capture all monitors (full mode only)
- `--monitor <n>`: Specific monitor number (full mode only)

The executable should output JSON to stdout with the following structure:
```json
{
  "ok": true,
  "cancelled": false,
  "rect": {"x": 0, "y": 0, "width": 1920, "height": 1080},
  "width": 1920,
  "height": 1080
}
```

### Screenshots Directory

Screenshots are automatically saved to the `screenshots/` directory in the project root. This directory is created automatically if it doesn't exist.

## Development

### Building

```bash
npm run build
```

### Testing

The server can be tested using the MCP inspector:

```bash
npm run inspector
```

This starts the server and opens a debugging interface to test the available tools.

### Project Structure

```
├── src/
│   └── index.ts          # Main server implementation
├── build/                # Compiled JavaScript output
├── screenshots/          # Screenshot storage directory
├── bin/
│   └── RegionSnip.exe    # Helper executable (not included)
├── package.json
└── README.md
```
